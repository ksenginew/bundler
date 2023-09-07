import path, { basename } from "path";
import fs from "fs/promises";

export const DONT_LOAD = new Error()

/** @returns {import("../types").Plugin} */
export function loaderPlugin() {
    return {
        name: "load",
        async resolveId(id) {
            let url = new URL(id, "file://");
            url.pathname = path.resolve(url.pathname.slice(1));
            try {
                url.searchParams.set("r", Math.random() + basename(url.pathname));
                await fs.open(url.pathname);
                return url.pathname + url.search;
            } catch { }
        },
        async load(id) {
            let url = new URL(id, "file://");
            if (!/\.(txt|css|less|sass|scss|styl|stylus|pcss|postcss|sss|[mc]?[jt]sx?|html?|json)$/.test(url.pathname)) throw DONT_LOAD
            if (path.isAbsolute(url.pathname)) {
                try {
                    return {
                        ast: {
                            end: 0,
                            start: 0,
                            type: "File",
                        },
                        code: await fs.readFile(url.pathname, "utf-8"),
                    };
                } catch { }
            }
        },
    };
}
