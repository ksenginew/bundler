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
   * @param {import("./types").Plugin[]} plugins
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
   * @template {keyof import("./types").Plugin} T
   * @param {T} method
   * @param {import("./types").Plugin[]} plugins
   * @param {Parameters<import("./types").Plugin[T]>} args
   * @param {boolean} [first]
   */
  async run(method, plugins, args, first, parallel = true) {
    let results = []
    for (const plugin_type of this.sortMethod(method, plugins))
      for (const plugin of plugin_type) {
        const handler = plugin.handler || plugin
        const ctx = this.pluginContexts.get(plugin)
        let result = handler.apply(ctx, args)
        if (!parallel || plugin.sequential) await result
        if (first) {
          result = await result
          if (result !== null || result !== undefined) return result
        }
        else
          results.push(result)
      }
    return results
  }

  /**
   * @param {string} source
   * @param {string | undefined} importer
   * @param {import("rollup").CustomPluginOptions | undefined} custom
   * @param {boolean} [isEntry]
   * @param {Record<string, string>} assertions
   * @param {{ importer: string | undefined; plugin: import("./types").Plugin; source: string; }[] | null} skips
   */
  resolveId(source, importer, custom, isEntry, assertions, skips) {
    return this.run('resolveId', skips ? this.plugins.filter(_plugin => skips.some(({ plugin }) => _plugin === plugin)) : this.plugins, [source, importer, { custom, isEntry: isEntry || false, assertions }],true)
  }

  /**
   * @param {{ id: string; resolveDependencies?: boolean | undefined; } & Partial<import("rollup").PartialNull<import("rollup").ModuleOptions>>} resolvedId
   */
  load(resolvedId) {
    return this.run('resolveId', skips ? this.plugins.filter(_plugin => skips.some(({ plugin }) => _plugin === plugin)) : this.plugins, [source, importer, { custom, isEntry: isEntry || false, assertions }],true)
  }
}
