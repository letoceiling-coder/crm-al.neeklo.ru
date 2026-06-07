import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DomainCrawlSettings, DEFAULT_CRAWL_SETTINGS } from '../jobs/knowledge-job.types';

export interface RobotsInfo {
  allowed: boolean;
  sitemapUrls: string[];
  disallowedPaths: string[];
}

@Injectable()
export class DomainDiscoveryService {
  private readonly logger = new Logger(DomainDiscoveryService.name);

  async fetchRobots(baseUrl: string): Promise<RobotsInfo> {
    const origin = new URL(baseUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const { data } = await axios.get<string>(robotsUrl, {
        timeout: 15_000,
        responseType: 'text',
      });
      const text = typeof data === 'string' ? data : String(data);
      const sitemapUrls = [...text.matchAll(/^Sitemap:\s*(.+)$/gim)].map((m) => m[1].trim());
      const disallowedPaths = [...text.matchAll(/^Disallow:\s*(.+)$/gim)]
        .map((m) => m[1].trim())
        .filter(Boolean);
      const allowed = !disallowedPaths.some((p) => p === '/');
      return { allowed, sitemapUrls, disallowedPaths };
    } catch {
      return { allowed: true, sitemapUrls: [], disallowedPaths: [] };
    }
  }

  /** BFS link discovery from start URL with crawl settings */
  async discoverUrls(
    startUrl: string,
    settings: DomainCrawlSettings = DEFAULT_CRAWL_SETTINGS,
  ): Promise<string[]> {
    const cfg = { ...DEFAULT_CRAWL_SETTINGS, ...settings };
    const maxDepth = cfg.maxDepth ?? 2;
    const maxPages = cfg.maxPages ?? 100;
    const origin = new URL(startUrl).origin;
    const hostname = new URL(startUrl).hostname;

    const robots = await this.fetchRobots(startUrl);
    if (!robots.allowed) return [];

    const seen = new Set<string>();
    const result: string[] = [];
    const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

    while (queue.length > 0 && result.length < maxPages) {
      const { url, depth } = queue.shift()!;
      if (seen.has(url)) continue;
      seen.add(url);

      if (!this.isPathAllowed(url, cfg, robots.disallowedPaths)) continue;

      result.push(url);

      if (depth >= maxDepth) continue;

      try {
        const { data } = await axios.get<string>(url, {
          timeout: 20_000,
          responseType: 'text',
          headers: { 'User-Agent': 'AI-Gateway-KB/1.0' },
          maxContentLength: 2 * 1024 * 1024,
        });
        const html = typeof data === 'string' ? data : String(data);
        const hrefs = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1].trim());

        for (const href of hrefs) {
          try {
            const abs = new URL(href, url);
            if (abs.hostname !== hostname) continue;
            if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
            const normalized = abs.origin + abs.pathname;
            if (!seen.has(normalized)) {
              queue.push({ url: normalized, depth: depth + 1 });
            }
          } catch {
            /* invalid href */
          }
        }
      } catch (err) {
        this.logger.debug(`Crawl skip ${url}: ${(err as Error).message}`);
      }
    }

    return result.slice(0, maxPages);
  }

  private isPathAllowed(
    url: string,
    settings: DomainCrawlSettings,
    robotsDisallowed: string[],
  ): boolean {
    const path = new URL(url).pathname;
    for (const blocked of [...(settings.blockedPaths ?? []), ...robotsDisallowed]) {
      if (blocked && path.startsWith(blocked)) return false;
    }
    const allowed = settings.allowedPaths ?? [];
    if (allowed.length > 0 && !allowed.some((p) => path.startsWith(p))) return false;
    return true;
  }
}
