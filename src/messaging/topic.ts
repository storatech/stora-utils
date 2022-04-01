import AWS from 'aws-sdk'
import { getLogger } from 'log4js'
import { getQueue } from './utils'

const sqs = new AWS.SQS({})
const sns = new AWS.SNS({})
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

type StringFilter = string | {exists: boolean} | {'anything-but': string[]} | {prefix: string}
type NumberFilter = number | {'numberic': ['>' | '=' | '<=' | '>=', number]} | {exists: boolean} | {'anything-but': number[]}

export interface MessageFilter {
  stringFilters?: Record<string, StringFilter[]>
  numberFilters?: Record<string, NumberFilter[]>
}

interface MessageTopic<T> {
  publish: (message: Message<T>) => Promise<void>
  subscribe: (name: string, filter: MessageFilter) => Promise<void>
}

const MessageTopicImpl = async <T>(topicArn: string): Promise<MessageTopic<T>> => {
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
      const req: AWS.SNS.PublishInput = {
        TopicArn: topicArn,
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
      const defaultPolicy: Policy = {
        Version: '2008-10-17',
        Id: `${QueueArn}/SQSPOLICY`,
        Statement: []
      }
      const {
        Policy = JSON.stringify(defaultPolicy)
      } = queue
      console.log(Policy)
      const policy: Policy = JSON.parse(Policy)
      const { Statement } = policy
      let existingPolicy = false
      Statement.map((value) => {
        logger.info(value)
        if (value.Sid === `topic-subscription-${topicArn}`) {
          existingPolicy = true
        }
      })
      if (!existingPolicy) {
        Statement.push({
          Sid: `topic-subscription-${topicArn}`,
          Effect: 'Allow',
          Principal: {
            Service: 'sns.amazonaws.com'
            // AWS: '*'
          },
          Action: ['SQS:SendMessage'],
          Resource: QueueArn,
          Condition: {
            ArnEquals: {
              'aws:SourceArn': topicArn
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
        TopicArn: topicArn,
        Attributes: {
          FilterPolicy
        },
        Endpoint: QueueArn
      }
      logger.trace('SQS.subscribe', req)
      await sns.subscribe(req).promise()
    }
  }
}

export default MessageTopicImpl
