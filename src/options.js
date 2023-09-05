import { importAssertions } from "acorn-import-assertions";

/**
 * @param {any[]} array
 */
export async function asyncFlatten(array) {
  do {
    array = (await Promise.all(array)).flat(Infinity);
  } while (array.some((v) => v?.then));
  return array;
}

/**
 * @param {import("./types").InputOptions} config
 * @param {boolean} watchMode
 */
export async function normalizeInputOptions(config, watchMode) {
  // These are options that may trigger special warnings or behaviour later
  // if the user did not select an explicit value
  const unsetOptions = new Set();

  const context = config.context ?? "undefined";
  const normalizePluginOption = async (/** @type {any} */ plugins) =>
    (await asyncFlatten([plugins])).filter(Boolean);
  /**
   * @type {import("./types").Plugin[]}
   */
  const plugins = await normalizePluginOption(config.plugins);

  const logLevel = config.logLevel || "info";
  const onLog = console.log.bind(console);
  const strictDeprecations = config.strictDeprecations || false;
  const maxParallelFileOps = 20;
  const options = {
    acorn: getAcorn(config),
    acornInjectPlugins: getAcornInjectPlugins(config),
    cache: {},
    context,
    experimentalCacheExpiry: config.experimentalCacheExpiry ?? 10,
    experimentalLogSideEffects: config.experimentalLogSideEffects || false,
    external: [],
    inlineDynamicImports: false,
    input: "",
    logLevel,
    makeAbsoluteExternalsRelative:
      config.makeAbsoluteExternalsRelative ?? "ifRelativeSource",
    manualChunks: [],
    maxParallelFileOps,
    maxParallelFileReads: maxParallelFileOps,
    moduleContext: {},
    onLog,
    onwarn: (/** @type {any} */ warning) => onLog("warn", warning),
    perf: config.perf || false,
    plugins,
    preserveEntrySignatures: config.preserveEntrySignatures ?? "exports-only",
    preserveModules: [],
    preserveSymlinks: config.preserveSymlinks || false,
    shimMissingExports: config.shimMissingExports || false,
    strictDeprecations,
    treeshake: true,
  };

  return { options, unsetOptions };
}

const getAcorn = (/** @type {import("./types").InputOptions} */ config) => ({
  ecmaVersion: "latest",
  sourceType: "module",
  ...config.acorn,
});

const getAcornInjectPlugins = (
  /** @type {import("./types").InputOptions} */ config,
) => [
  importAssertions,
  ...(Array.isArray(config.acornInjectPlugins)
    ? config.acornInjectPlugins
    : [config.acornInjectPlugins]),
];
