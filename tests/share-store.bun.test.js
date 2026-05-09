import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createShare,
  getShare,
  resetShareStoreForTest
} from '../lib/share-store.js';

describe('share-store (bun)', () => {
  beforeEach(() => {
    resetShareStoreForTest();
  });

  test('createShare 后可 getShare 读取', async () => {
    const payload = {
      imageDataUrl: 'data:image/jpeg;base64,abc',
      artworkTitle: '测试画作',
      analysis: { description: '描述' },
      story: { title: '故事', content: '正文' },
      psych: { overall_assessment: '评估', teacher_advice: '建议' }
    };

    const created = await createShare(payload);
    expect(created.id.length).toBeGreaterThan(6);

    const hit = await getShare(created.id);
    expect(hit).not.toBeNull();
    expect(hit.artworkTitle).toBe('测试画作');
    expect(hit.story.title).toBe('故事');
  });

  test('不存在的分享 id 返回 null', async () => {
    const hit = await getShare('not-exists-id');
    expect(hit).toBeNull();
  });
});
