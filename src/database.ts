import { AsyncLocalStorage } from 'async_hooks'
import { getLogger } from 'log4js'
import { ClientSession, Collection, Db, Logger, MongoClient, MongoClientCommonOption, MongoClientOptions, SessionOptions } from 'mongodb'

const sessionStorage = new AsyncLocalStorage<ClientSession>()

export interface IMongo {
  connect: () => Promise<MongoClient>
  database: (dbname?: string, options?: MongoClientCommonOption) => Promise<Db>
  session: (options?: SessionOptions) => Promise<ClientSession>
  withTransaction: <T>(callback: (session: ClientSession) => Promise<T>, options?: SessionOptions) => Promise<T>
}

const logger = getLogger('db')

Logger.setLevel('debug')
Logger.filter('class', ['Cursor', 'Db'])
Logger.setCurrentLogger(function (msg, state) {
  const session = sessionStorage.getStore()
  logger.debug(state?.className, state?.pid, state?.message, session !== undefined ? 'session' : '')
})

export const Mongo = (url: string, db: string, options: MongoClientOptions = { useUnifiedTopology: true }): IMongo => {
  const client = new MongoClient(url, options)
  return {
    connect: async () => {
      await client.connect()
      console.debug('🔗 Connected to Mongo')
      return client
    },
    database: async (dbname, options) => {
      return client.db(dbname ?? db, options)
    },
    session: async (options) => {
      return client.startSession(options)
    },
    withTransaction: async<T> (callback: (session: ClientSession) => Promise<T>, options?: SessionOptions): Promise<T> => {
      const parentSession = sessionStorage.getStore()
      if (parentSession === undefined) {
        const session = client.startSession(options)
        console.debug('starting session')
        return await sessionStorage.run<Promise<T>>(session, async () => {
          session.startTransaction()
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
          } finally {
            await session.endSession()
            logger.debug('end session')
          }
        })
      } else {
        const ret = await callback(parentSession)
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
