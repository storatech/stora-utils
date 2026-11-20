import { Attributes, Context, propagation, TextMapPropagator } from '@opentelemetry/api'
import { core, tracing } from '@opentelemetry/sdk-node'

import { CUSTOMER_ID, SESSION_ID, SPAN_ATTRIBUTES } from './span'

/** The only baggage sent on outgoing requests: they also go to outside APIs (payment providers, marketplaces ...) */
const OUTBOUND_BAGGAGE = [SESSION_ID]

const keepBaggage = (ctx: Context, keys: string[]): Context => {
  const baggage = propagation.getBaggage(ctx)
  if (baggage === undefined) return ctx
  let kept = propagation.createBaggage()
  for (const [key, entry] of baggage.getAllEntries()) {
    if (keys.includes(key)) {
      kept = kept.setEntry(key, entry)
    }
  }
  return kept.getAllEntries().length > 0 ? propagation.setBaggage(ctx, kept) : propagation.deleteBaggage(ctx)
}

/** W3C trace context (`traceparent`), plus W3C baggage limited to inboundBaggage on incoming requests and to `session.id` on outgoing ones */
export const StoraPropagator = (inboundBaggage: string[]): TextMapPropagator => {
  const baggage = new core.W3CBaggagePropagator()
  const filteredBaggage: TextMapPropagator = {
    inject: (ctx, carrier, setter) => baggage.inject(keepBaggage(ctx, OUTBOUND_BAGGAGE), carrier, setter),
    extract: (ctx, carrier, getter) => keepBaggage(baggage.extract(ctx, carrier, getter), inboundBaggage),
    fields: () => baggage.fields()
  }
  return new core.CompositePropagator({ propagators: [new core.W3CTraceContextPropagator(), filteredBaggage] })
}

/** Puts `session.id` and `customer.id` from the baggage, and the `withSpanAttributes` values, on every span as it starts */
export const SpanAttributesProcessor = (): tracing.SpanProcessor => ({
  onStart: (span, parentContext) => {
    const baggage = propagation.getBaggage(parentContext)
    for (const key of [SESSION_ID, CUSTOMER_ID]) {
      const entry = baggage?.getEntry(key)
      if (entry !== undefined && entry.value !== '') {
        span.setAttribute(key, entry.value)
      }
    }
    const attributes = parentContext.getValue(SPAN_ATTRIBUTES) as Attributes | undefined
    if (attributes !== undefined) {
      span.setAttributes(attributes)
    }
  },
  onEnd: () => {},
  forceFlush: async () => {},
  shutdown: async () => {}
})
