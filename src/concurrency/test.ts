import { getLogger } from 'log4js'
import { ThreadPool } from '.'
import '../logger'

const logger = getLogger('test')

const t = ThreadPool(9)
for (let i = 0; i < 10; i++) {
  t.submit(async () => {
    logger.info('thread start', i)
    await new Promise((resolve, reject) => {
      setTimeout(resolve, 10000)
    })
    logger.info('thread end', i)
  })
}
