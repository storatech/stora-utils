export interface HandlerFunctionParams<T> {
  queueUrl: string
  callback: (
    message: T,
    attributes?: Record<string, any>
  ) => Promise<void>
  waitSec?: number
  retrySec?: number
  maxDiffMs?: number
}

export interface MessageQueue<T> {
  produce: (message: T, delaySec?: number) => Promise<void>
  /**
 * @deprecated Will be removed at v3. It is recommended to use startConsume instead. WARNING: This method may consume some messages duplicatedly.
 */
  consume: (
    callback: (
      message: T,
      attributes?: Record<string, any>
    ) => Promise<void>,
    waitSec?: number,
    retrySec?: number,
    maxDiffMs?: number
  ) => Promise<void>
  startConsume: (
    callback: (
      message: T,
      attributes?: Record<string, any>
    ) => Promise<void>,
    waitSec?: number,
    retrySec?: number,
    maxDiffMs?: number
  ) => Promise<void>
}
