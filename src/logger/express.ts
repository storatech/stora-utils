import { getLogger } from 'log4js'
import { Request, Response, NextFunction } from 'express'
import { reqIdStorage } from '../logger'

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const logger = getLogger('http')
  const reqId = Math.random()
  const oldEnd = res.end
  const ts = new Date().getTime()
  res.end = (): void => {
    logger.info(res.statusCode, new Date().getTime() - ts, 'ms')
    // @ts-expect-error
    oldEnd.apply(res, arguments)
  }
  res.setHeader('X-Request-Id', `${reqId}`)
  reqIdStorage.run(`${reqId}`, () => {
    logger.info(req.method, req.originalUrl)
    next()
  })
}
