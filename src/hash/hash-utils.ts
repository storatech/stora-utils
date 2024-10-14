import crypto from 'crypto'
import { HashUtils } from "./types"

export const hashUtils: HashUtils = {
  hash: (str: string): string => {
    return crypto.createHash('md5').update(str).digest('hex').toString()
  } 
}
