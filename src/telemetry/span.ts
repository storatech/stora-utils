// Helpers for application code. They only need @opentelemetry/api, and do nothing (beyond running fn) when telemetry is off
import { Attributes, AttributeValue, context, createContextKey, propagation, Span, SpanStatusCode, trace } from '@opentelemetry/api'

/** Visit ID: stora-web's `stora_sid` cookie, or the API's own session cookie. Sent to other services in the W3C baggage header */
export const SESSION_ID = 'session.id'
/** Signed-in customer, taken from the verified token by each service. Not sent to other services */
export const CUSTOMER_ID = 'customer.id'

/** Context key for the attributes that `withSpanAttributes` puts on every span started inside it */
export const SPAN_ATTRIBUTES = createContextKey('@storatech/stora-utils/telemetry/span-attributes')

const tracer = trace.getTracer('@storatech/stora-utils')

/**
 * Times one step as a span, under the current span:
 * `const prices = await span('checkout.price', async () => await getPrices(items), { 'item.count': items.length })`.
 * The span ends when fn settles. A thrown error is recorded on the span and rethrown
 */
export const span = async <T>(name: string, fn: (span: Span) => T | Promise<T>, attributes?: Attributes): Promise<T> => {
  return await tracer.startActiveSpan(name, { attributes }, async (current) => {
    try {
      return await fn(current)
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      current.recordException(error)
      current.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      throw e
    } finally {
      current.end()
    }
  })
}

/** `session.id` of the current request: from the incoming baggage (sent by stora-web) or set with `withSpanAttributes` */
export const getSessionId = (): string | undefined => propagation.getBaggage(context.active())?.getEntry(SESSION_ID)?.value

/**
 * Runs fn with attributes on the current span and on every span started inside fn, for example
 * `withSpanAttributes({ [CUSTOMER_ID]: token?.customerId }, next)` in an Express middleware.
 * Empty values are skipped. `session.id` is also put in the baggage, so the services called inside fn get it
 */
export const withSpanAttributes = <T>(attributes: Record<string, AttributeValue | null | undefined>, fn: () => T): T => {
  const values: Attributes = {}
  for (const key in attributes) {
    const value = attributes[key]
    if (value !== undefined && value !== null && value !== '') {
      values[key] = value
    }
  }

  trace.getActiveSpan()?.setAttributes(values)

  let ctx = context.active()
  ctx = ctx.setValue(SPAN_ATTRIBUTES, { ...(ctx.getValue(SPAN_ATTRIBUTES) as Attributes | undefined), ...values })
  const sessionId = values[SESSION_ID]
  if (typeof sessionId === 'string') {
    const baggage = propagation.getBaggage(ctx) ?? propagation.createBaggage()
    ctx = propagation.setBaggage(ctx, baggage.setEntry(SESSION_ID, { value: sessionId }))
  }
  return context.with(ctx, fn)
}
