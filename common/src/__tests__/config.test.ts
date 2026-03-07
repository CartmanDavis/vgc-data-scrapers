import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Config } from '../config.js';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

vi.mock('process', () => ({
  env: {},
}));

import { readFileSync, existsSync } from 'fs';

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

describe('Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('constructor', () => {
    it('should use default config path when none provided', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = new Config();
      
      expect(mockExistsSync).toHaveBeenCalled();
    });

    it('should use custom config path when provided', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = new Config({ configPath: '/custom/path/config.json' });
      
      expect(mockExistsSync).toHaveBeenCalledWith('/custom/path/config.json');
    });

    it('should load config from file when it exists', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        limitless: { apiKey: 'test-key' },
      }));
      
      const config = new Config();
      
      expect(mockReadFileSync).toHaveBeenCalled();
    });
  });

  describe('limitlessApiKey', () => {
    it('should return undefined when no api key configured', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = new Config();
      
      expect(config.limitlessApiKey).toBeUndefined();
    });

    it('should return api key from config file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        limitless: { apiKey: 'file-api-key' },
      }));
      
      const config = new Config();
      
      expect(config.limitlessApiKey).toBe('file-api-key');
    });

    it('should return api key from env variable when set', () => {
      mockExistsSync.mockReturnValue(false);
      
      vi.stubEnv('LIMITLESS_API_KEY', 'env-api-key');
      
      const config = new Config();
      
      expect(config.limitlessApiKey).toBe('env-api-key');
      
      vi.unstubAllEnvs();
    });
  });

  describe('limitlessBaseUrl', () => {
    it('should return default base url when not configured', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = new Config();
      
      expect(config.limitlessBaseUrl).toBe('https://play.limitlesstcg.com/api');
    });

    it('should return custom base url from config', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        limitless: { baseUrl: 'https://custom.api.com' },
      }));
      
      const config = new Config();
      
      expect(config.limitlessBaseUrl).toBe('https://custom.api.com');
    });
  });

  describe('limitlessRateLimit', () => {
    it('should return default rate limit when not configured', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = new Config();
      
      expect(config.limitlessRateLimit).toBe(200);
    });

    it('should return custom rate limit from config', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        limitless: { rateLimit: 500 },
      }));
      
      const config = new Config();
      
      expect(config.limitlessRateLimit).toBe(500);
    });

    it('should fallback to default for invalid rate limit', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        limitless: { rateLimit: 0 },
      }));
      
      const config = new Config();
      
      expect(config.limitlessRateLimit).toBe(200);
    });
  });

  describe('rk9BaseUrl', () => {
    it('should return default base url when not configured', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = new Config();
      
      expect(config.rk9BaseUrl).toBe('https://rk9.gg');
    });

    it('should return custom base url from config', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        rk9: { baseUrl: 'https://custom.rk9.com' },
      }));
      
      const config = new Config();
      
      expect(config.rk9BaseUrl).toBe('https://custom.rk9.com');
    });
  });

  describe('rk9RequestDelay', () => {
    it('should return default request delay when not configured', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = new Config();
      
      expect(config.rk9RequestDelay).toBe(1.0);
    });

    it('should return custom request delay from config', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        rk9: { requestDelay: 2.5 },
      }));
      
      const config = new Config();
      
      expect(config.rk9RequestDelay).toBe(2.5);
    });
  });

  describe('logDir', () => {
    it('should return default log directory when not configured', () => {
      mockExistsSync.mockReturnValue(false);
      
      const config = new Config();
      
      expect(config.logDir).toContain('logs');
    });

    it('should return custom log directory from config', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        log: { dir: '/custom/logs' },
      }));
      
      const config = new Config();
      
      expect(config.logDir).toBe('/custom/logs');
    });

    it('should resolve relative paths to absolute', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        log: { dir: './my-logs' },
      }));
      
      const config = new Config();
      
      expect(config.logDir).toContain('my-logs');
      expect(config.logDir).not.toBe('./my-logs');
    });
  });
});
