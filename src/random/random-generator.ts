import { GenerateRandom } from './types'

export const generateRandom: GenerateRandom = (length, onlyDigit) => {
  let text = ''

  const chars = onlyDigit === true ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  for (let i = 0; i < length; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return text
}
