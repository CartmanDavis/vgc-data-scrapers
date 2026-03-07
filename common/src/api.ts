import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from './logging.js';

export interface APIClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  rateLimit?: number;
}

export class APIClient {
  private client: AxiosInstance;
  private rateLimit: number;
  private lastRequestTime: number = 0;
  private minRequestDelay: number;

  constructor(options: APIClientOptions) {
    this.rateLimit = options.rateLimit || 200;
    this.minRequestDelay = 60 / this.rateLimit;

    this.client = axios.create({
      baseURL: options.baseUrl.replace(/\/$/, ''),
      headers: options.headers,
      timeout: 30000,
    });
  }

  private async waitForRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minRequestDelay * 1000) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestDelay * 1000 - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
  }

  async get<T = unknown>(
    endpoint: string, 
    params?: Record<string, unknown>, 
    maxRetries: number = 3
  ): Promise<T | null> {
    await this.waitForRateLimit();

    const url = `/${endpoint.replace(/^\//, '')}`;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const response = await this.client.get<T>(url, { params });
        return response.data;
      } catch (error) {
        retries++;
        const waitTime = Math.pow(2, retries) * 1000;
        
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          logger.warn('Request failed: url=%s attempt=%d maxRetries=%d error=%s status=%s', 
            url, retries, maxRetries, axiosError.message, axiosError.response?.status);
        } else {
          logger.warn('Request failed: url=%s attempt=%d maxRetries=%d error=%s', 
            url, retries, maxRetries, String(error));
        }

        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          logger.error('Max retries reached: url=%s error=%s', url, String(error));
          return null;
        }
      }
    }

    return null;
  }
}
