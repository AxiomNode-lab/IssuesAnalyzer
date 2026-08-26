\set ON_ERROR_STOP on

DO $$
DECLARE
  user_one uuid;
  user_two uuid;
  issue_one uuid;
  report_one uuid;
BEGIN
  INSERT INTO users (github_user_id, github_login)
  VALUES (1001, 'first-user')
  RETURNING id INTO user_one;

  INSERT INTO users (github_user_id, github_login)
  VALUES (1002, 'second-user')
  RETURNING id INTO user_two;

  INSERT INTO profiles (user_id, display_name)
  VALUES (user_one, 'First User');

  INSERT INTO github_issues (
    repository_owner,
    repository_name,
    issue_number,
    issue_url,
    title,
    state
  ) VALUES (
    'owner',
    'repo',
    42,
    'https://github.com/owner/repo/issues/42',
    'Example issue',
    'open'
  ) RETURNING id INTO issue_one;

  INSERT INTO evidence_snapshots (
    github_issue_id,
    evidence_version,
    source,
    payload,
    collected_at,
    fingerprint
  ) VALUES (
    issue_one,
    'evidence-v1',
    'github-rest',
    '{"activity":true}'::jsonb,
    now(),
    'fingerprint-1'
  );

  INSERT INTO reports (
    user_id,
    github_issue_id,
    score_model_version,
    report_version,
    score,
    verdict,
    confidence,
    report_payload,
    idempotency_key
  ) VALUES (
    user_one,
    issue_one,
    'opportunity-score-v1',
    'report-v1',
    72,
    'pursue',
    'high',
    '{"score":72}'::jsonb,
    'report-request-1'
  ) RETURNING id INTO report_one;

  INSERT INTO saved_opportunities (
    user_id,
    github_issue_id,
    latest_report_id
  ) VALUES (
    user_one,
    issue_one,
    report_one
  );

  INSERT INTO jobs (
    owner_user_id,
    github_issue_id,
    kind,
    idempotency_key
  ) VALUES (
    user_one,
    issue_one,
    'refresh-analysis',
    'refresh-1'
  );

  INSERT INTO audit_events (
    actor_user_id,
    subject_user_id,
    action,
    resource_type,
    resource_id,
    request_id
  ) VALUES (
    user_one,
    user_one,
    'report.saved',
    'report',
    report_one::text,
    'request-1'
  );

  IF (SELECT count(*) FROM saved_opportunities WHERE user_id = user_one) <> 1 THEN
    RAISE EXCEPTION 'saved opportunity ownership was not persisted';
  END IF;

  IF (SELECT count(*) FROM saved_opportunities WHERE user_id = user_two) <> 0 THEN
    RAISE EXCEPTION 'saved opportunity leaked across owners';
  END IF;
END $$;

DO $$
DECLARE
  issue_one uuid;
BEGIN
  SELECT id INTO issue_one
  FROM github_issues
  WHERE repository_owner = 'owner'
    AND repository_name = 'repo'
    AND issue_number = 42;

  BEGIN
    INSERT INTO evidence_snapshots (
      github_issue_id,
      evidence_version,
      source,
      payload,
      collected_at,
      fingerprint
    ) VALUES (
      issue_one,
      'evidence-v1',
      'github-rest',
      '{}'::jsonb,
      now(),
      'fingerprint-1'
    );
    RAISE EXCEPTION 'duplicate evidence fingerprint unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;

DO $$
DECLARE
  user_one uuid;
  issue_one uuid;
BEGIN
  SELECT id INTO user_one FROM users WHERE github_user_id = 1001;
  SELECT id INTO issue_one
  FROM github_issues
  WHERE repository_owner = 'owner'
    AND repository_name = 'repo'
    AND issue_number = 42;

  BEGIN
    INSERT INTO reports (
      user_id,
      github_issue_id,
      score_model_version,
      report_version,
      score,
      verdict,
      confidence,
      report_payload,
      idempotency_key
    ) VALUES (
      user_one,
      issue_one,
      'opportunity-score-v1',
      'report-v1',
      73,
      'pursue',
      'high',
      '{}'::jsonb,
      'report-request-1'
    );
    RAISE EXCEPTION 'duplicate report idempotency key unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO github_issues (
      repository_owner,
      repository_name,
      issue_number,
      issue_url,
      title,
      state
    ) VALUES (
      'owner',
      'repo',
      0,
      'https://github.com/owner/repo/issues/0',
      'Invalid issue',
      'open'
    );
    RAISE EXCEPTION 'invalid issue number unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;
