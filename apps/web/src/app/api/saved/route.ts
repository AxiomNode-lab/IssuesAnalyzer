import { NextRequest, NextResponse } from "next/server";

import { CSRF_COOKIE, SESSION_COOKIE, decodeSession, verifyCsrf } from "../../../lib/auth";
import { listSavedOpportunities, saveOpportunity } from "../../../lib/database";
import { assertSameOrigin, consumeAbuseBudget, readBoundedJson } from "../../../lib/security";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sessionFor(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return decodeSession(request.cookies.get(SESSION_COOKIE)?.value, secret);
}

function crossOrigin() {
  return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
}

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function OPTIONS(request: NextRequest) {
  return assertSameOrigin(request)
    ? new NextResponse(null, { status: 204 })
    : new NextResponse(null, { status: 403 });
}

export async function GET(request: NextRequest) {
  if (!assertSameOrigin(request)) return crossOrigin();
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const limit = await consumeAbuseBudget(request, session.user.userId);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  return NextResponse.json({ items: await listSavedOpportunities(session.user.userId) });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return crossOrigin();
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const limit = await consumeAbuseBudget(request, session.user.userId);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token"))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  let body: { githubIssueId?: unknown; latestReportId?: unknown };
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.githubIssueId !== "string" || !UUID_PATTERN.test(body.githubIssueId)) {
    return NextResponse.json({ error: "A valid githubIssueId is required." }, { status: 400 });
  }
  if (
    body.latestReportId !== undefined &&
    (typeof body.latestReportId !== "string" || !UUID_PATTERN.test(body.latestReportId))
  ) {
    return NextResponse.json({ error: "latestReportId must be a UUID." }, { status: 400 });
  }

  try {
    const saved = await saveOpportunity({
      userId: session.user.userId,
      githubIssueId: body.githubIssueId,
      ...(typeof body.latestReportId === "string" ? { latestReportId: body.latestReportId } : {}),
    });
    return NextResponse.json({ item: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_NOT_OWNED") {
      return NextResponse.json(
        { error: "Report does not belong to this account." },
        { status: 403 },
      );
    }
    throw error;
  }
}
