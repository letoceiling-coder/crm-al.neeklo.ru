import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { VARIABLE_PATTERN } from './constants/standard-variables';
import { RedisCacheService } from '../cache/redis-cache.service';

@Injectable()
export class PromptRenderService {
  constructor(@Optional() private cache?: RedisCacheService) {}

  render(template: string, variables: Record<string, string>): string {
    return template.replace(VARIABLE_PATTERN, (_match, key: string) => {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        return variables[key] ?? '';
      }
      return '';
    });
  }

  extractPlaceholders(template: string): string[] {
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    const re = new RegExp(VARIABLE_PATTERN.source, 'g');
    while ((match = re.exec(template)) !== null) {
      found.add(match[1]);
    }
    return [...found];
  }

  renderSystemPrompt(
    systemPrompt: string,
    variables: Record<string, string>,
  ): { rendered: string; missing: string[] } {
    const cacheKey = this.cache?.buildKey(
      'prompt',
      createHash('sha256').update(systemPrompt).digest('hex').slice(0, 16),
      createHash('sha256').update(JSON.stringify(variables)).digest('hex').slice(0, 16),
    );

    const placeholders = this.extractPlaceholders(systemPrompt);
    const missing = placeholders.filter((p) => !variables[p]?.length);
    const result = {
      rendered: this.render(systemPrompt, variables),
      missing,
    };
    if (cacheKey && this.cache) {
      void this.cache.set(cacheKey, result, 300);
    }
    return result;
  }
}
