import { S3FileStorage } from '../file-storage'
import { isNil } from '../utilities'

if (isNil(process.env.AWS_ACCESS) || isNil(process.env.AWS_SECRET)) {
  throw new Error('AWS_ACCESS or AWS_SECRET is not set')
}

const client = S3FileStorage({
  cdnPath: 'https://test.com',
  bucket: 'stora-dev-bucket'
})

const s3ListTest = async (): Promise<void> => {
  const files = await client.listFiles('test', {})
  console.log('files: ', files)
}

const s3UploadeTest = async (): Promise<void> => {
  const uploadResult = await client.uploadFile('test', 'test2.txt', Buffer.from('test'), 'plain/text')
  console.log('uploadResult: ', uploadResult)
}

const s3DownloadTest = async (): Promise<void> => {
  const downloadResult = await client.getFile('test/test2.txt')
  console.log('downloadResult: ', downloadResult.toString())
}

const s3DeleteTest = async (): Promise<void> => {
  const deleteResult = await client.deleteFile('test/test2.txt')
  console.log('deleteResult: ', deleteResult)
}

s3ListTest().catch(e => {
  console.error(e)
})
s3UploadeTest().catch(e => {
  console.error(e)
})
s3DownloadTest().catch(e => {
  console.error(e)
})
s3DeleteTest().catch(e => {
  console.error(e)
})
