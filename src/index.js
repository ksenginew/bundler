import fs from "fs/promises";
import { PluginDriver } from "./PluginDriver.js";
import path from "path";

const driver = await PluginDriver({
    plugins: [
        {
            name: 'losd',
            async load(id) {
                if (path.isAbsolute(id))
                    try {
                        return {
                            ast: {
                                end: 0,
                                start: 0,
                                type: "File"
                            },
                            code: await fs.readFile(id, 'utf-8'),
                        }
                    } catch { }
            }
        }
    ]
})
const resolvedId = await driver.resolve('src/index.css')
if (resolvedId)
    console.log(await driver.load({ ...resolvedId, resolveDependencies: true }))