export type AppEnvironment = "development" | "test" | "staging" | "production";

export type RuntimeConfig = Readonly<{
  environment: AppEnvironment;
  serviceName: string;
  release: string;
}>;

const VALID_ENVIRONMENTS = new Set<AppEnvironment>([
  "development",
  "test",
  "staging",
  "production",
]);

export function runtimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
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
