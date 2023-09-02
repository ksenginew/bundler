import { createPluginCache } from "./PluginCache"

const error = console.error.bind(console)
/**
 * 
 * @param {*} plugin 
 * @param {*} pluginCache 
 * @param {*} graph 
 * @param {*} options 
 * @param {*} fileEmitter 
 * @param {*} existingPluginNames 
 * @returns {import("./types").PluginContext}
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
    if (typeof plugin.cacheKey !== "string") {
        existingPluginNames.add(plugin.name)
    }

    const cacheKey = plugin.cacheKey || plugin.name
    let cacheInstance = createPluginCache(
        pluginCache[cacheKey] || (pluginCache[cacheKey] = Object.create(null))
    )

    return {
        addWatchFile(id) {
            graph.watchFiles[id] = true
        },
        cache: cacheInstance,
        debug: console.debug.bind(console),
        emitFile: fileEmitter.emitFile.bind(fileEmitter),
        // @ts-ignore
        error(error_) {
            error(error_)
        },
        getFileName: fileEmitter.getFileName,
        getModuleIds: () => graph.modulesById.keys(),
        getModuleInfo: graph.getModuleInfo,
        getWatchFiles: () => Object.keys(graph.watchFiles),
        info: console.info.bind(console),
        load(resolvedId) {
            return graph.moduleLoader.preloadModule(resolvedId)
        },
        meta: {
            rollupVersion:'3',
            watchMode: graph.watchMode
        },
        get moduleIds() {
            function* wrappedModuleIds() {
                // We are wrapping this in a generator to only show the message once we are actually iterating
                console.warn(
                    `Accessing "this.moduleIds" on the plugin context by plugin ${plugin.name} is deprecated. The "this.getModuleIds" plugin context function should be used instead.`,
                )
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
        warn: console.warn.bind(console),
    }
}
