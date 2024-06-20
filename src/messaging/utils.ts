import { CreateQueueCommand, CreateQueueCommandOutput, GetQueueAttributesCommand, GetQueueAttributesCommandOutput, GetQueueUrlCommand, GetQueueUrlCommandOutput, SQSClient } from '@aws-sdk/client-sqs'

import { getLogger } from 'log4js'
import { isNil } from '../utilities'

const sqs = new SQSClient({})

const logger = getLogger('messaging utils')

export interface GetQueueRes {
  QueueUrl: string
  QueueArn?: string
  Policy?: string
}

export const createQueue = async (queueName: string): Promise<void> => {
  const command = new CreateQueueCommand({
    QueueName: queueName
  })

  const res: CreateQueueCommandOutput = await sqs.send(command)
  logger.trace('CreateQueue', command, res)
}

export const getQueue = async (queueName: string): Promise<GetQueueRes> => {
  const command = new GetQueueUrlCommand({
    QueueName: queueName
  })

  const res: GetQueueUrlCommandOutput = await sqs.send(command)
  logger.trace('getQueue', command, res)

  const { QueueUrl } = res

  if (!isNil(QueueUrl)) {
    const command = new GetQueueAttributesCommand({
      QueueUrl,
      AttributeNames: ['QueueArn', 'Policy']
    })

    const res: GetQueueAttributesCommandOutput = await sqs.send(command)
    logger.trace('getQueueAttributes', command, res)

    const { Attributes } = res

    if (!isNil(Attributes)) {
      const { QueueArn, Policy } = Attributes

      return { QueueUrl, QueueArn, Policy }
    }
  }

  throw new Error('cant get queue Arn')
}
