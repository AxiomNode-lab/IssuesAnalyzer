import { createServer } from "node:http";
import { performance } from "node:perf_hooks";

const cache = new Map();
const pending = new Map();
let outboundGitHubRequests = 0;

async function mockedAnalysis(issue) {
  const cached = cache.get(issue);
  if (cached) return cached;
  const inFlight = pending.get(issue);
  if (inFlight) return inFlight;
  const work = (async () => {
    outboundGitHubRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const report = { issue, score: 70, evidence: "mocked" };
    cache.set(issue, report);
    return report;
  })().finally(() => pending.delete(issue));
  pending.set(issue, work);
  return work;
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/api/analyze") {
    response.writeHead(404).end();
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const { issue } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const report = await mockedAnalysis(issue);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ report }));
});

function percentile(values, fraction) {
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)] ?? 0;
}

async function scenario(baseUrl, concurrency, sameIssue) {
  cache.clear();
  pending.clear();
  outboundGitHubRequests = 0;
  const memoryBefore = process.memoryUsage().heapUsed;
  const results = await Promise.all(
    Array.from({ length: concurrency }, async (_, index) => {
      const started = performance.now();
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issue: sameIssue ? "owner/repo#1" : `owner/repo#${index + 1}` }),
      });
      return { ok: response.ok, latency: performance.now() - started };
    }),
  );
  const latencies = results.map(({ latency }) => latency).sort((a, b) => a - b);
  const elapsed = Math.max(...latencies);
  return {
    scenario: `${concurrency} concurrent${sameIssue ? " same issue" : " unique issues"}`,
    throughputRps: Number((concurrency / (elapsed / 1_000)).toFixed(1)),
    p50Ms: Number(percentile(latencies, 0.5).toFixed(1)),
    p95Ms: Number(percentile(latencies, 0.95).toFixed(1)),
    p99Ms: Number(percentile(latencies, 0.99).toFixed(1)),
    errorRate: results.filter(({ ok }) => !ok).length / concurrency,
    heapDeltaBytes: process.memoryUsage().heapUsed - memoryBefore,
    outboundGitHubRequests,
  };
}

server.listen(0, "127.0.0.1", async () => {
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Stub server did not bind.");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const results = [];
    for (const concurrency of [10, 50, 100])
      results.push(await scenario(baseUrl, concurrency, false));
    const sameIssue = await scenario(baseUrl, 100, true);
    results.push(sameIssue);
    console.table(results);
    if (
      results.some(({ errorRate }) => errorRate !== 0) ||
      sameIssue.outboundGitHubRequests !== 1
    ) {
      process.exitCode = 1;
    }
  } finally {
    server.close();
  }
});
