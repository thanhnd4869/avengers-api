import { renderActionEmail } from './layout.js'

export function resetPasswordEmail({ displayName, url, ttlMinutes }) {
  const intro = `Chào ${displayName}, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.`
  const note = `Liên kết có hiệu lực trong ${ttlMinutes} phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu sẽ không thay đổi.`

  return {
    subject: 'Đặt lại mật khẩu',
    html: renderActionEmail({
      heading: 'Đặt lại mật khẩu',
      intro,
      actionLabel: 'Đặt mật khẩu mới',
      actionUrl: url,
      note,
    }),
    text: `${intro}\n\n${url}\n\n${note}`,
  }
}
