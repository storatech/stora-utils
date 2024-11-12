import { AnalyticsData, SendAnalyticsEvent } from './types'
import { isNil } from '../utilities'
import { Mongo, MongoCollection } from '../database'
import { getLogger } from 'log4js'

const logger = getLogger('mongo-dumper')

const {
  ANALYTICS_URI = '',
  ANALYTICS_DB = ''
} = process.env

const collection = MongoCollection<AnalyticsData>('analytics')
let conn: any | undefined

export const sendAnalyticsEvent: SendAnalyticsEvent = async (event, data) => {
  if (isNil(conn)) {
    if (ANALYTICS_DB === '' || ANALYTICS_URI === '') {
      logger.warn('Missing Analytics MongoDB URI or DB')
      return
    }

    logger.info('Connecting to Analytics MongoDB')
    const mongo = Mongo(ANALYTICS_URI, ANALYTICS_DB)
    await mongo.connect()

    conn = await mongo.database()
  }

  collection(conn).insertOne({
    ...data,
    event,
    createdAt: new Date()
  }).catch((e) => {
    logger.error('Failed to insert analytics event', e)
  })
}
