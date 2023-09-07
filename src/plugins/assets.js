import path from "path";
import fs from "fs/promises";


/** @returns {import("../types").Plugin} */
export function assetsPlugin(options) {
    const assets = {}
    return {
        name: "css",
        async resolveId(importee, _importer, _options) {
            if (_importer && /^[./]/.test(importee)) {
                const importer = new URL(_importer, "file://")
                const tryResolve = async (/** @type {string} */ importee) => {
                    const _resolved = /^\//.test(importee) ? path.resolve(options.root, importee.slice(1)) : path.resolve(path.dirname(importer.pathname), importee);
                    const resolved = new URL(_resolved, "file://")
                    if (/\.(txt|css|less|sass|scss|styl|stylus|pcss|postcss|sss|[mc]?[jt]sx?|html?|json)$/.test(resolved.pathname)) return
                    try {
                        await fs.open(resolved.pathname);
                        let filepath = path.relative(options.root, resolved.pathname)
                        assets[resolved.pathname] = filepath
                        return importee
                    } catch (e) {
                    }
                }
                return (await tryResolve(importee)) || (/^\//.test(importee) && (await tryResolve(path.join("/public", importee))))
            }
        },
        load(id) {
            let url = new URL(id, "file://");
            console.log(id,assets)
            if (url.pathname in assets) {
                return {
                    code: `export default ${JSON.stringify("/" + assets[url.pathname])};`,
                    meta: { $$: { js: true } }
                }
            }
        }
    };
}
