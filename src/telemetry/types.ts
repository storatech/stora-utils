import { InstrumentationConfigMap } from '@opentelemetry/auto-instrumentations-node'

export interface TelemetryOptions {
  /** `service.name`. Defaults to `OTEL_SERVICE_NAME`, then the `name` in the app's package.json (without the npm scope) */
  serviceName?: string
  /** `service.version`. Defaults to the `version` in the app's package.json */
  serviceVersion?: string
  /** `deployment.environment.name`. Defaults to `NODE_ENV` */
  environment?: string
  /** Share of new traces to keep, 0 to 1. Defaults to `OTEL_TRACES_SAMPLER_ARG`, then 0.1 */
  sampleRatio?: number
  /**
   * Baggage keys accepted from incoming requests and put on the spans. Defaults to `['session.id']`.
   * Accept `customer.id` only where every request comes through a hop that sets it (stora-web's middleware):
   * public APIs take it from the verified token with `withSpanAttributes`, so that a client cannot claim another customer
   */
  inboundBaggage?: string[]
  /** Per-instrumentation settings, merged over the defaults (see `startTelemetry`) */
  instrumentations?: InstrumentationConfigMap
}

export interface Telemetry {
  /** Exports the pending spans, then stops the SDK */
  shutdown: () => Promise<void>
}

/** Returns undefined when telemetry is off (no `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, or `OTEL_SDK_DISABLED=true`) */
export type StartTelemetry = (options?: TelemetryOptions) => Telemetry | undefined
