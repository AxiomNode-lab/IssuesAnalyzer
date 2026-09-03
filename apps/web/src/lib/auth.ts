export const SESSION_COOKIE = "gor_session";
export const CSRF_COOKIE = "gor_csrf";
export const OAUTH_STATE_COOKIE = "gor_oauth_state";

export type SessionUser = Readonly<{
  userId: string;
  githubUserId: number;
  login: string;
  avatarUrl?: string;
}>;

export type Session = Readonly<{
  user: SessionUser;
  issuedAt: number;
  expiresAt: number;
}>;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export async function encodeSession(session: Session, secret: string): Promise<string> {
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function decodeSession(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<Session | null> {
  if (!value || secret.length < 32) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = await hmac(secret, payload);
  if (!constantTimeEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Session;
    if (
      typeof parsed.user?.userId !== "string" ||
      parsed.user.userId.length === 0 ||
      typeof parsed.user.githubUserId !== "number" ||
      !Number.isSafeInteger(parsed.user.githubUserId) ||
      typeof parsed.user.login !== "string" ||
      parsed.user.login.length === 0 ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now ||
      parsed.issuedAt > now + 60_000
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64Url(value);
}

export function buildGithubAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", input.state);
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

export function verifyCsrf(
  cookieToken: string | undefined,
  submittedToken: string | null,
): boolean {
  if (!cookieToken || !submittedToken) return false;
  return constantTimeEqual(cookieToken, submittedToken);
}

export function verifyOAuthState(expected: string | undefined, submitted: string | null): boolean {
  if (!expected || !submitted) return false;
  return constantTimeEqual(expected, submitted);
}

export function assertOwner(session: Session | null, ownerUserId: string): Session {
  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.user.userId !== ownerUserId) throw new Error("FORBIDDEN");
  return session;
}
