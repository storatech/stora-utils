import EventEmitter from 'events'
import '../logger'

export type Topic = <T>() => {
  publish: (subscriptionId: string, data: T) => void
  subscribe: (subscriptionId: string, waitMs: number) => Promise<T | undefined>
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
    }
  }
}

export default TopicImpl

// const test = (): void => {
//   const topic = TopicImpl<string>()

//   const thread1 = async (): Promise<void> => {
//     setTimeout(() => {
//       topic.publish('1', '123')
//     }, 12000)
//   }

//   const thread2 = async (): Promise<void> => {
//     const data = await topic.subscribe('1', 10000)
//     console.log('1', data)
//   }

//   thread1().catch(e => e)

//   thread2().catch(e => e)
// }

// test()
