import { getConfig } from '../lib/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const config = getConfig();
  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    success: true,
    provider: config.provider,
    model: config.model,
    configured: Boolean(config.apiKey)
  });
}
