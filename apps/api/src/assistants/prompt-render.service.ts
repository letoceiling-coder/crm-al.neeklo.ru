import { Injectable } from '@nestjs/common';
import { VARIABLE_PATTERN } from './constants/standard-variables';

@Injectable()
export class PromptRenderService {
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
    const placeholders = this.extractPlaceholders(systemPrompt);
    const missing = placeholders.filter((p) => !variables[p]?.length);
    return {
      rendered: this.render(systemPrompt, variables),
      missing,
    };
  }
}
