import Koa from 'koa'
import { getLogger } from 'log4js'
import { getReqId } from './config'

export const koaLogger: Koa.Middleware = async (ctx, next) => {
  const logger = getLogger('http')
  const ts = new Date().getTime()
  await getReqId(async (reqId) => {
    ctx.set('X-Request-Id', `${reqId}`)
    logger.info(ctx.method, ctx.originalUrl)
    await next()
    logger.info(ctx.status, new Date().getTime() - ts, 'ms')
  })
}
