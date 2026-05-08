import { getShare } from '../../lib/share-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const shareId = req.query?.id;
    if (!shareId || typeof shareId !== 'string') {
      res.status(400).json({ success: false, error: '缺少分享 ID' });
      return;
    }

    const data = getShare(shareId);
    if (!data) {
      res.status(404).json({ success: false, error: '分享内容不存在或已过期' });
      return;
    }

    res.status(200).json({
      success: true,
      shareId,
      ...data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '服务器错误' });
  }
}
