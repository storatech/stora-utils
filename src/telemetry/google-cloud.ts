import { ChannelCredentials, credentials, Metadata } from '@grpc/grpc-js'
import { diag, DiagLogger, DiagLogLevel } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import type { ExpressLayerType } from '@opentelemetry/instrumentation-express'
import { core, metrics, NodeSDK, NodeSDKConfiguration, resources } from '@opentelemetry/sdk-node'
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base'
import { GoogleAuth } from 'google-auth-library'
import { getLogger } from 'log4js'
import { hostname } from 'os'

import { isNil } from '../utilities'
import { StartTelemetry } from './types'

const logger = getLogger('telemetry')

// Google Cloud Telemetry API (OTLP): traces go to Cloud Trace, metrics to Cloud Monitoring
const GOOGLE_TELEMETRY_URL = 'https://telemetry.googleapis.com'
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'
const DEFAULT_SAMPLE_RATIO = 0.1
const DEFAULT_METRIC_INTERVAL = 60000 // 1 minute
// The Telemetry API accepts at most 200 points per metrics request
const METRIC_BATCH_SIZE = 200
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

/** TLS, plus a Google access token on every call from Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`) */
const googleCredentials = (): ChannelCredentials => {
  const auth = new GoogleAuth({ scopes: GOOGLE_SCOPE })
  // Not credentials.createFromGoogleCredential: it reads plain object keys, and google-auth-library 10 returns Headers
  const callCredentials = credentials.createFromMetadataGenerator((options, callback) => {
    auth.getRequestHeaders(options.service_url).then((headers) => {
      const metadata = new Metadata()
      headers.forEach((value, key) => metadata.add(key, value))
      callback(null, metadata)
    }, (e: Error) => callback(e))
  })
  return credentials.combineChannelCredentials(credentials.createSsl(), callCredentials)
}

/**
 * Starts OpenTelemetry tracing and metrics, exported to Google Cloud.
 * Call it before anything else is imported (express, mongodb, pg, graphql, aws-sdk, http ...), so that they get instrumented.
 *
 * Environment:
 * - `GOOGLE_CLOUD_PROJECT`: Google Cloud project ID. Telemetry is off without it
 * - `GOOGLE_APPLICATION_CREDENTIALS`: service account key or workload identity federation config
 * - `OTEL_SDK_DISABLED=true`: turns telemetry off
 * - `OTEL_TRACES_SAMPLER_ARG`: share of new traces to keep (default 0.1), or the standard `OTEL_TRACES_SAMPLER`
 * - `OTEL_METRIC_EXPORT_INTERVAL`: milliseconds between metric exports (default 60000)
 * - `OTEL_EXPORTER_OTLP_ENDPOINT`: another OTLP gRPC endpoint; `http://` means a local collector, sent without Google credentials
 * - `OTEL_LOG_LEVEL`: SDK log level, written to the `telemetry` log4js category (default warn)
 */
export const startTelemetry: StartTelemetry = (options) => {
  const {
    GOOGLE_CLOUD_PROJECT,
    OTEL_SDK_DISABLED,
    OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_TRACES_SAMPLER,
    OTEL_TRACES_SAMPLER_ARG,
    OTEL_METRIC_EXPORT_INTERVAL,
    OTEL_LOG_LEVEL,
    NODE_APP_INSTANCE,
    NODE_ENV
  } = process.env

  if (OTEL_SDK_DISABLED === 'true' || isNil(GOOGLE_CLOUD_PROJECT) || GOOGLE_CLOUD_PROJECT === '') {
    logger.info('Telemetry is off: GOOGLE_CLOUD_PROJECT is not set or OTEL_SDK_DISABLED=true')
    return undefined
  }

  try {
    const url = OTEL_EXPORTER_OTLP_ENDPOINT ?? GOOGLE_TELEMETRY_URL
    const channelCredentials = url.startsWith('http://') ? credentials.createInsecure() : googleCredentials()
    const sampleRatio = options.sampleRatio ?? toNumber(OTEL_TRACES_SAMPLER_ARG) ?? DEFAULT_SAMPLE_RATIO

    const config: Partial<NodeSDKConfiguration> = {
      // OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES override these (the SDK merges detected attributes over them)
      resource: resources.defaultResource().merge(resources.resourceFromAttributes({
        'service.name': options.serviceName,
        'service.namespace': 'stora',
        'service.version': options.serviceVersion,
        // One per PM2 worker: Cloud Monitoring rejects points written to the same time series by several processes
        'service.instance.id': `${hostname()}-${NODE_APP_INSTANCE ?? process.pid}`,
        'deployment.environment.name': options.environment ?? NODE_ENV,
        // Required by the Telemetry API
        'gcp.project_id': GOOGLE_CLOUD_PROJECT
      })),
      traceExporter: new OTLPTraceExporter({ url, credentials: channelCredentials }),
      metricReaders: [
        new metrics.PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url, credentials: channelCredentials }),
          exportIntervalMillis: toNumber(OTEL_METRIC_EXPORT_INTERVAL) ?? DEFAULT_METRIC_INTERVAL,
          maxExportBatchSize: METRIC_BATCH_SIZE
        })
      ],
      instrumentations: [
        getNodeAutoInstrumentations({
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
          },
          ...options.instrumentations
        })
      ]
    }
    // When OTEL_TRACES_SAMPLER is set, the SDK reads it (and OTEL_TRACES_SAMPLER_ARG) itself
    if (isNil(OTEL_TRACES_SAMPLER)) {
      config.sampler = new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(sampleRatio) })
    }

    const sdk = new NodeSDK(config)
    // After new NodeSDK(), which installs a console logger when OTEL_LOG_LEVEL is set
    diag.setLogger(diagLogger, {
      logLevel: core.diagLogLevelFromString(OTEL_LOG_LEVEL) ?? DiagLogLevel.WARN,
      suppressOverrideMessage: true
    })
    sdk.start()
    logger.info('Telemetry started: %s to %s, sampling %s', options.serviceName, url, OTEL_TRACES_SAMPLER ?? sampleRatio)

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
