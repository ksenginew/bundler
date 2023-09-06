import http from "http";
import http2 from "http2";

import fs from "fs/promises";

const PAD = "  ";
const { HOST, PORT } = process.env;
const stamp = () => Date();

function toTime() {
  return "[" + stamp() + "] ";
}

/**
 * @param {number[]} arr
 */
function toMS(arr) {
  return `${(arr[1] / 1e6).toFixed(2)}ms`;
}

/**
 * @param {string} msg
 */
function exit(msg) {
  process.stderr.write("\n" + PAD + "ERROR: " + msg + "\n\n");
  process.exit(1);
}

/**
 * @param {((req: http.IncomingMessage & {info: URL;originalUrl: string;path: string;search: string;query: URLSearchParams;}, res: http.ServerResponse<http.IncomingMessage> & {req: http.IncomingMessage;}, next: () => Promise<void>) => any)[]} middlewares
 * @param {{}} [options]
 */
export async function Server(middlewares, options = {}) {
  let defaultHeaders = {};
  if (options.cors) {
    defaultHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Origin, Content-Type, Accept, Range",
    };
  }
  let { hrtime, stdout } = process;
  middlewares.push((req, res) => {
    res.writeHead(404);
    res.end();
  });
  const handler = async (
    /** @type {http.IncomingMessage} */ _req,
    /** @type {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }} */ res,
  ) => {
    if (!_req.url) throw Error();
    const info = new URL(_req.url, "file://");
    const originalUrl = _req.url;
    const path = info.pathname;
    // Grab addl values from `info`
    const search = info.search;
    const query = info.searchParams;

    let index = 0;
    const next = async () => {
      if (!res.writableEnded) {
        const middleware = middlewares[index++];
        if (middleware)
          try {
            await middleware(
              Object.assign(_req, { info, originalUrl, path, search, query }),
              res,
              next,
            );
          } catch (error) {
            res.writeHead(500, error+'');
            res.end(error + "");
          }
      }
    };
    await next();
  };

  /**
   * @type {http2.Http2SecureServer | http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>}
   */
  let server;
  if (options.http2) {
    // if (semiver(process.version.substring(1), '8.4.0') < 0) {
    // 	return exit('HTTP/2 requires Node v8.4.0 or greater');
    // }

    if (!options.key || !options.cert) {
      exit('HTTP/2 requires "key" and "cert" values');
    }

    options.allowHTTP1 = true; // grace
    const key = await fs.readFile(options.key);
    const cert = await fs.readFile(options.cert);
    let cacert;
    let passphrase;
    if (options.cacert) cacert = await fs.readFile(options.cacert);
    if (options.pass) passphrase = await fs.readFile(options.pass, "utf-8");
    server = http2.createSecureServer(
      {
        key,
        cert,
        passphrase,
        // @ts-ignore
      },
      handler,
    );
  } else {
    server = http.createServer(handler);
  }
  return server;
}
