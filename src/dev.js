import fs from "fs/promises";
import { PluginDriver } from "./PluginDriver.js";
import path from "path";
import { Server } from "./server.js";
import minimist from "minimist";
import { lookup } from "mrmime";
import { DONT_LOAD, loaderPlugin } from "./plugins/loader.js";
import sirv from "sirv";
import { cssPlugin } from "./plugins/css.js";
import sucrase from "@rollup/plugin-sucrase";
import { assetsPlugin } from "./plugins/assets.js";

const { HOST, PORT } = process.env;

/**
 *
 * @param {*} options
 * @returns {(req: import("http").IncomingMessage & {info: URL;originalUrl: string;path: string;search: string;query: URLSearchParams;}, res: import("http").ServerResponse<import("http").IncomingMessage> & {req: import("http").IncomingMessage;}, next: () => Promise<void>) => any}
 */
function devMiddleWare(options) {
  /**
   * @type {import("rollup").PluginContext}
   */
  let driver;
  let _driver = PluginDriver({
    plugins: [sucrase({
      include: [/\.[mc]?[jt]sx?$/],
      exclude: ['node_modules/**'],
      transforms: ['typescript']
    }), cssPlugin(), assetsPlugin(options),loaderPlugin()],
  });
  const init = async () => (driver = await _driver);

  let extensions = ["html", "htm"];
  let gzips = options.gzip && extensions.map((x) => `${x}.gz`).concat("gz");
  let brots = options.brotli && extensions.map((x) => `${x}.br`).concat("br");

  const FILES = {};

  let fallback = "/";
  let isEtag = !!options.etag;

  let cc = options.maxAge != null && `public,max-age=${options.maxAge}`;
  if (cc && options.immutable) cc += ",immutable";
  else if (cc && options.maxAge === 0) cc += ",must-revalidate";

  return async (req, res, next) => {
    await init();
    let extns = [""];
    let val = req.headers["accept-encoding"] || "";
    if (gzips && val.includes("gzip")) extns.unshift(...gzips);
    if (brots && /(br|brotli)/i.test(val + "")) extns.unshift(...brots);
    extns.push(...extensions); // [...br, ...gz, orig, ...exts]
    let pathname = req.info.pathname
    if (pathname.endsWith("/"))
      pathname += "index.html";
    pathname = path.join(options.root, pathname);
    let resolved = await driver.resolve(
      pathname + req.info.search,
      undefined,
      { isEntry: true },
    );
    if (resolved) {
      try {
        let result = await driver.load(resolved);
        if (result) {
          let ctype = (result.meta?.$$?.js || /\.[mc]?[jt]sx?$/.test(pathname)) ? 'application/javascript' : (lookup(pathname) || "")
          if (ctype === "text/html") ctype += ";charset=utf-8";
          res.writeHead(200, {
            // Vary: (gzips || brots) && "Accept-Encoding",
            "Cache-Control": isEtag ? "no-cache" : "no-store",
            // 'Content-Length': stats.size,
            "Content-Type": ctype && ctype,
            // 'Last-Modified': stats.mtime.toUTCString(),
          });
          res.end(result.code);
        }
      } catch (error) {
        if (error !== DONT_LOAD) throw error
      }
    }
    next();
  };
}

/**
 * @param {string[]} argv
 */
export async function dev(argv) {
  /** @type {minimist.ParsedArgs & { root: string }} */
  // @ts-ignore
  const options = minimist(argv, {});
  options.root = options.root || "/";
  let start = new Date().getMilliseconds();

  const server = await Server([sirv(path.join(options.root, 'public'), { dev: true }), devMiddleWare(options), sirv(options.root, { dev: true })]);

  const port = options.port || PORT || 3000;
  const hostname = options.host || HOST || "0.0.0.0";

  server.listen(port, hostname);
  console.info(
    `Server       ready in ${new Date().getMilliseconds() - start} ms\n\n` +
    `=> Local:    http://localhost:3000/\n` +
    "",
  );
}
