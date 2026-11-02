import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
const transport = env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS?.replace(/\s/g, '') }
            : undefined,
    })
    : null;
/** Sends an email. Without SMTP_HOST (development) the message is printed to the console. */
export const sendMail = async (mail) => {
    if (!transport) {
        console.log(`\n[mail:dev] to=${mail.to}\nsubject: ${mail.subject}\n${mail.text}\n`);
        return;
    }
    await transport.sendMail({ from: env.MAIL_FROM, ...mail });
};
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
/** One call-to-action email in the AbroadMates style. */
export const callToActionMail = (to, subject, intro, label, url) => ({
    to,
    subject,
    text: `${intro}\n\n${label}: ${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
  <h2 style="color:#d4002a">abroadMATES</h2>
  <p>${escapeHtml(intro)}</p>
  <p><a href="${escapeHtml(url)}" style="background:#d4002a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(label)}</a></p>
  <p style="color:#777;font-size:12px">If you did not request this, you can ignore this email.</p>
</div>`,
});
//# sourceMappingURL=mailer.js.map