import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, decodeSession } from "../../../../lib/auth";
import { consumeAbuseBudget } from "../../../../lib/security";

export async function GET(request: NextRequest) {
  const limit = await consumeAbuseBudget(request);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.json({ authenticated: false }, { status: 200 });
  const session = await decodeSession(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 200 });
  return NextResponse.json({ authenticated: true, user: session.user }, { status: 200 });
}
