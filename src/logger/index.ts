import { configureLogger } from "./config";

const {
  LOG4JS_FILE = 'logs/api'
} = process.env

configureLogger(LOG4JS_FILE)
