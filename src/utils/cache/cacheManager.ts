import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { Logger } from '../Logger';
import { Readable } from 'stream';
import { join } from 'path';

const CACHE_DIR = join(__dirname, '../../../.cache');

interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface DiskCacheMeta<TMeta = unknown> {
  expiresAt: number;
  meta?: TMeta;
}

/** Метод для нормализации URL перед использованием в ключе кэша
 @param url - исходная ссылка
 @return string - нормализованная ссылка без лишних query-параметров */
export function normalizeCacheUrl(url: string): string {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(normalizedUrl);
    const trackingParams = ['si', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'igsh'];

    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    parsed.hash = '';

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Метод для создания ключа кэша из префикса и значения
 @param prefix - тип кэшируемых данных
 @param value - уникальное значение (URL, chatId и т.д.)
 @return string - ключ кэша */
export function buildCacheKey(prefix: string, value: string | number): string {
  return `${prefix}:${value}`;
}

class CacheManager {
  private memoryCache = new Map<string, MemoryCacheEntry<unknown>>();

  private hashKey(key: string): string {
    return createHash('md5').update(key).digest('hex');
  }

  private isExpired(expiresAt: number): boolean {
    return Date.now() > expiresAt;
  }

  private ensureCacheDir(): void {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  private getDiskPaths(key: string): { metaPath: string; dataPath: string } {
    const hash = this.hashKey(key);
    return {
      metaPath: join(CACHE_DIR, `${hash}.meta.json`),
      dataPath: join(CACHE_DIR, `${hash}.bin`),
    };
  }

  private deleteDiskEntry(key: string): void {
    const { metaPath, dataPath } = this.getDiskPaths(key);

    if (existsSync(metaPath)) {
      unlinkSync(metaPath);
    }

    if (existsSync(dataPath)) {
      unlinkSync(dataPath);
    }
  }

  /** Метод для получения значения из in-memory кэша
 @param key - ключ кэша
 @return T | null - значение или null, если кэш отсутствует или протух */
  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry.expiresAt)) {
      this.memoryCache.delete(key);
      return null;
    }

    Logger.yellow(`[Cache] HIT memory: ${key}`);
    return entry.value as T;
  }

  /** Метод для сохранения значения в in-memory кэш
 @param key - ключ кэша
 @param value - значение для сохранения
 @param ttlMs - время жизни записи в миллисекундах */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /** Метод для получения значения из кэша или выполнения fetcher при промахе
 @param key - ключ кэша
 @param ttlMs - время жизни записи в миллисекундах
 @param fetcher - функция получения данных при промахе кэша
 @return Promise<T> - закэшированное или свежее значение */
  async getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    Logger.log(`[Cache] MISS memory: ${key}`);
    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }

  /** Метод для получения Buffer из disk-кэша
 @param key - ключ кэша
 @return Buffer | null - буфер или null, если кэш отсутствует или протух */
  getBuffer(key: string): Buffer | null {
    const { metaPath, dataPath } = this.getDiskPaths(key);

    if (!existsSync(metaPath) || !existsSync(dataPath)) {
      return null;
    }

    const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as DiskCacheMeta;

    if (this.isExpired(meta.expiresAt)) {
      this.deleteDiskEntry(key);
      return null;
    }

    Logger.yellow(`[Cache] HIT disk: ${key}`);
    return readFileSync(dataPath);
  }

  /** Метод для получения Buffer и метаданных из disk-кэша
 @param key - ключ кэша
 @return объект с buffer и meta или null */
  getBufferWithMeta<TMeta>(key: string): { buffer: Buffer; meta: TMeta } | null {
    const { metaPath, dataPath } = this.getDiskPaths(key);

    if (!existsSync(metaPath) || !existsSync(dataPath)) {
      return null;
    }

    const diskMeta = JSON.parse(readFileSync(metaPath, 'utf-8')) as DiskCacheMeta<TMeta>;

    if (this.isExpired(diskMeta.expiresAt)) {
      this.deleteDiskEntry(key);
      return null;
    }

    Logger.yellow(`[Cache] HIT disk: ${key}`);
    return {
      buffer: readFileSync(dataPath),
      meta: diskMeta.meta as TMeta,
    };
  }

  /** Метод для сохранения Buffer в disk-кэш
 @param key - ключ кэша
 @param buffer - данные для сохранения
 @param ttlMs - время жизни записи в миллисекундах */
  setBuffer(key: string, buffer: Buffer, ttlMs: number): void {
    this.ensureCacheDir();

    const { metaPath, dataPath } = this.getDiskPaths(key);
    const meta: DiskCacheMeta = { expiresAt: Date.now() + ttlMs };

    writeFileSync(metaPath, JSON.stringify(meta));
    writeFileSync(dataPath, buffer);
  }

  /** Метод для сохранения Buffer и метаданных в disk-кэш
 @param key - ключ кэша
 @param buffer - данные для сохранения
 @param meta - дополнительные метаданные
 @param ttlMs - время жизни записи в миллисекундах */
  setBufferWithMeta<TMeta>(key: string, buffer: Buffer, meta: TMeta, ttlMs: number): void {
    this.ensureCacheDir();

    const { metaPath, dataPath } = this.getDiskPaths(key);
    const diskMeta: DiskCacheMeta<TMeta> = {
      expiresAt: Date.now() + ttlMs,
      meta,
    };

    writeFileSync(metaPath, JSON.stringify(diskMeta));
    writeFileSync(dataPath, buffer);
  }

  /** Метод для получения Buffer из disk-кэша или выполнения fetcher при промахе
 @param key - ключ кэша
 @param ttlMs - время жизни записи в миллисекундах
 @param fetcher - функция получения данных при промахе кэша
 @return Promise<Buffer> - закэшированный или свежий буфер */
  async getOrFetchBuffer(key: string, ttlMs: number, fetcher: () => Promise<Buffer>): Promise<Buffer> {
    const cached = this.getBuffer(key);

    if (cached) {
      return cached;
    }

    Logger.log(`[Cache] MISS disk: ${key}`);
    const buffer = await fetcher();
    this.setBuffer(key, buffer, ttlMs);
    return buffer;
  }

  /** Метод для получения Buffer с метаданными из disk-кэша или выполнения fetcher при промахе
 @param key - ключ кэша
 @param ttlMs - время жизни записи в миллисекундах
 @param fetcher - функция получения данных при промахе кэша
 @return Promise с buffer и meta */
  async getOrFetchBufferWithMeta<TMeta>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<{ buffer: Buffer; meta: TMeta }>
  ): Promise<{ buffer: Buffer; meta: TMeta }> {
    const cached = this.getBufferWithMeta<TMeta>(key);

    if (cached) {
      return cached;
    }

    Logger.log(`[Cache] MISS disk: ${key}`);
    const result = await fetcher();
    this.setBufferWithMeta(key, result.buffer, result.meta, ttlMs);
    return result;
  }
}

export const cacheManager = new CacheManager();

/** Метод для преобразования Readable-потока в Buffer
 @param stream - поток данных
 @return Promise<Buffer> - буфер с содержимым потока */
export async function readableToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (typeof stream.destroy === 'function') {
    stream.destroy();
  }

  return Buffer.concat(chunks);
}
