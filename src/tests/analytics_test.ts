
import { sendAnalyticsEvent } from '../analytics'
import '../logger'

export const test = async (): Promise<void> => {
  await sendAnalyticsEvent('test-event', { foo: 'bar' }).catch(console.error)
  await sendAnalyticsEvent('test-event', { 'response-time': 100 }).catch(console.error)

  for (let i = 0; i < 100; i++) {
    await sendAnalyticsEvent('loop-event', { date: new Date(), count: i }).catch(console.error)
  }
}

test().then(
  async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    process.exit(0)
  }
).catch(console.error)
