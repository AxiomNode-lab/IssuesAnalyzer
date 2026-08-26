import postgres from "postgres";

import type { SessionUser } from "./auth";

type Sql = ReturnType<typeof postgres>;

let client: Sql | undefined;

function database(): Sql {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  client ??= postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.NODE_ENV === "production" ? "require" : false,
  });
  return client;
}

export async function upsertGithubUser(input: {
  githubUserId: number;
  login: string;
  avatarUrl?: string;
}): Promise<SessionUser> {
  const sql = database();
  const rows = await sql<{ id: string; github_user_id: number; github_login: string }[]>`
    INSERT INTO users (github_user_id, github_login)
    VALUES (${input.githubUserId}, ${input.login})
    ON CONFLICT (github_user_id) DO UPDATE
      SET github_login = EXCLUDED.github_login,
          updated_at = now(),
          deleted_at = NULL
    RETURNING id, github_user_id, github_login
  `;
  const user = rows[0];
  if (!user) throw new Error("Failed to persist GitHub user.");

  await sql`
    INSERT INTO profiles (user_id, avatar_url)
    VALUES (${user.id}::uuid, ${input.avatarUrl ?? null})
    ON CONFLICT (user_id) DO UPDATE
      SET avatar_url = EXCLUDED.avatar_url,
          updated_at = now()
  `;

  return {
    userId: user.id,
    githubUserId: Number(user.github_user_id),
    login: user.github_login,
    ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
  };
}

export async function listSavedOpportunities(userId: string) {
  const sql = database();
  return sql`
    SELECT
      so.id,
      so.status,
      so.notes,
      so.created_at,
      so.updated_at,
      gi.id AS github_issue_id,
      gi.repository_owner,
      gi.repository_name,
      gi.issue_number,
      gi.issue_url,
      gi.title,
      so.latest_report_id
    FROM saved_opportunities so
    JOIN github_issues gi ON gi.id = so.github_issue_id
    WHERE so.user_id = ${userId}::uuid
    ORDER BY so.updated_at DESC, so.id DESC
  `;
}

export async function saveOpportunity(input: {
  userId: string;
  githubIssueId: string;
  latestReportId?: string;
}) {
  const sql = database();
  if (input.latestReportId) {
    const ownedReport = await sql`
      SELECT id
      FROM reports
      WHERE id = ${input.latestReportId}::uuid
        AND user_id = ${input.userId}::uuid
        AND github_issue_id = ${input.githubIssueId}::uuid
      LIMIT 1
    `;
    if (ownedReport.length === 0) throw new Error("REPORT_NOT_OWNED");
  }

  const rows = await sql`
    INSERT INTO saved_opportunities (user_id, github_issue_id, latest_report_id)
    VALUES (
      ${input.userId}::uuid,
      ${input.githubIssueId}::uuid,
      ${input.latestReportId ?? null}::uuid
    )
    ON CONFLICT (user_id, github_issue_id) DO UPDATE
      SET latest_report_id = COALESCE(EXCLUDED.latest_report_id, saved_opportunities.latest_report_id),
          updated_at = now()
    RETURNING id, user_id, github_issue_id, latest_report_id, status, notes, created_at, updated_at
  `;
  return rows[0];
}

export async function deleteSavedOpportunity(
  userId: string,
  savedOpportunityId: string,
): Promise<boolean> {
  const sql = database();
  const deleted = await sql`
    DELETE FROM saved_opportunities
    WHERE id = ${savedOpportunityId}::uuid
      AND user_id = ${userId}::uuid
    RETURNING id
  `;
  return deleted.length === 1;
}

export async function exportAccount(userId: string) {
  const sql = database();
  const [user, profile, saved, reports] = await Promise.all([
    sql`SELECT id, github_user_id, github_login, created_at, updated_at FROM users WHERE id = ${userId}::uuid AND deleted_at IS NULL`,
    sql`SELECT display_name, avatar_url, timezone, created_at, updated_at FROM profiles WHERE user_id = ${userId}::uuid`,
    listSavedOpportunities(userId),
    sql`
      SELECT id, github_issue_id, score_model_version, report_version, score, verdict, confidence,
             report_payload, generated_at, created_at
      FROM reports
      WHERE user_id = ${userId}::uuid
      ORDER BY generated_at DESC
    `,
  ]);
  return { user: user[0] ?? null, profile: profile[0] ?? null, savedOpportunities: saved, reports };
}

export async function deleteAccount(userId: string): Promise<boolean> {
  const sql = database();
  return sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO audit_events (actor_user_id, subject_user_id, action, resource_type, resource_id)
      VALUES (${userId}::uuid, ${userId}::uuid, 'account.delete', 'user', ${userId})
    `;
    const deleted = await transaction`DELETE FROM users WHERE id = ${userId}::uuid RETURNING id`;
    return deleted.length === 1;
  });
}
