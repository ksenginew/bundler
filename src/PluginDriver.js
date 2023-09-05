import { getPluginContext } from "./PluginContext.js";
import { parse } from "acorn";
import { normalizeInputOptions } from "./options.js";
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
    this.options = options;
    this.plugins = userPlugins;
    const existingPluginNames = new Set();
    /**
     * @type {Map<import("./types").Plugin, string[]>}
     */
    this.skippedIds = new Map(this.plugins.map((plugin) => [plugin, []]));
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
  }

  getModuleInfo = (/** @type {string} */ moduleId) => {
    const foundModule = this.modulesById.get(moduleId);
    if (!foundModule) return null;
    return foundModule.info;
  };

  contextParse = parse;
  emitFile = () => {};
  getFileName = () => {};

  /**
   * @param {string} method
   * @param {import("./types").Plugin[]} plugins
   */
  sortMethod(method, plugins) {
    const pre = [];
    const defaults = [];
    const post = [];

    for (const plugin of plugins) {
      let ctx = this.pluginContexts.get(plugin);
      // @ts-ignore
      let handler = plugin[method];
      if (handler)
        if (handler.order === "pre") pre.push(plugin);
        else if (handler.order === "post") post.push(plugin);
        else defaults.push(plugin);
    }

    return [pre, defaults, post];
  }

  /**
   * @template {keyof import("./types").Plugin} T
   * @param {T} name
   * @param {import("./types").Plugin[]} plugins
   * @param {Parameters<import("./types").Plugin[T]>} args
   * @param {boolean} [first]
   */
  async run(name, plugins, args, first, parallel = true) {
    let results = [];
    for (const plugin_type of this.sortMethod(name, plugins))
      for (const plugin of plugin_type) {
        // @ts-ignore
        const method = plugin[name];
        const handler = method.handler || method;
        const ctx = this.pluginContexts.get(plugin);
        let result = handler.apply(ctx, args);
        if (!parallel || method.sequential) await result;
        if (first) {
          result = await result;
          if (result !== null || result !== undefined) return result;
        } else results.push(result);
      }
    if (first) return;
    return results;
  }

  /**
   * @param {string} source
   * @param {string | undefined} [importer]
   * @param {import("rollup").CustomPluginOptions | undefined} [custom]
   * @param {boolean | undefined} [isEntry]
   * @param {Record<string, string> | undefined} [assertions]
   * @param {{ importer: string | undefined; plugin: import("./types").Plugin; source: string; }[] | null | undefined} [skips]
   */
  resolveId(source, importer, custom, isEntry, assertions, skips) {
    const key = importer + "$" + source;
    if (skips)
      for (let { importer, plugin, source } of skips) {
        this.skippedIds.get(plugin)?.push(key);
      }
    return this.run(
      "resolveId",
      this.plugins.filter(
        (plugin) => !this.skippedIds.get(plugin)?.includes(key),
      ),
      [
        source,
        importer,
        { custom, isEntry: isEntry || false, assertions: assertions || {} },
      ],
      true,
    );
  }

  /**
   * @param {{ id: string; resolveDependencies?: boolean | undefined; } & Partial<import("rollup").PartialNull<import("rollup").ModuleOptions>>} resolvedId
   * @returns {Promise<import("rollup").ModuleInfo | undefined>}
   */
  async load(resolvedId) {
    /** @type {string | import("rollup").SourceDescription} */
    const result = await this.run("load", this.plugins, [resolvedId.id], true);
    if (result) {
      return {
        ...resolvedId,
        dynamicImporters: [],
        dynamicallyImportedIdResolutions: [],
        dynamicallyImportedIds: [],
        exportedBindings: {},
        exports: [],
        hasDefaultExport: null,
        hasModuleSideEffects: false,
        implicitlyLoadedAfterOneOf: [],
        implicitlyLoadedBefore: [],
        importedIdResolutions: [],
        importedIds: [],
        importers: [],
        isEntry: false,
        isExternal: false,
        isIncluded: null,
        ...(typeof result === "object" ? result : {}),
        code: typeof result === "string" ? result : result.code,
        // @ts-ignore
        map: result.ast || null,
      };
    }
  }

  async resolveOptions() {
    await this.run("options", this.plugins, [this.options], false, false);
  }

  async buildStart() {
    this.options = await normalizeInputOptions(this.options, true);
    if (Object.freeze) Object.freeze(this.options);
    this.run("buildStart", this.plugins, [this.options]);
  }
}
