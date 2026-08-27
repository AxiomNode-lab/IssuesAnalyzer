import { NextResponse } from "next/server";

import { runtimeConfig } from "../../../../lib/runtime-config";

export function GET() {
  const config = runtimeConfig();
  return NextResponse.json(
    {
      status: "ok",
      service: config.serviceName,
      environment: config.environment,
      release: config.release,
    },
    { status: 200 },
  );
}
