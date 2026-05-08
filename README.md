# 画语星河 (huayuxinghe)

一个面向儿童绘画场景的 AI H5 工具：拍照上传画作，自动生成画面观察、故事文本与教师关怀建议。  
项目基于 **静态前端 + Vercel Serverless API + OpenAI Compatible API**，可独立部署、可开源发布。

## 功能亮点

- 手机拍照上传 / 相册选择
- AI 画作观察（结构化输出）
- AI 故事生成（儿童友好表达）
- 教师关怀建议（避免诊断和标签化）
- 图片识别失败时自动降级，确保流程不中断

## 技术栈

- 前端：原生 HTML + CSS + JavaScript
- 服务端：Vercel Serverless Function（`/api`），本地可用 Bun 调试
- 模型接口：OpenAI Compatible（可接 DashScope）

## 本地开发

### 1. 安装 Bun

参考官方文档：[https://bun.sh](https://bun.sh)

### 2. 配置环境变量

复制模板并填写密钥：

```bash
cp .env.example .env
```

`.env` 示例：

```env
PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen3.6-35b-a3b
PORT=8081
```

### 3. 启动服务

```bash
bun run dev
```

访问：

- 本机：`http://127.0.0.1:8081`
- 局域网手机：`http://你的局域网IP:8081`

## API

- `GET /api/health`：健康检查
- `POST /api/analyze`：提交图片分析

请求体示例：

```json
{
  "imageDataUrl": "data:image/png;base64,...",
  "artworkTitle": "孩子的画"
}
```

## 部署建议

### 方案 A：Vercel（推荐）

- 导入 GitHub 仓库
- Framework 选择 `Other`
- Build Command 留空
- Output Directory 留空（项目根目录静态托管）
- 设置环境变量：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `MODEL_NAME`
  - `PROVIDER`（可选）
- 点击 Deploy，部署完成后访问域名即可

> 注意：前端已内置图片压缩（最长边 1280）以降低请求体过大风险。

### 方案 B：本地 / 自有服务器（Bun）

```bash
git clone <你的仓库地址>
cd xinsheng-shiguang
cp .env.example .env
# 编辑 .env
bun run start
```

建议加 Nginx 反向代理并启用 HTTPS。

## 开源说明

- License: MIT（见 `LICENSE`）
- 请勿提交 `.env` 到公开仓库
- 若密钥曾经暴露，请立即在模型平台控制台轮换

## 项目结构

```text
xinsheng-shiguang/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── api/
│   ├── analyze.js
│   └── health.js
├── lib/
│   └── ai.js
├── server.js            # 本地 Bun 调试服务（可选）
├── vercel.json
├── .env.example
├── .gitignore
├── package.json
└── LICENSE
```
