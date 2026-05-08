import { createShare } from '../../lib/share-store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const imageDataUrl = body.imageDataUrl || '';
    const artworkTitle = body.artworkTitle || '孩子的画';
    const analysis = body.analysis || null;
    const story = body.story || null;
    const psych = body.psych || null;

    if (!imageDataUrl.startsWith('data:image/')) {
      res.status(400).json({ success: false, error: '缺少有效图片数据' });
      return;
    }
    if (!analysis || !story || !psych) {
      res.status(400).json({ success: false, error: '缺少分析结果数据' });
      return;
    }

    const created = createShare({
      imageDataUrl,
      artworkTitle,
      analysis,
      story,
      psych
    });

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const shareUrl = `${proto}://${host}/?share=${created.id}`;

    res.status(200).json({
      success: true,
      shareId: created.id,
      shareUrl,
      expiresAt: created.expiresAt
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '服务器错误' });
  }
}
