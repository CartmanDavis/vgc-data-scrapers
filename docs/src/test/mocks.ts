import { vi } from 'vitest';

export const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock('../supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          count: vi.fn().mockResolvedValue({ count: 0, error: null }),
        })),
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
  },
}));
