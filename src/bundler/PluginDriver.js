import { getPluginContext } from "./PluginContext"
import {
    LOGLEVEL_WARN,
} from "./logging.js"
const error = console.error.bind(console)

/**
 * @param {Map<any, any>} map
 * @param {string | number} key
 * @param {{ (): any[]; (): any; }} init
 */
export function getOrCreate(map, key, init) {
    const existing = map.get(key)
    if (existing !== undefined) {
      return existing
    }
    const value = init()
    map.set(key, value)
    return value
  }

  
// This will make sure no input hook is omitted
const inputHookNames = {
  buildEnd: 1,
  buildStart: 1,
  closeBundle: 1,
  closeWatcher: 1,
  load: 1,
  moduleParsed: 1,
  onLog: 1,
  options: 1,
  resolveDynamicImport: 1,
  resolveId: 1,
  shouldTransformCachedModule: 1,
  transform: 1,
  watchChange: 1
}
const inputHooks = Object.keys(inputHookNames)

export class PluginDriver {
  sortedPlugins = new Map()
  unfulfilledActions = new Set()

  /**
     * @param {any} graph
     * @param {{ onLog: (arg0: string, arg1: any) => void; }} options
     * @param {any} userPlugins
     * @param {any} pluginCache
     * @param {*} basePluginDriver
     */
  constructor(graph, options, userPlugins, pluginCache, basePluginDriver) {
    this.graph = graph
    this.options = options
    this.pluginCache = pluginCache
    this.fileEmitter = new FileEmitter(
      graph,
      options,
      basePluginDriver && basePluginDriver.fileEmitter
    )
    this.emitFile = this.fileEmitter.emitFile.bind(this.fileEmitter)
    this.getFileName = this.fileEmitter.getFileName.bind(this.fileEmitter)
    this.finaliseAssets = this.fileEmitter.finaliseAssets.bind(this.fileEmitter)
    this.setChunkInformation = this.fileEmitter.setChunkInformation.bind(
      this.fileEmitter
    )
    this.setOutputBundle = this.fileEmitter.setOutputBundle.bind(
      this.fileEmitter
    )
    this.plugins = [
      ...(basePluginDriver ? basePluginDriver.plugins : []),
      ...userPlugins
    ]
    const existingPluginNames = new Set()

    this.pluginContexts = new Map(
      this.plugins.map(plugin => [
        plugin,
        getPluginContext(
          plugin,
          pluginCache,
          graph,
          options,
          this.fileEmitter,
          existingPluginNames
        )
      ])
    )

    if (basePluginDriver) {
      for (const plugin of userPlugins) {
        for (const hook of inputHooks) {
          if (hook in plugin) {
            options.onLog(
              LOGLEVEL_WARN,
              'logInputHookInOutputPlugin'+plugin.name+hook
            )
          }
        }
      }
    }
  }

  /**
     * @param {any} plugins
     */
  createOutputPluginDriver(plugins) {
    return new PluginDriver(
      this.graph,
      this.options,
      plugins,
      this.pluginCache,
      this
    )
  }

  getUnfulfilledHookActions() {
    return this.unfulfilledActions
  }

  // chains, first non-null result stops and returns
  /**
     * @param {any} hookName
     * @param {any} parameters
     * @param {any} replaceContext
     * @param {any} skipped
     */
  hookFirst(hookName, parameters, replaceContext, skipped) {
    return this.hookFirstAndGetPlugin(
      hookName,
      parameters,
      replaceContext,
      skipped
    ).then(result => result && result[0])
  }

  // chains, first non-null result stops and returns result and last plugin
  /**
     * @param {any} hookName
     * @param {any} parameters
     * @param {any} replaceContext
     * @param {{ has: (arg0: any) => any; }} skipped
     */
  async hookFirstAndGetPlugin(hookName, parameters, replaceContext, skipped) {
    for (const plugin of this.getSortedPlugins(hookName)) {
      if (skipped?.has(plugin)) continue
      const result = await this.runHook(
        hookName,
        parameters,
        plugin,
        replaceContext
      )
      if (result != null) return [result, plugin]
    }
    return null
  }

  // chains synchronously, first non-null result stops and returns
  /**
     * @param {any} hookName
     * @param {any} parameters
     * @param {any} replaceContext
     */
  hookFirstSync(hookName, parameters, replaceContext) {
    for (const plugin of this.getSortedPlugins(hookName)) {
      const result = this.runHookSync(
        hookName,
        parameters,
        plugin,
        replaceContext
      )
      if (result != null) return result
    }
    return null
  }

  // parallel, ignores returns
  /**
     * @param {string | number} hookName
     * @param {any} parameters
     * @param {any} replaceContext
     */
  async hookParallel(hookName, parameters, replaceContext) {
    const parallelPromises = []
    for (const plugin of this.getSortedPlugins(hookName)) {
      if (plugin[hookName].sequential) {
        await Promise.all(parallelPromises)
        parallelPromises.length = 0
        await this.runHook(hookName, parameters, plugin, replaceContext)
      } else {
        parallelPromises.push(
          this.runHook(hookName, parameters, plugin, replaceContext)
        )
      }
    }
    await Promise.all(parallelPromises)
  }

  // chains, reduces returned value, handling the reduced value as the first hook argument
  /**
     * @param {any} hookName
     * @param {{ call: (arg0: import("../types").PluginContext | undefined, arg1: any, arg2: any, arg3: any) => any; }} reduce
     * @param {any} replaceContext
     */
  // @ts-ignore
  hookReduceArg0(hookName, [argument0, ...rest], reduce, replaceContext) {
    let promise = Promise.resolve(argument0)
    for (const plugin of this.getSortedPlugins(hookName)) {
      promise = promise.then(argument0 =>
        this.runHook(
          hookName,
          [argument0, ...rest],
          plugin,
          replaceContext
        ).then(result =>
          reduce.call(
            this.pluginContexts.get(plugin),
            argument0,
            result,
            plugin
          )
        )
      )
    }
    return promise
  }

  // chains synchronously, reduces returned value, handling the reduced value as the first hook argument
  /**
     * @param {any} hookName
     * @param {{ call: (arg0: import("../types").PluginContext | undefined, arg1: any, arg2: any, arg3: any) => any; }} reduce
     * @param {any} replaceContext
     */
  // @ts-ignore
  hookReduceArg0Sync(hookName, [argument0, ...rest], reduce, replaceContext) {
    for (const plugin of this.getSortedPlugins(hookName)) {
      const parameters = [argument0, ...rest]
      const result = this.runHookSync(
        hookName,
        parameters,
        plugin,
        replaceContext
      )
      argument0 = reduce.call(
        this.pluginContexts.get(plugin),
        argument0,
        result,
        plugin
      )
    }
    return argument0
  }

  // chains, reduces returned value to type string, handling the reduced value separately. permits hooks as values.
  /**
     * @param {string | number} hookName
     * @param {any} initialValue
     * @param {any} parameters
     * @param {(previousValue: any, currentValue: any, currentIndex: number, array: any[]) => any} reducer
     */
  async hookReduceValue(hookName, initialValue, parameters, reducer) {
    const results = []
    const parallelResults = []
    for (const plugin of this.getSortedPlugins(
      hookName,
      validateAddonPluginHandler
    )) {
      if (plugin[hookName].sequential) {
        results.push(...(await Promise.all(parallelResults)))
        parallelResults.length = 0
        results.push(await this.runHook(hookName, parameters, plugin))
      } else {
        parallelResults.push(this.runHook(hookName, parameters, plugin))
      }
    }
    results.push(...(await Promise.all(parallelResults)))
    return results.reduce(reducer, await initialValue)
  }

  // chains synchronously, reduces returned value to type T, handling the reduced value separately. permits hooks as values.
  /**
     * @param {any} hookName
     * @param {any} initialValue
     * @param {any} parameters
     * @param {{ call: (arg0: import("../types").PluginContext | undefined, arg1: any, arg2: any, arg3: any) => any; }} reduce
     * @param {any} replaceContext
     */
  hookReduceValueSync(
    hookName,
    initialValue,
    parameters,
    reduce,
    replaceContext
  ) {
    let accumulator = initialValue
    for (const plugin of this.getSortedPlugins(hookName)) {
      const result = this.runHookSync(
        hookName,
        parameters,
        plugin,
        replaceContext
      )
      accumulator = reduce.call(
        this.pluginContexts.get(plugin),
        accumulator,
        result,
        plugin
      )
    }
    return accumulator
  }

  // chains, ignores returns
  /**
     * @param {any} hookName
     * @param {any} parameters
     * @param {any} replaceContext
     */
  hookSeq(hookName, parameters, replaceContext) {
    let promise = Promise.resolve()
    for (const plugin of this.getSortedPlugins(hookName)) {
      promise = promise.then(() =>
        this.runHook(hookName, parameters, plugin, replaceContext)
      )
    }
    return promise.then(noReturn)
  }

  /**
     * @param {string | number} hookName
     * @param {((handler: any, hookName: any, plugin: { name: any; }) => void) | undefined} [validateHandler]
     */
  getSortedPlugins(hookName, validateHandler) {
    return getOrCreate(this.sortedPlugins, hookName, () =>
      getSortedValidatedPlugins(hookName, this.plugins, validateHandler)
    )
  }

  // Implementation signature
  /**
     * @param {string | number} hookName
     * @param {any[]} parameters
     * @param {{ [x: string]: any; name: any; }} plugin
     * @param {((arg0: import("../types").PluginContext | undefined, arg1: any) => import("../types").PluginContext | undefined) | undefined} [replaceContext]
     */
  runHook(hookName, parameters, plugin, replaceContext) {
    // We always filter for plugins that support the hook before running it
    const hook = plugin[hookName]
    const handler = typeof hook === "object" ? hook.handler : hook

    let context = this.pluginContexts.get(plugin)
    if (replaceContext) {
      context = replaceContext(context, plugin)
    }

    /**
       * @type {any[] | null}
       */
    let action = null
    return Promise.resolve()
      .then(() => {
        if (typeof handler !== "function") {
          return handler
        }
        // eslint-disable-next-line @typescript-eslint/ban-types
        const hookResult = handler.apply(context, parameters)

        if (!hookResult?.then) {
          // short circuit for non-thenables and non-Promises
          return hookResult
        }

        // Track pending hook actions to properly error out when
        // unfulfilled promises cause rollup to abruptly and confusingly
        // exit with a successful 0 return code but without producing any
        // output, errors or warnings.
        action = [plugin.name, hookName, parameters]
        this.unfulfilledActions.add(action)

        // Although it would be more elegant to just return hookResult here
        // and put the .then() handler just above the .catch() handler below,
        // doing so would subtly change the defacto async event dispatch order
        // which at least one test and some plugins in the wild may depend on.
        return Promise.resolve(hookResult).then(result => {
          // action was fulfilled
          this.unfulfilledActions.delete(action)
          return result
        })
      })
      .catch(error_ => {
        if (action !== null) {
          // action considered to be fulfilled since error being handled
          this.unfulfilledActions.delete(action)
        }
        return error('logPluginError',error_, plugin.name, { hook: hookName })
      })
  }

  /**
     * Run a sync plugin hook and return the result.
     * @param {string | number} hookName Name of the plugin hook. Must be in `PluginHooks`.
     * @param args Arguments passed to the plugin hook.
     * @param {{ [x: string]: any; name: any; }} plugin The acutal plugin
     * @param {(arg0: import("../types").PluginContext | undefined, arg1: any) => import("../types").PluginContext | undefined} replaceContext When passed, the plugin context can be overridden.
     * @param {any[]} parameters
     */
  runHookSync(hookName, parameters, plugin, replaceContext) {
    const hook = plugin[hookName]
    const handler = typeof hook === "object" ? hook.handler : hook

    let context = this.pluginContexts.get(plugin)
    if (replaceContext) {
      context = replaceContext(context, plugin)
    }

    try {
      // eslint-disable-next-line @typescript-eslint/ban-types
      return handler.apply(context, parameters)
    } catch (error_) {
      return error('logPluginError',error_, plugin.name, { hook: hookName })
    }
  }
}

/**
 * @param {string | number} hookName
 * @param {any[]} plugins
 */
export function getSortedValidatedPlugins(
  hookName,
  plugins,
  validateHandler = validateFunctionPluginHandler
) {
  const pre = []
  const normal = []
  const post = []
  for (const plugin of plugins) {
    const hook = plugin[hookName]
    if (hook) {
      if (typeof hook === "object") {
        validateHandler(hook.handler, hookName, plugin)
        if (hook.order === "pre") {
          pre.push(plugin)
          continue
        }
        if (hook.order === "post") {
          post.push(plugin)
          continue
        }
      } else {
        validateHandler(hook, hookName, plugin)
      }
      normal.push(plugin)
    }
  }
  return [...pre, ...normal, ...post]
}

/**
 * @param {any} handler
 * @param {any} hookName
 * @param {{ name: any; }} plugin
 */
function validateFunctionPluginHandler(handler, hookName, plugin) {
  if (typeof handler !== "function") {
    error('logInvalidFunctionPluginHook',hookName, plugin.name)
  }
}

/**
 * @param {any} handler
 * @param {any} hookName
 * @param {{ name: any; }} plugin
 */
function validateAddonPluginHandler(handler, hookName, plugin) {
  if (typeof handler !== "string" && typeof handler !== "function") {
    return error('logInvalidAddonPluginHook',hookName, plugin.name)
  }
}

function noReturn() {}
