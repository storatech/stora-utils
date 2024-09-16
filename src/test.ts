// import { getLogger } from 'log4js'
// import { Mongo, MongoCollection } from './database'
// import './logger'
// import { MoneyCalculator } from './money'

// // const mongo = Mongo('mongodb://localhost:27017', 'test')

// // const logger = getLogger('db-test')

// // interface Test {
// //   a: number
// // }

// // const testCollection = MongoCollection<Test>('test')

// // const test = async (deep: number): Promise<void> => {
// //   const conn = await mongo.database()
// //   await testCollection(conn).findOne({})
// //   await mongo.withTransaction<any>(async (session) => {
// //     const insertRes = await testCollection(conn).insertOne({
// //       a: 1
// //     }, {
// //       session
// //     })
// //     logger.info('insertRes', insertRes)
// //     if (deep > 3) {
// //       throw new Error('test error')
// //     }
// //     const updateRes = await testCollection(conn).findOneAndUpdate({
// //       _id: insertRes.insertedId
// //     }, {
// //       $inc: { a: 1 }
// //     }, {
// //       returnDocument: 'after',
// //       session
// //     })
// //     logger.info('updateRes', updateRes)
// //     if (deep < 5) {
// //       await test(deep + 1)
// //     }
// //   })
// // }
// // mongo.connect().then(async () => {
// //   await test(0)
// // }).catch(e => {
// //   logger.error('error', e)
// // })

// const money = MoneyCalculator({}, "MNT")
// const t = money.new('100.99', 'CNY')
// console.log(money.format(t))
// console.log(money.parse('¥100.99'))
