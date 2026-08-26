import { NextRequest, NextResponse } from "next/server";

import { OAUTH_STATE_COOKIE, buildGithubAuthorizeUrl, randomToken } from "../../../../../lib/auth";

export function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "OAuth is not configured." }, { status: 503 });

  const state = randomToken();
  const redirectUri = `${process.env.APP_ORIGIN ?? request.nextUrl.origin}/api/auth/github/callback`;
  const response = NextResponse.redirect(buildGithubAuthorizeUrl({ clientId, redirectUri, state }));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/auth/github",
  });
  return response;
}
