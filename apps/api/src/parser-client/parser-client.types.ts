export interface ParserHealthResponse {
  ok: boolean;
  service?: string;
  auth?: boolean;
  oxylabs?: boolean;
  captcha?: boolean;
}

export interface ParseRequest {
  url: string;
  timeoutMs?: number;
  mode?: string;
  async?: boolean;
  profile?: Record<string, unknown>;
  headless?: Record<string, unknown>;
  captcha?: Record<string, unknown>;
}

export interface ParseResult {
  ok: boolean;
  okContent?: boolean;
  id?: string;
  url?: string;
  text?: string;
  html?: string;
  chars?: number;
  contentValidation?: Record<string, unknown>;
  warnings?: string[];
  [key: string]: unknown;
}

export interface AsyncJobAccepted {
  ok: boolean;
  accepted: boolean;
  id: string;
  statusUrl?: string;
  kind?: string;
  mode?: string;
  status?: string;
}

export interface ParserJobResponse {
  ok: boolean;
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: ParseResult;
  error?: string | null;
}

export interface DocumentRequest {
  url: string;
  timeoutMs?: number;
}

export interface DocumentResponse {
  ok: boolean;
  text?: string;
  chars?: number;
  documentType?: string;
  [key: string]: unknown;
}

export interface LegalLatestRequest {
  mode?: string;
  codes?: string[];
  timeoutMs?: number;
  async?: boolean;
  profile?: Record<string, unknown>;
}

export interface CaptchaRequest {
  timeoutMs?: number;
  task: Record<string, unknown>;
}

export interface PollOptions {
  intervalMs?: number;
  maxWaitMs?: number;
}
