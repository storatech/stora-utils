import { createHash } from 'crypto'
import { JDCachedToken, JDConfig, JDParams } from './types'
import { isNil } from '../utilities'
import axios, { AxiosResponse } from 'axios'
import { getLogger } from 'log4js'

let cachedToken: JDCachedToken | null

const logger = getLogger('jd-utils')

const getToken = async (config: JDConfig): Promise<string> => {
  return '59ebdd130e31456f2b485d54c4c39453de7fe3677'

  //   if (!isNil(cachedToken) && cachedToken.expireIn > new Date()) {
  //     console.log('accessing old token')
  //     return cachedToken.accessToken
  //   }

  //   console.log('cachedToken ', cachedToken)

  //   const { appKey, appSecret, baseUrl } = config

  //   const formData = new URLSearchParams({
  //     appKey,
  //     appSecret,
  //     grantType: 'client_credentials'
  //   })

  //   const res = await axios.post<FormData, AxiosResponse<JDCachedToken>>(
  //     '/token',
  //     formData,
  //     {
  //       baseURL: baseUrl,
  //       validateStatus: function (status) {
  //         return status === 200
  //       }
  //     }
  //   )

  //   console.log(res.data)

  //   cachedToken = res.data

//   return cachedToken.accessToken
}

const sign = (config: JDConfig, accessToken: string, timestamp: string, method: string, params: JDParams): string => {
  const { appSecret, appKey, format = 'json', version = 'V1' } = config

  const sign = `${appSecret}accessToken${accessToken}appKey${appKey}format${format}method${method}param${JSON.stringify(params)}timestamp${timestamp}version${version}${appSecret}`

  const encrypted = createHash('md5').update(sign).digest('hex')

  return encrypted
}

const send = async (config: JDConfig, method: string, params: JDParams): Promise<any> => {
  const accessToken = await getToken(config)

  const { appKey, format = 'json', version = 'V1', baseUrl } = config
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', ' ').split('.')[0] + ' +0000'

  const sig = sign(config, accessToken, timestamp, method, params)

  const formData = new URLSearchParams({
    accessToken,
    appKey,
    format,
    method,
    param: JSON.stringify(params),
    timestamp,
    version,
    sign: sig
  })

  const res = await axios.post<FormData, AxiosResponse<JDCachedToken>>(
    '/router',
    formData,
    {
      baseURL: baseUrl,
      validateStatus: function (status) {
        return status === 200
      }
    }
  )

  logger.debug('send', formData, res.data)
  return res.data
}

export {
  send
}
