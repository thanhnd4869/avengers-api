import { escapeHtml } from './layout.js'

const formatVnd = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    value,
  )

/**
 * Sent once an order is paid: every key it bought, grouped by game, and a
 * link to the order in the account where they stay available.
 */
export function orderKeysEmail({ displayName, order, keys, url }) {
  const lines = order.items.map((item) => ({
    title: `${item.productName} (${item.platform.name}${item.edition !== 'Standard' ? `, ${item.edition}` : ''})`,
    codes: keys.get(String(item.variantId)) ?? [],
  }))
  const intro = `Chào ${displayName}, cảm ơn bạn đã mua hàng. Đơn ${order.number} đã được thanh toán ${formatVnd(order.total)}. Dưới đây là key của bạn.`
  const note =
    'Hãy giữ kín các key này: ai có key đều có thể kích hoạt. Key luôn có trong mục Orders của tài khoản.'

  const text = [
    intro,
    '',
    ...lines.flatMap((line) => [
      line.title,
      ...line.codes.map((code) => `  ${code}`),
      '',
    ]),
    url,
    '',
    note,
  ].join('\n')

  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px">
      <tr>
        <td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:20px">Key của bạn đã sẵn sàng</h1>
          <p style="margin:0 0 24px;line-height:1.5">${escapeHtml(intro)}</p>
          ${lines
            .map(
              (
                line,
              ) => `<p style="margin:0 0 8px;font-weight:bold">${escapeHtml(line.title)}</p>
          ${line.codes
            .map(
              (code) =>
                `<p style="margin:0 0 8px"><code style="display:inline-block;padding:8px 12px;border:1px dashed #e4002b;border-radius:4px;font-size:16px;letter-spacing:2px">${escapeHtml(code)}</code></p>`,
            )
            .join('\n          ')}`,
            )
            .join('\n          ')}
          <p style="margin:24px 0">
            <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background:#e4002b;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold">Xem đơn hàng</a>
          </p>
          <p style="margin:0;font-size:13px;color:#52606d">${escapeHtml(note)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject: `Key cho đơn hàng ${order.number}`, html, text }
}
