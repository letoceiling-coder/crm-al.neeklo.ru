import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios from 'axios';
import { ProviderAccountsService } from '../../provider-accounts/provider-accounts.service';
import { AIProvider } from '@prisma/client';
import type { EmbeddingProfile } from '@prisma/client';

@Injectable()
export class EmbeddingClientService {
  private readonly logger = new Logger(EmbeddingClientService.name);

  constructor(private providerAccounts: ProviderAccountsService) {}

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
    const [vec] = await this.embedTexts(profile, [text], organizationId);
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
