const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

/**
 * Wraps a message with a single call-to-action button. Styles are inline
 * because most mail clients strip `<style>` blocks.
 */
export function renderActionEmail({
  heading,
  intro,
  actionLabel,
  actionUrl,
  note,
}) {
  const url = escapeHtml(actionUrl)

  return `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px">
      <tr>
        <td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 24px;line-height:1.5">${escapeHtml(intro)}</p>
          <p style="margin:0 0 24px">
            <a href="${url}" style="display:inline-block;padding:12px 24px;background:#e4002b;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold">${escapeHtml(actionLabel)}</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#52606d">Nếu nút không hoạt động, hãy mở liên kết sau:</p>
          <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${url}" style="color:#e4002b">${url}</a></p>
          <p style="margin:0;font-size:13px;color:#52606d">${escapeHtml(note)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
