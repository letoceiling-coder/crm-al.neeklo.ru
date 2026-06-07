import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { CircuitBreaker } from './circuit-breaker';
import {
  AsyncJobAccepted,
  CaptchaRequest,
  DocumentRequest,
  DocumentResponse,
  LegalLatestRequest,
  ParseRequest,
  ParseResult,
  ParserHealthResponse,
  ParserJobResponse,
  PollOptions,
} from './parser-client.types';

@Injectable()
export class ParserClientService {
  private readonly logger = new Logger(ParserClientService.name);
  private readonly client: AxiosInstance;
  private readonly breaker: CircuitBreaker;
  private readonly maxRetries: number;
  private readonly defaultTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly maxPollMs: number;

  constructor(private config: ConfigService) {
    const baseURL = this.config.get<string>(
      'PARSER_BASE_URL',
      'https://pars-site.neeklo.ru',
    );
    const apiKey = this.config.get<string>('PARSER_API_KEY', '');

    this.defaultTimeoutMs = Number(
      this.config.get('PARSER_DEFAULT_TIMEOUT_MS', 120000),
    );
    this.pollIntervalMs = Number(this.config.get('PARSER_POLL_INTERVAL_MS', 4000));
    this.maxPollMs = Number(this.config.get('PARSER_MAX_POLL_MS', 600000));
    this.maxRetries = Number(this.config.get('PARSER_MAX_RETRIES', 2));

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      validateStatus: (s) => s < 500 || s === 502,
    });

    this.breaker = new CircuitBreaker(5, 60_000);
  }

  async health(): Promise<ParserHealthResponse & { configured: boolean }> {
    try {
      const { data } = await this.client.get<ParserHealthResponse>('/health', {
        timeout: 10_000,
      });
      return {
        ...data,
        configured: Boolean(this.config.get('PARSER_API_KEY')),
      };
    } catch (err) {
      this.logger.warn(`Parser health check failed: ${(err as Error).message}`);
      return { ok: false, configured: Boolean(this.config.get('PARSER_API_KEY')) };
    }
  }

  async parse(dto: ParseRequest): Promise<ParseResult | AsyncJobAccepted> {
    return this.requestWithRetry('POST', '/v1/parse', dto, dto.timeoutMs ?? this.defaultTimeoutMs);
  }

  async document(dto: DocumentRequest): Promise<DocumentResponse> {
    return this.requestWithRetry(
      'POST',
      '/v1/document',
      dto,
      dto.timeoutMs ?? this.defaultTimeoutMs,
    );
  }

  async legalLatest(dto: LegalLatestRequest): Promise<ParseResult | AsyncJobAccepted> {
    return this.requestWithRetry(
      'POST',
      '/v1/legal/latest',
      dto,
      dto.timeoutMs ?? this.defaultTimeoutMs,
    );
  }

  async getJob(jobId: string): Promise<ParserJobResponse> {
    return this.breaker.exec(async () => {
      const { data, status } = await this.client.get<ParserJobResponse>(`/v1/jobs/${jobId}`, {
        timeout: 30_000,
      });
      if (status === 401) throw new ServiceUnavailableException('Parser unauthorized');
      if (status === 404) throw new ServiceUnavailableException(`Parser job not found: ${jobId}`);
      return data;
    });
  }

  async solveCaptcha(dto: CaptchaRequest) {
    return this.requestWithRetry(
      'POST',
      '/v1/captcha/solve',
      dto,
      dto.timeoutMs ?? this.defaultTimeoutMs,
    );
  }

  async parseAndWait(dto: ParseRequest, opts?: PollOptions): Promise<ParseResult> {
    const result = await this.parse(dto);
    if (this.isAsyncAccepted(result)) {
      return this.pollJob(result.id, opts);
    }
    return result as ParseResult;
  }

  async pollJob(jobId: string, opts?: PollOptions): Promise<ParseResult> {
    const interval = opts?.intervalMs ?? this.pollIntervalMs;
    const maxWait = opts?.maxWaitMs ?? this.maxPollMs;
    const started = Date.now();

    while (Date.now() - started < maxWait) {
      const job = await this.getJob(jobId);
      if (job.status === 'completed' && job.result) {
        return job.result;
      }
      if (job.status === 'failed') {
        throw new ServiceUnavailableException(job.error || 'Parser job failed');
      }
      await this.sleep(interval);
    }
    throw new ServiceUnavailableException(`Parser job timeout: ${jobId}`);
  }

  private isAsyncAccepted(r: ParseResult | AsyncJobAccepted): r is AsyncJobAccepted {
    return Boolean((r as AsyncJobAccepted).accepted);
  }

  private async requestWithRetry<T>(
    method: 'POST' | 'GET',
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.breaker.exec(async () => {
          const response = await this.client.request<T>({
            method,
            url: path,
            data: body,
            timeout: timeoutMs + 30_000,
          });
          if (response.status === 401) {
            throw new ServiceUnavailableException('Parser API key invalid or missing');
          }
          if (response.status >= 400) {
            throw new ServiceUnavailableException(
              `Parser error ${response.status}: ${JSON.stringify(response.data)}`,
            );
          }
          return response.data;
        });
      } catch (err) {
        lastError = err as Error;
        const axiosErr = err as AxiosError;
        const retryable =
          axiosErr.code === 'ECONNABORTED' ||
          axiosErr.code === 'ETIMEDOUT' ||
          axiosErr.response?.status === 502;
        if (!retryable || attempt >= this.maxRetries) break;
        await this.sleep(1000 * (attempt + 1));
      }
    }
    throw lastError ?? new ServiceUnavailableException('Parser request failed');
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
