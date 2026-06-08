import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(
    private email: EmailService,
    private config: ConfigService,
  ) {}

  private alertEmail(): string | undefined {
    return this.config.get<string>('ALERT_EMAIL');
  }

  async paymentSucceeded(organizationId: string, paymentId: string, amount: number) {
    this.logger.log(`Payment succeeded org=${organizationId} payment=${paymentId} amount=${amount}`);
    const to = this.alertEmail();
    if (to) {
      await this.email.sendAlert(to, 'Payment succeeded', `org=${organizationId}\npayment=${paymentId}\namount=${amount}`);
    }
  }

  async paymentFailed(organizationId: string, paymentId: string) {
    this.logger.warn(`Payment failed org=${organizationId} payment=${paymentId}`);
    const to = this.alertEmail();
    if (to) {
      await this.email.sendAlert(to, 'Payment failed', `org=${organizationId}\npayment=${paymentId}`);
    }
  }

  async queueBacklog(queueName: string, waiting: number, threshold: number) {
    if (waiting < threshold) return;
    this.logger.warn(`Queue backlog ${queueName}: ${waiting}`);
    const to = this.alertEmail();
    if (to) {
      await this.email.sendAlert(to, `Queue backlog: ${queueName}`, `waiting=${waiting} threshold=${threshold}`);
    }
  }

  async storageAlert(organizationId: string, usedMb: number, limitMb: number) {
    if (usedMb < limitMb * 0.9) return;
    this.logger.warn(`Storage alert org=${organizationId} ${usedMb}/${limitMb} MB`);
    const to = this.alertEmail();
    if (to) {
      await this.email.sendAlert(to, 'Storage limit warning', `org=${organizationId}\nused=${usedMb}MB\nlimit=${limitMb}MB`);
    }
  }

  async smtpFailure(error: string) {
    this.logger.error(`SMTP failure: ${error}`);
  }
}
