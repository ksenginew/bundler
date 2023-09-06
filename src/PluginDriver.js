import { rollup } from "rollup";

/**
 * @param {import("rollup").RollupOptions} options
 * @returns {Promise<import("rollup").PluginContext>}
 */
export function PluginDriver(options) {
  /**
   * @type {(arg0: import("rollup").PluginContext) => void}
   */
  let resolve;
  /**
   * @type {(reason?: any) => void}
   */
  let reject;
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  let input = Math.random() + "";
  rollup({
    input,
    ...options,
    plugins: [
      {
        name: "dev",
        buildStart() {
          resolve(this);
        },
        resolveId(id) {
          if (id == input) return id;
        },
        load(id) {
          if (id == input) return "";
        },
      },
      ...(Array.isArray(options.plugins) ? options.plugins : [options.plugins]),
    ],
    treeshake: false,
    experimentalCacheExpiry: 0,
  });

  setTimeout(() => reject(new Error("timeout")), 2000);
  return promise;
}
