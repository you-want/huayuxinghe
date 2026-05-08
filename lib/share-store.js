import crypto from 'node:crypto';

const SHARE_TTL_HOURS = Number(process.env.SHARE_TTL_HOURS || 72);
const SHARE_MAX_ENTRIES = Number(process.env.SHARE_MAX_ENTRIES || 500);

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

function createShare(payload) {
  const store = getStore();
  pruneStore();
  const id = crypto.randomBytes(6).toString('hex');
  const createdAt = nowMs();
  const expiresAt = createdAt + SHARE_TTL_HOURS * 60 * 60 * 1000;
  store.set(id, {
    createdAt,
    expiresAt,
    payload
  });
  return { id, createdAt, expiresAt };
}

function getShare(id) {
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
  createShare,
  getShare,
  resetShareStoreForTest
};
