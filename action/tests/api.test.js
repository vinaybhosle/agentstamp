import { describe, it, expect, vi, beforeEach } from 'vitest';
const { fetchTrustCheck, resolveAgentId } = require('../src/api');

const mockResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

describe('fetchTrustCheck', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed response on success', async () => {
    const expected = { trusted: true, score: 75, tier: 'gold' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(expected)));

    const result = await fetchTrustCheck('0x1234', 'https://agentstamp.org');
    expect(result).toEqual(expected);
    expect(fetch).toHaveBeenCalledWith(
      'https://agentstamp.org/api/v1/trust/check/0x1234',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('handles erc8004: prefix', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ trusted: true })));

    await fetchTrustCheck('erc8004:42', 'https://agentstamp.org');
    expect(fetch).toHaveBeenCalledWith(
      'https://agentstamp.org/api/v1/trust/check/erc8004%3A42',
      expect.any(Object)
    );
  });

  it('throws on HTTP 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, 404)));

    await expect(
      fetchTrustCheck('0xunknown', 'https://agentstamp.org')
    ).rejects.toThrow(/404/);
  });

  it('throws on HTTP 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, 500)));

    await expect(
      fetchTrustCheck('0x1234', 'https://agentstamp.org')
    ).rejects.toThrow(/500/);
  });

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    await expect(
      fetchTrustCheck('0x1234', 'https://agentstamp.org')
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});

describe('resolveAgentId', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns wallet address from registry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({ agent: { wallet_address: '0xabc' } })
      )
    );

    const wallet = await resolveAgentId('agent-123', 'https://agentstamp.org');
    expect(wallet).toBe('0xabc');
  });

  it('throws if agent has no wallet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ agent: {} })));

    await expect(
      resolveAgentId('agent-123', 'https://agentstamp.org')
    ).rejects.toThrow(/no wallet/i);
  });

  it('throws on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, 404)));

    await expect(
      resolveAgentId('unknown', 'https://agentstamp.org')
    ).rejects.toThrow(/404/);
  });
});
