import { diag, DiagLogger, DiagLogLevel } from '@opentelemetry/api'
import { getNodeAutoInstrumentations, InstrumentationConfigMap } from '@opentelemetry/auto-instrumentations-node'
import type { ExpressLayerType } from '@opentelemetry/instrumentation-express'
import { core, NodeSDK, NodeSDKConfiguration, resources, tracing } from '@opentelemetry/sdk-node'
import { readFileSync } from 'fs'
import { getLogger } from 'log4js'
import { hostname } from 'os'
import { join } from 'path'

import { isNil } from '../utilities'
import { OtlpTraceExporter } from './otlp-exporter'
import { SpanAttributesProcessor, StoraPropagator } from './propagation'
import { SESSION_ID } from './span'
import { StartTelemetry } from './types'

const logger = getLogger('telemetry')

const DEFAULT_SAMPLE_RATIO = 0.1
// Query parameters recorded as REDACTED in url.full and url.query (exact, case-sensitive names):
// OpenTelemetry's defaults, plus the names the services use for keys and tokens (Facebook access_token, Google key ...)
const REDACTED_QUERY_PARAMS = [
  'sig', 'Signature', 'AWSAccessKeyId', 'X-Goog-Signature', 'X-Amz-Signature', 'X-Amz-Credential', 'X-Amz-Security-Token',
  'key', 'apiKey', 'api_key', 'apikey', 'access_token', 'accessToken', 'token', 'secret', 'client_secret', 'password', 'otp',
  'signature', 'sign'
]

const diagLogger: DiagLogger = {
  error: (message, ...args) => logger.error(message, ...args),
  warn: (message, ...args) => logger.warn(message, ...args),
  info: (message, ...args) => logger.info(message, ...args),
  debug: (message, ...args) => logger.debug(message, ...args),
  verbose: (message, ...args) => logger.trace(message, ...args)
}

const toNumber = (value: string | undefined): number | undefined => {
  if (isNil(value) || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

/** The default instrumentation settings, each merged with the app's settings for the same instrumentation */
const instrumentationConfig = (overrides: InstrumentationConfigMap = {}): InstrumentationConfigMap => {
  const config: InstrumentationConfigMap = {
    // A span for every lookup, socket and file read is noise
    '@opentelemetry/instrumentation-dns': { enabled: false },
    '@opentelemetry/instrumentation-net': { enabled: false },
    '@opentelemetry/instrumentation-fs': { enabled: false },
    '@opentelemetry/instrumentation-http': {
      // CORS preflights
      ignoreIncomingRequestHook: (req) => req.method === 'OPTIONS',
      redactedQueryParams: REDACTED_QUERY_PARAMS,
      redactedQueryParamsServer: REDACTED_QUERY_PARAMS
    },
    '@opentelemetry/instrumentation-express': {
      // cors, json, compression, logger ... on every request; routers and handlers are kept
      ignoreLayersType: ['middleware' as ExpressLayerType]
    },
    '@opentelemetry/instrumentation-graphql': {
      // Resolver spans down to Mutation.checkouts.createV3 (the services group operations under a field);
      // deeper fields join their parent's span. Apollo wraps every resolver, so ignoreTrivialResolveSpans alone does little
      depth: 2,
      ignoreTrivialResolveSpans: true,
      mergeItems: true
    }
  }
  for (const name in overrides) {
    const key = name as keyof InstrumentationConfigMap
    Object.assign(config, { [key]: { ...config[key], ...overrides[key] } })
  }
  return config
}

/** name and version from the app's package.json (PM2 and `next start` run in the app folder) */
const appPackage = (): { name?: string, version?: string } => {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
  } catch (e) {
    return {}
  }
}

/**
 * Starts OpenTelemetry tracing over OTLP/HTTP, to AWS X-Ray by default.
 * Call it before anything else is imported (express, mongodb, pg, graphql, aws-sdk, http ...), so that they get instrumented,
 * or import `@storatech/stora-utils/telemetry/register` instead.
 *
 * Environment:
 * - `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`: where spans go. Telemetry is off without it.
 *   `https://xray.<region>.amazonaws.com/v1/traces` is signed with the AWS SDK's default credentials (needs `xray:PutTraceSegments`
 *   and CloudWatch Transaction Search); `http://localhost:4318/v1/traces` is a local collector
 * - `OTEL_SDK_DISABLED=true`: turns telemetry off
 * - `OTEL_SERVICE_NAME`: service name (default: the package.json name)
 * - `OTEL_TRACES_SAMPLER_ARG`: share of new traces to keep (default 0.1), or the standard `OTEL_TRACES_SAMPLER`
 * - `OTEL_LOG_LEVEL`: SDK log level, written to the `telemetry` log4js category (default warn)
 */
export const startTelemetry: StartTelemetry = (options = {}) => {
  const {
    OTEL_SDK_DISABLED,
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    OTEL_SERVICE_NAME,
    OTEL_TRACES_SAMPLER,
    OTEL_TRACES_SAMPLER_ARG,
    OTEL_LOG_LEVEL,
    NODE_APP_INSTANCE,
    NODE_ENV
  } = process.env

  if (OTEL_SDK_DISABLED === 'true' || isNil(OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) || OTEL_EXPORTER_OTLP_TRACES_ENDPOINT.trim() === '') {
    logger.info('Telemetry is off: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is not set or OTEL_SDK_DISABLED=true')
    return undefined
  }

  try {
    const endpoint = OTEL_EXPORTER_OTLP_TRACES_ENDPOINT.trim()
    const app = appPackage()
    const serviceName = options.serviceName ?? OTEL_SERVICE_NAME ?? app.name?.replace(/^@[^/]+\//, '') ?? 'unknown_service'
    const sampleRatio = options.sampleRatio ?? toNumber(OTEL_TRACES_SAMPLER_ARG) ?? DEFAULT_SAMPLE_RATIO

    const config: Partial<NodeSDKConfiguration> = {
      // OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES override these (the SDK merges detected attributes over them)
      resource: resources.defaultResource().merge(resources.resourceFromAttributes({
        'service.name': serviceName,
        'service.namespace': 'stora',
        'service.version': options.serviceVersion ?? app.version,
        // One per PM2 worker
        'service.instance.id': `${hostname()}-${NODE_APP_INSTANCE ?? process.pid}`,
        'deployment.environment.name': options.environment ?? NODE_ENV
      })),
      spanProcessors: [SpanAttributesProcessor(), new tracing.BatchSpanProcessor(OtlpTraceExporter(endpoint))],
      // Traces only. The empty lists also stop the SDK from starting its default OTLP metric and log exporters
      metricReaders: [],
      logRecordProcessors: [],
      textMapPropagator: StoraPropagator(options.inboundBaggage ?? [SESSION_ID]),
      instrumentations: [getNodeAutoInstrumentations(instrumentationConfig(options.instrumentations))]
    }
    // When OTEL_TRACES_SAMPLER is set, the SDK reads it (and OTEL_TRACES_SAMPLER_ARG) itself
    if (isNil(OTEL_TRACES_SAMPLER)) {
      config.sampler = new tracing.ParentBasedSampler({ root: new tracing.TraceIdRatioBasedSampler(sampleRatio) })
    }

    const sdk = new NodeSDK(config)
    // After new NodeSDK(), which installs a console logger when OTEL_LOG_LEVEL is set
    diag.setLogger(diagLogger, {
      logLevel: core.diagLogLevelFromString(OTEL_LOG_LEVEL) ?? DiagLogLevel.WARN,
      suppressOverrideMessage: true
    })
    sdk.start()
    logger.info('Telemetry started: %s to %s, sampling %s', serviceName, endpoint, OTEL_TRACES_SAMPLER ?? sampleRatio)

    return {
      shutdown: async () => {
        await sdk.shutdown()
      }
    }
  } catch (e) {
    logger.error('Telemetry start error: ', e)
    return undefined
  }
}
