import { MessageQueue } from '../messaging'
import '../src/logger'
import { getLogger } from 'log4js'

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
  await testQueue.startPool(consumeSingleData)
}

main().catch(console.log)
