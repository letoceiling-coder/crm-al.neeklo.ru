import { ParseResult } from '../parser-client/parser-client.types';
import { DocumentResponse } from '../parser-client/parser-client.types';

export type QualityGateResult =
  | { pass: true }
  | { pass: false; reason: 'parse_failed' | 'quality_gate' | 'min_chars' };

/** URL/HTML parse: ok=true AND okContent=true required for indexing. */
export function passUrlQualityGate(result: ParseResult): QualityGateResult {
  if (result.ok !== true) {
    return { pass: false, reason: 'parse_failed' };
  }
  if (result.okContent !== true) {
    return { pass: false, reason: 'quality_gate' };
  }
  return { pass: true };
}

/** File/document parse: no okContent — validate minimum character count. */
export function passDocumentQualityGate(
  result: DocumentResponse,
  minChars = 500,
): QualityGateResult {
  if (result.ok !== true) {
    return { pass: false, reason: 'parse_failed' };
  }
  const chars = result.chars ?? result.text?.length ?? 0;
  if (chars < minChars) {
    return { pass: false, reason: 'min_chars' };
  }
  return { pass: true };
}

export function passManualTextGate(text: string, minChars = 50): QualityGateResult {
  if (text.trim().length < minChars) {
    return { pass: false, reason: 'min_chars' };
  }
  return { pass: true };
}
