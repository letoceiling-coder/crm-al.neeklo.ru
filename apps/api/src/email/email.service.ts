import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { buildSmtpTransportOptions } from '../common/utils/smtp-transport.util';
import { SystemIntegrationsService } from '../system-settings/system-integrations.service';
import { SETTING_KEYS } from '../system-settings/system-settings.constants';
import { SystemSettingsService } from '../system-settings/system-settings.service';

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

  constructor(
    private config: ConfigService,
    private integrations: SystemIntegrationsService,
    private settings: SystemSettingsService,
  ) {}

  private async getTransporter(): Promise<Transporter | null> {
    const cfg = await this.integrations.resolveSmtpConfig();
    if (!cfg.host || !cfg.user) return null;
    return nodemailer.createTransport(buildSmtpTransportOptions(cfg));
  }

  async isConfigured(): Promise<boolean> {
    const cfg = await this.integrations.resolveSmtpConfig();
    return !!(cfg.host && cfg.user && cfg.password);
  }

  async send(to: string, subject: string, html: string, text?: string) {
    const cfg = await this.integrations.resolveSmtpConfig();
    const from = cfg.from || this.config.get('SMTP_FROM', 'noreply@crm-al.neeklo.ru');
    const transporter = await this.getTransporter();

    if (!transporter) {
      this.logger.log(`[EMAIL STUB] to=${to} subject=${subject}`);
      return { queued: false, stub: true, to, subject };
    }

    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, ''),
      });
      await this.settings.set(SETTING_KEYS.EMAIL_LAST_SUCCESS, new Date().toISOString(), undefined, {
        category: 'EMAIL' as never,
      });
      return { messageId: info.messageId, queued: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      await this.settings.set(
        SETTING_KEYS.EMAIL_LAST_ERROR,
        { at: new Date().toISOString(), message },
        undefined,
        { category: 'EMAIL' as never },
      );
      throw err;
    }
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
