import {Request} from 'express'

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const HMAC_HEX_LENGTH = 64
const HMAC_HEX = new RegExp(`^[0-9a-f]{${HMAC_HEX_LENGTH}}`)

/**
 * Read the restrictions a secured API key embeds. The key is base64 of a 64-character hex HMAC followed by the query
 * string it signs. The mock never knows the parent key, so the HMAC is not verified.
 * Returns null for a plain admin or search key.
 */
export const decodeSecuredApiKey = (apiKey: unknown): URLSearchParams | null => {
  if (typeof apiKey !== `string` || !BASE64.test(apiKey)) return null

  const decoded = Buffer.from(apiKey, `base64`).toString(`utf8`)
  return HMAC_HEX.test(decoded) ? new URLSearchParams(decoded.slice(HMAC_HEX_LENGTH)) : null
}

// Browser clients send credentials as query parameters, Node clients as headers
const requestApiKey = (req: Request): unknown => req.get(`x-algolia-api-key`) ?? req.query[`x-algolia-api-key`]

/**
 * Algolia ANDs a secured key's embedded `filters` with each search's own `filters`, so a search can narrow what the
 * key lets it see but never widen it
 */
export const withSecuredApiKeyFilters = (req: Request, filters?: string): string | undefined => {
  const keyFilters = decodeSecuredApiKey(requestApiKey(req))?.get(`filters`)
  const combined = [keyFilters, filters].filter(part => typeof part === `string` && part.trim().length > 0)
  return combined.length > 0 ? combined.join(` AND `) : undefined
}
