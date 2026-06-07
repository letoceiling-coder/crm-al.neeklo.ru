import { ChunkStrategy } from '@prisma/client';

export interface ChunkSettings {
  chunkStrategy: ChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  maxChunkSize: number;
}

export const DEFAULT_CHUNK_SETTINGS: ChunkSettings = {
  chunkStrategy: ChunkStrategy.FIXED,
  chunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
  maxChunkSize: 4000,
};

export interface TextChunk {
  content: string;
  charCount: number;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}
