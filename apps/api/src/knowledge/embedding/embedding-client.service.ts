import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { ProviderAccountsService } from '../../provider-accounts/provider-accounts.service';
import { RedisCacheService } from '../../cache/redis-cache.service';
import { AIProvider } from '@prisma/client';
import type { EmbeddingProfile } from '@prisma/client';

@Injectable()
export class EmbeddingClientService {
  private readonly logger = new Logger(EmbeddingClientService.name);

  constructor(
    private providerAccounts: ProviderAccountsService,
    @Optional() private cache?: RedisCacheService,
  ) {}

  async embedTexts(profile: EmbeddingProfile, texts: string[], organizationId: string): Promise<number[][]> {
    if (!texts.length) return [];
    const provider = profile.provider.toLowerCase();

    if (provider === 'openai') {
      return this.embedOpenAi(profile, texts, organizationId);
    }
    if (provider === 'voyage') {
      return this.embedVoyage(profile, texts, organizationId);
    }
    // openrouter, bge, nomic — via OpenRouter-compatible embeddings API
    return this.embedOpenRouter(profile, texts, organizationId);
  }

  async embedText(profile: EmbeddingProfile, text: string, organizationId: string): Promise<number[]> {
    const start = Date.now();
    const cacheKey = this.cache?.buildKey(
      'embedding',
      profile.id,
      createHash('sha256').update(text).digest('hex').slice(0, 32),
    );
    if (cacheKey && this.cache) {
      const cached = await this.cache.get<number[]>(cacheKey);
      if (cached) {
        await this.cache.recordHit('embedding', Date.now() - start);
        return cached;
      }
    }
    const [vec] = await this.embedTexts(profile, [text], organizationId);
    if (cacheKey && this.cache) {
      await this.cache.set(cacheKey, vec, 600);
      await this.cache.recordMiss('embedding', Date.now() - start);
    }
    return vec;
  }

  private async getApiKey(profile: EmbeddingProfile, organizationId: string): Promise<string> {
    if (profile.providerAccountId) {
      const key = await this.providerAccounts.getApiKeyForAccount(
        profile.providerAccountId,
        organizationId,
      );
      if (key) return key;
    }
    const mapped = this.mapProviderToAccount(profile.provider);
    const account = await this.providerAccounts.getDefaultForProvider(mapped, organizationId);
    if (!account) throw new BadRequestException(`No provider account for ${profile.provider}`);
    const key = await this.providerAccounts.getApiKeyForAccount(account.id, organizationId);
    if (!key) throw new BadRequestException('Provider API key missing');
    return key;
  }

  private mapProviderToAccount(provider: string): AIProvider {
    const p = provider.toLowerCase();
    if (p === 'openai') return AIProvider.OPENAI;
    return AIProvider.OPENROUTER;
  }

  private async embedOpenRouter(
    profile: EmbeddingProfile,
    texts: string[],
    organizationId: string,
  ): Promise<number[][]> {
    const apiKey = await this.getApiKey(profile, organizationId);
    const { data } = await axios.post(
      'https://openrouter.ai/api/v1/embeddings',
      { model: profile.model, input: texts },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
      },
    );
    return this.parseEmbeddingResponse(data, profile.dimensions);
  }

  private async embedOpenAi(
    profile: EmbeddingProfile,
    texts: string[],
    organizationId: string,
  ): Promise<number[][]> {
    const apiKey = await this.getApiKey(profile, organizationId);
    const { data } = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { model: profile.model, input: texts },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
      },
    );
    return this.parseEmbeddingResponse(data, profile.dimensions);
  }

  private async embedVoyage(
    profile: EmbeddingProfile,
    texts: string[],
    organizationId: string,
  ): Promise<number[][]> {
    const apiKey = await this.getApiKey(profile, organizationId);
    const { data } = await axios.post(
      'https://api.voyageai.com/v1/embeddings',
      { model: profile.model, input: texts },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
      },
    );
    return this.parseEmbeddingResponse(data, profile.dimensions);
  }

  private parseEmbeddingResponse(data: unknown, dimensions: number): number[][] {
    const body = data as { data?: Array<{ embedding?: number[] }> };
    const vectors = (body.data ?? []).map((d) => d.embedding ?? []);
    if (!vectors.length) {
      this.logger.warn('Empty embedding response');
      return [];
    }
    return vectors.map((v) => v.slice(0, dimensions));
  }
}
