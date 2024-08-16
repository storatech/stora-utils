import { getLogger } from 'log4js'
import { createClient } from 'redis'

const logger = getLogger('redis')

const {
  REDIS_URL = 'redis://localhost:6379'
} = process.env

export const redis = createClient({
  url: REDIS_URL
})

logger.debug('redis')

export type PubSubListener<T> = (message: T) => Promise<void>

export interface PubSub<T> {
  subscribe: (listener: PubSubListener<T>) => Promise<void>
  count: () => Promise<number>
  publish: (message: T) => Promise<void>
}

export const PubSubChannel = <T>(channel: string): PubSub<T> => {
  return {
    subscribe: async (listener) => {
      logger.info('subscribing channel: ', channel)
      const sub = redis.duplicate()
      await sub.connect()
      await sub.subscribe(channel, (message, channel) => {
        try {
          const m = JSON.parse(message) as T
          logger.debug('message received on channel', channel, m)
          listener(m).catch((e: any) => {
            logger.error('subscriber error:', e)
          })
        } catch (e) {
          logger.error('message error: ', e)
        }
      })
    },
    count: async () => {
      const res = await redis.pubSubNumSub(channel)
      logger.trace('message count: ', res[channel])

      return res[channel]
    },
    publish: async (message) => {
      logger.debug('message publish on channel: ', channel, message)
      const m = JSON.stringify(message)
      await redis.publish(channel, m)
    }
  }
}
