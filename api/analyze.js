import {
  analyzeArtwork,
  generateStory,
  generatePsych,
  buildFallbackAnalysis
} from '../lib/ai.js';

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

    if (!imageDataUrl.startsWith('data:image/')) {
      res.status(400).json({ success: false, error: '请上传有效的图片数据' });
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

    res.status(200).json({ success: true, analysis, story, psych, warning });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
}
