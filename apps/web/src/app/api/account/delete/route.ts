import { NextRequest, NextResponse } from "next/server";

import { CSRF_COOKIE, SESSION_COOKIE, decodeSession, verifyCsrf } from "../../../../lib/auth";
import { deleteAccount } from "../../../../lib/database";
import { assertSameOrigin, consumeAbuseBudget } from "../../../../lib/security";

export async function OPTIONS(request: NextRequest) {
  return assertSameOrigin(request)
    ? new NextResponse(null, { status: 204 })
    : new NextResponse(null, { status: 403 });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const secret = process.env.SESSION_SECRET;
  const session = secret
    ? await decodeSession(request.cookies.get(SESSION_COOKIE)?.value, secret)
    : null;
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const limit = consumeAbuseBudget(request, session.user.userId);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token"))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const deleted = await deleteAccount(session.user.userId);
  if (!deleted) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(CSRF_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
