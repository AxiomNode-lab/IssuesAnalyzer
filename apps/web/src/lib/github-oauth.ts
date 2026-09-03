const OAUTH_TIMEOUT_MS = 8_000;

export async function githubOAuthFetch(
  url: "https://github.com/login/oauth/access_token" | "https://api.github.com/user",
  init: RequestInit,
  fetchImplementation: typeof fetch = fetch,
): Promise<Response> {
  return fetchImplementation(url, {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
  });
}
