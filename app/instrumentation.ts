/**
 * Next.js instrumentation hook (P0-E observability).
 *
 * Registers OpenTelemetry on the server runtime so web requests are traceable and
 * trace context propagates to the FastAPI backend (end-to-end traces). Env-driven
 * and free-tier-first: when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset this is a no-op,
 * so local/dev/CI need no collector. `@vercel/otel` auto-detects the OTLP endpoint
 * and standard `OTEL_*` env vars.
 *
 * Runs only in the Node.js server runtime (not edge/browser).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  const { registerOTel } = await import("@vercel/otel");
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? "gyf-web" });
}
