import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { SETTING_KEYS } from '../system-settings/system-settings.constants';
import { TelegramPlatformService } from '../telegram-platform/telegram-platform.service';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(
    private email: EmailService,
    private config: ConfigService,
    private settings: SystemSettingsService,
    private telegram: TelegramPlatformService,
  ) {}

  private async alertEmail(): Promise<string | undefined> {
    const fromDb = await this.settings.getString(SETTING_KEYS.ALERTS_EMAIL, '');
    if (fromDb) return fromDb;
    return this.config.get<string>('ALERT_EMAIL');
  }

  private async alertsEnabled(
    kind: 'queue' | 'payment' | 'storage' | 'smtp' | 'security' | 'parser',
  ): Promise<boolean> {
    const map = {
      queue: SETTING_KEYS.ALERTS_QUEUE,
      payment: SETTING_KEYS.ALERTS_PAYMENT,
      storage: SETTING_KEYS.ALERTS_STORAGE,
      smtp: SETTING_KEYS.ALERTS_SMTP,
      security: SETTING_KEYS.ALERTS_SECURITY,
      parser: SETTING_KEYS.ALERTS_PARSER,
    } as const;
    return this.settings.getBoolean(map[kind], true);
  }

  private async dispatch(
    type: 'QUEUE_ERROR' | 'PARSER_ERROR' | 'SMTP_ERROR' | 'PAYMENT_ERROR' | 'SECURITY_ALERT' | 'SYSTEM_ALERT' | 'STORAGE_WARNING',
    title: string,
    body: string,
  ) {
    const to = await this.alertEmail();
    if (to) {
      await this.email.sendAlert(to, title, body);
    }
    await this.telegram.sendAlert(type, title, body);
  }

  async paymentSucceeded(organizationId: string, paymentId: string, amount: number) {
    this.logger.log(`Payment succeeded org=${organizationId} payment=${paymentId} amount=${amount}`);
    if (!(await this.alertsEnabled('payment'))) return;
    const to = await this.alertEmail();
    if (to) {
      await this.email.sendAlert(
        to,
        'Платёж успешен',
        `org=${organizationId}\npayment=${paymentId}\namount=${amount}`,
      );
    }
  }

  async paymentFailed(organizationId: string, paymentId: string) {
    this.logger.warn(`Payment failed org=${organizationId} payment=${paymentId}`);
    if (!(await this.alertsEnabled('payment'))) return;
    await this.dispatch('PAYMENT_ERROR', 'Ошибка платежа', `org=${organizationId}\npayment=${paymentId}`);
  }

  async queueBacklog(queueName: string, waiting: number, threshold: number) {
    if (waiting < threshold) return;
    this.logger.warn(`Queue backlog ${queueName}: ${waiting}`);
    if (!(await this.alertsEnabled('queue'))) return;
    await this.dispatch(
      'QUEUE_ERROR',
      `Ошибка очереди: ${queueName}`,
      `waiting=${waiting} threshold=${threshold}`,
    );
  }

  async storageAlert(organizationId: string, usedMb: number, limitMb: number) {
    if (usedMb < limitMb * 0.9) return;
    this.logger.warn(`Storage alert org=${organizationId} ${usedMb}/${limitMb} MB`);
    if (!(await this.alertsEnabled('storage'))) return;
    await this.dispatch(
      'STORAGE_WARNING',
      'Предупреждение хранилища',
      `org=${organizationId}\nused=${usedMb}MB\nlimit=${limitMb}MB`,
    );
  }

  async smtpFailure(error: string) {
    this.logger.error(`SMTP failure: ${error}`);
    if (!(await this.alertsEnabled('smtp'))) return;
    await this.dispatch('SMTP_ERROR', 'Ошибка SMTP', error);
  }

  async parserFailure(sourceId: string, url: string, error: string) {
    this.logger.warn(`Parser failure source=${sourceId} url=${url}: ${error}`);
    if (!(await this.alertsEnabled('parser'))) return;
    await this.dispatch('PARSER_ERROR', 'Ошибка парсинга', `source=${sourceId}\nurl=${url}\nerror=${error}`);
  }

  async securityAlert(event: string, detail: string) {
    this.logger.warn(`Security alert: ${event}`);
    if (!(await this.alertsEnabled('security'))) return;
    await this.dispatch('SECURITY_ALERT', `Безопасность: ${event}`, detail);
  }

  async systemAlert(title: string, detail: string) {
    await this.dispatch('SYSTEM_ALERT', title, detail);
  }
}
