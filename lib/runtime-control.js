import crypto from 'node:crypto';

const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 10);
const MAX_CACHE_ENTRIES = Number(process.env.MAX_CACHE_ENTRIES || 300);
const QUOTA_USE_BLOB = (process.env.QUOTA_USE_BLOB || 'true').toLowerCase() !== 'false';
const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const BLOB_ACCESS = (process.env.BLOB_ACCESS || 'private').toLowerCase() === 'private' ? 'private' : 'public';
const ACCESS_MISMATCH_ERRORS = [
  'Cannot use public access on a private store',
  'access must be "public"'
];

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

function ipHash(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
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

async function readBlobJson(pathPrefix) {
  const { list } = await import('@vercel/blob');
  const listing = await list({
    prefix: pathPrefix,
    limit: 1
  });
  const blob = listing?.blobs?.[0];
  if (!blob) return null;
  const response = await fetch(blob.url, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function writeBlobJson(path, data) {
  const { put } = await import('@vercel/blob');
  const payload = JSON.stringify(data);
  const accessOrder = BLOB_ACCESS === 'private' ? ['private', 'public'] : ['public', 'private'];
  let lastAccessError = null;
  for (const access of accessOrder) {
    try {
      await put(path, payload, {
        access,
        addRandomSuffix: false,
        contentType: 'application/json'
      });
      lastAccessError = null;
      break;
    } catch (error) {
      const message = String(error?.message || error || '');
      const isAccessMismatch = ACCESS_MISMATCH_ERRORS.some((text) => message.includes(text));
      if (!isAccessMismatch) {
        throw error;
      }
      lastAccessError = error;
    }
  }
  if (lastAccessError) {
    throw lastAccessError;
  }
}

async function getQuotaInfo(ip) {
  if (QUOTA_USE_BLOB && hasBlobToken) {
    const date = todayKey();
    const quotaPath = `quota/${date}/${ipHash(ip)}.json`;
    const hit = await readBlobJson(quotaPath);
    const used = Number(hit?.used || 0);
    const remaining = Math.max(0, DAILY_LIMIT - used);
    return { date, limit: DAILY_LIMIT, used, remaining };
  }

  const store = getGlobalStore();
  const date = todayKey();
  cleanupRateStore(store.rate, date);
  const key = `${date}:${ip}`;
  const used = Number(store.rate.get(key) || 0);
  const remaining = Math.max(0, DAILY_LIMIT - used);
  return { date, limit: DAILY_LIMIT, used, remaining };
}

async function consumeQuota(ip) {
  if (QUOTA_USE_BLOB && hasBlobToken) {
    const info = await getQuotaInfo(ip);
    if (info.remaining <= 0) {
      return { allowed: false, quota: info };
    }
    const nextUsed = info.used + 1;
    const quotaPath = `quota/${info.date}/${ipHash(ip)}.json`;
    await writeBlobJson(quotaPath, {
      used: nextUsed,
      updatedAt: Date.now()
    });
    return {
      allowed: true,
      quota: {
        ...info,
        used: nextUsed,
        remaining: Math.max(0, DAILY_LIMIT - nextUsed)
      }
    };
  }

  const store = getGlobalStore();
  const info = await getQuotaInfo(ip);
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
