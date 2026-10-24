/**
 * Preload (`node --import`) that sends requests for https://api.figma.com to a fake
 * Figma API at $DTA_FIGMA_API_URL, without changing the program that makes them.
 *
 * It patches `https.request` / `https.get`, which axios (via follow-redirects) calls at
 * request time. Requests to any other host are untouched.
 */
import http from 'node:http'
import https from 'node:https'

const FIGMA_HOST = 'api.figma.com'
const target = process.env.DTA_FIGMA_API_URL

if (target) {
  const fake = new URL(target)
  const originalRequest = https.request

  /** Options for the plain-http request to the fake, or null if the request is not for Figma. */
  function redirected(first, second) {
    if (typeof first === 'string' || first instanceof URL) {
      const url = new URL(first)
      if (url.hostname !== FIGMA_HOST) return null
      const extra =
        second && typeof second === 'object' && !(second instanceof Function) ? second : {}
      return { ...extra, path: url.pathname + url.search }
    }
    if (first && (first.hostname ?? first.host) === FIGMA_HOST) return { ...first }
    return null
  }

  https.request = function request(...args) {
    const options = redirected(args[0], args[1])
    if (options === null) return originalRequest.apply(this, args)

    const callback = args.find((arg) => typeof arg === 'function')
    return http.request(
      {
        ...options,
        protocol: 'http:',
        hostname: fake.hostname,
        host: fake.hostname,
        port: fake.port,
        // An https agent cannot be used for a plain-http request.
        agent: undefined,
        agents: undefined,
      },
      callback,
    )
  }

  https.get = function get(...args) {
    const req = https.request(...args)
    req.end()
    return req
  }
}
