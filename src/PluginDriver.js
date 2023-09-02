import { getPluginContext } from "./PluginContext";
import { parse } from "acorn";
export class PluginDriver {
  /**
   * @type {{ [x: string]: boolean; }}
   */
  watchFiles = {};
  /**
   * @type {Map<string,any>}
   */
  modulesById = new Map();
  watchMode = true;
  /**
   * @param {any} options
   * @param {import("./types").Plugin[]} userPlugins
   * @param {Map<string, any>} pluginCache
   */
  constructor(options, userPlugins, pluginCache) {
    this.plugins = userPlugins;
    const existingPluginNames = new Set();

    this.pluginContexts = new Map(
      this.plugins.map((plugin) => [
        plugin,
        getPluginContext(
          plugin,
          pluginCache,
          this,
          options,
          existingPluginNames,
        ),
      ]),
    );
    this.emitFile = undefined;
    this.getFileName = undefined;
  }

  getModuleInfo = (/** @type {string} */ moduleId) => {
    const foundModule = this.modulesById.get(moduleId);
    if (!foundModule) return null;
    return foundModule.info;
  };

  contextParse = parse;

  /**
   * @param {string} method
   */
  sortMethod(method, plugins) {
    const pre = []
    const defaults = []
    const post = []

    for (const plugin of plugins) {
      let ctx = this.pluginContexts.get(plugin)
      // @ts-ignore
      let handler = plugin[method]
      if (handler)
        if (handler.order === 'pre')
          pre.push(handler.handler)
        else if (handler.order === 'post')
          post.push(handler.handler)
        else defaults.push(handler)
    }

    return [pre, defaults, post]
  }

  /**
   * @param {string} source
   * @param {string | undefined} importer
   * @param {import("rollup").CustomPluginOptions | undefined} custom
   * @param {boolean | undefined} isEntry
   * @param {Record<string, string>} arg4
   * @param {{ importer: string | undefined; plugin: import("./types").Plugin; source: string; }[] | null} skips
   */
  async resolve(source, importer, custom, isEntry, arg4, skips) {
    for (const plugin_type of this.sortMethod('resolveId', skips ? this.plugins.filter(_plugin => skips.some(({ plugin }) => _plugin === plugin)) : this.plugins))
      for (const handler of plugin_type) {
        const result = handler()
    }
  }

  /**
   * @param {{ id: string; resolveDependencies?: boolean | undefined; } & Partial<import("rollup").PartialNull<import("rollup").ModuleOptions>>} resolvedId
   */
  load(resolvedId) {
    throw new Error("Method not implemented.");
  }
}
