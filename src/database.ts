import { getLogger } from 'log4js'
import { ClientSession, Collection, Db, Logger, MongoClient, MongoClientCommonOption, SessionOptions } from 'mongodb'

export interface IMongo {
  connect: (url: string) => void
  database: (dbname: string, options?: MongoClientCommonOption) => Promise<Db>
  session: (options?: SessionOptions) => Promise<ClientSession>
  collection: <T>(name: string) => (conn: Db) => Collection<T>
}

const logger = getLogger('db')

export const Mongo = (url: string): IMongo => {
  const client = new MongoClient(url, {
    useUnifiedTopology: true
  })
  Logger.setLevel('debug')
  Logger.filter('class', ['Cursor', 'Db'])
  Logger.setCurrentLogger(function (msg, state) {
    logger.debug(state?.className, state?.pid, state?.message)
  })
  return {
    connect: async (url) => {
      await client.connect()
      logger.info('🔗 Connected to Mongo')
    },
    database: async (dbname, options) => {
      return client.db(dbname, options)
    },
    session: async (options) => {
      return client.startSession(options)
    },
    collection: <T>(name: string) => {
      return (conn) => {
        return conn.collection<T>(name)
      }
    }
  }
}
