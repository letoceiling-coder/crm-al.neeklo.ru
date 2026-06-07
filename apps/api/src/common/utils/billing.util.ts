import { calculateTokenCost } from './crypto.util';

/**
 * Тариф профиля (₽/1M) — основной. Per-model sell только если у профиля нет общей цены.
 */
export function resolveProfileSellPriceRub(
  profilePricePerMillionRub: number,
  perModelSellPriceRub?: number,
): number {
  if (profilePricePerMillionRub > 0) return profilePricePerMillionRub;
  if (perModelSellPriceRub != null && perModelSellPriceRub > 0) {
    return perModelSellPriceRub;
  }
  return 0;
}

export function computeUserCostRub(
  inputTokens: number,
  outputTokens: number,
  sellPricePerMillionRub: number,
): number {
  return (
    calculateTokenCost(inputTokens, sellPricePerMillionRub) +
    calculateTokenCost(outputTokens, sellPricePerMillionRub)
  );
}

/** Определяет профиль по фактической ставке в старом логе (до появления profile_slug). */
export function inferProfileSlugFromEffectiveRate(
  userCost: number,
  inputTokens: number,
  outputTokens: number,
  profiles: Array<{
    slug: string;
    pricePerMillionRub: number;
    pricing?: Array<{ sellPrice: number }>;
  }>,
): string {
  const tokens = inputTokens + outputTokens;
  if (tokens <= 0 || userCost <= 0 || !profiles.length) return 'auto';

  const effective = userCost / (tokens / 1_000_000);
  let bestSlug = profiles[0]?.slug ?? 'auto';
  let minDiff = Infinity;

  for (const p of profiles) {
    const rates = new Set<number>();
    if (p.pricePerMillionRub > 0) rates.add(p.pricePerMillionRub);
    for (const pr of p.pricing ?? []) {
      if (pr.sellPrice > 0) rates.add(pr.sellPrice);
    }
    for (const rate of rates) {
      const diff = Math.abs(rate - effective);
      if (diff < minDiff) {
        minDiff = diff;
        bestSlug = p.slug;
      }
    }
  }

  return bestSlug;
}
