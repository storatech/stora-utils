import { Mongo } from ".";
import '../logger';


const mongo = Mongo('mongodb://localhost:27017', 'test')

const test = async (): Promise<void> => {
  await mongo.connect()
  const db = await mongo.database()
  const res = await db.collection('test1').findOne({})
  console.log(res)
}

test().catch(e => {
  console.error('e')
})
