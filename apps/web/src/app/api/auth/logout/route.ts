import { NextRequest, NextResponse } from "next/server";

import { CSRF_COOKIE, SESSION_COOKIE, verifyCsrf } from "../../../../lib/auth";
import { assertSameOrigin, consumeAbuseBudget } from "../../../../lib/security";

export async function OPTIONS(request: NextRequest) {
  return assertSameOrigin(request)
    ? new NextResponse(null, { status: 204 })
    : new NextResponse(null, { status: 403 });
}

export function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const limit = consumeAbuseBudget(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const submittedToken = request.headers.get("x-csrf-token");
  if (!verifyCsrf(cookieToken, submittedToken)) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(CSRF_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
