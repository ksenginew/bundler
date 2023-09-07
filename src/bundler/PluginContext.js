// import { version as rollupVersion } from "package.json"
const rollupVersion = "3.0.0"
// import { BuildPhase } from "./buildPhase"
import { LOGLEVEL_DEBUG, LOGLEVEL_INFO, LOGLEVEL_WARN, normalizeLog, getLogHandler } from "./logging.js"
// import {
//   error,
//   logInvalidRollupPhaseForAddWatchFile,
//   logPluginError,
//   warnDeprecation
// } from "./logs"
// import { normalizeLog } from "./options/options"
const ANONYMOUS_PLUGIN_PREFIX = 'at position ';
const ANONYMOUS_OUTPUT_PLUGIN_PREFIX = 'at output position ';
// import { URL_THIS_GETMODULEIDS } from "./urls"

/**
 * 
 * @param {*} plugin 
 * @param {*} pluginCache 
 * @param {*} graph 
 * @param {*} options 
 * @param {*} fileEmitter 
 * @param {*} existingPluginNames 
 * @returns {import("../types.js").PluginContext}
 */
export function getPluginContext(
    plugin,
    pluginCache,
    graph,
    options,
    fileEmitter,
    existingPluginNames
) {
    const { logLevel, onLog } = options
    let cacheable = true
    if (typeof plugin.cacheKey !== "string") {
        if (
            plugin.name.startsWith(ANONYMOUS_PLUGIN_PREFIX) ||
            plugin.name.startsWith(ANONYMOUS_OUTPUT_PLUGIN_PREFIX) ||
            existingPluginNames.has(plugin.name)
        ) {
            cacheable = false
        } else {
            existingPluginNames.add(plugin.name)
        }
    }

    let cacheInstance
    if (!pluginCache) {
        cacheInstance = new Map()
    } else if (cacheable) {
        const cacheKey = plugin.cacheKey || plugin.name
        cacheInstance = new Map()
        if (!pluginCache[cacheKey]) pluginCache[cacheKey] || (pluginCache[cacheKey] = Object.create(null))
    } else {
        cacheInstance = new Map()
    }

    return {
        addWatchFile(id) {
            // if (graph.phase >= BuildPhase.GENERATE) {
            //     return this.error('logInvalidRollupPhaseForAddWatchFile')
            // }
            graph.watchFiles[id] = true
        },
        cache: cacheInstance,
        // @ts-ignore
        debug: getLogHandler(
            LOGLEVEL_DEBUG,
            "PLUGIN_LOG",
            onLog,
            plugin.name,
            logLevel
        ),
        emitFile: fileEmitter.emitFile.bind(fileEmitter),
        // @ts-ignore
        error(error_) {
            return console.error('logPluginError', (normalizeLog(error_), plugin.name))
        },
        getFileName: fileEmitter.getFileName,
        getModuleIds: () => graph.modulesById.keys(),
        getModuleInfo: graph.getModuleInfo,
        getWatchFiles: () => Object.keys(graph.watchFiles),
        // @ts-ignore
        info: getLogHandler(
            LOGLEVEL_INFO,
            "PLUGIN_LOG",
            onLog,
            plugin.name,
            logLevel
        ),
        load(resolvedId) {
            return graph.moduleLoader.preloadModule(resolvedId)
        },
        meta: {
            rollupVersion,
            watchMode: graph.watchMode
        },
        get moduleIds() {
            function* wrappedModuleIds() {
                // depr
                yield* moduleIds
            }

            const moduleIds = graph.modulesById.keys()
            return wrappedModuleIds()
        },
        parse: graph.contextParse.bind(graph),
        resolve(
            source,
            importer,
            { assertions, custom, isEntry, skipSelf } = {}
        ) {
            return graph.moduleLoader.resolveId(
                source,
                importer,
                custom,
                isEntry,
                assertions || {},
                skipSelf ? [{ importer, plugin, source }] : null
            )
        },
        setAssetSource: fileEmitter.setAssetSource,
        // @ts-ignore
        warn: getLogHandler(
            LOGLEVEL_WARN,
            "PLUGIN_WARNING",
            onLog,
            plugin.name,
            logLevel
        )
    }
}
