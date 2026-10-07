import nodemailer from 'nodemailer';

function isConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM
  );
}

function getTransporter() {
  if (!isConfigured()) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendTransactionEmail({ toEmail, toName, html, subject, replyTo }) {
  const transporter = getTransporter();

  if (!transporter) {
    const error = new Error('SMTP email is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    replyTo: replyTo || process.env.MAIL_REPLY_TO || undefined,
    subject: subject || 'Transaction notification — HisabKitab',
    html,
    text: `Dear ${toName || 'Customer'}, your transaction has been recorded. Please view the HTML email for the complete transaction details.`,
  });

  return { messageId: info.messageId };
}

export function emailIsConfigured() {
  return isConfigured();
}
