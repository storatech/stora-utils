import { getLogger } from 'log4js'
import { ClientSession, Collection, Db, Logger, MongoClient, MongoClientCommonOption, SessionOptions } from 'mongodb'

export interface IMongo {
  connect: () => void
  database: (dbname?: string, options?: MongoClientCommonOption) => Promise<Db>
  session: (options?: SessionOptions) => Promise<ClientSession>
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
    }
  }
}

export function MongoCollection<T> (name: string): (conn: Db) => Collection<T> {
  return (conn) => {
    return conn.collection(name)
  }
}
