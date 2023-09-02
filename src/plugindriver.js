export class PluginDriver {
  sortedPlugins = new Map()
  unfulfilledActions = new Set()

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
              logInputHookInOutputPlugin(plugin.name, hook)
            )
          }
        }
      }
    }
  }

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
}
