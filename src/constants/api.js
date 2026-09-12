export const API_VERSION = 'v1'
export const API_PREFIX = `/api/${API_VERSION}`

/**
 * Correlates a client report with server logs. Accepted from an upstream proxy
 * when present and always echoed back on the response.
 */
export const REQUEST_ID_HEADER = 'x-request-id'
