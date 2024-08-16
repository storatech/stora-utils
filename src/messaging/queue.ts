import {
  SQSClient,
  ReceiveMessageCommand,
  ReceiveMessageCommandOutput,
  SendMessageCommand,
  SendMessageCommandOutput,
  DeleteMessageCommand,
  DeleteMessageCommandOutput
} from '@aws-sdk/client-sqs'

import { getLogger } from 'log4js'
import { ThreadPool } from '../concurrency'
import { isNil } from '../utilities'
import { getQueue } from './utils'
import { HandlerFunctionParams, MessageQueue } from './types'

const sqs = new SQSClient({})

const logger = getLogger('messaging-queue')

const handler = async <T>(params: HandlerFunctionParams<T>): Promise<void> => {
  const command = new ReceiveMessageCommand({
    QueueUrl: params.queueUrl,
    WaitTimeSeconds: params.waitSec,
    MaxNumberOfMessages: 1,
    VisibilityTimeout: params.retrySec,
    AttributeNames: ['All']
  })
  logger.trace('receive message command: ', command)

  try {
    const res: ReceiveMessageCommandOutput = await sqs.send(command)
    logger.trace('receive message output:', res)

    const Messages = res.Messages ?? []

    for (const Message of Messages) {
      const { Body, ReceiptHandle } = Message

      if (!isNil(Body) && !isNil(ReceiptHandle)) {
        try {
          const body = JSON.parse(Body)

          if (!isNil(body) && !isNil(body.TopicArn)) {
            const {
              Message,
              Timestamp,
              TopicArn,
              MessageAttributes
            } = body as {
              Message: string
              Timestamp: string
              TopicArn: string
              MessageAttributes?: Record<string, { Type: String, Value: string }>
            }

            const diff = new Date().getTime() - new Date(Timestamp).getTime()
            logger.debug(`message received from ${TopicArn}, diff: ${diff}`)

            if (!isNil(params.maxDiffMs) && params.maxDiffMs > 0 && params.maxDiffMs < diff) {
              logger.debug('message too old ignored')
              return
            }

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
                } catch (e) {}
              }
            }
            await params.callback(message, attributes)
          } else {
            const message = body
            await params.callback(message)
          }

          const command = new DeleteMessageCommand({
            QueueUrl: params.queueUrl,
            ReceiptHandle
          })
          logger.trace('delete message command: ', command)

          const res: DeleteMessageCommandOutput = await sqs.send(command)
          logger.trace('delete message res: ', res)
        } catch (e) {
          logger.error('subscribe error: ', e)
        }
      }
    }
  } catch (e) {
    logger.error('receive message error', e)
  }
}

const MessageQueueImpl = <T>(
  queueNameOrUrl: string,
  concurrentCount: number = 1
): MessageQueue<T> => {
  const pool = ThreadPool(concurrentCount)

  const setup = async (): Promise<string> => {
    const { QueueUrl } = queueNameOrUrl.startsWith('http') ? { QueueUrl: queueNameOrUrl } : await getQueue(queueNameOrUrl)
    return QueueUrl
  }

  const url = setup()

  return {
    produce: async (message, delaySec = 0) => {
      const QueueUrl = await url

      const command = new SendMessageCommand({
        QueueUrl,
        DelaySeconds: delaySec,
        MessageBody: JSON.stringify(message)
      })
      logger.trace('produce message command: ', command)

      const res: SendMessageCommandOutput = await sqs.send(command)
      logger.trace('produce message: ', command, res)
    },
    consume: async (callback, waitSec = 10, retrySec = 10, maxDiffMs = 0) => {
      const QueueUrl = await url

      const command = new ReceiveMessageCommand({
        QueueUrl,
        WaitTimeSeconds: waitSec,
        MaxNumberOfMessages: concurrentCount,
        VisibilityTimeout: retrySec, // 10 minute
        AttributeNames: ['All']
      })

      let Messages: ReceiveMessageCommandOutput['Messages'] | undefined

      try {
        const res: ReceiveMessageCommandOutput = await sqs.send(command)

        Messages = res.Messages

        logger.trace('receive message', command, res)
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
                  const { Message, Timestamp, TopicArn, MessageAttributes } = body as { Message: string, Timestamp: string, TopicArn: string, MessageAttributes?: Record<string, { Type: String, Value: string }> }
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

                const command = new DeleteMessageCommand({
                  QueueUrl,
                  ReceiptHandle
                })

                const res = await sqs.send(command)

                logger.trace('delete message', command, res)
              } catch (e) {
                logger.error('subsribe error', e)
              }
            }
          }

          pool.submit(onMessage)
        }
      }
    },
    startPool: async (callback, waitSec = 10, retrySec = 10, maxDiffMs = 0) => {
      for (let i = 0; i < concurrentCount; i++) {
        logger.info('Starting pool consumer: ', i)

        pool.submit(async () => {
          while (true) {
            // [OPTIMIZATION] waitSec: Will send fewer requests to the server when idle. AWS max is 20 seconds.
            await handler({ queueUrl: await url, callback, waitSec: i === 0 ? 10 : 20, retrySec, maxDiffMs })
          }
        })
      }
    }
  }
}

export default MessageQueueImpl
