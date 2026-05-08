import crypto from 'node:crypto';

const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 20);
const MAX_CACHE_ENTRIES = Number(process.env.MAX_CACHE_ENTRIES || 300);

function getGlobalStore() {
  if (!globalThis.__huayuStore) {
    globalThis.__huayuStore = {
      rate: new Map(),
      cache: new Map()
    };
  }
  return globalThis.__huayuStore;
}

function resetRuntimeStoreForTest() {
  globalThis.__huayuStore = {
    rate: new Map(),
    cache: new Map()
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'] || '';
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function cleanupRateStore(store, date) {
  for (const key of store.keys()) {
    if (!key.startsWith(`${date}:`)) {
      store.delete(key);
    }
  }
}

function getQuotaInfo(ip) {
  const store = getGlobalStore();
  const date = todayKey();
  cleanupRateStore(store.rate, date);
  const key = `${date}:${ip}`;
  const used = Number(store.rate.get(key) || 0);
  const remaining = Math.max(0, DAILY_LIMIT - used);
  return { date, limit: DAILY_LIMIT, used, remaining };
}

function consumeQuota(ip) {
  const store = getGlobalStore();
  const info = getQuotaInfo(ip);
  if (info.remaining <= 0) {
    return { allowed: false, quota: info };
  }
  const key = `${info.date}:${ip}`;
  store.rate.set(key, info.used + 1);
  return {
    allowed: true,
    quota: {
      ...info,
      used: info.used + 1,
      remaining: Math.max(0, DAILY_LIMIT - (info.used + 1))
    }
  };
}

function hashImageData(imageDataUrl) {
  return crypto.createHash('sha256').update(imageDataUrl).digest('hex');
}

function cleanupCacheStore(cache) {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const entries = Array.from(cache.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
  const removeCount = cache.size - MAX_CACHE_ENTRIES;
  for (let i = 0; i < removeCount; i++) {
    cache.delete(entries[i][0]);
  }
}

function getCachedResult(imageHash) {
  const store = getGlobalStore();
  const hit = store.cache.get(imageHash);
  return hit || null;
}

function setCachedResult(imageHash, payload) {
  const store = getGlobalStore();
  store.cache.set(imageHash, {
    ...payload,
    createdAt: Date.now()
  });
  cleanupCacheStore(store.cache);
}

export {
  DAILY_LIMIT,
  getClientIp,
  getQuotaInfo,
  consumeQuota,
  hashImageData,
  getCachedResult,
  setCachedResult,
  resetRuntimeStoreForTest
};
