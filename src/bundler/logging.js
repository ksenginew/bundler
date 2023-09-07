export const LOGLEVEL_SILENT = "silent"
export const LOGLEVEL_ERROR = "error"
export const LOGLEVEL_WARN = "warn"
export const LOGLEVEL_INFO = "info"
export const LOGLEVEL_DEBUG = "debug"

export const logLevelPriority = {
  [LOGLEVEL_DEBUG]: 0,
  [LOGLEVEL_INFO]: 1,
  [LOGLEVEL_SILENT]: 3,
  [LOGLEVEL_WARN]: 2
}

// @ts-ignore
export const normalizeLog = (/** @type {any} */ log) =>
	typeof log === 'string'
		? { message: log }
		: typeof log === 'function'
		? normalizeLog(log())
		: log;

/**
 * @param {string} level
 * @param {string} code
 * @param {(arg0: string, arg1: string) => void} logger
 * @param {any} pluginName
 * @param {string | number} logLevel
 */
export function getLogHandler(level, code, logger, pluginName, logLevel) {
  // @ts-ignore
  if (logLevelPriority[level] < logLevelPriority[logLevel]) {
    return ()=>{}
  }
  return (/** @type {{ (): any; code?: any; pluginCode?: any; plugin?: any; }} */ log, /** @type {null} */ pos) => {
    if (pos != null) {
      logger(LOGLEVEL_WARN, `logInvalidLogPosition: ${pluginName})`)
    }
    log = normalizeLog(log)
    if (log.code && !log.pluginCode) {
      log.pluginCode = log.code
    }
    log.code = code
    log.plugin = pluginName
    // @ts-ignore
    logger(level, log)
  }
}
