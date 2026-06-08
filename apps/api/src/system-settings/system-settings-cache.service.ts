import { Injectable } from '@nestjs/common';

type CacheEntry = { value: unknown; expiresAt: number };

@Injectable()
export class SystemSettingsCache {
  private store = new Map<string, CacheEntry>();
  private ttlMs = 60_000;

  get<T>(key: string): T | undefined {
    const row = this.store.get(key);
    if (!row) return undefined;
    if (Date.now() > row.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return row.value as T;
  }

  set(key: string, value: unknown) {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key?: string) {
    if (key) this.store.delete(key);
    else this.store.clear();
  }
}
