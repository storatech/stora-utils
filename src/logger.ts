import log4js, { ConsoleAppender, getLogger, DateFileAppender, PatternLayout, LogLevelFilterAppender } from 'log4js'
import { AsyncLocalStorage } from 'async_hooks'
import { Request, Response, NextFunction } from 'express'

const {
  LOG4JS_LEVEL = 'trace',
  LOG4JS_PATTERN = '%[[%d{hh:mm:ss.SSS}][%p][%c][%f{2}:%l][%x{reqId}]%] %m',
  LOG4JS_FILE = 'logs/api'
} = process.env

const reqIdStorage = new AsyncLocalStorage<string>()

const layout: PatternLayout = {
  pattern: LOG4JS_PATTERN,
  type: 'pattern',
  tokens: {
    reqId: (event): string => {
      const reqId = reqIdStorage.getStore() ?? ''
      return reqId
    }
  }
}

const consoleAppender: ConsoleAppender = {
  type: 'console',
  layout
}

const logFileAppender: DateFileAppender = {
  type: 'dateFile',
  encoding: 'utf-8',
  filename: `${LOG4JS_FILE}.log`,
  daysToKeep: 30,
  layout,
  keepFileExt: true
}

const debugFileAppender: DateFileAppender = {
  type: 'dateFile',
  encoding: 'utf-8',
  filename: `${LOG4JS_FILE}.deb`,
  daysToKeep: 7,
  layout,
  keepFileExt: true
}

const logAppender: LogLevelFilterAppender = {
  type: 'logLevelFilter',
  appender: 'logFileAppender',
  level: 'INFO'
}

const debugAppender: LogLevelFilterAppender = {
  type: 'logLevelFilter',
  appender: 'debugFileAppender',
  level: 'ALL'
}

log4js.configure({
  appenders: {
    consoleAppender,
    logFileAppender,
    debugFileAppender,
    logAppender,
    debugAppender
  },
  categories: {
    default: {
      appenders: ['consoleAppender', 'logAppender', 'debugAppender'],
      level: LOG4JS_LEVEL,
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
  res.setHeader('X-Request-Id', `${reqId}`)
  reqIdStorage.run(`${reqId}`, () => {
    logger.info(req.method, req.originalUrl)
    next()
  })
}
