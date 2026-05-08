function getConfig() {
  return {
    provider: process.env.PROVIDER || 'openai-compatible',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.MODEL_NAME || 'gpt-4o-mini'
  };
}

function parseJsonFromText(text) {
  const cleaned = String(text || '')
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    return null;
  }
}

async function chat(messages, options = {}) {
  const config = getConfig();
  if (!config.apiKey) {
    throw new Error('服务端未配置 OPENAI_API_KEY');
  }
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
      stream: false
    })
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`上游模型请求失败(${response.status}): ${raw.slice(0, 240)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function analyzeArtwork(imageDataUrl) {
  const prompt = `你是一位儿童美术教育专家。请观察儿童画作并输出 JSON：
{
  "description":"50-100字整体描述",
  "elements":["元素1","元素2"],
  "colors":["颜色1","颜色2"],
  "mood":"情绪氛围",
  "highlights":"创意亮点"
}`;

  const raw = await chat([
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: prompt }
      ]
    }
  ]);

  const parsed = parseJsonFromText(raw);
  return parsed || {
    description: raw,
    elements: [],
    colors: [],
    mood: '未知',
    highlights: ''
  };
}

async function generateStory(analysis, artworkTitle) {
  const prompt = `请根据以下画作分析，写一个200-350字、温暖有趣、适合孩子听的故事，并输出 JSON：
{
  "title":"故事标题",
  "content":"故事正文"
}
画作标题：${artworkTitle}
描述：${analysis.description}
元素：${(analysis.elements || []).join('、')}
颜色：${(analysis.colors || []).join('、')}
情绪：${analysis.mood}
亮点：${analysis.highlights}`;
  const raw = await chat([{ role: 'user', content: prompt }]);
  const parsed = parseJsonFromText(raw);
  return parsed || { title: '画里的小故事', content: raw };
}

async function generatePsych(analysis, artworkTitle) {
  const prompt = `你是一位温和的教师助手。请给出绘画心理关怀建议，避免诊断和贴标签，输出 JSON：
{
  "overall_assessment":"一句总体评估",
  "teacher_advice":"2-4条可执行建议，写成一段话"
}
画作标题：${artworkTitle}
描述：${analysis.description}
元素：${(analysis.elements || []).join('、')}
颜色：${(analysis.colors || []).join('、')}
情绪：${analysis.mood}`;
  const raw = await chat([{ role: 'user', content: prompt }], { temperature: 0.5 });
  const parsed = parseJsonFromText(raw);
  return parsed || { overall_assessment: raw, teacher_advice: '' };
}

function buildFallbackAnalysis(artworkTitle, reason) {
  return {
    description: `暂时无法直接识别图片细节，先基于标题“${artworkTitle}”生成陪伴式解读。`,
    elements: ['孩子创作', '自由表达'],
    colors: ['待观察'],
    mood: '待进一步观察',
    highlights: '建议老师先和孩子聊聊画面主角、颜色和故事，再结合AI结果一起解读。',
    warning: `图片直读失败，已使用降级方案：${reason}`
  };
}

export {
  getConfig,
  analyzeArtwork,
  generateStory,
  generatePsych,
  buildFallbackAnalysis
};
