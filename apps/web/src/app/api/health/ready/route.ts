import { NextResponse } from "next/server";

import { checkDatabaseReadiness } from "../../../../lib/database";
import { observeLatency, reportOperationalError } from "../../../../lib/observability";
import { runtimeConfig } from "../../../../lib/runtime-config";

export async function GET() {
  const config = runtimeConfig();
  try {
    await observeLatency("readiness.database", checkDatabaseReadiness);
    return NextResponse.json(
      {
        status: "ready",
        service: config.serviceName,
        environment: config.environment,
        release: config.release,
        dependencies: { database: "ready" },
      },
      { status: 200 },
    );
  } catch (error) {
    reportOperationalError(error, { event: "readiness_failed", dependency: "database" });
    return NextResponse.json(
      {
        status: "not_ready",
        service: config.serviceName,
        environment: config.environment,
        release: config.release,
        dependencies: { database: "unavailable" },
      },
      { status: 503 },
    );
  }
}
