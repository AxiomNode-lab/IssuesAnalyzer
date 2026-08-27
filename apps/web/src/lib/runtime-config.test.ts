import { describe, expect, it } from "vitest";

import { isProductionLike, runtimeConfig } from "./runtime-config";

describe("runtimeConfig", () => {
  it("keeps staging and production explicit and distinct", () => {
    const staging = runtimeConfig({ APP_ENV: "staging", APP_RELEASE: "abc123" });
    const production = runtimeConfig({ APP_ENV: "production", APP_RELEASE: "def456" });

    expect(staging.environment).toBe("staging");
    expect(production.environment).toBe("production");
    expect(staging.release).toBe("abc123");
    expect(production.release).toBe("def456");
    expect(isProductionLike(staging)).toBe(true);
    expect(isProductionLike(production)).toBe(true);
  });

  it("rejects unsupported environments", () => {
    expect(() => runtimeConfig({ APP_ENV: "prod-ish" })).toThrow("Unsupported APP_ENV");
  });
});
