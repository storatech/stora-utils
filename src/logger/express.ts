import { getLogger } from 'log4js'
import { Request, Response, NextFunction } from 'express'
import { reqIdStorage } from './config'

type LoggerMiddleware = (req: Request, res: Response, next: NextFunction) => void
export const loggerMiddleware: LoggerMiddleware = (req, res, next) => {
  const logger = getLogger('http')
  const reqId = Math.random()
  const oldEnd = res.end
  const ts = new Date().getTime()
  res.end = (): any => {
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
