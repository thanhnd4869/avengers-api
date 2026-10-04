import { renderActionEmail } from './layout.js'

export function verifyEmailEmail({ displayName, url, ttlHours }) {
  const intro = `Chào ${displayName}, hãy xác minh địa chỉ email để hoàn tất đăng ký tài khoản Avengers.`
  const note = `Liên kết có hiệu lực trong ${ttlHours} giờ. Nếu bạn không đăng ký, hãy bỏ qua email này.`

  return {
    subject: 'Xác minh địa chỉ email',
    html: renderActionEmail({
      heading: 'Xác minh email',
      intro,
      actionLabel: 'Xác minh email',
      actionUrl: url,
      note,
    }),
    text: `${intro}\n\n${url}\n\n${note}`,
  }
}
