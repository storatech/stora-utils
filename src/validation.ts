import validate from 'validate.js'
import moment from 'moment'

interface Validator<T> {
  object?: Constraint<T>
  presence?: boolean
  string?: boolean | {
    allowEmpty?: boolean
  }
  numericality?: boolean
  type?: 'string' | 'number' | 'boolean' | 'array' | 'integer'
  url?: boolean | {
    schemes?: string[]
    allowDataUrl?: boolean
    allowLocal?: boolean
  }
  email?: boolean
  length?: number | {
    is?: number
    minimum?: number
    maximum?: number
  }
  element?: Validator<T>
  date?: boolean
}

export type Constraint<T> = {
  [Z in keyof T]: T extends any[] ? Validator<T[number]> : Validator<T[Z]>
}

validate.validators.element = (value: any, options: any, key: string, attributes: any): string | null => {
  if (value !== null && value !== undefined) {
    if (Array.isArray(value)) {
      for (const e of value) {
        const res = validate.single(e, options)
        if (res !== null && res !== undefined && res.length > 0) return 'element ' + String(res[0])
      }
    } else {
      const res = validate.single(value, options)
      if (res !== null && res !== undefined && res.length > 0) return res[0]
    }
  }
  return null
}

validate.validators.object = (value: any, options: any, key: string, attributes: any): string | null => {
  if (value != null && value !== undefined) {
    if (typeof value !== 'object' || Array.isArray(value)) {
      return 'must be object'
    }
    const res = validate(value, options)
    if (res !== undefined) {
      if (typeof res === 'string') {
        return res
      } else if (Array.isArray(res) && res.length > 0) {
        return res[0]
      } else {
        return res
      }
    }
  }
  return null
}

validate.validators.date = (value: any, options: any, key: string, attributes: any): string | null => {
  if (value != null && value !== undefined) {
    try {
      moment(value, true)
    } catch (e) {
      return 'invalid date format'
    }
  }
  return null
}
