import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const VERSION = '2.1.0'
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000
const QUERY_TIMEOUT_MS = 10_000
const REFUND_TIMEOUT_MS = 15_000

/** `yyyyMMddHHmmss` in Vietnam time (GMT+7), as every VNPay date is. */
export function formatVnpayDate(date) {
  return new Date(date.getTime() + VIETNAM_OFFSET_MS)
    .toISOString()
    .replace(/\D/g, '')
    .slice(0, 14)
}

export function parseVnpayDate(value) {
  if (!/^\d{14}$/.test(value ?? '')) return null

  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+07:00`
  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * VNPay's canonical query string: keys sorted, values URL-encoded with spaces
 * as `+`. The same string is what gets signed, exactly as VNPay's reference
 * code builds it, so any deviation here breaks every signature.
 */
function canonicalQuery(params) {
  return Object.keys(params)
    .filter(
      (key) =>
        params[key] !== undefined && params[key] !== null && params[key] !== '',
    )
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key])).replace(/%20/g, '+')}`,
    )
    .join('&')
}

function hmac(secret, data) {
  return createHmac('sha512', secret).update(data, 'utf8').digest('hex')
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a ?? '').toLowerCase(), 'utf8')
  const right = Buffer.from(String(b ?? '').toLowerCase(), 'utf8')

  return left.length === right.length && timingSafeEqual(left, right)
}

/** Strips anything VNPay does not allow in `vnp_OrderInfo`. */
function plainText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255)
}

/**
 * The VNPay calls this shop makes: a signed payment URL, checking the
 * signature of what VNPay sends back (IPN and the return redirect), and
 * asking VNPay for a transaction's result (`querydr`).
 *
 * `fetchImpl` is injectable so tests can stand in for VNPay.
 */
export function createVnpayClient({
  tmnCode,
  hashSecret,
  payUrl,
  apiUrl,
  fetchImpl = fetch,
}) {
  return {
    buildPaymentUrl({
      txnRef,
      amount,
      orderInfo,
      ipAddr,
      returnUrl,
      createdAt,
      expiresAt,
      locale = 'vn',
    }) {
      const params = {
        vnp_Version: VERSION,
        vnp_Command: 'pay',
        vnp_TmnCode: tmnCode,
        // VNPay amounts carry two implied decimals, even for VND.
        vnp_Amount: amount * 100,
        vnp_CurrCode: 'VND',
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: plainText(orderInfo),
        // "other": VNPay's catch-all goods category.
        vnp_OrderType: 'other',
        vnp_Locale: locale,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: formatVnpayDate(createdAt),
        vnp_ExpireDate: formatVnpayDate(expiresAt),
      }
      const query = canonicalQuery(params)

      return `${payUrl}?${query}&vnp_SecureHash=${hmac(hashSecret, query)}`
    },

    /**
     * Checks the signature of the parameters VNPay sent (IPN or the return
     * redirect) and that they are for this terminal. Answers the parameters
     * without the hash fields, or `null` when they cannot be trusted.
     */
    verifyCallback(query) {
      const params = {}

      for (const [key, value] of Object.entries(query ?? {})) {
        if (key.startsWith('vnp_') && typeof value === 'string') {
          params[key] = value
        }
      }

      const { vnp_SecureHash: hash, ...signed } = params

      delete signed.vnp_SecureHashType

      if (
        !hash ||
        !safeEqualHex(hash, hmac(hashSecret, canonicalQuery(signed)))
      ) {
        return null
      }

      if (signed.vnp_TmnCode !== tmnCode) return null

      return signed
    },

    /**
     * Asks VNPay how a payment ended. Answers VNPay's verified reply, or
     * throws when VNPay cannot be reached or its reply is not signed by it.
     */
    async queryTransaction({ txnRef, transactionDate, orderInfo, ipAddr }) {
      const request = {
        vnp_RequestId: randomBytes(16).toString('hex'),
        vnp_Version: VERSION,
        vnp_Command: 'querydr',
        vnp_TmnCode: tmnCode,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: plainText(orderInfo),
        vnp_TransactionDate: formatVnpayDate(transactionDate),
        vnp_CreateDate: formatVnpayDate(new Date()),
        vnp_IpAddr: ipAddr,
      }

      request.vnp_SecureHash = hmac(
        hashSecret,
        [
          request.vnp_RequestId,
          request.vnp_Version,
          request.vnp_Command,
          request.vnp_TmnCode,
          request.vnp_TxnRef,
          request.vnp_TransactionDate,
          request.vnp_CreateDate,
          request.vnp_IpAddr,
          request.vnp_OrderInfo,
        ].join('|'),
      )

      const response = await fetchImpl(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      })

      if (!response.ok) {
        throw new Error(`VNPay querydr answered HTTP ${response.status}`)
      }

      const reply = await response.json()
      const expected = hmac(
        hashSecret,
        [
          reply.vnp_ResponseId,
          reply.vnp_Command,
          reply.vnp_ResponseCode,
          reply.vnp_Message,
          reply.vnp_TmnCode,
          reply.vnp_TxnRef,
          reply.vnp_Amount,
          reply.vnp_BankCode,
          reply.vnp_PayDate,
          reply.vnp_TransactionNo,
          reply.vnp_TransactionType,
          reply.vnp_TransactionStatus,
          reply.vnp_OrderInfo,
          reply.vnp_PromotionCode,
          reply.vnp_PromotionAmount,
        ]
          .map((value) => value ?? '')
          .join('|'),
      )

      if (!safeEqualHex(reply.vnp_SecureHash, expected)) {
        throw new Error('VNPay querydr reply has an invalid signature')
      }

      return reply
    },

    /**
     * Requests a full refund for a settled transaction. VNPay's merchant API
     * signs the fixed field sequence, rather than the payment URL query.
     */
    async refundTransaction({
      requestId,
      txnRef,
      amount,
      transactionNo,
      transactionDate,
      orderInfo,
      createdBy,
      ipAddr,
      createdAt = new Date(),
    }) {
      const request = {
        vnp_RequestId: requestId,
        vnp_Version: VERSION,
        vnp_Command: 'refund',
        vnp_TmnCode: tmnCode,
        vnp_TransactionType: '02',
        vnp_TxnRef: txnRef,
        vnp_Amount: String(amount * 100),
        vnp_OrderInfo: plainText(orderInfo),
        vnp_TransactionNo: transactionNo,
        vnp_TransactionDate: formatVnpayDate(transactionDate),
        vnp_CreateBy: plainText(createdBy).slice(0, 50),
        vnp_CreateDate: formatVnpayDate(createdAt),
        vnp_IpAddr: ipAddr,
      }

      request.vnp_SecureHash = hmac(
        hashSecret,
        [
          request.vnp_RequestId,
          request.vnp_Version,
          request.vnp_Command,
          request.vnp_TmnCode,
          request.vnp_TxnRef,
          request.vnp_TransactionType,
          request.vnp_Amount,
          request.vnp_TransactionNo,
          request.vnp_TransactionDate,
          request.vnp_CreateBy,
          request.vnp_CreateDate,
          request.vnp_IpAddr,
          request.vnp_OrderInfo,
        ].join('|'),
      )

      const response = await fetchImpl(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(REFUND_TIMEOUT_MS),
      })

      if (!response.ok) {
        throw new Error(`VNPay refund answered HTTP ${response.status}`)
      }

      const reply = await response.json()
      const expected = hmac(
        hashSecret,
        [
          reply.vnp_ResponseId,
          reply.vnp_Command,
          reply.vnp_ResponseCode,
          reply.vnp_Message,
          reply.vnp_TmnCode,
          reply.vnp_TxnRef,
          reply.vnp_Amount,
          reply.vnp_BankCode,
          reply.vnp_PayDate,
          reply.vnp_TransactionNo,
          reply.vnp_TransactionType,
          reply.vnp_TransactionStatus,
          reply.vnp_OrderInfo,
          reply.vnp_PromotionCode,
          reply.vnp_PromotionAmount,
        ]
          .map((value) => value ?? '')
          .join('|'),
      )

      if (!safeEqualHex(reply.vnp_SecureHash, expected)) {
        throw new Error('VNPay refund reply has an invalid signature')
      }

      if (
        reply.vnp_Command !== 'refund' ||
        typeof reply.vnp_ResponseCode !== 'string' ||
        !/^\d{2}$/.test(reply.vnp_ResponseCode) ||
        reply.vnp_TmnCode !== tmnCode ||
        reply.vnp_TxnRef !== txnRef ||
        Number(reply.vnp_Amount) !== amount * 100 ||
        reply.vnp_TransactionType !== '02'
      ) {
        throw new Error('VNPay refund reply does not match the request')
      }

      return reply
    },

    // Exposed for tests that need to play VNPay's part.
    sign: (params) => hmac(hashSecret, canonicalQuery(params)),
    createRefundRequestId: () => randomBytes(16).toString('hex'),
  }
}
