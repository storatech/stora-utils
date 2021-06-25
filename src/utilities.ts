export const combineUrls = (baseUrl: string, ...urlParts: string[]): string => {
  if (urlParts.length === 0) {
    return baseUrl
  }
  const firstPart: string = urlParts.shift() ?? ''
  baseUrl = baseUrl.replace(/\/+$/, '') + '/' + firstPart.replace(/^\/+/, '')
  return combineUrls(baseUrl, ...urlParts)
}

export function keyBy<T extends Record<K, string>, K extends keyof T> (values: T[], key: K): Record<string, T>
export function keyBy<T extends Record<K, number>, K extends keyof T> (values: T[], key: K): Record<number, T>
export function keyBy<T extends Record<K, string | number>, K extends keyof T> (values: T[], key: K): Record<string | number, T> {
  return values.reduce<Record<string | number, T>>((map, cur) => {
    map[cur[key]] = cur
    return map
  }, {})
}

export function uniqBy<T extends Record<K, string>, K extends keyof T> (values: T[], key: K): T[]
export function uniqBy<T extends Record<K, number>, K extends keyof T> (values: T[], key: K): T[]
export function uniqBy<T extends Record<K, string | number>, K extends keyof T> (values: T[], key: K): T[] {
  const map = values.reduce<Record<string | number, T>>((map, cur) => {
    map[cur[key]] = cur
    return map
  }, {})
  return Object.values(map)
}

export const isNil = (value: any): value is null | undefined => {
  return value === null || value === undefined
}

export const isNonEmptyString = (value: string | null | undefined): value is string => {
  return (value ?? '').trim() !== ''
}

export const isNonEmptyValue = (value: any): boolean => {
  if (value === undefined || value === null) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim() !== ''
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0
  }
  return true
}
