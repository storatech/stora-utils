import { InstrumentationConfigMap } from '@opentelemetry/auto-instrumentations-node'

export interface TelemetryOptions {
  /** `service.name`, for example `stora-api` */
  serviceName: string
  /** `service.version`, for example the package.json version */
  serviceVersion?: string
  /** `deployment.environment.name`. Defaults to `NODE_ENV` */
  environment?: string
  /** Share of new traces to keep, 0 to 1. Defaults to `OTEL_TRACES_SAMPLER_ARG`, then 0.1 */
  sampleRatio?: number
  /** Per-instrumentation settings, merged over the defaults (see `startTelemetry`) */
  instrumentations?: InstrumentationConfigMap
}

export interface Telemetry {
  /** Exports pending spans and metrics, then stops the SDK */
  shutdown: () => Promise<void>
}

/** Returns undefined when telemetry is off (no `GOOGLE_CLOUD_PROJECT`, or `OTEL_SDK_DISABLED=true`) */
export type StartTelemetry = (options: TelemetryOptions) => Telemetry | undefined
