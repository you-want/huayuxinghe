import crypto from 'node:crypto';

const SHARE_TTL_HOURS = Number(process.env.SHARE_TTL_HOURS || 72);
const SHARE_MAX_ENTRIES = Number(process.env.SHARE_MAX_ENTRIES || 500);
const SHARE_USE_BLOB = (process.env.SHARE_USE_BLOB || 'true').toLowerCase() !== 'false';
const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const SHARE_PERSISTENT_READY = SHARE_USE_BLOB && hasBlobToken;
const BLOB_ACCESS = (process.env.BLOB_ACCESS || 'public').toLowerCase() === 'private' ? 'private' : 'public';

function getStore() {
  if (!globalThis.__huayuShareStore) {
    globalThis.__huayuShareStore = new Map();
  }
  return globalThis.__huayuShareStore;
}

function nowMs() {
  return Date.now();
}

function pruneStore() {
  const store = getStore();
  const now = nowMs();
  for (const [id, item] of store.entries()) {
    if (item.expiresAt <= now) {
      store.delete(id);
    }
  }
  if (store.size <= SHARE_MAX_ENTRIES) return;
  const entries = Array.from(store.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
  const removeCount = store.size - SHARE_MAX_ENTRIES;
  for (let i = 0; i < removeCount; i++) {
    store.delete(entries[i][0]);
  }
}

async function createShare(payload) {
  const createdAt = nowMs();
  const expiresAt = createdAt + SHARE_TTL_HOURS * 60 * 60 * 1000;
  const id = crypto.randomBytes(6).toString('hex');

  if (SHARE_USE_BLOB && hasBlobToken) {
    const { put } = await import('@vercel/blob');
    const record = JSON.stringify({
      payload,
      createdAt,
      expiresAt
    });
    await put(`shares/${id}.json`, record, {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      contentType: 'application/json'
    });
    return { id, createdAt, expiresAt };
  }

  const store = getStore();
  pruneStore();
  store.set(id, {
    createdAt,
    expiresAt,
    payload
  });
  return { id, createdAt, expiresAt };
}

async function getShare(id) {
  if (SHARE_USE_BLOB && hasBlobToken) {
    const { list } = await import('@vercel/blob');
    const listing = await list({
      prefix: `shares/${id}.json`,
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
    const json = await response.json();
    if (!json || typeof json !== 'object') return null;
    if (Number(json.expiresAt) <= nowMs()) return null;
    return {
      ...(json.payload || {}),
      createdAt: json.createdAt,
      expiresAt: json.expiresAt
    };
  }

  const store = getStore();
  pruneStore();
  const item = store.get(id);
  if (!item) return null;
  return {
    ...item.payload,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt
  };
}

function resetShareStoreForTest() {
  globalThis.__huayuShareStore = new Map();
}

export {
  SHARE_TTL_HOURS,
  SHARE_MAX_ENTRIES,
  SHARE_PERSISTENT_READY,
  BLOB_ACCESS,
  createShare,
  getShare,
  resetShareStoreForTest
};
