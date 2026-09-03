export type AppEnvironment = "development" | "test" | "staging" | "production";

export type RuntimeConfig = Readonly<{
  environment: AppEnvironment;
  serviceName: string;
  release: string;
}>;

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

const VALID_ENVIRONMENTS = new Set<AppEnvironment>([
  "development",
  "test",
  "staging",
  "production",
]);

export function runtimeConfig(env: RuntimeEnvironment = process.env): RuntimeConfig {
  const rawEnvironment = env.APP_ENV ?? env.NODE_ENV ?? "development";
  if (!VALID_ENVIRONMENTS.has(rawEnvironment as AppEnvironment)) {
    throw new Error(`Unsupported APP_ENV: ${rawEnvironment}`);
  }

  return {
    environment: rawEnvironment as AppEnvironment,
    serviceName: env.SERVICE_NAME?.trim() || "opportunity-radar-web",
    release: env.APP_RELEASE?.trim() || "development",
  };
}

export function isProductionLike(config: RuntimeConfig): boolean {
  return config.environment === "staging" || config.environment === "production";
}

export function applicationOrigin(
  requestOrigin: string,
  env: RuntimeEnvironment = process.env,
): string {
  const configured = env.APP_ORIGIN?.trim();
  if (!configured) {
    if (isProductionLike(runtimeConfig(env)))
      throw new Error("APP_ORIGIN is required in production-like environments.");
    return new URL(requestOrigin).origin;
  }
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.origin !== configured
  ) {
    throw new Error(
      "APP_ORIGIN must be a canonical HTTPS origin without credentials, port, path, query, or fragment.",
    );
  }
  return url.origin;
}
