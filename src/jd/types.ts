export interface JDCachedToken {
  accessToken: string
  expireIn: Date
}

export interface JDConfig {
  baseUrl: string
  appKey: string
  appSecret: string
  format?: string
  version?: string
}

export interface JDParams {
  request: Record<string, any>
}
