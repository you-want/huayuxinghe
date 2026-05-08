import { describe, test, expect, beforeEach } from 'bun:test';
import {
  DAILY_LIMIT,
  getClientIp,
  getQuotaInfo,
  consumeQuota,
  hashImageData,
  getCachedResult,
  setCachedResult,
  resetRuntimeStoreForTest
} from '../lib/runtime-control.js';

describe('runtime-control (bun)', () => {
  beforeEach(() => {
    resetRuntimeStoreForTest();
  });

  test('getClientIp 优先读取 x-forwarded-for', () => {
    const ip = getClientIp({
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' },
      socket: { remoteAddress: '9.9.9.9' }
    });
    expect(ip).toBe('1.1.1.1');
  });

  test('hashImageData 对同一输入稳定一致', () => {
    const input = 'data:image/jpeg;base64,abc123';
    const h1 = hashImageData(input);
    const h2 = hashImageData(input);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64);
  });

  test('缓存 set/get 正常', () => {
    const key = hashImageData('data:image/jpeg;base64,test-cache');
    expect(getCachedResult(key)).toBeNull();
    setCachedResult(key, { analysis: { description: 'ok' }, story: {}, psych: {}, warning: '' });
    const hit = getCachedResult(key);
    expect(hit).not.toBeNull();
    expect(hit.analysis.description).toBe('ok');
  });

  test('限流：同 IP 每日额度用尽后拒绝', () => {
    const ip = '8.8.8.8';
    for (let i = 0; i < DAILY_LIMIT; i++) {
      const result = consumeQuota(ip);
      expect(result.allowed).toBe(true);
    }
    const denied = consumeQuota(ip);
    expect(denied.allowed).toBe(false);
    expect(denied.quota.remaining).toBe(0);

    const info = getQuotaInfo(ip);
    expect(info.used).toBe(DAILY_LIMIT);
    expect(info.remaining).toBe(0);
  });
});
