import { AsyncLocalStorage } from 'async_hooks'
import { getLogger } from 'log4js'
import { ClientSession, Collection, Db, Logger, MongoClient, MongoClientCommonOption, MongoClientOptions, SessionOptions, TransactionOptions } from 'mongodb'

const logger = getLogger('db')

const sessionStorage = new AsyncLocalStorage<ClientSession>()

Logger.setLevel('debug')
Logger.filter('class', ['Cursor', 'Db'])
Logger.setCurrentLogger(function (msg, state) {
  const session = sessionStorage.getStore()
  logger.debug(state?.className, state?.pid, state?.message, session !== undefined ? 'session' : '')
})

type MongoCollection = <T> (name: string) => ((conn: Db) => Collection<T>)
export const MongoCollectionImpl: MongoCollection = (name) => {
  return (conn) => {
    return conn.collection(name)
  }
}

type Mongo = (url: string, db: string, options?: MongoClientOptions) => {
  connect: () => Promise<MongoClient>
  isConnected: (options?: MongoClientCommonOption) => boolean
  disconnect: (force?: boolean) => Promise<void>
  database: (dbname?: string, options?: MongoClientCommonOption) => Promise<Db>
  session: (options?: SessionOptions) => Promise<ClientSession>
  withTransaction: <T>(callback: (session: ClientSession) => Promise<T>, options?: TransactionOptions) => Promise<T>
}

export const MongoImpl: Mongo = (url, db, options = { useUnifiedTopology: true }) => {
  const client = new MongoClient(url, options)
  return {
    connect: async () => {
      await client.connect()
      logger.debug('🔗 Connected to Mongo')
      return client
    },
    isConnected: (options) => {
      return client.isConnected(options)
    },
    disconnect: async (force) => {
      await client.close(force)
    },
    database: async (dbname, options) => {
      return client.db(dbname ?? db, options)
    },
    session: async (options) => {
      return client.startSession(options)
    },
    withTransaction: async<T> (callback: (session: ClientSession) => Promise<T>, options?: TransactionOptions): Promise<T> => {
      const parentSession = sessionStorage.getStore()
      if (parentSession === undefined) {
        const session = client.startSession()
        logger.debug('starting session')
        try {
          return await sessionStorage.run<Promise<T>>(session, async () => {
            session.startTransaction(options)
            logger.debug('starting transaction')
            try {
              const ret = await callback(session)
              await session.commitTransaction()
              logger.debug('commit transaction')
              return ret
            } catch (e) {
              await session.abortTransaction()
              logger.debug('rollback transaction')
              throw e
            }
          })
        } finally {
          await session.endSession()
          logger.debug('end session')
        }
      } else {
        const ret = await callback(parentSession)
        return ret
      }
    }
  }
}

export default MongoImpl
