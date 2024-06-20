// import AWS from 'aws-sdk'
import { SQSClient, SetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { PublishCommand, PublishCommandOutput, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns'
import { getLogger } from 'log4js'
import { GetQueueRes, createQueue, getQueue } from './utils'
import { isNil } from '../utilities'

const sqs = new SQSClient({})

const sns = new SNSClient({})

const logger = getLogger('messaging-topic')

interface Message<T> {
  stringAttributes?: Record<string, string>
  arrayAttributes?: Record<string, string[]>
  numberAttributes?: Record<string, number>
  body: T
}

interface Policy {
  Version: string
  Id: string
  Statement: any[]
}

interface Attribute {
  DataType: 'Number' | 'String' | 'String.Array'
  StringValue: string
}

type StringFilter = string | { exists: boolean } | { 'anything-but': string[] } | { prefix: string }
type NumberFilter = number | { 'numberic': ['>' | '=' | '<=' | '>=', number] } | { exists: boolean } | { 'anything-but': number[] }

export interface MessageFilter {
  stringFilters?: Record<string, StringFilter[]>
  numberFilters?: Record<string, NumberFilter[]>
}

export interface MessageTopic<T> {
  publish: (message: Message<T>) => Promise<void>
  subscribe: (name: string, filter: MessageFilter) => Promise<void>
}

const MessageTopicImpl = <T>(topicArn: string): MessageTopic<T> => {
  return {
    publish: async (message) => {
      const { stringAttributes, numberAttributes, arrayAttributes, body } = message
      const json = JSON.stringify(body)
      const attributes: Record<string, Attribute> = {}
      if (stringAttributes !== undefined) {
        for (const key of Object.keys(stringAttributes)) {
          const stringValue = stringAttributes[key]
          if (stringValue !== undefined) {
            const attribute: Attribute = {
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
            const attribute: Attribute = {
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
            const attribute: Attribute = {
              DataType: 'String.Array',
              StringValue: JSON.stringify(arrayValue)
            }
            attributes[key] = attribute
          }
        }
      }

      const command = new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({ default: json, sqs: json }),
        MessageAttributes: attributes,
        MessageStructure: 'json'
      })

      const res: PublishCommandOutput = await sns.send(command)

      logger.trace('publish message', command, res)
    },
    subscribe: async (name, filter) => {
      let queue: GetQueueRes | undefined

      try {
        queue = await getQueue(name)
      } catch {
        await createQueue(name)
        queue = await getQueue(name)
      }

      if (isNil(queue)) {
        throw new Error('Get queue failed.')
      }

      const { QueueArn, QueueUrl } = queue

      if (isNil(QueueArn)) {
        throw new Error('Queue Arn not found.')
      }

      const defaultPolicy: Policy = {
        Version: '2008-10-17',
        Id: `${QueueArn}/SQSPOLICY`,
        Statement: []
      }

      const {
        Policy = JSON.stringify(defaultPolicy)
      } = queue

      logger.trace(Policy)

      const policy: Policy = JSON.parse(Policy)

      const { Statement } = policy

      let existingPolicy = false

      for (const value of Statement) {
        logger.info(value)
        if (value.Sid === `topic-subscription-${topicArn}`) {
          existingPolicy = true
        }
      }

      if (!existingPolicy) {
        Statement.push({
          Sid: `topic-subscription-${topicArn}`,
          Effect: 'Allow',
          Principal: {
            Service: 'sns.amazonaws.com'
          },
          Action: ['SQS:SendMessage'],
          Resource: QueueArn,
          Condition: {
            ArnEquals: {
              'aws:SourceArn': topicArn
            }
          }
        })

        const command = new SetQueueAttributesCommand({
          QueueUrl,
          Attributes: {
            Policy: JSON.stringify(policy)
          }
        })
        logger.trace('SQS.setQueueAttributes', command)

        const res = await sqs.send(command)
        logger.trace('SQS.setQueueAttributes', res, command)
      }

      const { stringFilters, numberFilters } = filter
      const FilterPolicy = JSON.stringify({ ...stringFilters, ...numberFilters })

      const command = new SubscribeCommand({
        Protocol: 'sqs',
        TopicArn: topicArn,
        Attributes: {
          FilterPolicy
        },
        Endpoint: QueueArn
      })
      logger.trace('SQS.subscribe', command)

      const res = await sns.send(command)
      logger.trace('SQS.subscribe', command, res)
    }
  }
}

export default MessageTopicImpl
