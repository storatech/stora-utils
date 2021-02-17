import log4js, { ConsoleAppender, getLogger } from 'log4js'
import { AsyncLocalStorage } from 'async_hooks'
import { Request, Response, NextFunction } from 'express'

const pattern = '%[[%d{hh:mm:ss.SSS}][%p][%c][%f{2}:%l][%x{reqId}]%] %m'

const reqIdStorage = new AsyncLocalStorage()

const layout = {
  pattern,
  type: 'pattern',
  tokens: {
    reqId: (event: any) => {
      const reqId = reqIdStorage.getStore()
      if (reqId !== null && reqId !== undefined) {
        return reqId
      }
      return ''
    }
  }
}

const consoleAppender: ConsoleAppender = {
  type: 'console',
  layout
}

const fileAppender = {
  type: 'dateFile',
  encoding: 'utf-8',
  filename: `${process.env.LOG_PATH ?? 'logs/'}/api.log`,
  daysToKeep: 7,
  layout,
  keepFileExt: true
}

log4js.configure({
  appenders: {
    console: consoleAppender,
    file: fileAppender
  },
  categories: {
    default: {
      appenders: ['console'],
      level: 'trace',
      enableCallStack: true
    }
  }
})

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
  res.setHeader('X-Request-Id', reqId)
  reqIdStorage.run(reqId, () => {
    logger.info(req.method, req.originalUrl)
    next()
  })
}
