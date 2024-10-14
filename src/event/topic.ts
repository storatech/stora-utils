import EventEmitter from 'events'
import '../logger'

export type Topic = <T>() => {
  publish: (subscriptionId: string, data: T) => void
  subscribe: (subscriptionId: string, waitMs: number) => Promise<T | undefined>
  subscribeAll: (subscriptionId: string, waitMs: number, limit?: number) => Promise<Array<T | undefined>>
}

export const TopicImpl: Topic = () => {
  const emitter = new EventEmitter()
  return {
    publish: async (subscriptionId, data) => {
      emitter.emit(subscriptionId, data)
    },
    subscribe: async (subscriptionId, waitMs): Promise<any> => {
      const a = new Promise((resolve, reject) => {
        const listener = (data: any): void => {
          clearTimeout(timeout)
          resolve(data)
        }
        const timeout = setTimeout(() => {
          emitter.removeListener(subscriptionId, listener)
          resolve(undefined)
        }, waitMs)
        emitter.once(subscriptionId, listener)
      })
      const data = await a
      return data
    },
    subscribeAll: async (subscriptionId, waitMs, limit = Infinity): Promise<any> => {
      // const count = 0
      const a = new Promise((resolve, reject) => {
        const result: any = []
        const listener = (data: any): void => {
          result.push(data)
          if (result.length >= limit) {
            end()
            clearTimeout(timeout)
          }
        }
        const end = () => {
          emitter.removeListener(subscriptionId, listener)
          resolve(result)
        }
        const timeout = setTimeout(end, waitMs)
        emitter.on(subscriptionId, listener)
      })
      const data = await a
      return data
    }
  }
}

export default TopicImpl

// const test = (): void => {
//   const logger = getLogger('test')
//   const topic = TopicImpl<string>()

//   const thread1 = async (): Promise<void> => {
//     setTimeout(() => {
//       topic.publish('1', '123')
//     }, 1000)
//   }

//   const thread3 = async (): Promise<void> => {
//     setTimeout(() => {
//       topic.publish('1', '123')
//     }, 2000)
//   }

//   const thread2 = async (): Promise<void> => {
//     logger.info('start')
//     const data = await topic.subscribeAll('1', 3000, 2)
//     logger.info('end', data)
//   }

//   thread1().catch(e => e)
//   thread2().catch(e => e)
//   thread3().catch(e => e)
// }

// test()
