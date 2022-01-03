import AWS from 'aws-sdk'
import { getLogger } from 'log4js'
import { getQueue } from './utils'

const sqs = new AWS.SQS({})
const logger = getLogger('messaging-queue')

type MessageQueue = <T>(queueNameOrUrl: string) => Promise<{
  produce: (message: T, delaySec?: number) => Promise<void>
  consume: (callback: (message: T, attributes?: Record<string, any>) => Promise<void>, waitSec?: number) => Promise<void>
}>

const MessageQueueImpl: MessageQueue = async (queueNameOrUrl) => {
  const { QueueUrl } = queueNameOrUrl.startsWith('http') ? { QueueUrl: queueNameOrUrl } : await getQueue(queueNameOrUrl)
  return {
    consume: async (callback, waitSec: number = 10) => {
      const req = {
        QueueUrl,
        WaitTimeSeconds: waitSec,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: 10, // 10 minute
        AttributeNames: ['All']
      }
      let Messages: AWS.SQS.MessageList | undefined
      try {
        const res = await sqs.receiveMessage(req).promise()
        Messages = res.Messages
        logger.trace('receive message', req, res)
      } catch (e) {
        logger.debug('receive message error')
      }
      if (Messages !== undefined) {
        for (const Message of Messages) {
          const { Body, ReceiptHandle } = Message
          if (Body !== undefined && ReceiptHandle !== undefined) {
            try {
              const body = JSON.parse(Body)
              if (body.TopicArn !== undefined) {
                const { Message, Timestamp, TopicArn, MessageAttributes } = body as { Message: string, Timestamp: string, TopicArn: string, MessageAttributes?: Record<string, {Type: String, Value: string}>}
                const diff = new Date().getTime() - new Date(Timestamp).getTime()
                logger.debug(`message received from ${TopicArn}, diff: ${diff}`)
                const message = JSON.parse(Message)
                const attributes: Record<string, any> = {}
                if (MessageAttributes !== undefined) {
                  for (const key in MessageAttributes) {
                    const Attribute = MessageAttributes[key]
                    const { Type, Value } = Attribute
                    try {
                      if (Type === 'String') {
                        attributes[key] = Value
                      }
                      if (Type === 'Number') {
                        attributes[key] = parseInt(Value, 10)
                      }
                      if (Type === 'String.Array') {
                        attributes[key] = JSON.parse(Value)
                      }
                    } catch (e) {
                    }
                  }
                }
                await callback(message, attributes)
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

export default MessageQueueImpl
