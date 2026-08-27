import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, decodeSession } from "../../../../lib/auth";
import { exportAccount } from "../../../../lib/database";
import { assertSameOrigin, consumeAbuseBudget } from "../../../../lib/security";

export async function OPTIONS(request: NextRequest) {
  return assertSameOrigin(request)
    ? new NextResponse(null, { status: 204 })
    : new NextResponse(null, { status: 403 });
}

export async function GET(request: NextRequest) {
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

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      account: await exportAccount(session.user.userId),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="opportunity-radar-account.json"',
      },
    },
  );
}
