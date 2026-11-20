import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { context } from '@opentelemetry/api'
import { ProtobufTraceSerializer } from '@opentelemetry/otlp-transformer'
import { core, tracing } from '@opentelemetry/sdk-node'
import { Hash } from '@smithy/hash-node'
import { SignatureV4 } from '@smithy/signature-v4'
import { HttpRequest } from '@smithy/types'
import { request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'
import { getLogger } from 'log4js'
import { promisify } from 'util'
import { gzip } from 'zlib'

const logger = getLogger('telemetry')

const gzipAsync = promisify(gzip)
// https://xray.<region>.amazonaws.com/v1/traces (AWS X-Ray OTLP endpoint, needs CloudWatch Transaction Search)
const XRAY_HOST = /^xray(?:-fips)?\.([a-z0-9-]+)\.amazonaws\.com$/
const REQUEST_TIMEOUT = 10000
const MAX_ATTEMPTS = 3
const RETRYABLE_STATUS = [429, 502, 503, 504]

interface HttpResponse {
  status: number
  body: Buffer
}

/**
 * OTLP/HTTP span exporter (protobuf, gzip). Requests to the AWS X-Ray endpoint are signed with SigV4, using the AWS SDK's
 * default credentials (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, ~/.aws profile, EC2 instance role), which need `xray:PutTraceSegments`.
 * Other endpoints (a local collector) get unsigned requests
 */
export const OtlpTraceExporter = (endpoint: string): tracing.SpanExporter => {
  const url = new URL(endpoint)
  const region = XRAY_HOST.exec(url.hostname)?.[1]
  const signer = region === undefined
    ? undefined
    : new SignatureV4({ service: 'xray', region, credentials: defaultProvider(), sha256: Hash.bind(null, 'sha256') })
  const pending = new Set<Promise<void>>()
  let stopped = false

  const post = async (body: Buffer): Promise<HttpResponse> => {
    let headers: Record<string, string> = { host: url.host, 'content-type': 'application/x-protobuf', 'content-encoding': 'gzip' }
    if (signer !== undefined) {
      const request: HttpRequest = { method: 'POST', protocol: url.protocol, hostname: url.hostname, path: url.pathname, headers, body }
      headers = (await signer.sign(request)).headers
    }
    return await new Promise((resolve, reject) => {
      const send = url.protocol === 'http:' ? httpRequest : httpsRequest
      const req = send(url, { method: 'POST', headers: { ...headers, 'content-length': String(body.length) }, timeout: REQUEST_TIMEOUT }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }))
        res.on('error', reject)
      })
      req.on('timeout', () => req.destroy(new Error(`timed out after ${REQUEST_TIMEOUT} ms`)))
      req.on('error', reject)
      req.end(body)
    })
  }

  const exportSpans = async (spans: tracing.ReadableSpan[]): Promise<void> => {
    const serialized = ProtobufTraceSerializer.serializeRequest(spans)
    if (serialized === undefined) {
      throw new Error('Could not serialize the spans')
    }
    const body = await gzipAsync(serialized)
    for (let attempt = 1; ; attempt++) {
      let error: Error
      let retryable = true
      try {
        const response = await post(body)
        if (response.status >= 200 && response.status < 300) {
          const partialSuccess = ProtobufTraceSerializer.deserializeResponse(response.body).partialSuccess
          if ((partialSuccess?.rejectedSpans ?? 0) > 0 || (partialSuccess?.errorMessage ?? '') !== '') {
            logger.warn('Spans rejected by %s: %s (%s)', url.host, partialSuccess?.rejectedSpans, partialSuccess?.errorMessage)
          }
          return
        }
        // The body is a protobuf google.rpc.Status: keep its readable text (the message)
        const message = response.body.toString('utf8').replace(/[^\x20-\x7e]+/g, ' ').trim().slice(0, 500)
        error = new Error(`HTTP ${response.status} ${message}`)
        retryable = RETRYABLE_STATUS.includes(response.status)
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e))
      }
      if (!retryable || attempt >= MAX_ATTEMPTS) {
        throw new Error(`Span export to ${url.host} failed: ${error.message}`)
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }

  return {
    export: (spans, resultCallback) => {
      if (stopped) {
        resultCallback({ code: core.ExportResultCode.FAILED, error: new Error('The exporter is shut down') })
        return
      }
      // The export's own requests, including AWS credential lookups, must not be traced
      const exporting = context.with(core.suppressTracing(context.active()), async () => await exportSpans(spans))
        .then(
          () => resultCallback({ code: core.ExportResultCode.SUCCESS }),
          (error: Error) => resultCallback({ code: core.ExportResultCode.FAILED, error })
        )
      pending.add(exporting)
      void exporting.then(() => pending.delete(exporting))
    },
    forceFlush: async () => {
      await Promise.all(Array.from(pending))
    },
    shutdown: async () => {
      stopped = true
      await Promise.all(Array.from(pending))
    }
  }
}
