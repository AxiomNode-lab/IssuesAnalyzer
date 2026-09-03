import { NextRequest, NextResponse } from "next/server";

import {
  CSRF_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  encodeSession,
  randomToken,
  type Session,
  verifyOAuthState,
} from "../../../../../lib/auth";
import { upsertGithubUser } from "../../../../../lib/database";
import { githubOAuthFetch } from "../../../../../lib/github-oauth";
import { applicationOrigin } from "../../../../../lib/runtime-config";
import { consumeAbuseBudget } from "../../../../../lib/security";

type GitHubTokenResponse = { access_token?: string; error?: string };
type GitHubUserResponse = { id?: number; login?: string; avatar_url?: string };

export async function GET(request: NextRequest) {
  const limit = await consumeAbuseBudget(request);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !verifyOAuthState(expectedState, state)) {
    return NextResponse.json({ error: "Invalid OAuth state." }, { status: 400 });
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !sessionSecret || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "OAuth is not configured." }, { status: 503 });
  }

  const origin = applicationOrigin(request.nextUrl.origin);
  const redirectUri = `${origin}/api/auth/github/callback`;
  let tokenResponse: Response;
  try {
    tokenResponse = await githubOAuthFetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
  } catch {
    return NextResponse.json({ error: "GitHub token exchange failed." }, { status: 502 });
  }
  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "GitHub token exchange failed." }, { status: 502 });
  }

  const token = (await tokenResponse.json()) as GitHubTokenResponse;
  if (!token.access_token) {
    return NextResponse.json({ error: "GitHub did not return an access token." }, { status: 502 });
  }

  let userResponse: Response;
  try {
    userResponse = await githubOAuthFetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token.access_token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    return NextResponse.json({ error: "GitHub user lookup failed." }, { status: 502 });
  }
  if (!userResponse.ok) {
    return NextResponse.json({ error: "GitHub user lookup failed." }, { status: 502 });
  }

  const githubUser = (await userResponse.json()) as GitHubUserResponse;
  if (!Number.isSafeInteger(githubUser.id) || !githubUser.login) {
    return NextResponse.json(
      { error: "GitHub returned an invalid user identity." },
      { status: 502 },
    );
  }

  const persistedUser = await upsertGithubUser({
    githubUserId: githubUser.id as number,
    login: githubUser.login,
    ...(githubUser.avatar_url ? { avatarUrl: githubUser.avatar_url } : {}),
  });
  const now = Date.now();
  const session: Session = {
    user: persistedUser,
    issuedAt: now,
    expiresAt: now + 8 * 60 * 60 * 1000,
  };

  const response = NextResponse.redirect(origin);
  response.cookies.set(SESSION_COOKIE, await encodeSession(session, sessionSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60,
    path: "/",
  });
  response.cookies.set(CSRF_COOKIE, randomToken(), {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60,
    path: "/",
  });
  response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/api/auth/github" });
  return response;
}
