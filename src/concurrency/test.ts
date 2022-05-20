import { getLogger } from 'log4js'
import { ThreadPool } from '.'
import '../logger'

const logger = getLogger('test')

const t = ThreadPool(10)
const test = async (): Promise<void> => {
  for (let i = 0; i < 101; i++) {
    await t.submit(async () => {
      logger.info('thread start', i)
      await new Promise((resolve, reject) => {
        setTimeout(resolve, 1000)
      })
      logger.info('thread end', i)
    })
  }
}

test().catch(e => {

})
