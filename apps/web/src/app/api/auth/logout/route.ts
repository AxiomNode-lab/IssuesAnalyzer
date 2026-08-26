import { NextRequest, NextResponse } from "next/server";

import { CSRF_COOKIE, SESSION_COOKIE, verifyCsrf } from "../../../../lib/auth";

export function POST(request: NextRequest) {
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
