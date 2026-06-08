import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type EmailTemplate =
  | 'organization-invitation'
  | 'password-reset'
  | 'payment-confirmation'
  | 'subscription-activated'
  | 'marketplace-purchase'
  | 'alert';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get('SMTP_PORT', 587));
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    const secure = this.config.get('SMTP_TLS', 'true') === 'true';

    if (!host || !user) {
      this.logger.warn('SMTP not configured — emails will be logged only');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  isConfigured(): boolean {
    return !!this.transporter;
  }

  async send(to: string, subject: string, html: string, text?: string) {
    const from = this.config.get('SMTP_FROM', 'noreply@crm-al.neeklo.ru');

    if (!this.transporter) {
      this.logger.log(`[EMAIL STUB] to=${to} subject=${subject}`);
      return { queued: false, stub: true, to, subject };
    }

    const info = await this.transporter.sendMail({ from, to, subject, html, text: text ?? html.replace(/<[^>]+>/g, '') });
    return { messageId: info.messageId, queued: true };
  }

  async sendOrganizationInvitation(to: string, orgName: string, inviteUrl: string, role: string) {
    return this.send(
      to,
      `Приглашение в организацию ${orgName}`,
      `<p>Вас пригласили в организацию <strong>${orgName}</strong> с ролью ${role}.</p>
       <p><a href="${inviteUrl}">Принять приглашение</a></p>`,
    );
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    return this.send(
      to,
      'Сброс пароля — AI Gateway',
      `<p>Запрошен сброс пароля.</p><p><a href="${resetUrl}">Установить новый пароль</a></p>
       <p>Ссылка действует 1 час.</p>`,
    );
  }

  async sendPaymentConfirmation(to: string, amount: string, currency: string, invoiceNumber: string) {
    return this.send(
      to,
      `Оплата получена — счёт ${invoiceNumber}`,
      `<p>Оплата <strong>${amount} ${currency}</strong> по счёту ${invoiceNumber} успешно получена.</p>`,
    );
  }

  async sendSubscriptionActivated(to: string, planName: string) {
    return this.send(
      to,
      `Подписка активирована — ${planName}`,
      `<p>Ваша подписка <strong>${planName}</strong> активирована. Лимиты тарифа обновлены.</p>`,
    );
  }

  async sendMarketplacePurchase(to: string, packageName: string, amount: string) {
    return this.send(
      to,
      `Покупка в Marketplace — ${packageName}`,
      `<p>Пакет <strong>${packageName}</strong> успешно приобретён (${amount}).</p>`,
    );
  }

  async sendAlert(to: string, subject: string, body: string) {
    return this.send(to, `[Alert] ${subject}`, `<pre>${body}</pre>`);
  }
}
