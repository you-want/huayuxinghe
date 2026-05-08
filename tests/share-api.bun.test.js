import { describe, test, expect, beforeEach } from 'bun:test';
import createShareHandler from '../api/share/create.js';
import getShareHandler from '../api/share/[id].js';
import { resetShareStoreForTest } from '../lib/share-store.js';

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
    end() {
      return this;
    }
  };
}

describe('share api (bun)', () => {
  beforeEach(() => {
    resetShareStoreForTest();
  });

  test('POST /api/share/create 成功创建分享链接', async () => {
    const req = {
      method: 'POST',
      headers: {
        host: 'example.com',
        'x-forwarded-proto': 'https'
      },
      body: {
        imageDataUrl: 'data:image/jpeg;base64,abc123',
        artworkTitle: '测试画作',
        analysis: { description: '画面描述' },
        story: { title: '故事标题', content: '故事正文' },
        psych: { overall_assessment: '总体评估', teacher_advice: '教师建议' }
      }
    };
    const res = mockRes();

    await createShareHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(typeof res.payload.shareId).toBe('string');
    expect(res.payload.shareUrl.includes(`?share=${res.payload.shareId}`)).toBe(true);
  });

  test('POST /api/share/create 缺失图片时报 400', async () => {
    const req = {
      method: 'POST',
      headers: { host: 'example.com' },
      body: {
        imageDataUrl: '',
        artworkTitle: '测试画作',
        analysis: { description: '画面描述' },
        story: { title: '故事标题', content: '故事正文' },
        psych: { overall_assessment: '总体评估', teacher_advice: '教师建议' }
      }
    };
    const res = mockRes();

    await createShareHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.success).toBe(false);
  });

  test('GET /api/share/:id 可读取已创建分享', async () => {
    const createReq = {
      method: 'POST',
      headers: {
        host: 'example.com',
        'x-forwarded-proto': 'https'
      },
      body: {
        imageDataUrl: 'data:image/jpeg;base64,abc123',
        artworkTitle: '测试画作',
        analysis: { description: '画面描述' },
        story: { title: '故事标题', content: '故事正文' },
        psych: { overall_assessment: '总体评估', teacher_advice: '教师建议' }
      }
    };
    const createRes = mockRes();
    await createShareHandler(createReq, createRes);

    const shareId = createRes.payload.shareId;
    const getReq = {
      method: 'GET',
      query: { id: shareId }
    };
    const getRes = mockRes();

    await getShareHandler(getReq, getRes);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.payload.success).toBe(true);
    expect(getRes.payload.shareId).toBe(shareId);
    expect(getRes.payload.artworkTitle).toBe('测试画作');
  });

  test('GET /api/share/:id 不存在时返回 404', async () => {
    const req = {
      method: 'GET',
      query: { id: 'not-found-id' }
    };
    const res = mockRes();

    await getShareHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload.success).toBe(false);
  });
});
