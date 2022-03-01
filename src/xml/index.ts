import { getLogger } from 'log4js'
import sax from 'sax'
import { escapeXml } from '../utilities'
import { XmlDef } from './types'

export interface XmlNode<T> {
  parent?: XmlNode<any>
  tag?: string
  value?: any
  structure?: XmlDef<T>
  deep: number
}

export interface XmlNodeHandler {
  open: (tag: string) => void
  close: (tag: string) => void
  value: (value: string) => void
}

export type Xml = <T>(structure: XmlDef<T>) => {
  parse: (data: string) => T
  format: (data: T) => string
}

const logger = getLogger('xml')

export const XML: Xml = <T>(structure: XmlDef<T>) => {
  return {
    parse: (data) => {
      const root: XmlNode<T> = {
        structure,
        deep: 0
      }
      let current: XmlNode<any> = root
      const parser = sax.parser(true)
      parser.onopentag = (tag) => {
        const parent = current
        const { deep } = parent
        if (parent.structure === undefined) {
          current = {
            tag: tag.name,
            parent,
            deep: deep + 1
          }
        } else if (typeof parent.structure === 'function') {
          // do nothing
          current = {
            tag: tag.name,
            parent,
            deep: deep + 1
          }
        } else if (Array.isArray(parent.structure)) {
          current = {
            tag: tag.name,
            parent,
            structure: parent.structure[0][tag.name],
            deep: deep + 1
          }
        } else {
          current = {
            tag: tag.name,
            parent,
            structure: parent.structure[tag.name],
            deep: deep + 1
          }
        }
      }
      parser.onclosetag = (tag) => {
        const { parent } = current
        if (parent === undefined) {
          logger.error('parent not found', tag)
          throw new Error('close tag error')
        }
        if (current.tag !== tag) {
          logger.error('close tag not found', tag)
          throw new Error('close tag error')
        }
        if (current.structure === undefined) {
          // do nothing
        } else if (typeof current.structure === 'function') {
          parent.value = parent.value ?? {}
          parent.value[tag] = parent.value[tag] ?? {}
          parent.value[tag] = current.value
        } else if (Array.isArray(current.structure)) {
          parent.value = parent.value ?? {}
          parent.value[tag] = parent.value[tag] ?? []
          parent.value[tag].push(current.value)
        } else {
          parent.value = parent.value ?? {}
          parent.value[tag] = parent.value[tag] ?? {}
          parent.value[tag] = current.value
        }
        current = parent
      }
      parser.ontext = (value) => {
        if (current.structure !== undefined) {
          if (typeof current.structure === 'function') {
            current.value = current.structure().parser(value)
          }
        }
      }
      parser.write(data)
      return root.value as T
    },
    format: (data) => {
      const root: XmlNode<T> = {
        structure,
        deep: 0
      }

      const format: string[] = []

      const indent = (parent: XmlNode<any>, beauty: boolean = true): void => {
        if (!beauty) {
          return
        }
        format.push('\n')
        for (let i = 1; i < parent.deep; i++) {
          format.push('  ')
        }
      }

      const opentag = (parent: XmlNode<any>, beauty: boolean = true, isSelfCloseing: boolean = false): void => {
        if (isSelfCloseing) {
          if (parent.tag !== undefined) {
            indent(parent, parent.deep > 1 && beauty)
            format.push('<', parent.tag, '/>')
          }
        } else {
          if (parent.tag !== undefined) {
            indent(parent, parent.deep > 1 && beauty)
            format.push('<', parent.tag, '>')
          }
        }
      }

      const closetag = (parent: XmlNode<any>, beauty: boolean = true): void => {
        if (parent.tag !== undefined) {
          indent(parent, beauty)
          format.push('</', parent.tag, '>')
        }
      }

      const ontext = (parent: XmlNode<any>, beauty: boolean = true): void => {
        if (parent.value !== undefined) {
          opentag(parent, beauty)
          format.push(escapeXml(parent.value))
          closetag(parent, false)
        } else {
          opentag(parent, beauty, true)
        }
      }

      const formatXml = (parent: XmlNode<any>, data: any, beauty: boolean = true): void => {
        if (data === undefined) {
          return
        }
        const { deep } = parent
        if (parent.structure !== undefined) {
          if (typeof parent.structure === 'function') {
            parent.value = parent.structure().formatter(data)
            ontext(parent, beauty)
          } else if (Array.isArray(parent.structure)) {
            const current: XmlNode<any> = {
              parent,
              deep: deep,
              structure: parent.structure[0],
              tag: parent.tag
            }
            for (const child of data) {
              formatXml(current, child)
            }
          } else {
            opentag(parent, beauty)
            for (const tag of Object.keys(parent.structure)) {
              const current: XmlNode<any> = {
                parent,
                deep: deep + 1,
                structure: parent.structure[tag],
                tag
              }
              formatXml(current, data[tag])
            }
            closetag(parent, beauty)
          }
        }
      }
      formatXml(root, data)
      return format.join('')
    }
  }
}
