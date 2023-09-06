import path from "path";
import fs from "fs/promises";


/** @returns {import("../types").Plugin} */
export function cssPlugin() {
    return {
        name: "css",
        transform(code, id) {
            let url = new URL(id, "file://");
            if (/\.css$/.test(url.pathname))
                return {
                    code: `const __$__id = "";`
                        + `const __$__css = ${JSON.stringify(code)};`
                        + `const __$__style = document.createElement("style");`
                        + `__$__style.innerHTML = __$__css;`
                        + `document.head.appendChild(__$__style);`
                        + `export default __$__css;`,
                    meta: { $$: { js: true } }
                }
        }
    };
}
