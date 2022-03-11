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
  emitter.on('new', (d: ThreadTask) => {
    queue.push(d)
    logger.trace('waiting tasks: ', queue.length)
  })
  emitter.setMaxListeners(size + 1)
  const runner = async (thread: number): Promise<void> => {
    await getReqId(async () => {
      while (true) {
        const d = queue.shift()
        if (d !== undefined) {
          logger.trace('waiting tasks: ', queue.length)
          try {
            await d()
          } catch (e) {
            logger.error('unknown error', thread, e)
          }
        } else {
          await new Promise((resolve, reject) => {
            const wait = (): void => {
              clearTimeout(timeout)
              resolve(undefined)
              emitter.removeListener('new', wait)
            }
            const timeout = setTimeout(wait, 60000)
            emitter.once('new', wait)
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
      emitter.emit('new', d)
    }
  }
}

export default ThreadPoolImpl
