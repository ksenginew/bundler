import fs from "fs/promises";
import { PluginDriver } from "./PluginDriver.js";
import path from "path";
import { Server } from "./server.js";
import minimist from "minimist";
import sirv from "sirv";

/** @type {Record<string, RegExp>} */
const mimeMap = {
  "text/html": /\.html?$/,
  "application/javascript": /\.[mc]?[jt]sx?$/,
};

/**
 * @param {string[]} argv
 */
export async function dev(argv) {
  /** @type {minimist.ParsedArgs & { root: string }} */
  // @ts-ignore
  const options = minimist(argv, {})
  options.root = options.root || "/"
  let start = new Date().getMilliseconds();
  /**
   * @type {import("rollup").PluginContext}
   */
  let driver;
  let _driver = PluginDriver({
    plugins: [
      {
        name: "load",
        async resolveId(id) {
          let url = new URL(id, "file://");
          url.pathname = path.resolve(url.pathname.slice(1))
          try {
            url.searchParams.set("r", Math.random() + "");
            await fs.open(url.pathname);
            return url.pathname + url.search;
          } catch {

          }
        },
        async load(id) {
          let url = new URL(id, "file://");
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
      },
    ],
  });
  const init = async () => (driver = await _driver);
  const server = Server([
    async (req, res, next) => {
      await init();
      let content_type;
      if (req.info.pathname.endsWith("/")) {
        content_type = "text/html";
        req.info.pathname += "index.html";
      }
      req.info.pathname = path.join(options.root, req.info.pathname)
      for (let mime in mimeMap) {
        if (mimeMap[mime].test(req.info.pathname)) {
          content_type = mime;
          break;
        }
      }
      let resolved = await driver.resolve(
        req.info.pathname + req.info.search,
        undefined, { isEntry: true }
      );
      if (resolved) {
        let result = await driver.load(resolved);
        if (result) {
          if (content_type) res.setHeader("Content-Type", content_type);
          res.writeHead(200);
          res.end(result.code);
          return;
        }
      }
      next();
    },
  ]);
  server.listen(3000);
  console.info(
    `Server       ready in ${new Date().getMilliseconds() - start} ms\n\n` +
    `=> Local:    http://localhost:3000/\n` +
    "",
  );
}
