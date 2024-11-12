export type SendAnalyticsEvent = (
  event: string,
  data: Object // TODO better type
) => Promise<void>

export interface AnalyticsData {
  event: string
  [key: string]: any
}
