export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\u0400-\u04FF]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'kb'
  );
}

export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function parserModeToApi(mode: string | null | undefined): string | undefined {
  if (!mode) return undefined;
  return mode.toLowerCase().replace(/_/g, '_');
}

export const DEFAULT_KB_STATS = {
  documentCount: 0,
  sourceCount: 0,
  readyCount: 0,
  failedCount: 0,
  skippedQualityCount: 0,
  pendingCount: 0,
  totalChars: 0,
  chunkCount: 0,
  indexedCount: 0,
};

export interface KbStats {
  documentCount: number;
  sourceCount: number;
  readyCount: number;
  failedCount: number;
  skippedQualityCount: number;
  pendingCount: number;
  totalChars: number;
  chunkCount: number;
  indexedCount: number;
}

export interface UploadedFilePayload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export function formatFromMime(mime: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (mime.includes('pdf') || ext === 'pdf') return 'PDF';
  if (mime.includes('word') || ext === 'docx') return 'DOCX';
  if (ext === 'md' || mime.includes('markdown')) return 'MD';
  if (ext === 'txt' || mime.startsWith('text/')) return 'TXT';
  if (ext === 'zip' || mime.includes('zip')) return 'ZIP';
  return 'TXT';
}
