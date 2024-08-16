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
  consume: (
    callback: (
      message: T,
      attributes?: Record<string, any>
    ) => Promise<void>,
    waitSec?: number,
    retrySec?: number,
    maxDiffMs?: number
  ) => Promise<void>
  startPool: (
    callback: (
      message: T,
      attributes?: Record<string, any>
    ) => Promise<void>,
    waitSec?: number,
    retrySec?: number,
    maxDiffMs?: number
  ) => Promise<void>
}
