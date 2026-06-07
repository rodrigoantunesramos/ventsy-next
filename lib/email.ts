import nodemailer, { type Transporter } from 'nodemailer';

// Transporte SMTP — SERVER-ONLY. Configure via env (.env.local / Vercel):
//   SMTP_HOST  (default: smtp.zoho.com)
//   SMTP_PORT  (default: 465)
//   SMTP_USER  — e-mail completo da caixa (ex.: relatorios@ventsy.com.br)
//   SMTP_PASS  — senha de app (NÃO a senha normal da conta)
//   SMTP_FROM  — remetente exibido (default: "Ventsy <SMTP_USER>")
//
// Sem SMTP_USER/SMTP_PASS, sendEmail() vira no-op (retorna skipped) — assim o
// build e o cron nunca quebram quando o e-mail ainda não foi configurado.

let _transporter: Transporter | null | undefined;

function transporter(): Transporter | null {
  if (_transporter !== undefined) return _transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) { _transporter = null; return null; }
  const port = Number(process.env.SMTP_PORT || 465);
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return _transporter;
}

export function emailConfigurado(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const t = transporter();
  if (!t) return { ok: false, skipped: true };
  const from = process.env.SMTP_FROM || `Ventsy <${process.env.SMTP_USER}>`;
  await t.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
  return { ok: true, skipped: false };
}
