import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface ConfigOptions {
  configPath?: string;
}

export interface LimitlessConfig {
  apiKey?: string;
  baseUrl?: string;
  rateLimit?: number;
}

export interface Rk9Config {
  baseUrl?: string;
  requestDelay?: number;
}

export interface DatabaseConfig {
  path?: string;
}

export interface LogConfig {
  dir?: string;
}

export interface AppConfig {
  limitless?: LimitlessConfig;
  rk9?: Rk9Config;
  database?: DatabaseConfig;
  log?: LogConfig;
}

export class Config {
  private config: AppConfig;
  private configPath: string;

  constructor(options: ConfigOptions = {}) {
    this.configPath = options.configPath || 'config.json';
    this.config = {};
    this.loadConfig();
  }

  private loadConfig(): void {
    const resolvedPath = resolve(this.configPath);
    if (resolvedPath && existsSync(resolvedPath)) {
      const content = readFileSync(resolvedPath, 'utf-8');
      this.config = JSON.parse(content);
    }
  }

  private get(key: string, defaultValue?: unknown, envVar?: string): unknown {
    if (envVar) {
      const envValue = process.env[envVar];
      if (envValue) {
        return envValue;
      }
    }

    const keys = key.split('.');
    let value: unknown = this.config;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return defaultValue;
      }
    }
    return value ?? defaultValue;
  }

  get limitlessApiKey(): string | undefined {
    return this.get('limitless.apiKey', undefined, 'LIMITLESS_API_KEY') as string | undefined;
  }

  get limitlessBaseUrl(): string {
    return (this.get('limitless.baseUrl', 'https://play.limitlesstcg.com/api') as string) || 'https://play.limitlesstcg.com/api';
  }

  get limitlessRateLimit(): number {
    return Number(this.get('limitless.rateLimit', 200)) || 200;
  }

  get rk9BaseUrl(): string {
    return (this.get('rk9.baseUrl', 'https://rk9.gg') as string) || 'https://rk9.gg';
  }

  get rk9RequestDelay(): number {
    return Number(this.get('rk9.requestDelay', 1.0)) || 1.0;
  }

  get dbPath(): string {
    return (this.get('database.path', './db/vgc.db') as string) || './db/vgc.db';
  }

  get logDir(): string {
    return (this.get('log.dir', './logs') as string) || './logs';
  }
}

export const config = new Config();
