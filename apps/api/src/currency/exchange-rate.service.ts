import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/** Курс USD→RUB (сколько рублей за 1 доллар). */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cache: { rate: number; at: number } | null = null;
  private readonly ttlMs = 60 * 60 * 1000;

  constructor(private config: ConfigService) {}

  async getUsdRub(): Promise<number> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.rate;
    }

    try {
      const { data } = await axios.get<{
        Valute?: { USD?: { Value?: number } };
      }>('https://www.cbr-xml-daily.ru/daily_json.js', { timeout: 8000 });
      const rate = Number(data?.Valute?.USD?.Value);
      if (Number.isFinite(rate) && rate > 0) {
        this.cache = { rate, at: Date.now() };
        return rate;
      }
    } catch (err) {
      this.logger.warn(`CBR rate fetch failed: ${(err as Error).message}`);
    }

    const fallback = Number(this.config.get('USD_RUB_RATE', '90'));
    const rate = Number.isFinite(fallback) && fallback > 0 ? fallback : 90;
    this.cache = { rate, at: Date.now() };
    return rate;
  }

  usdToRub(usd: number, rate: number): number {
    return usd * rate;
  }
}
