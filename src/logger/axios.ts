import axios from 'axios'
import { getLogger } from 'log4js'

const axiosLogger = getLogger('axios')
axios.interceptors.request.use((req) => {
  axiosLogger.info('>>', req.method?.toUpperCase(), req.baseURL, req.url)
  return req
})

axios.interceptors.response.use((res) => {
  axiosLogger.info('<<', res.status, res.statusText)
  return res
})
