import EventEmitter from 'events'
import { getLogger } from 'log4js'
import { getReqId } from '../logger/config'

type ThreadTask = () => Promise<void>

interface ThreadPool {
  submit: (task: ThreadTask) => void
  finish: () => Promise<void>
}

export const ThreadPoolImpl = (size: number): ThreadPool => {
  const logger = getLogger('THREAD')
  const queue: ThreadTask[] = []
  let runningJobs = 0
  const emitter = new EventEmitter()
  emitter.setMaxListeners(size + 1)
  const runner = async (thread: number): Promise<void> => {
    await getReqId(async () => {
      while (true) {
        const d = queue.shift()
        if (d !== undefined) {
          runningJobs += 1
          try {
            await d()
          } catch (e) {
            logger.error('unknown error', thread, e)
          }
          runningJobs -= 1
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
      queue.push(d)
      emitter.emit('begin')
    },
    finish: async () => {
      await new Promise((resolve, reject) => {
        const onFinish = (): void => {
          if (queue.length === 0 && runningJobs === 0) {
            resolve('finished')
          } else {
            logger.debug('awaiting tasks:', queue.length, 'running task:', runningJobs)
          }
        }
        emitter.on('end', onFinish)
      })
    }
  }
}

export default ThreadPoolImpl
