import { NextRequest, NextResponse } from "next/server";

import { CSRF_COOKIE, SESSION_COOKIE, decodeSession, verifyCsrf } from "../../../../lib/auth";
import { deleteSavedOpportunity } from "../../../../lib/database";
import { assertSameOrigin, consumeAbuseBudget } from "../../../../lib/security";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function OPTIONS(request: NextRequest) {
  return assertSameOrigin(request)
    ? new NextResponse(null, { status: 204 })
    : new NextResponse(null, { status: 403 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid saved opportunity id." }, { status: 400 });
  }
  const deleted = await deleteSavedOpportunity(session.user.userId, id);
  if (!deleted)
    return NextResponse.json({ error: "Saved opportunity not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
