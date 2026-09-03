import { describe, expect, it } from "vitest";

import { GET as live } from "./live/route";
import { GET as ready } from "./ready/route";

describe("health endpoints", () => {
  it("reports liveness without infrastructure details", async () => {
    const response = live();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });

  it("keeps anonymous analysis ready when the optional database is not configured", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const response = await ready();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        status: "ready",
        dependencies: { database: "not_configured" },
      });
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous;
    }
  });
});
