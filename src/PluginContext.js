
const error = console.error.bind(console);
/**
 * @param {import("./types").Plugin} plugin
 * @param {{ [x: string]: any; }} pluginCache
 * @param {import("./PluginDriver").PluginDriver} driver
 * @param {{ logLevel: any; onLog: any; }} options
 * @param {{ add: (arg0: any) => void; }} existingPluginNames
 * @returns {import("./types").PluginContext}
 */
export function getPluginContext(
  plugin,
  pluginCache,
  driver,
  options,
  existingPluginNames,
) {
  const { logLevel, onLog } = options;
  if (typeof plugin.cacheKey !== "string") {
    existingPluginNames.add(plugin.name);
  }

  const cacheKey = plugin.cacheKey || plugin.name;
  let cacheInstance =
    pluginCache[cacheKey] || (pluginCache[cacheKey] = Object.create(null));

  return {
    addWatchFile(id) {
      driver.watchFiles[id] = true;
    },
    cache: new Map(),
    debug: console.debug.bind(console),
    emitFile: driver.emitFile.bind(driver),
    // @ts-ignore
    error(error_) {
      error(error_);
    },
    getFileName: driver.getFileName,
    getModuleIds: () => driver.modulesById.keys(),
    getModuleInfo: driver.getModuleInfo,
    getWatchFiles: () => Object.keys(driver.watchFiles),
    info: console.info.bind(console),
    load(resolvedId) {
      return driver.load(resolvedId);
    },
    meta: {
      rollupVersion: "3",
      watchMode: driver.watchMode,
    },
    get moduleIds() {
      function* wrappedModuleIds() {
        // We are wrapping this in a generator to only show the message once we are actually iterating
        console.warn(
          `Accessing "this.moduleIds" on the plugin context by plugin ${plugin.name} is deprecated. The "this.getModuleIds" plugin context function should be used instead.`,
        );
        yield* moduleIds;
      }

      const moduleIds = driver.modulesById.keys();
      return wrappedModuleIds();
    },
    parse: driver.contextParse.bind(driver),
    resolve(source, importer, { assertions, custom, isEntry, skipSelf } = {}) {
      return driver.resolveId(
        source,
        importer,
        custom,
        isEntry,
        assertions || {},
        skipSelf ? [{ importer, plugin, source }] : null,
      );
    },
    setAssetSource: driver.setAssetSource,
    warn: console.warn.bind(console),
  };
}
