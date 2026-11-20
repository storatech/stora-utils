// One-line start for Node services: `import '@storatech/stora-utils/telemetry/register'` as the first import of the
// entry file (after dotenv), so that the modules imported after it get instrumented. Importing this file is meant to
// have side effects: it configures log4js, starts telemetry with the defaults (off without OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
// and exports the last spans when the process is stopped
import { getLogger } from 'log4js'

import { configureLogger } from '../logger/config'
import { startTelemetry } from './start'

const logger = getLogger('telemetry')
const SHUTDOWN_TIMEOUT = 3000

configureLogger()

const telemetry = startTelemetry()

if (telemetry !== undefined) {
  let stopping = false
  // Export the last spans when PM2 stops or reloads the worker, then exit (what the signal would have done).
  // process.on, not once: Apollo stops on the same signal and raises it again, which would end the process before the export
  const shutdown = (): void => {
    if (stopping) return
    stopping = true
    setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT).unref()
    telemetry.shutdown()
      .catch((e) => { logger.warn('Telemetry shutdown error: ', e) })
      .finally(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
