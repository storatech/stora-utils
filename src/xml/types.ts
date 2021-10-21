import dayjs from 'dayjs'

type XmlParser<T> = (value?: string) => T | undefined
type XmlFormatter<T> = (value?: T) => string | undefined

export type XmlTransformer<T> = () => {
  parser: XmlParser<T>
  formatter: XmlFormatter<T>
}

export type XmlDef<T> = (XmlObject<T> | XmlTransformer<T>)

export type XmlObject<T> = {
  [Z in keyof T]?: (T extends [] ? XmlDef<T[number]>: XmlDef<T[Z]>)
}

export const XmlString = (options?: any): XmlTransformer<string> => {
  return () => {
    return {
      parser: (value) => {
        return value
      },
      formatter: (value) => {
        return value
      }
    }
  }
}

export const XmlNumber = (options?: any): XmlTransformer<number> => {
  return () => {
    return {
      parser: (value) => {
        return value !== undefined ? parseInt(value, 10) : undefined
      },
      formatter: (value) => {
        return value !== undefined ? `${value}` : undefined
      }
    }
  }
}

export const XmlDate = (options?: any): XmlTransformer<Date> => {
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
