import {
  analyzeArtwork,
  generateStory,
  generatePsych,
  buildFallbackAnalysis
} from '../lib/ai.js';
import {
  getClientIp,
  getQuotaInfo,
  consumeQuota,
  hashImageData,
  getCachedResult,
  setCachedResult
} from '../lib/runtime-control.js';

export const config = {
  maxDuration: 60
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const imageDataUrl = body.imageDataUrl || '';
    const artworkTitle = body.artworkTitle || '孩子的画';
    const clientIp = getClientIp(req);

    if (!imageDataUrl.startsWith('data:image/')) {
      res.status(400).json({ success: false, error: '请上传有效的图片数据' });
      return;
    }

    const imageHash = hashImageData(imageDataUrl);
    const cached = getCachedResult(imageHash);
    if (cached) {
      res.status(200).json({
        success: true,
        analysis: cached.analysis,
        story: cached.story,
        psych: cached.psych,
        warning: cached.warning || '',
        cacheHit: true,
        quota: getQuotaInfo(clientIp)
      });
      return;
    }

    const quotaConsume = consumeQuota(clientIp);
    if (!quotaConsume.allowed) {
      res.status(429).json({
        success: false,
        error: '今日分析额度已用完，请明天再试',
        quota: quotaConsume.quota
      });
      return;
    }

    let analysis;
    let warning = '';
    try {
      analysis = await analyzeArtwork(imageDataUrl);
    } catch (error) {
      warning = error.message || '图片分析失败';
      analysis = buildFallbackAnalysis(artworkTitle, warning);
    }

    const story = await generateStory(analysis, artworkTitle);
    const psych = await generatePsych(analysis, artworkTitle);

    setCachedResult(imageHash, { analysis, story, psych, warning });

    res.status(200).json({
      success: true,
      analysis,
      story,
      psych,
      warning,
      cacheHit: false,
      quota: quotaConsume.quota
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
}
