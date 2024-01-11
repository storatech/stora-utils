import AWS from 'aws-sdk'
import { getLogger } from 'log4js'
import { ThreadPool } from '../concurrency'
import { isNil } from '../utilities'
import { getQueue } from './utils'

const sqs = new AWS.SQS({})
const logger = getLogger('messaging-queue')

export interface MessageQueue<T> {
  produce: (message: T, delaySec?: number) => Promise<void>
  consume: (callback: (message: T, attributes?: Record<string, any>) => Promise<void>, waitSec?: number, retrySec?: number, maxDiffMs?: number) => Promise<void>
}

const MessageQueueImpl = <T>(queueNameOrUrl: string, concurrentCount: number = 1): MessageQueue<T> => {
  const pool = ThreadPool(concurrentCount)
  const setup = async (): Promise<string> => {
    const { QueueUrl } = queueNameOrUrl.startsWith('http') ? { QueueUrl: queueNameOrUrl } : await getQueue(queueNameOrUrl)
    return QueueUrl;
  }
  const url = setup()
  return {
    consume: async (callback, waitSec = 10, retrySec = 10, maxDiffMs = 0) => {
      const QueueUrl = await url
      const req = {
        QueueUrl,
        WaitTimeSeconds: waitSec,
        MaxNumberOfMessages: concurrentCount,
        VisibilityTimeout: retrySec, // 10 minute
        AttributeNames: ['All']
      }
      let Messages: AWS.SQS.MessageList | undefined
      try {
        const res = await sqs.receiveMessage(req).promise()
        Messages = res.Messages
        logger.trace('receive message', req, res)
      } catch (e) {
        logger.debug('receive message error', e)
      }
      if (Messages !== undefined) {
        for (const Message of Messages) {
          const onMessage = async (): Promise<void> => {
            const { Body, ReceiptHandle } = Message
            if (Body !== undefined && ReceiptHandle !== undefined) {
              try {
                const body = JSON.parse(Body)
                if (!isNil(body) && !isNil(body.TopicArn)) {
                  const { Message, Timestamp, TopicArn, MessageAttributes } = body as { Message: string, Timestamp: string, TopicArn: string, MessageAttributes?: Record<string, {Type: String, Value: string}>}
                  const diff = new Date().getTime() - new Date(Timestamp).getTime()
                  logger.debug(`message received from ${TopicArn}, diff: ${diff}`)
                  if (maxDiffMs > 0 && maxDiffMs < diff) {
                    logger.debug('message too old ignored')
                  } else {
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
                  }
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
          await pool.submit(onMessage)
        }
      }
    },
    produce: async (message, delaySec = 0) => {
      const QueueUrl = await url
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
