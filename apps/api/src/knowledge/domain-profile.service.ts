import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParserMode } from '@prisma/client';
import { ParseResult } from '../parser-client/parser-client.types';

const DOMAIN_MODE_PATTERNS: Array<{ pattern: RegExp; mode: ParserMode }> = [
  { pattern: /consultant\.ru$/i, mode: 'LEGAL_DEEP' },
  { pattern: /sudrf\.ru$/i, mode: 'LEGAL_FAST' },
  { pattern: /sudact\.ru$/i, mode: 'LEGAL_FAST' },
  { pattern: /pravo\.gov\.ru$/i, mode: 'LEGAL_FAST' },
  { pattern: /ozon\.ru$/i, mode: 'MARKETPLACE_HARD' },
  { pattern: /wildberries\.ru$/i, mode: 'MARKETPLACE_HARD' },
  { pattern: /market\.yandex\.ru$/i, mode: 'MARKETPLACE_HARD' },
];

@Injectable()
export class DomainProfileService {
  constructor(private prisma: PrismaService) {}

  async resolveParserMode(domain: string, userOverride?: ParserMode | null): Promise<ParserMode> {
    if (userOverride) return userOverride;

    const profile = await this.prisma.domainProfile.findUnique({ where: { domain } });
    if (profile?.recommendedMode) return profile.recommendedMode;

    for (const { pattern, mode } of DOMAIN_MODE_PATTERNS) {
      if (pattern.test(domain)) return mode;
    }
    return ParserMode.STANDARD;
  }

  async recordParseResult(domain: string, result: ParseResult, okContent: boolean) {
    const success = result.ok === true && okContent;
    const chars = result.chars ?? result.text?.length ?? 0;
    const validation = result.contentValidation as { reason?: string } | undefined;
    const antiBot =
      validation?.reason === 'anti_bot_or_stub' ||
      validation?.reason === 'anti_bot' ||
      false;

    let profile = await this.prisma.domainProfile.findUnique({ where: { domain } });
    if (!profile) {
      profile = await this.prisma.domainProfile.create({
        data: { domain, recommendedMode: await this.resolveParserMode(domain) },
      });
    }

    const totalRequests = profile.totalRequests + 1;
    const successfulParses = profile.successfulParses + (success ? 1 : 0);
    const failedParses = profile.failedParses + (success ? 0 : 1);
    const successRate = totalRequests > 0 ? successfulParses / totalRequests : null;

    const averageChars = success
      ? Math.round(
          ((profile.averageChars ?? 0) * Math.max(successfulParses - 1, 0) + chars) /
            Math.max(successfulParses, 1),
        )
      : profile.averageChars;

    const averageQualityScore = okContent
      ? ((profile.averageQualityScore ?? 0) * Math.max(successfulParses - 1, 0) + 1) /
        Math.max(successfulParses, 1)
      : profile.averageQualityScore;

    let recommendedMode = profile.recommendedMode ?? ParserMode.STANDARD;
    if (successRate !== null && successRate < 0.5 && recommendedMode !== 'HEADLESS_ONLY') {
      recommendedMode = this.escalateMode(recommendedMode);
    }
    if (antiBot) {
      recommendedMode = ParserMode.AGGRESSIVE;
    }

    await this.prisma.domainProfile.update({
      where: { domain },
      data: {
        totalRequests,
        successfulParses,
        failedParses,
        successRate,
        averageChars,
        averageQualityScore,
        recommendedMode,
        antiBotDetected: profile.antiBotDetected || antiBot,
        captchaDetected:
          profile.captchaDetected ||
          validation?.reason === 'captcha' ||
          false,
        lastParsedAt: new Date(),
      },
    });
  }

  async getProfile(domain: string) {
    return this.prisma.domainProfile.findUnique({ where: { domain } });
  }

  private escalateMode(current: ParserMode): ParserMode {
    const order: ParserMode[] = [
      ParserMode.STANDARD,
      ParserMode.AGGRESSIVE,
      ParserMode.HEADLESS_ONLY,
    ];
    const idx = order.indexOf(current);
    return order[Math.min(idx + 1, order.length - 1)] ?? ParserMode.HEADLESS_ONLY;
  }
}
