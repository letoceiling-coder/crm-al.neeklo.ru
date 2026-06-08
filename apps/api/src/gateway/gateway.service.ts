import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { apiHttpException } from '../common/api-error.util';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { KeyModelProfilesService } from '../key-model-profiles/key-model-profiles.service';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { UsageService } from '../usage/usage.service';
import { AgentsService } from '../agents/agents.service';
import { RequestStatus } from '@prisma/client';
import { SystemRateLimitService } from '../system/system-rate-limit.service';

@Injectable()
export class GatewayService {
  constructor(
    private apiKeys: ApiKeysService,
    private profiles: KeyModelProfilesService,
    private openRouter: OpenRouterService,
    private usage: UsageService,
    private agents: AgentsService,
    private rateLimits: SystemRateLimitService,
  ) {}

  async chatCompletions(
    authHeader: string | undefined,
    body: Record<string, unknown>,
    ip?: string,
  ) {
    const apiKey = await this.authenticate(authHeader, ip);
    await this.assertBalance(apiKey.id);
    await this.rateLimits.assertOrganizationLimits(apiKey.organizationId);
    await this.rateLimits.assertApiKeyLimits(apiKey.id);

    const requestedModel =
      typeof body.model === 'string' ? body.model.trim() : '';
    const routingKey = await this.apiKeys.getKeyForRouting(apiKey.id);
    const { models, profile: requestProfile } =
      await this.profiles.resolveModelsForRequest(
        routingKey,
        requestedModel,
        () => this.apiKeys.ensureAutoModel(),
      );

    let lastError: Error | null = null;
    let fallbackUsed = false;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      if (!model.isEnabled) continue;
      if (i > 0) fallbackUsed = true;

      try {
        const orKey = await this.openRouter.getActiveKey();
        if (!orKey) throw new Error('OpenRouter not configured');

        const requestBody = { ...body, model: model.openrouterId };
        const { data, responseTimeMs } = await this.openRouter.chatCompletion(
          orKey,
          model.openrouterId,
          requestBody,
        );

        const usage = data.usage ?? {};
        const inputTokens = usage.prompt_tokens ?? 0;
        const outputTokens = usage.completion_tokens ?? 0;
        const sell = this.profiles.resolveSellPrice(
          routingKey,
          model.id,
          Number(model.inputPrice),
          requestProfile,
        );
        const costs = await this.usage.calculateCosts(
          inputTokens,
          outputTokens,
          Number(model.inputPrice),
          Number(model.outputPrice),
          sell,
          sell,
        );

        await this.usage.logUsage({
          userId: apiKey.userId,
          apiKeyId: apiKey.id,
          modelId: model.id,
          modelUsed: model.openrouterId,
          profileSlug: requestProfile?.slug ?? 'auto',
          inputTokens,
          outputTokens,
          realCost: costs.realCost,
          userCost: costs.userCost,
          responseTimeMs,
          status: fallbackUsed ? RequestStatus.FALLBACK : RequestStatus.SUCCESS,
          fallbackUsed,
          requestPath: '/v1/chat/completions',
          ipAddress: ip,
        });

        await this.apiKeys.recalculateSpent(apiKey.id);
        await this.rateLimits.recordTokenUsage(apiKey.organizationId, inputTokens + outputTokens);
        return data;
      } catch (err) {
        lastError = err as Error;
        continue;
      }
    }

    await this.usage.logUsage({
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
      modelUsed: requestedModel,
      inputTokens: 0,
      outputTokens: 0,
      realCost: 0,
      userCost: 0,
      responseTimeMs: 0,
      status: RequestStatus.ERROR,
      errorMessage: lastError?.message,
      requestPath: '/v1/chat/completions',
      ipAddress: ip,
    });

    apiHttpException(
      HttpStatus.BAD_GATEWAY,
      'MODELS_UNAVAILABLE',
      'Не удалось получить ответ ни от одной модели. Повторите запрос позже или укажите другой профиль (model).',
      'Bad Gateway',
      { detail: lastError?.message },
    );
  }

  async agentChat(
    authHeader: string | undefined,
    agentId: string,
    body: Record<string, unknown>,
    ip?: string,
  ) {
    const apiKey = await this.authenticate(authHeader, ip);
    await this.assertBalance(apiKey.id);
    await this.rateLimits.assertOrganizationLimits(apiKey.organizationId);
    await this.rateLimits.assertApiKeyLimits(apiKey.id);

    let agent;
    try {
      agent = await this.agents.findOne(agentId);
    } catch (err) {
      if (err instanceof NotFoundException) {
        apiHttpException(
          HttpStatus.NOT_FOUND,
          'AGENT_NOT_FOUND',
          'Агент не найден. Проверьте идентификатор в GET /api/v1/agents.',
          'Not Found',
        );
      }
      throw err;
    }
    if (!agent.isActive) {
      apiHttpException(
        HttpStatus.NOT_FOUND,
        'AGENT_UNAVAILABLE',
        'Агент отключён. Выберите другого агента или обратитесь к администратору.',
        'Not Found',
      );
    }

    const requestedModel =
      typeof body.model === 'string' ? body.model.trim() : '';
    const routingKey = await this.apiKeys.getKeyForRouting(apiKey.id);

    const messages =
      (body.messages as Array<{ role: string; content: unknown }>) ?? [];
    const enrichedMessages = agent.systemPrompt
      ? [{ role: 'system', content: agent.systemPrompt }, ...messages]
      : messages;

    const requestBody = {
      ...body,
      messages: enrichedMessages,
      temperature: body.temperature ?? agent.temperature,
      max_tokens: body.max_tokens ?? agent.maxContext,
    };

    let models = agent.modelChain.map((c) => c.model).filter(Boolean);
    let requestProfile: Awaited<
      ReturnType<KeyModelProfilesService['resolveRequestProfile']>
    > | null = null;
    if (!models.length) {
      const resolved = await this.profiles.resolveModelsForRequest(
        routingKey,
        requestedModel,
        () => this.apiKeys.ensureAutoModel(),
      );
      models = resolved.models;
      requestProfile = resolved.profile;
    } else {
      requestProfile = await this.profiles.resolveRequestProfile(
        routingKey,
        requestedModel,
      );
    }

    let lastError: Error | null = null;
    let fallbackUsed = false;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      if (!model.isEnabled) continue;
      if (i > 0) fallbackUsed = true;

      try {
        const orKey = await this.openRouter.getActiveKey();
        if (!orKey) throw new Error('OpenRouter not configured');

        const { data, responseTimeMs } = await this.openRouter.chatCompletion(
          orKey,
          model.openrouterId,
          { ...requestBody, model: model.openrouterId },
        );

        const usage = data.usage ?? {};
        const inputTokens = usage.prompt_tokens ?? 0;
        const outputTokens = usage.completion_tokens ?? 0;
        const sell = this.profiles.resolveSellPrice(
          routingKey,
          model.id,
          Number(model.inputPrice),
          requestProfile,
        );
        const costs = await this.usage.calculateCosts(
          inputTokens,
          outputTokens,
          Number(model.inputPrice),
          Number(model.outputPrice),
          sell,
          sell,
        );

        await this.usage.logUsage({
          userId: apiKey.userId,
          apiKeyId: apiKey.id,
          agentId: agent.id,
          modelId: model.id,
          modelUsed: model.openrouterId,
          profileSlug: requestProfile?.slug ?? 'auto',
          inputTokens,
          outputTokens,
          realCost: costs.realCost,
          userCost: costs.userCost,
          responseTimeMs,
          status: fallbackUsed ? RequestStatus.FALLBACK : RequestStatus.SUCCESS,
          fallbackUsed,
          requestPath: `/v1/agents/${agentId}/chat`,
          ipAddress: ip,
        });

        await this.apiKeys.recalculateSpent(apiKey.id);
        await this.rateLimits.recordTokenUsage(apiKey.organizationId, inputTokens + outputTokens);
        return data;
      } catch (err) {
        lastError = err as Error;
        continue;
      }
    }

    apiHttpException(
      HttpStatus.BAD_GATEWAY,
      'MODELS_UNAVAILABLE',
      'Не удалось получить ответ ни от одной модели. Повторите запрос позже.',
      'Bad Gateway',
      { detail: lastError?.message, agentId },
    );
  }

  private async authenticate(authHeader: string | undefined, ip?: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      apiHttpException(
        HttpStatus.UNAUTHORIZED,
        'MISSING_API_KEY',
        'Укажите API-ключ в заголовке: Authorization: Bearer agw_...',
        'Unauthorized',
      );
    }

    const rawKey = authHeader.slice(7);
    const apiKey = await this.apiKeys.validateKey(rawKey);
    if (!apiKey) {
      apiHttpException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_API_KEY',
        'API-ключ недействителен, отключён или заблокирован. Создайте новый ключ в панели.',
        'Unauthorized',
      );
    }

    if (apiKey.allowedIps.length && ip && !apiKey.allowedIps.includes(ip)) {
      apiHttpException(
        HttpStatus.FORBIDDEN,
        'IP_NOT_ALLOWED',
        'Запрос с этого IP-адреса не разрешён для данного API-ключа.',
        'Forbidden',
      );
    }

    return apiKey;
  }

  private async assertBalance(apiKeyId: string) {
    await this.apiKeys.recalculateSpent(apiKeyId);
    const balance = await this.apiKeys.getBalanceSnapshot(apiKeyId);
    if (balance.isExhausted) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'Payment Required',
          code: 'INSUFFICIENT_BALANCE',
          message:
            'Недостаточно средств на балансе API-ключа. Пополните баланс в разделе «API Ключи».',
          balanceRub: balance.balanceRub,
          spentRub: balance.spentRub,
          remainingRub: balance.remainingRub,
          currency: 'RUB',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
}
