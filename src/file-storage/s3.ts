import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { FileStorage, S3Config } from './types'
import { getLogger } from 'log4js'
import { isNil } from '../utilities'

const logger = getLogger('S3FileStorage')

export const S3FileStorage = (config: S3Config): FileStorage => {
  const s3 = new S3Client({})

  const { cdnPath } = config

  return {
    listFiles: async (path: string, filter: any): Promise<string[]> => {
      logger.trace('listFiles request:', path, filter)
      const command = new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: path,
        Delimiter: '/'
      })

      const res = await s3.send(command)

      const files = res.Contents?.map(f => `${path}/${f.Key as string}`) ?? []

      logger.trace('listFiles response:', files)
      return files
    },
    getFile: async (path: string): Promise<Buffer> => {
      logger.trace('getFile request:', path)

      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: `${cdnPath}/${path}`
      })

      const res = await s3.send(command)

      if (isNil(res) || isNil(res.Body)) {
        throw new Error('cant get object')
      }

      return Buffer.from(await res.Body.transformToByteArray())
    },
    uploadFile: async (path: string, name: string, data: Buffer, contentType: string): Promise<string> => {
      logger.trace('uploadFile request:', name, path)

      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: `${cdnPath}/${path}/${name}`,
        Body: data,
        ContentType: contentType
      })

      const res = await s3.send(command)

      logger.trace('uploadFile response:', res)

      return `${cdnPath}/${path}/${name}`
    },
    deleteFile: async (path: string): Promise<void> => {
      logger.trace('deleteFile request:', path)

      const command = new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: path
      })

      const res = await s3.send(command)

      logger.trace('deleteFile response:', res)
    }
  }
}
