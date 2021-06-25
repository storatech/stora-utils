export const combineUrls = (baseUrl: string, ...urlParts: string[]): string => {
  if (urlParts.length === 0) {
    return baseUrl
  }
  const firstPart: string = urlParts.shift() ?? ''
  baseUrl = baseUrl.replace(/\/+$/, '') + '/' + firstPart.replace(/^\/+/, '')
  return combineUrls(baseUrl, ...urlParts)
}

// T[key] must be string | number | symbol
export const keyBy = <T extends { [key: string]: any }>(values: T[], key: keyof T | ((val: T) => string)): Record<string, T> => {
  return values.reduce<Record<string, T>>((map, cur) => {
    map[key instanceof Function ? key(cur) : cur[key]] = cur
    return map
  }, {})
}

// T[key] must be string | number | symbol
export const uniqBy = <T extends { [key: string]: any }>(values: T[], key: keyof T | ((val: T) => string)): T[] => {
  const map = keyBy(values, key)
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
