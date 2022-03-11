import { AsyncLocalStorage } from 'async_hooks'
import log4js, { ConsoleAppender, DateFileAppender, LogLevelFilterAppender, PatternLayout } from 'log4js'

const {
  LOG4JS_LEVEL = 'trace',
  LOG4JS_PATTERN = '%[[%d{hh:mm:ss.SSS}][%p][%c][%f{2}:%l][%x{reqId}]%] %m',
  LOG4JS_FILE = 'logs/api'
} = process.env

export const reqIdStorage = new AsyncLocalStorage<string>()

type GetReqId = (callback: (reqId: string) => Promise<any>, prefix?: string) => Promise<void>
export const getReqId: GetReqId = async (callback, prefix) => {
  return await new Promise((resolve, reject) => {
    const reqId = `${prefix !== undefined ? prefix + '/' : ''}${Math.random()}`
    reqIdStorage.run(reqId, () => {
      callback(reqId).then(() => {
        resolve()
      }).catch(e => {
        reject(e)
      })
    })
  })
}

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
  numBackups: 30,
  layout,
  keepFileExt: true
}

const debugFileAppender: DateFileAppender = {
  type: 'dateFile',
  encoding: 'utf-8',
  filename: `${LOG4JS_FILE}.deb`,
  numBackups: 7,
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
