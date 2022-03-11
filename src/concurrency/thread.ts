
interface ThreadPool {
  submit: (task: () => Promise<void>) => Promise<void>
}

export const ThreadPoolImpl = (size: number): ThreadPool => {
  const queue: ThreadTask[] = []
  const emitter = new EventEmitter()
  emitter.on('new', (d: ThreadTask) => {
    queue.push(d)
  })
  emitter.setMaxListeners(size + 1)
  const runner = async (thread: number): Promise<void> => {
    while (true) {
      const d = queue.shift()
      if (d !== undefined) {
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
