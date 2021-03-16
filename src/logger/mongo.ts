import { getLogger } from 'log4js'
import { Logger } from 'mongodb'

const logger = getLogger('db')

Logger.setLevel('debug')
Logger.filter('class', ['Cursor', 'Db'])
Logger.setCurrentLogger(function (msg, state) {
  logger.debug(state?.className, state?.pid, state?.message)
})
