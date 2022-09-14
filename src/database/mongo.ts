import { AsyncLocalStorage } from 'async_hooks'
import { getLogger } from 'log4js'
import { ClientSession, ClientSessionOptions, Collection, Db, DbOptions, MongoClient, MongoClientOptions, TransactionOptions } from 'mongodb'

const logger = getLogger('db')

const sessionStorage = new AsyncLocalStorage<ClientSession>()

export const MongoCollection: <A> (name: string) => ((conn: Db) => Collection<A>) = (name) => {
  return (conn) => {
    return conn.collection(name)
  }
}

type Mongo = (url: string, db: string, options?: MongoClientOptions) => {
  connect: () => Promise<MongoClient>
  isConnected: () => Promise<boolean>
  disconnect: (force?: boolean) => Promise<void>
  database: (dbname?: string, options?: DbOptions) => Promise<Db>
  session: (options?: ClientSessionOptions) => Promise<ClientSession>
  withTransaction: <T>(callback: (session: ClientSession) => Promise<T>, options?: TransactionOptions) => Promise<T>
}

export const MongoImpl: Mongo = (url, db, options) => {
  options = { monitorCommands: true }
  const client = new MongoClient(url, options)
  client.on('commandStarted', (event) => {
    logger.trace(`${event.commandName}|${event.connectionId ?? ''}:${event.requestId}`, JSON.stringify(event.command))
  })
  client.on('commandSucceeded', (event) => {
    logger.trace(`${event.commandName}|${event.connectionId ?? ''}:${event.requestId}`, JSON.stringify(event.reply))
  })
  client.on('commandFailed', (event) => {
    logger.trace(`${event.commandName}|${event.connectionId ?? ''}:${event.requestId}`, JSON.stringify(event.failure.message))
  })
  return {
    connect: async () => {
      await client.connect()
      logger.debug('🔗 Connected to Mongo')
      return client
    },
    isConnected: async () => {
      await client.db(db).command({
        ping: 1
      })
      return true
    },
    disconnect: async (force) => {
      await client.close(force ?? false)
    },
    database: async (dbname, options) => {
      return client.db(dbname ?? db, options)
    },
    session: async (options) => {
      if (options !== undefined) {
        return client.startSession(options)
      }
      return client.startSession()
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
