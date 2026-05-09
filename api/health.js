import { getConfig } from '../lib/ai.js';
import { DAILY_LIMIT, getClientIp, getQuotaInfo } from '../lib/runtime-control.js';
import { SHARE_PERSISTENT_READY } from '../lib/share-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const config = getConfig();
  const clientIp = getClientIp(req);
  const quota = getQuotaInfo(clientIp);
  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    success: true,
    provider: config.provider,
    model: config.model,
    configured: Boolean(config.apiKey),
    sharePersistentReady: SHARE_PERSISTENT_READY,
    quota: {
      ...quota,
      limit: DAILY_LIMIT
    }
  });
}
