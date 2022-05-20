import EventEmitter from 'events'
import { getLogger } from 'log4js'
import { getReqId } from '../logger'

type ThreadTask = () => Promise<void>

interface ThreadPool {
  submit: (task: ThreadTask) => void
}

export const ThreadPoolImpl = (size: number): ThreadPool => {
  const logger = getLogger('THREAD')
  const queue: ThreadTask[] = []
  const emitter = new EventEmitter()
  emitter.setMaxListeners(size + 1)
  const runner = async (thread: number): Promise<void> => {
    await getReqId(async () => {
      while (true) {
        const d = queue.shift()
        if (d !== undefined) {
          try {
            await d()
          } catch (e) {
            logger.error('unknown error', thread, e)
          }
          emitter.emit('end')
        } else {
          await new Promise((resolve, reject) => {
            const waitEnd = (): void => {
              clearTimeout(timeout)
              resolve(undefined)
              emitter.removeListener('begin', waitEnd)
            }
            const timeout = setTimeout(waitEnd, 60000)
            emitter.once('begin', waitEnd)
          })
        }
      }
    }, `runner#${thread}`)
  }
  for (let i = 0; i < size; i++) {
    runner(i).catch(e => {
      logger.error('thread runner error', i, e)
    })
  }
  return {
    submit: async (d) => {
      if (queue.length >= size) {
        await new Promise((resolve, reject) => {
          emitter.once('end', resolve)
        })
      }
      queue.push(d)
      emitter.emit('begin')
    }
  }
}

export default ThreadPoolImpl
