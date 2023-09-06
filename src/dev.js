import fs from "fs/promises";
import { PluginDriver } from "./PluginDriver.js";
import path from "path";
import { Server } from "./server.js";

export async function dev() {
    /**
     * @type {import("rollup").PluginContext}
     */
    let driver;
    let _driver = PluginDriver({
        plugins: [
            {
                name: 'load',
                async resolveId(id) {
                    try {
                        id = path.resolve(id)
                        console.log(id)
                        await fs.open(id)
                        return id
                    } catch { }
                },
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
    const init = async () => driver = await _driver
    const server = Server([
        async (req, res, next) => {
            await init()
            req.info.searchParams.set('r', Math.random() + '')
            if (req.info.pathname.endsWith('/'))
                req.info.pathname += "index.html"
            let resolved = await driver.resolve(req.info.pathname.slice(1) + req.info.search)
            console.log(req.info.pathname.slice(1) + req.info.search)
            if (resolved) {
                let result = await driver.load(resolved)
                if (result) {
                    res.writeHead(200)
                    res.end(result.ast)
                }
            }
            next()
        }
    ])
    server.listen(3000)
    console.log('listening')
}