import http from "http";

/**
 * @param {((req: http.IncomingMessage & { info: URL; originalUrl: string; path: string; search: string; query: URLSearchParams; }, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }, next: () => Promise<void>) => any)[]} middlewares
 */
export function Server(middlewares) {
    middlewares.push((req, res) => {
        res.writeHead(404)
        res.end()
    })
    return http.createServer(async (_req, res) => {
        if (!_req.url) throw Error()
        const info = new URL(_req.url, "file://")
        const originalUrl = _req.url;
        const path = info.pathname
        // Grab addl values from `info`
        const search = info.search;
        const query = info.searchParams

        let index = 0
        const next = async () => {
            if (!res.writableEnded) {
                const middleware = middlewares[index++]
                if (middleware) try {
                    await middleware(Object.assign(_req, { info, originalUrl, path, search, query }), res, next)
                } catch (error) {
                    
                }
            }
        }
        await next()
    })
}