import path from "path";
import fs from "fs/promises";


/** @returns {import("../types").Plugin} */
export function assetsPlugin() {
    return {
        name: "css",
        resolveId(id,source){
            console.log(id,source)
        }
    };
}
