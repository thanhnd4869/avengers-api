export const API_VERSION = 'v1'
export const API_PREFIX = `/api/${API_VERSION}`

// Accepted from an upstream proxy when present, otherwise generated, and always
// echoed back so a user report can be traced to the matching logs.
export const REQUEST_ID_HEADER = 'x-request-id'
