import './logger'
import { getLogger } from 'log4js'
import { MessageQueue } from './messaging'

const logger = getLogger('queue-test')

const consumeSingleData = async (data: any): Promise<void> => {
  logger.info('consuming started: ', data)
  const timeout = async (sec: number): Promise<void> => {
    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, sec * 1000)
    })
  }
  await timeout(3 + Math.random() * 2)
  logger.info('consuming finished.')
}

const main = async (): Promise<void> => {
  const testQueue = MessageQueue<any>('test-queue', 3)

  logger.info('Main started.')
  await testQueue.consume(consumeSingleData)
}

// const main = async (): Promise<void> => {
//   const pool = ThreadPool(3)
//   for (let i = 0; i < 30; i++) {
//     await pool.submit(async () => {
//       await consumeSingleData(i)
//     })
//   }
//   await pool.finish()
// }

main().catch(console.log)
