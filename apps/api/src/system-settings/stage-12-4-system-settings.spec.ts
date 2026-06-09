import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction, PaymentProviderType } from '@prisma/client';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsCache } from './system-settings-cache.service';
import { SystemIntegrationsService } from './system-integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { SETTING_KEYS, PLATFORM_ORG_ID } from './system-settings.constants';

describe('Stage 12.4 — System Settings Admin Panel', () => {
  describe('SystemSettingsService', () => {
    it('reads boolean from DB with env fallback', async () => {
      const prisma = {
        systemSetting: {
          findUnique: jest.fn().mockResolvedValue({ key: SETTING_KEYS.REGISTRATION_ENABLED, value: true }),
          upsert: jest.fn(),
        },
      };
      const mod = await Test.createTestingModule({
        providers: [
          SystemSettingsService,
          SystemSettingsCache,
          { provide: PrismaService, useValue: prisma },
          { provide: AuditService, useValue: { log: jest.fn() } },
          { provide: ConfigService, useValue: { get: () => 'false' } },
        ],
      }).compile();
      const enabled = await mod.get(SystemSettingsService).isRegistrationEnabled();
      expect(enabled).toBe(true);
    });

    it('writes setting and audits', async () => {
      const audit = { log: jest.fn() };
      const prisma = {
        systemSetting: {
          findUnique: jest.fn(),
          upsert: jest.fn().mockResolvedValue({}),
        },
      };
      const mod = await Test.createTestingModule({
        providers: [
          SystemSettingsService,
          SystemSettingsCache,
          { provide: PrismaService, useValue: prisma },
          { provide: AuditService, useValue: audit },
          { provide: ConfigService, useValue: { get: jest.fn() } },
        ],
      }).compile();
      await mod.get(SystemSettingsService).set(SETTING_KEYS.ALERTS_EMAIL, 'ops@test.com', 'admin-1', {
        auditAction: AuditAction.ALERT_UPDATED,
      });
      expect(prisma.systemSetting.upsert).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        AuditAction.ALERT_UPDATED,
        'admin-1',
        expect.any(Object),
        undefined,
        undefined,
        'SystemSetting',
        SETTING_KEYS.ALERTS_EMAIL,
      );
    });
  });

  describe('SystemIntegrationsService — payment providers', () => {
    it('masks secret key in payment provider list', async () => {
      const prisma = {
        paymentProvider: {
          findMany: jest.fn().mockResolvedValue([
            {
              provider: PaymentProviderType.YOOKASSA,
              isEnabled: false,
              isDefault: true,
              config: { shopId: '123', secretKeySecretId: 'sec-1', testMode: true },
            },
          ]),
        },
      };
      const settings = {
        getPublicUrl: jest.fn().mockResolvedValue('https://example.com'),
        isPaymentMockMode: jest.fn().mockResolvedValue(true),
      };
      const integrations = new SystemIntegrationsService(
        prisma as never,
        settings as never,
        { getSecret: jest.fn() } as never,
        { get: jest.fn() } as never,
        { getSystemHealth: jest.fn() } as never,
        { checkAll: jest.fn() } as never,
        { getQueueMetrics: jest.fn() } as never,
      );
      const list = await integrations.listPaymentProviders();
      expect(list[0].hasSecretKey).toBe(true);
      expect(list[0].shopId).toBe('123');
      expect(list[0].webhookUrl).toContain('yookassa');
    });
  });

  describe('Encrypted secrets — platform org', () => {
    it('uses platform org id constant', () => {
      expect(PLATFORM_ORG_ID).toBe('org_platform_system');
    });
  });

  describe('Launch readiness', () => {
    it('returns NO-GO when checks incomplete', async () => {
      const settings = {
        getPublicUrl: jest.fn().mockResolvedValue('https://crm-al.neeklo.ru'),
        getBoolean: jest.fn().mockResolvedValue(false),
        isRegistrationEnabled: jest.fn().mockResolvedValue(false),
        getString: jest.fn().mockResolvedValue(''),
        getJson: jest.fn(),
        getNumber: jest.fn(),
        set: jest.fn(),
        isPaymentMockMode: jest.fn().mockResolvedValue(true),
      };
      const prisma = {
        paymentProvider: { findUnique: jest.fn().mockResolvedValue({ config: {} }) },
      };
      const secrets = { getSecret: jest.fn().mockResolvedValue('') };
      const config = { get: jest.fn().mockReturnValue('') };

      const integrations = new SystemIntegrationsService(
        prisma as never,
        settings as never,
        secrets as never,
        config as never,
        { getSystemHealth: jest.fn().mockResolvedValue({ checks: { database: { ok: true } }, queues: { redis: true } }) } as never,
        { checkAll: jest.fn() } as never,
        { getQueueMetrics: jest.fn().mockResolvedValue({ queues: [] }) } as never,
      );

      jest.spyOn(integrations, 'getSmtpSettings').mockResolvedValue({
        host: '',
        port: 587,
        tls: true,
        user: '',
        from: '',
        hasPassword: false,
        configured: false,
        lastSuccessAt: null,
        lastError: null,
      });
      jest.spyOn(integrations, 'getAlertSettings').mockResolvedValue({
        alertEmail: '',
        queueAlerts: true,
        paymentAlerts: true,
        storageAlerts: true,
        smtpAlerts: true,
        securityAlerts: true,
        parserAlerts: true,
        telegramEnabled: false,
        hasTelegramBotToken: false,
      });
      jest.spyOn(integrations, 'getRegistrationSettings').mockResolvedValue({
        enabled: false,
        inviteOnly: false,
        defaultPlan: 'FREE',
        requireEmailVerification: false,
        autoCreateOrganization: true,
      });
      jest.spyOn(integrations, 'getPaymentCredentials').mockResolvedValue({
        shopId: '',
        secretKey: '',
        mockMode: true,
      });

      const result = await integrations.getLaunchReadiness();
      expect(result.verdict).toBe('NO-GO');
      expect(result.readinessPercent).toBeLessThan(100);
    });
  });
});
