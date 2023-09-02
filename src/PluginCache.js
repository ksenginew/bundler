/**
 * @returns {import("rollup").PluginCache}
 */
export function createPluginCache(cache) {
  return {
    delete(id) {
      return delete cache[id]
    },
    get(id) {
      const item = cache[id]
      if (!item) return
      item[0] = 0
      return item[1]
    },
    has(id) {
      const item = cache[id]
      if (!item) return false
      item[0] = 0
      return true
    },
    set(id, value) {
      cache[id] = [0, value]
    }
  }
}
