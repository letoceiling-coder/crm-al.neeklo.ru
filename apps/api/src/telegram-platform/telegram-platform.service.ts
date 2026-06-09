import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  TelegramNotificationStatus,
  TelegramNotificationType,
  TelegramUserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  PLATFORM_ORG_ID,
  SECRET_KEYS,
  SETTING_KEYS,
  TelegramBotConfigValue,
} from '../system-settings/system-settings.constants';

type TelegramFrom = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export type TelegramAlertKind =
  | 'QUEUE_ERROR'
  | 'PARSER_ERROR'
  | 'SMTP_ERROR'
  | 'PAYMENT_ERROR'
  | 'SECURITY_ALERT'
  | 'SYSTEM_ALERT'
  | 'STORAGE_WARNING';

@Injectable()
export class TelegramPlatformService {
  private readonly logger = new Logger(TelegramPlatformService.name);

  constructor(
    private prisma: PrismaService,
    private secrets: SecretEncryptionService,
    private settings: SystemSettingsService,
    private config: ConfigService,
  ) {}

  getWebhookPath() {
    return '/api/v1/telegram/webhook';
  }

  async getWebhookUrl() {
    const publicUrl = await this.settings.getPublicUrl();
    return `${publicUrl}${this.getWebhookPath()}`;
  }

  private async getBotConfigRow(): Promise<TelegramBotConfigValue> {
    return this.settings.getJson<TelegramBotConfigValue>(SETTING_KEYS.TELEGRAM_BOT_CONFIG, {
      botTokenSecretId: null,
      webhookRegisteredAt: null,
      webhookOk: false,
      lastWebhookError: null,
    });
  }

  async resolveBotToken(): Promise<string> {
    const cfg = await this.getBotConfigRow();
    if (cfg.botTokenSecretId) {
      try {
        const token = await this.secrets.getSecret(cfg.botTokenSecretId, PLATFORM_ORG_ID);
        if (token) return token;
      } catch {
        /* fall through */
      }
    }
    return this.config.get('TELEGRAM_BOT_TOKEN', '');
  }

  async getSettings() {
    const cfg = await this.getBotConfigRow();
    const webhookUrl = await this.getWebhookUrl();
    let connected = false;
    const token = await this.resolveBotToken();

    if (token && cfg.webhookOk) {
      try {
        const { data } = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
          timeout: 10_000,
        });
        const info = data?.result;
        connected = info?.url === webhookUrl && !info?.last_error_message;
      } catch {
        connected = cfg.webhookOk;
      }
    }

    const pendingCount = await this.prisma.telegramUser.count({
      where: { status: TelegramUserStatus.PENDING },
    });
    const approvedCount = await this.prisma.telegramUser.count({
      where: { status: TelegramUserStatus.APPROVED },
    });

    return {
      hasBotToken: !!token,
      webhookUrl,
      webhookRegisteredAt: cfg.webhookRegisteredAt,
      webhookOk: cfg.webhookOk,
      connected,
      lastWebhookError: cfg.lastWebhookError,
      pendingUsers: pendingCount,
      approvedUsers: approvedCount,
    };
  }

  async updateSettings(dto: { botToken?: string }, userId: string) {
    const current = await this.getBotConfigRow();
    let botTokenSecretId = current.botTokenSecretId;

    if (dto.botToken?.trim()) {
      botTokenSecretId = await this.secrets.upsertByKey(
        PLATFORM_ORG_ID,
        SECRET_KEYS.telegramBotToken,
        dto.botToken.trim(),
      );
    }

    const next: TelegramBotConfigValue = {
      ...current,
      botTokenSecretId,
    };

    await this.settings.set(SETTING_KEYS.TELEGRAM_BOT_CONFIG, next, userId, {
      category: 'TELEGRAM' as never,
    });

    if (dto.botToken?.trim()) {
      return this.registerWebhook(userId);
    }

    return this.getSettings();
  }

  async registerWebhook(userId?: string) {
    const token = await this.resolveBotToken();
    if (!token) {
      throw new BadRequestException('Bot Token не настроен');
    }

    const webhookUrl = await this.getWebhookUrl();
    const current = await this.getBotConfigRow();

    try {
      const { data } = await axios.post(
        `https://api.telegram.org/bot${token}/setWebhook`,
        { url: webhookUrl, allowed_updates: ['message'] },
        { timeout: 15_000 },
      );

      if (!data?.ok) {
        throw new Error(data?.description ?? 'setWebhook failed');
      }

      const next: TelegramBotConfigValue = {
        ...current,
        webhookRegisteredAt: new Date().toISOString(),
        webhookOk: true,
        lastWebhookError: null,
      };
      await this.settings.set(SETTING_KEYS.TELEGRAM_BOT_CONFIG, next, userId, {
        category: 'TELEGRAM' as never,
      });

      return { ok: true, message: 'Webhook зарегистрирован', settings: await this.getSettings() };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Webhook registration failed';
      const next: TelegramBotConfigValue = {
        ...current,
        webhookOk: false,
        lastWebhookError: message,
      };
      await this.settings.set(SETTING_KEYS.TELEGRAM_BOT_CONFIG, next, userId, {
        category: 'TELEGRAM' as never,
      });
      return { ok: false, message };
    }
  }

  async testConnection() {
    const token = await this.resolveBotToken();
    if (!token) return { ok: false, message: 'Bot Token не настроен' };

    try {
      const { data } = await axios.get(`https://api.telegram.org/bot${token}/getMe`, {
        timeout: 10_000,
      });
      if (!data?.ok) return { ok: false, message: data?.description ?? 'getMe failed' };
      return {
        ok: true,
        message: `Бот подключён: @${data.result?.username ?? 'unknown'}`,
        botUsername: data.result?.username,
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
    }
  }

  async handleWebhookUpdate(body: Record<string, unknown>) {
    const message = body.message as {
      text?: string;
      from?: TelegramFrom;
      chat?: { id: number };
    } | undefined;

    if (!message?.from || !message.chat) return { ok: true };

    const text = message.text?.trim() ?? '';
    if (text.startsWith('/start')) {
      await this.handleStartCommand(message.from, message.chat.id);
    }

    return { ok: true };
  }

  private async handleStartCommand(from: TelegramFrom, chatId: number) {
    const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || '—';
    const username = from.username ? `@${from.username}` : '—';

    const existing = await this.prisma.telegramUser.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!existing || existing.status === TelegramUserStatus.REJECTED) {
      await this.prisma.telegramUser.upsert({
        where: { telegramId: BigInt(from.id) },
        create: {
          telegramId: BigInt(from.id),
          username: from.username ?? null,
          firstName: from.first_name ?? null,
          lastName: from.last_name ?? null,
          languageCode: from.language_code ?? null,
          status: TelegramUserStatus.PENDING,
          isAdmin: false,
        },
        update: {
          username: from.username ?? null,
          firstName: from.first_name ?? null,
          lastName: from.last_name ?? null,
          languageCode: from.language_code ?? null,
          status: TelegramUserStatus.PENDING,
          isAdmin: false,
          approvedAt: null,
          approvedById: null,
        },
      });
    } else {
      await this.prisma.telegramUser.update({
        where: { telegramId: BigInt(from.id) },
        data: {
          username: from.username ?? null,
          firstName: from.first_name ?? null,
          lastName: from.last_name ?? null,
          languageCode: from.language_code ?? null,
        },
      });
    }

    const welcome = [
      'Добро пожаловать.',
      '',
      'Ваш Telegram успешно определён.',
      '',
      `Имя: ${displayName}`,
      `Username: ${username}`,
      `Telegram ID: ${from.id}`,
      '',
      existing?.status === TelegramUserStatus.APPROVED
        ? 'Ваш доступ уже подтверждён. Вы получаете системные уведомления.'
        : 'Заявка на доступ отправлена администратору.',
    ].join('\n');

    await this.sendRawMessage(chatId, welcome);
  }

  async listUsers(status?: TelegramUserStatus) {
    return this.prisma.telegramUser.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        approvedBy: { select: { id: true, email: true, name: true } },
      },
    }).then((rows) =>
      rows.map((r) => ({
        ...r,
        telegramId: r.telegramId.toString(),
      })),
    );
  }

  async approveUser(id: string, adminUserId: string) {
    const user = await this.prisma.telegramUser.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Пользователь не найден');

    const updated = await this.prisma.telegramUser.update({
      where: { id },
      data: {
        status: TelegramUserStatus.APPROVED,
        isAdmin: true,
        approvedAt: new Date(),
        approvedById: adminUserId,
      },
    });

    await this.sendRawMessage(
      Number(updated.telegramId),
      'Ваш доступ подтверждён.\n\nТеперь вы будете получать системные уведомления.',
    );

    return { ...updated, telegramId: updated.telegramId.toString() };
  }

  async rejectUser(id: string, adminUserId: string) {
    const user = await this.prisma.telegramUser.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Пользователь не найден');

    const updated = await this.prisma.telegramUser.update({
      where: { id },
      data: {
        status: TelegramUserStatus.REJECTED,
        isAdmin: false,
        approvedAt: null,
        approvedById: adminUserId,
      },
    });

    await this.sendRawMessage(Number(updated.telegramId), 'В доступе отказано.');

    return { ...updated, telegramId: updated.telegramId.toString() };
  }

  async listNotifications(filters: {
    type?: TelegramNotificationType;
    userId?: string;
    status?: TelegramNotificationStatus;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const rows = await this.prisma.telegramNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 100,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return rows.map((r) => ({
      ...r,
      user: r.user
        ? { ...r.user, telegramId: r.user.telegramId.toString() }
        : null,
    }));
  }

  async sendAlert(type: TelegramAlertKind, title: string, message: string) {
    const enabled = await this.settings.getBoolean(SETTING_KEYS.ALERTS_TELEGRAM, false);
    if (!enabled) return { sent: 0, failed: 0 };

    const token = await this.resolveBotToken();
    if (!token) return { sent: 0, failed: 0 };

    const users = await this.prisma.telegramUser.findMany({
      where: { status: TelegramUserStatus.APPROVED },
    });

    let sent = 0;
    let failed = 0;
    const text = `*${this.escapeMarkdown(title)}*\n${this.escapeMarkdown(message)}`.slice(0, 4000);

    for (const user of users) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            chat_id: Number(user.telegramId),
            text,
            parse_mode: 'Markdown',
          },
          { timeout: 15_000 },
        );
        await this.prisma.telegramNotification.create({
          data: {
            userId: user.id,
            type: type as TelegramNotificationType,
            title,
            message,
            status: TelegramNotificationStatus.SENT,
          },
        });
        sent++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'send failed';
        this.logger.warn(`Telegram alert to ${user.telegramId}: ${errMsg}`);
        await this.prisma.telegramNotification.create({
          data: {
            userId: user.id,
            type: type as TelegramNotificationType,
            title,
            message: `${message}\n\nОшибка: ${errMsg}`,
            status: TelegramNotificationStatus.FAILED,
          },
        });
        failed++;
      }
    }

    return { sent, failed };
  }

  private async sendRawMessage(chatId: number, text: string) {
    const token = await this.resolveBotToken();
    if (!token) {
      this.logger.warn('Cannot send Telegram message: bot token missing');
      return;
    }
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text },
      { timeout: 15_000 },
    );
  }

  private escapeMarkdown(value: string) {
    return value.replace(/[*_`[\]]/g, '');
  }
}
