import Koa from 'koa'
import { getLogger } from 'log4js'
import { reqIdStorage } from '.'

export const koaLogger: Koa.Middleware = async (ctx, next) => {
  const logger = getLogger('http')
  const reqId = Math.random()
  const ts = new Date().getTime()
  ctx.setHeader('X-Request-Id', `${reqId}`)
  reqIdStorage.run(`${reqId}`, () => {
    logger.info(ctx.method, ctx.originalUrl)
    next().then(() => {
      logger.info(ctx.statusCode, new Date().getTime() - ts, 'ms')
    })
  })
}
