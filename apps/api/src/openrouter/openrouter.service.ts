import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { hashApiKey } from '../common/utils/crypto.util';
import { ModelLabel } from '@prisma/client';

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  top_provider?: { max_completion_tokens?: number };
  architecture?: { modality?: string; instruct_type?: string };
}

@Injectable()
export class OpenRouterService {
  private baseUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.baseUrl = config.get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
  }

  async getActiveKey(): Promise<string | null> {
    const envKey = this.config.get<string>('OPENROUTER_DEFAULT_KEY');
    if (envKey) return envKey;

    const dbKey = await this.prisma.openRouterKey.findFirst({
      where: { isActive: true, isDefault: true },
    });
    return dbKey ? this.decryptKey(dbKey.keyHash) : null;
  }

  private decryptKey(stored: string): string {
    return stored;
  }

  async syncModels() {
    const apiKey = await this.getActiveKey();
    if (!apiKey) return { synced: 0, error: 'No OpenRouter key configured' };

    const { data } = await axios.get<{ data: OpenRouterModel[] }>(
      `${this.baseUrl}/models`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    let synced = 0;
    let skipped = 0;
    for (const m of data.data) {
      try {
      const inputPrice = this.parsePricePerMillion(m.pricing?.prompt);
      const outputPrice = this.parsePricePerMillion(m.pricing?.completion);
      const isFree = inputPrice === 0 && outputPrice === 0;
      const provider = m.id.split('/')[0] ?? 'unknown';
      const labels = this.inferLabels(m, isFree);

      await this.prisma.model.upsert({
        where: { openrouterId: m.id },
        create: {
          openrouterId: m.id,
          name: m.name,
          provider,
          description: m.description,
          contextLength: m.context_length,
          inputPrice,
          outputPrice,
          isFree,
          labels,
          capabilities: this.inferCapabilities(m),
          lastSyncedAt: new Date(),
        },
        update: {
          name: m.name,
          description: m.description,
          contextLength: m.context_length,
          inputPrice,
          outputPrice,
          isFree,
          labels,
          capabilities: this.inferCapabilities(m),
          lastSyncedAt: new Date(),
        },
      });
      synced++;
      } catch {
        skipped++;
      }
    }
    return { synced, skipped, total: data.data.length };
  }

  /** OpenRouter: USD за токен → USD за 1M токенов (конвертация в ₽ в UsageService). */
  private parsePricePerMillion(price?: string): number {
    const perToken = parseFloat(price ?? '0');
    if (!Number.isFinite(perToken) || perToken < 0) return 0;
    return perToken * 1_000_000;
  }

  async chatCompletion(
    apiKey: string,
    model: string,
    body: Record<string, unknown>,
  ) {
    const start = Date.now();
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      { ...body, model },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai-gateway.local',
          'X-Title': 'AI Gateway',
        },
        timeout: 120000,
      },
    );
    return { data: response.data, responseTimeMs: Date.now() - start };
  }

  async checkBalance(apiKey: string) {
    try {
      const { data } = await axios.get(`${this.baseUrl}/auth/key`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return data;
    } catch {
      return null;
    }
  }

  private inferLabels(m: OpenRouterModel, isFree: boolean): ModelLabel[] {
    const labels: ModelLabel[] = [];
    if (isFree) labels.push(ModelLabel.FREE);
    const name = m.name.toLowerCase();
    const id = m.id.toLowerCase();
    if (name.includes('flash') || id.includes('flash')) labels.push(ModelLabel.FAST);
    if (name.includes('reason') || id.includes('o1') || id.includes('o3')) {
      labels.push(ModelLabel.REASONING);
    }
    if (m.architecture?.modality?.includes('image')) labels.push(ModelLabel.VISION);
    if (name.includes('code') || id.includes('code')) labels.push(ModelLabel.CODING);
    if (name.includes('agent')) labels.push(ModelLabel.AGENT);
    const inputPrice = parseFloat(m.pricing.prompt);
    if (!isFree && inputPrice < 0.000001) labels.push(ModelLabel.CHEAP);
    if (inputPrice > 0.00001) labels.push(ModelLabel.PREMIUM);
    return [...new Set(labels)];
  }

  private inferCapabilities(m: OpenRouterModel): string[] {
    const caps: string[] = ['chat'];
    if (m.architecture?.modality?.includes('image')) caps.push('vision');
    if (m.architecture?.instruct_type) caps.push('instruct');
    return caps;
  }

  storeKeyHash(key: string): string {
    return hashApiKey(key);
  }
}
