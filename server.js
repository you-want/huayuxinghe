import { join, normalize } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = import.meta.dir;
const PORT = Number(Bun.env.PORT || 8081);

function loadEnvFromProject() {
  const envFile = join(ROOT, '.env');
  const map = {};
  if (!existsSync(envFile)) return map;
  const lines = readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    map[key] = value;
  }
  return map;
}

const PROJECT_ENV = loadEnvFromProject();
const PROVIDER = Bun.env.PROVIDER || PROJECT_ENV.PROVIDER || 'openai-compatible';
const OPENAI_API_KEY = Bun.env.OPENAI_API_KEY || PROJECT_ENV.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = Bun.env.OPENAI_BASE_URL || PROJECT_ENV.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const MODEL_NAME = Bun.env.MODEL_NAME || PROJECT_ENV.MODEL_NAME || 'gpt-4o-mini';

function jsonResponse(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
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
  if (!OPENAI_API_KEY) {
    throw new Error('服务端未配置 OPENAI_API_KEY');
  }
  const endpoint = `${OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL_NAME,
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
        {
          type: 'image_url',
          image_url: { url: imageDataUrl }
        },
        {
          type: 'text',
          text: prompt
        }
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

function getMime(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function resolveStaticFile(pathname) {
  const normalizedPath = normalize(decodeURIComponent(pathname));
  const relativePath = normalizedPath === '/' ? '/index.html' : normalizedPath;
  const absPath = join(ROOT, relativePath);
  if (!absPath.startsWith(ROOT)) {
    return null;
  }
  return absPath;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    try {
      const url = new URL(req.url);

      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/health') {
        if (req.method === 'HEAD') return new Response(null, { status: 200 });
        return jsonResponse(200, {
          success: true,
          provider: PROVIDER,
          model: MODEL_NAME,
          configured: Boolean(OPENAI_API_KEY)
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/analyze') {
        const body = await req.json().catch(() => ({}));
        const imageDataUrl = body.imageDataUrl || '';
        const artworkTitle = body.artworkTitle || '孩子的画';

        if (!imageDataUrl.startsWith('data:image/')) {
          return jsonResponse(400, { success: false, error: '请上传有效的图片数据' });
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

        return jsonResponse(200, { success: true, analysis, story, psych, warning });
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        const filePath = resolveStaticFile(url.pathname);
        if (!filePath) return new Response('Forbidden', { status: 403 });

        const file = Bun.file(filePath);
        if (!(await file.exists())) {
          return new Response('Not Found', { status: 404 });
        }

        if (req.method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'Content-Type': file.type || getMime(filePath)
            }
          });
        }

        return new Response(file, {
          headers: {
            'Content-Type': file.type || getMime(filePath)
          }
        });
      }

      return new Response('Method Not Allowed', { status: 405 });
    } catch (error) {
      return jsonResponse(500, { success: false, error: error.message || '服务器错误' });
    }
  }
});

console.log(`H5 服务已启动: ${server.url}`);
