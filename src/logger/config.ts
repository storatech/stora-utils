import { AsyncLocalStorage } from 'async_hooks'
import log4js, { ConsoleAppender, DateFileAppender, LogLevelFilterAppender, PatternLayout } from 'log4js'
import { isNil } from '../utilities'

const {
  LOG4JS_LEVEL = 'trace',
  LOG4JS_PATTERN = '%[[%d{hh:mm:ss.SSS}][%p][%c][%f{2}:%l][%x{reqId}]%] %m',
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

const fileAppender = (file: string): DateFileAppender => {
  return {
    type: 'dateFile',
    encoding: 'utf-8',
    filename: `${file}.log`,
    compress: true,
    numBackups: 30,
    layout,
    keepFileExt: true
  }
}

export const configureLogger = (file?: string): void => {
  const config: log4js.Configuration = {
    appenders: {
      consoleAppender,
    },
    categories: {
      default: {
        appenders: ['consoleAppender'],
        level: LOG4JS_LEVEL,
        enableCallStack: true
      }
    }
  }
  if (!isNil(file)) {
    config.appenders.logFileAppender = fileAppender(file)
    config.appenders.logAppender = {
      type: 'logLevelFilter',
      appender: 'logFileAppender',
      level: 'INFO'
    }
    config.categories.default.appenders.push('logAppender')

    config.appenders.debugFileAppender = fileAppender(file + '.deb')
    config.appenders.debugAppender = {
      type: 'logLevelFilter',
      appender: 'debugFileAppender',
      level: 'ALL'
    }
    config.categories.default.appenders.push('debugAppender')
  }
  log4js.configure(config)
}
