import nodemailer from 'nodemailer'

/**
 * Sends `{ to, subject, html, text }`. Without SMTP settings (development
 * only; production refuses to start) each message is logged instead, so the
 * links inside can still be followed.
 */
export function createMailer({ smtp, mailFrom, logger }) {
  if (!smtp) {
    logger.warn('SMTP is not configured; emails will be logged, not sent')

    return {
      async send({ to, subject, text }) {
        logger.info({ mail: { to, subject } }, `Email not sent:\n${text}`)
      },
    }
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  })

  return {
    async send({ to, subject, html, text }) {
      await transport.sendMail({ from: mailFrom, to, subject, html, text })
    },
  }
}
