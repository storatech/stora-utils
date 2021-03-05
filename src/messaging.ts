import AWS from 'aws-sdk'
import { getLogger } from 'log4js'

const sqs = new AWS.SQS({})
const sns = new AWS.SNS({})
const logger = getLogger('messaging')

export interface IMessage<T> {
  stringAttributes?: Record<string, string>
  arrayAttributes?: Record<string, string[]>
  numberAttributes?: Record<string, number>
  body: T
}

interface IPolicy {
  Version: string
  Id: string
  Statement: any[]
}

interface IAttribute {
  DataType: 'Number' | 'String' | 'String.Array'
  StringValue: string
}

type IStringFilter = string | {exists: boolean} | {'anything-but': string[]} | {prefix: string}
type INumberFilter = {'numberic': ['>' | '=' | '<=' | '>=', number]} | {exists: boolean}

export interface IMessageFilter {
  stringFilters?: Record<string, IStringFilter[]>
  numberFilters?: Record<string, INumberFilter[]>
}

export interface IMessageQueue<T> {
  produce: (message: T, delaySec?: number) => Promise<void>
  consume: (callback: (message: T) => Promise<void>, waitSec?: number) => Promise<void>
}

export interface IMessageTopic<T> {
  publish: (message: IMessage<T>) => Promise<void>
  subscribe: (name: string, filter: IMessageFilter) => Promise<void>
}

const getQueue = async (queueName: string): Promise<{QueueUrl: string, QueueArn: string, Policy: string}> => {
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
      const req: AWS.SQS.Types.SendMessageRequest = {
        QueueUrl,
        DelaySeconds: delaySec,
        MessageBody: JSON.stringify(message)
      }
      const res = await sqs.sendMessage(req).promise()
      logger.debug('produce message', req, res)
    }
  }
}

export async function MessageTopic<T> (TopicArn: string): Promise<IMessageTopic<T>> {
  return {
    publish: async (message) => {
      const { stringAttributes, numberAttributes, arrayAttributes, body } = message
      const json = JSON.stringify(body)
      const attributes: Record<string, IAttribute> = {}
      if (stringAttributes !== undefined) {
        for (const key of Object.keys(stringAttributes)) {
          const stringValue = stringAttributes[key]
          if (stringValue !== undefined) {
            const attribute: IAttribute = {
              DataType: 'String',
              StringValue: stringValue
            }
            attributes[key] = attribute
          }
        }
      }
      if (numberAttributes !== undefined) {
        for (const key of Object.keys(numberAttributes)) {
          const numberValue = numberAttributes[key]
          if (numberValue !== undefined) {
            const attribute: IAttribute = {
              DataType: 'Number',
              StringValue: JSON.stringify(numberValue)
            }
            attributes[key] = attribute
          }
        }
      }
      if (arrayAttributes !== undefined) {
        for (const key of Object.keys(arrayAttributes)) {
          const arrayValue = arrayAttributes[key]
          if (arrayValue !== undefined) {
            const attribute: IAttribute = {
              DataType: 'String.Array',
              StringValue: JSON.stringify(arrayValue)
            }
            attributes[key] = attribute
          }
        }
      }
      const req: AWS.SNS.PublishInput = {
        TopicArn,
        Message: JSON.stringify({ default: json, sqs: json }),
        MessageAttributes: attributes,
        MessageStructure: 'json'
      }
      const res = await sns.publish(req).promise()
      logger.debug('publish message', req, res)
    },
    subscribe: async (name, filter) => {
      try {
        await sqs.createQueue({
          QueueName: name
        }).promise()
      } catch (e) {
        logger.trace('create error', e)
      }
      const queue = await getQueue(name)
      const { QueueArn, QueueUrl } = queue
      const defaultPolicy: IPolicy = {
        Version: '2008-10-17',
        Id: `${QueueArn}/SQSPOLICY`,
        Statement: []
      }
      const {
        Policy = JSON.stringify(defaultPolicy)
      } = queue
      console.log(Policy)
      const policy: IPolicy = JSON.parse(Policy)
      const { Statement } = policy
      let existingPolicy = false
      Statement.map((value) => {
        logger.info(value)
        if (value.Sid === `topic-subscription-${TopicArn}`) {
          existingPolicy = true
        }
      })
      if (!existingPolicy) {
        Statement.push({
          Sid: `topic-subscription-${TopicArn}`,
          Effect: 'Allow',
          Principal: {
            Service: 'sns.amazonaws.com'
            // AWS: '*'
          },
          Action: ['SQS:SendMessage'],
          Resource: QueueArn,
          Condition: {
            ArnEquals: {
              'aws:SourceArn': TopicArn
            }
          }
        })
        {
          const req: AWS.SQS.SetQueueAttributesRequest = {
            QueueUrl,
            Attributes: {
              Policy: JSON.stringify(policy)
            }
          }
          logger.trace('SQS.setQueueAttributes', req)
          await sqs.setQueueAttributes(req).promise()
        }
      }
      const { stringFilters, numberFilters } = filter
      const FilterPolicy = JSON.stringify({ ...stringFilters, ...numberFilters })
      const req = {
        Protocol: 'sqs',
        TopicArn,
        Attributes: {
          FilterPolicy,
          RawMessageDelivery: 'true'
        },
        Endpoint: QueueArn
      }
      logger.trace('SQS.subscribe', req)
      await sns.subscribe(req).promise()
    }
  }
}
