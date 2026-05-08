import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import {
  getConfig,
  analyzeArtwork,
  generateStory,
  generatePsych,
  buildFallbackAnalysis
} from './lib/ai.js';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 8081);

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
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

function safeResolve(pathname) {
  const normalizedPath = normalize(decodeURIComponent(pathname));
  const relativePath = normalizedPath === '/' ? '/index.html' : normalizedPath;
  const absPath = join(ROOT, relativePath);
  if (!absPath.startsWith(ROOT)) return null;
  return absPath;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/health') {
      const cfg = getConfig();
      if (req.method === 'HEAD') {
        res.writeHead(200);
        res.end();
        return;
      }
      sendJson(res, 200, {
        success: true,
        provider: cfg.provider,
        model: cfg.model,
        configured: Boolean(cfg.apiKey)
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/analyze') {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const imageDataUrl = body.imageDataUrl || '';
      const artworkTitle = body.artworkTitle || '孩子的画';

      if (!imageDataUrl.startsWith('data:image/')) {
        sendJson(res, 400, { success: false, error: '请上传有效的图片数据' });
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
      sendJson(res, 200, { success: true, analysis, story, psych, warning });
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const filePath = safeResolve(url.pathname);
      if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const contentType = getMime(filePath);
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end();
        return;
      }
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    }

    res.writeHead(405);
    res.end('Method Not Allowed');
  } catch (error) {
    sendJson(res, 500, { success: false, error: error.message || '服务器错误' });
  }
});

server.listen(PORT, () => {
  console.log(`Server started on http://127.0.0.1:${PORT}`);
});
