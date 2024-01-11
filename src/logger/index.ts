import { configureLogger } from "./config";
export { getReqId } from './config'

const {
  LOG4JS_FILE
} = process.env

configureLogger(LOG4JS_FILE)
