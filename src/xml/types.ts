import dayjs from 'dayjs'

type XmlParser<T> = (value?: string) => T | undefined
type XmlFormatter<T> = (value?: T) => string | undefined

export type XmlTransformer<T> = () => {
  parser: XmlParser<T>
  formatter: XmlFormatter<T>
}

export type XmlDef<T> = (XmlObject<T> | XmlTransformer<T | undefined>)

export type XmlObject<T> = {
  [Z in keyof T]?: (T extends [] ? XmlDef<T[number]> : XmlDef<T[Z]>)
}

export const XmlBoolean = (trueValue: string, falseValue: string): XmlTransformer<boolean | undefined> => {
  return () => {
    return {
      parser: (value) => {
        if (value === undefined) {
          return undefined
        }
        if (value === trueValue) {
          return true
        }
        if (value === falseValue) {
          return false
        }
      },
      formatter: (value) => {
        if (value === undefined) {
          return undefined
        }
        if (value) {
          return trueValue
        } else {
          return falseValue
        }
      }
    }
  }
}

export const XmlString = (options?: any): XmlTransformer<string | undefined> => {
  return () => {
    return {
      parser: (value) => {
        if (value === undefined) {
          return undefined
        }
        return value
      },
      formatter: (value) => {
        if (value === undefined) {
          return undefined
        }
        return value
      }
    }
  }
}

export const XmlNumber = (options?: any): XmlTransformer<number | undefined> => {
  return () => {
    return {
      parser: (value) => {
        if (value === undefined) {
          return undefined
        }
        return parseInt(value, 10)
      },
      formatter: (value) => {
        if (value === undefined) {
          return undefined
        }
        return `${value}`
      }
    }
  }
}

export const XmlDate = (options?: any): XmlTransformer<Date | undefined> => {
  return () => {
    return {
      parser: (value) => {
        return value !== undefined ? dayjs(value).toDate() : undefined
      },
      formatter: (value) => {
        return value !== undefined ? dayjs(value).format(options) : undefined
      }
    }
  }
}
