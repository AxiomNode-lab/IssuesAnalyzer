import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, decodeSession } from "../../../../lib/auth";
import { exportAccount } from "../../../../lib/database";

export async function GET(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const session = secret
    ? await decodeSession(request.cookies.get(SESSION_COOKIE)?.value, secret)
    : null;
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

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
