import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

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

export interface LogConfig {
  dir?: string;
}

export interface AppConfig {
  limitless?: LimitlessConfig;
  rk9?: Rk9Config;
  log?: LogConfig;
}

export class Config {
  private config: AppConfig;
  private configPath: string;

  constructor(options: ConfigOptions = {}) {
    this.configPath = options.configPath || resolve(PROJECT_ROOT, 'config.json');
    this.config = {};
    this.loadConfig();
  }

  private loadConfig(): void {
    if (this.configPath && existsSync(this.configPath)) {
      const content = readFileSync(this.configPath, 'utf-8');
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

  get logDir(): string {
    const path = (this.get('log.dir', './logs') as string) || './logs';
    if (path.startsWith('/')) return path;
    return resolve(PROJECT_ROOT, path);
  }
}

export const config = new Config();
