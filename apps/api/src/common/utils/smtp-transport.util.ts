import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type SmtpConnectionConfig = {
  host: string;
  port: number;
  tls: boolean;
  user: string;
  password: string;
};

/** Nodemailer transport options — port 465 uses implicit SSL; 587 uses STARTTLS when tls is set. */
export function buildSmtpTransportOptions(cfg: SmtpConnectionConfig): SMTPTransport.Options {
  const secure = cfg.port === 465 || (cfg.tls && cfg.port !== 587);
  const options: SMTPTransport.Options = {
    host: cfg.host,
    port: cfg.port,
    secure,
    auth: { user: cfg.user, pass: cfg.password },
  };
  if (cfg.port === 587 && cfg.tls) {
    options.requireTLS = true;
  }
  return options;
}
