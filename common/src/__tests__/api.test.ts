import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { APIClient } from '../api.js';

vi.mock('axios');
vi.mock('../logging.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockAxios = axios as ReturnType<typeof vi.fn>;
const mockCreate = vi.fn();

mockAxios.create = mockCreate;

describe('APIClient', () => {
  let mockClient: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      get: vi.fn(),
    };
    
    mockCreate.mockReturnValue(mockClient);
  });

  describe('constructor', () => {
    it('should create axios instance with provided base url', () => {
      new APIClient({ baseUrl: 'https://api.test.com' });
      
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://api.test.com',
        headers: undefined,
        timeout: 30000,
      });
    });

    it('should remove trailing slash from base url', () => {
      new APIClient({ baseUrl: 'https://api.test.com/' });
      
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://api.test.com',
        headers: undefined,
        timeout: 30000,
      });
    });

    it('should use custom headers when provided', () => {
      new APIClient({ 
        baseUrl: 'https://api.test.com',
        headers: { 'Authorization': 'Bearer token' },
      });
      
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://api.test.com',
        headers: { 'Authorization': 'Bearer token' },
        timeout: 30000,
      });
    });

    it('should set default rate limit of 200 when not provided', () => {
      const client = new APIClient({ baseUrl: 'https://api.test.com' });
      
      expect((client as unknown as { minRequestDelay: number }).minRequestDelay).toBeCloseTo(0.3, 1);
    });

    it('should use custom rate limit when provided', () => {
      const client = new APIClient({ 
        baseUrl: 'https://api.test.com',
        rateLimit: 100,
      });
      
      expect((client as unknown as { minRequestDelay: number }).minRequestDelay).toBe(0.6);
    });
  });

  describe('get', () => {
    it('should make GET request to correct endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { test: 'value' } });
      
      const client = new APIClient({ baseUrl: 'https://api.test.com', rateLimit: 10000 });
      const result = await client.get('/users', { id: 1 });
      
      expect(mockClient.get).toHaveBeenCalledWith('/users', { params: { id: 1 } });
      expect(result).toEqual({ test: 'value' });
    });

    it('should handle leading slash in endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { test: 'value' } });
      
      const client = new APIClient({ baseUrl: 'https://api.test.com', rateLimit: 10000 });
      const result = await client.get('/users');
      
      expect(mockClient.get).toHaveBeenCalledWith('/users', { params: undefined });
      expect(result).toEqual({ test: 'value' });
    });

    it('should return null on request failure after max retries', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));
      
      const client = new APIClient({ baseUrl: 'https://api.test.com', rateLimit: 10000 });
      const result = await client.get('/users', {}, 3);
      
      expect(result).toBeNull();
      expect(mockClient.get).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should retry on failure and succeed on subsequent attempt', async () => {
      mockClient.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { test: 'value' } });
      
      const client = new APIClient({ baseUrl: 'https://api.test.com', rateLimit: 10000 });
      const result = await client.get('/users');
      
      expect(mockClient.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ test: 'value' });
    }, 10000);

    it('should use default max retries of 3', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));
      
      const client = new APIClient({ baseUrl: 'https://api.test.com', rateLimit: 10000 });
      await client.get('/users');
      
      expect(mockClient.get).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should handle axios errors correctly', async () => {
      const axiosError = new Error('Request failed');
      (axiosError as any).isAxiosError = true;
      (axiosError as any).response = { status: 404 };
      mockClient.get.mockRejectedValue(axiosError);
      
      const client = new APIClient({ baseUrl: 'https://api.test.com', rateLimit: 10000 });
      const result = await client.get('/users');
      
      expect(result).toBeNull();
    }, 15000);
  });
});
