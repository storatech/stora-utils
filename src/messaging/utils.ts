import AWS from 'aws-sdk'
import { getLogger } from 'log4js'

const sqs = new AWS.SQS({})
const logger = getLogger('messaging')

export const getQueue = async (queueName: string): Promise<{QueueUrl: string, QueueArn: string, Policy: string}> => {
  const req: AWS.SQS.Types.GetQueueUrlRequest = {
    QueueName: queueName
  }
  const res = await sqs.getQueueUrl(req).promise()
  const { QueueUrl } = res

  if (QueueUrl !== undefined) {
    const req: AWS.SQS.GetQueueAttributesRequest = {
      QueueUrl,
      AttributeNames: ['QueueArn', 'Policy']
    }
    const res = await sqs.getQueueAttributes(req).promise()
    logger.trace('getQueue', req, res)
    const { Attributes } = res
    if (Attributes !== undefined) {
      const { QueueArn, Policy } = Attributes
      return { QueueUrl, QueueArn, Policy }
    }
  }
  throw new Error('cant get queue ANR')
}
