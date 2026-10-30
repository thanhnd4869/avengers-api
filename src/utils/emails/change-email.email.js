import { renderActionEmail } from './layout.js'

export function changeEmailEmail({ displayName, email, url, ttlHours }) {
  const intro = `Chào ${displayName}, hãy xác nhận ${email} là địa chỉ email mới của tài khoản Avengers.`
  const note = `Liên kết có hiệu lực trong ${ttlHours} giờ. Cho đến khi xác nhận, bạn vẫn đăng nhập bằng email cũ. Nếu bạn không yêu cầu, hãy bỏ qua email này.`

  return {
    subject: 'Xác nhận địa chỉ email mới',
    html: renderActionEmail({
      heading: 'Xác nhận email mới',
      intro,
      actionLabel: 'Xác nhận email mới',
      actionUrl: url,
      note,
    }),
    text: `${intro}\n\n${url}\n\n${note}`,
  }
}
