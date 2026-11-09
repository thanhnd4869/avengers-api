// VNPay wants a plain address; Node reports IPv4 clients as IPv4-mapped IPv6.
export function clientIp(request) {
  const ip = request.ip ?? '127.0.0.1'

  return ip.startsWith('::ffff:')
    ? ip.slice(7)
    : ip === '::1'
      ? '127.0.0.1'
      : ip
}
