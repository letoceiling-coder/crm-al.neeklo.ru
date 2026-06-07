import { Injectable } from '@nestjs/common';
import { ChunkStrategy } from '@prisma/client';
import { ChunkSettings, TextChunk } from './chunk.types';

@Injectable()
export class ChunkStrategyService {
  split(text: string, settings: ChunkSettings): TextChunk[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    let raw: string[];
    switch (settings.chunkStrategy) {
      case ChunkStrategy.PARAGRAPH:
        raw = this.splitParagraphs(normalized);
        break;
      case ChunkStrategy.SECTION:
        raw = this.splitSections(normalized);
        break;
      case ChunkStrategy.LEGAL_ARTICLE:
        raw = this.splitLegalArticles(normalized);
        break;
      case ChunkStrategy.MARKDOWN:
        raw = this.splitMarkdown(normalized);
        break;
      case ChunkStrategy.FIXED:
      default:
        raw = this.splitFixed(normalized, settings.chunkSize, settings.chunkOverlap);
        break;
    }

    return raw
      .map((content) => content.trim())
      .filter((c) => c.length >= settings.minChunkSize)
      .map((content) => this.toChunk(content, settings.maxChunkSize));
  }

  estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private toChunk(content: string, maxChunkSize: number): TextChunk {
    const trimmed = content.length > maxChunkSize ? content.slice(0, maxChunkSize) : content;
    return {
      content: trimmed,
      charCount: trimmed.length,
      tokenCount: this.estimateTokens(trimmed),
    };
  }

  private splitFixed(text: string, size: number, overlap: number): string[] {
    const out: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      out.push(text.slice(start, end));
      if (end >= text.length) break;
      start = Math.max(start + size - overlap, start + 1);
    }
    return out;
  }

  private splitParagraphs(text: string): string[] {
    return text.split(/\n\s*\n+/).filter(Boolean);
  }

  private splitSections(text: string): string[] {
    const parts = text.split(/(?=^(?:#{1,3}\s|<h[1-3][^>]*>|\d+\.\s))/gim);
    if (parts.length <= 1) return this.splitParagraphs(text);
    return parts.filter(Boolean);
  }

  private splitLegalArticles(text: string): string[] {
    const parts = text.split(
      /(?=(?:Статья|ст\.|Article|ARTICLE)\s+\d+[\.\)]?\s)/gim,
    );
    if (parts.length <= 1) return this.splitParagraphs(text);
    return parts.filter(Boolean);
  }

  private splitMarkdown(text: string): string[] {
    const parts = text.split(/(?=^#{1,6}\s)/gm);
    if (parts.length <= 1) return this.splitParagraphs(text);
    return parts.filter(Boolean);
  }
}
