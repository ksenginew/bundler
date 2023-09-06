import fs from "fs/promises";
import { PluginDriver } from "./PluginDriver.js";
import path from "path";
import { Server } from "./server.js";

/** @type {Record<string, RegExp>} */
const mimeMap = {
  "text/html": /\.html?$/,
  "application/javascript": /\.[mc]?[jt]sx?$/,
};

/**
 * @param {import("minimist").ParsedArgs} options
 */
export async function dev(options) {
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
          try {
            let url = new URL(id, "file://");
            let filepath = path.resolve(url.pathname.slice(1));
            await fs.open(filepath);
            return filepath + url.search;
          } catch {}
        },
        async load(id) {
          let url = new URL(id, "file://");
          if (path.isAbsolute(url.pathname))
            try {
              return {
                ast: {
                  end: 0,
                  start: 0,
                  type: "File",
                },
                code: await fs.readFile(url.pathname, "utf-8"),
              };
            } catch {}
        },
      },
    ],
  });
  const init = async () => (driver = await _driver);
  const server = Server([
    async (req, res, next) => {
      await init();
      req.info.searchParams.set("r", Math.random() + "");
      let content_type;
      if (req.info.pathname.endsWith("/")) {
        content_type = "text/html";
        req.info.pathname += "index.html";
      }
      for (let mime in mimeMap) {
        if (mimeMap[mime].test(req.info.pathname)) {
          content_type = mime;
          break;
        }
      }
      let resolved = await driver.resolve(
        req.info.pathname.slice(1) + req.info.search,
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
