import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SitemapExpansionService {
  private readonly logger = new Logger(SitemapExpansionService.name);

  /** Fetch and parse sitemap.xml or sitemap-index.xml → list of page URLs */
  async expandSitemap(sitemapUrl: string, maxUrls: number): Promise<string[]> {
    const visited = new Set<string>();
    const urls: string[] = [];
    await this.collectFromSitemap(sitemapUrl, visited, urls, maxUrls);
    return urls.slice(0, maxUrls);
  }

  private async collectFromSitemap(
    url: string,
    visited: Set<string>,
    out: string[],
    maxUrls: number,
  ) {
    if (visited.has(url) || out.length >= maxUrls) return;
    visited.add(url);

    try {
      const { data } = await axios.get<string>(url, {
        timeout: 30_000,
        responseType: 'text',
        headers: { 'User-Agent': 'AI-Gateway-KB/1.0' },
      });
      const xml = typeof data === 'string' ? data : String(data);

      const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());

      const isIndex = /<sitemapindex/i.test(xml);
      if (isIndex) {
        for (const loc of locs) {
          if (out.length >= maxUrls) break;
          await this.collectFromSitemap(loc, visited, out, maxUrls);
        }
      } else {
        for (const loc of locs) {
          if (out.length >= maxUrls) break;
          if (!loc.endsWith('.xml')) out.push(loc);
        }
      }
    } catch (err) {
      this.logger.warn(`Sitemap fetch failed ${url}: ${(err as Error).message}`);
    }
  }
}
