import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, SystemSettingCategory, SystemSettingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SystemSettingsCache } from './system-settings-cache.service';
import { ENV_FALLBACKS, SETTING_KEYS } from './system-settings.constants';

@Injectable()
export class SystemSettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private cache: SystemSettingsCache,
    private audit: AuditService,
  ) {}

  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    const cached = this.cache.get<boolean>(key);
    if (cached !== undefined) return cached;

    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (row) {
      const val = row.value === true || row.value === 'true';
      this.cache.set(key, val);
      return val;
    }

    const envKey = ENV_FALLBACKS[key];
    if (envKey) {
      const envVal = this.config.get(envKey, String(defaultValue));
      return envVal === 'true';
    }
    return defaultValue;
  }

  async getString(key: string, defaultValue = ''): Promise<string> {
    const cached = this.cache.get<string>(key);
    if (cached !== undefined) return cached;

    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (row) {
      const val = typeof row.value === 'string' ? row.value : JSON.stringify(row.value).replace(/^"|"$/g, '');
      const parsed = row.value === null ? defaultValue : String(typeof row.value === 'string' ? row.value : JSON.parse(JSON.stringify(row.value)));
      const finalVal = parsed === 'null' || parsed === '""' ? defaultValue : parsed;
      this.cache.set(key, finalVal);
      return finalVal;
    }

    const envKey = ENV_FALLBACKS[key];
    if (envKey) {
      return this.config.get(envKey, defaultValue) ?? defaultValue;
    }
    return defaultValue;
  }

  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (row) {
      const n = Number(row.value);
      return Number.isFinite(n) ? n : defaultValue;
    }
    return defaultValue;
  }

  async getJson<T>(key: string, defaultValue: T): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached !== undefined) return cached;

    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (row) {
      const val = row.value as T;
      this.cache.set(key, val);
      return val;
    }
    return defaultValue;
  }

  async set(
    key: string,
    value: unknown,
    userId?: string,
    opts?: { category?: SystemSettingCategory; type?: SystemSettingType; isEncrypted?: boolean; auditAction?: AuditAction },
  ) {
    const type = opts?.type ?? this.inferType(value);
    const category = opts?.category ?? SystemSettingCategory.GENERAL;

    await this.prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: value as object,
        type,
        category,
        isEncrypted: opts?.isEncrypted ?? false,
        updatedById: userId,
      },
      update: {
        value: value as object,
        type,
        category,
        isEncrypted: opts?.isEncrypted ?? false,
        updatedById: userId,
      },
    });

    this.cache.invalidate(key);
    if (userId) {
      await this.audit.log(
        opts?.auditAction ?? AuditAction.SYSTEM_SETTING_UPDATED,
        userId,
        { key, category },
        undefined,
        undefined,
        'SystemSetting',
        key,
      );
    }
  }

  async getByCategory(category: SystemSettingCategory) {
    return this.prisma.systemSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
      select: { key: true, value: true, type: true, category: true, isEncrypted: true, updatedAt: true },
    });
  }

  isRegistrationEnabledEnvFallback(): boolean {
    return this.config.get('REGISTRATION_ENABLED', 'false') === 'true';
  }

  async isRegistrationEnabled(): Promise<boolean> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: SETTING_KEYS.REGISTRATION_ENABLED } });
    if (row) return row.value === true;
    return this.isRegistrationEnabledEnvFallback();
  }

  async getPublicUrl(): Promise<string> {
    const url = await this.getString(SETTING_KEYS.APP_PUBLIC_URL, 'https://crm-al.neeklo.ru');
    return url || this.config.get('APP_PUBLIC_URL', 'https://crm-al.neeklo.ru');
  }

  async isPaymentMockMode(): Promise<boolean> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: SETTING_KEYS.PAYMENT_MOCK_MODE } });
    if (row) return row.value === true;
    return this.config.get('PAYMENT_MOCK_MODE', 'true') === 'true';
  }

  private inferType(value: unknown): SystemSettingType {
    if (typeof value === 'boolean') return SystemSettingType.BOOLEAN;
    if (typeof value === 'number') return SystemSettingType.NUMBER;
    if (typeof value === 'string') return SystemSettingType.STRING;
    return SystemSettingType.JSON;
  }
}
