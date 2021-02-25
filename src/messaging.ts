import AWS from 'aws-sdk'
import { getLogger } from 'log4js'

const sqs = new AWS.SQS({})
const sns = new AWS.SNS({})
const logger = getLogger('messaging')

export interface IMessage<T> {
  type: string
  event: string
  body: T
}

export interface IMessageQueue<T> {
  produce: (message: IMessage<T>, delaySec?: number) => Promise<void>
  consume: (callback: (message: IMessage<T>, waitSec?: number) => Promise<void>) => Promise<void>
}

export interface IMessageTopic<T> {
  publish: (message: IMessage<T>) => Promise<void>
}

const getQueue = async (queueName: string, isCreate: boolean = true): Promise<{QueueUrl: string, QueueArn: string, Policy: string}> => {
  const req = {
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
    logger.debug('getQueue', req, res)
    const { Attributes } = res
    if (Attributes !== undefined) {
      const { QueueArn, Policy } = Attributes
      return { QueueUrl, QueueArn, Policy }
    }
  }
  throw new Error('cant get queue ANR')
}

export async function MessageQueue<T> (queueName: string): Promise<IMessageQueue<T>> {
  const { QueueUrl } = await getQueue(queueName)
  return {
    consume: async (callback, waitSec: number = 10) => {
      const req = {
        QueueUrl,
        WaitTimeSeconds: waitSec,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: 10, // 10 minute
        AttributeNames: ['All']
      }
      const res = await sqs.receiveMessage(req).promise()
      logger.trace('receive message', req, res)
      const { Messages } = res
      if (Messages !== undefined) {
        for (const Message of Messages) {
          const { Body, ReceiptHandle } = Message
          if (Body !== undefined && ReceiptHandle !== undefined) {
            try {
              const body = JSON.parse(Body)
              if (body.TopicArn !== undefined) {
                const { Message, Timestamp, TopicArn } = body as { Message: string, Timestamp: string, TopicArn: string}
                const diff = new Date().getTime() - new Date(Timestamp).getTime()
                logger.debug(`message received from ${TopicArn}, diff: ${diff}`)
                const message = JSON.parse(Message)
                await callback(message)
              } else {
                const message = body
                await callback(message)
              }
              const req = {
                QueueUrl,
                ReceiptHandle
              }
              const res = await sqs.deleteMessage(req).promise()
              logger.trace('delete message', res)
            } catch (e) {
              logger.error('subsribe error', e)
            }
          }
        }
      }
    },
    produce: async (message, delaySec = 0) => {
      const { type, event } = message
      const req: AWS.SQS.Types.SendMessageRequest = {
        QueueUrl,
        DelaySeconds: delaySec,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          type: {
            DataType: 'String',
            StringValue: type
          },
          event: {
            DataType: 'String',
            StringValue: event
          }
        }
      }
      const res = await sqs.sendMessage(req).promise()
      logger.debug('produce message', req, res)
    }
  }
}

export async function MessageTopic<T> (TopicArn: string): Promise<IMessageTopic<T>> {
  return {
    publish: async (message) => {
      const { type, event } = message
      const json = JSON.stringify(message)
      const req: AWS.SNS.PublishInput = {
        TopicArn,
        Message: JSON.stringify({ default: json, sqs: json }),
        MessageAttributes: {
          type: {
            DataType: 'String',
            StringValue: type
          },
          event: {
            DataType: 'String',
            StringValue: event
          }
        },
        MessageStructure: 'json'
      }
      const res = await sns.publish(req).promise()
      logger.debug('publish message', req, res)
    }
  }
}
