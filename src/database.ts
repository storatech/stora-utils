import { AsyncLocalStorage } from 'async_hooks'
import { getLogger } from 'log4js'
import { ClientSession, Collection, Db, Logger, MongoClient, MongoClientCommonOption, SessionOptions } from 'mongodb'

const sessionStorage = new AsyncLocalStorage<ClientSession>()

export interface IMongo {
  connect: () => void
  database: (dbname?: string, options?: MongoClientCommonOption) => Promise<Db>
  session: (options?: SessionOptions) => Promise<ClientSession>
  withTransaction: <T>(callback: () => Promise<T>, options?: SessionOptions) => Promise<T>
}

const logger = getLogger('db')

export const Mongo = (url: string, db: string): IMongo => {
  const client = new MongoClient(url, {
    useUnifiedTopology: true
  })
  Logger.setLevel('debug')
  Logger.filter('class', ['Cursor', 'Db'])
  Logger.setCurrentLogger(function (msg, state) {
    logger.debug(state?.className, state?.pid, state?.message)
  })
  return {
    connect: async () => {
      await client.connect()
      logger.info('🔗 Connected to Mongo')
    },
    database: async (dbname, options) => {
      return client.db(dbname ?? db, options)
    },
    session: async (options) => {
      return client.startSession(options)
    },
    withTransaction: async<T> (callback: () => Promise<T>, options?: SessionOptions): Promise<T> => {
      const parentSession = sessionStorage.getStore()
      if (parentSession !== undefined) {
        const session = client.startSession(options)
        logger.debug('starting session')
        return await sessionStorage.run<Promise<T>>(session, async () => {
          session.startTransaction()
          logger.debug('starting transaction')
          try {
            const ret = await callback()
            await session.commitTransaction()
            logger.debug('commit transaction')
            return ret
          } catch (e) {
            await session.abortTransaction()
            logger.debug('rollback transaction')
            throw e
          }
        })
      } else {
        const ret = await callback()
        return ret
      }
    }
  }
}

export function MongoCollection<T> (name: string): (conn: Db) => Collection<T> {
  return (conn) => {
    return conn.collection(name)
  }
}
