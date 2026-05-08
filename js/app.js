(() => {
  'use strict';

  const cameraInput = document.getElementById('cameraInput');
  const albumInput = document.getElementById('albumInput');
  const previewCard = document.getElementById('previewCard');
  const previewImage = document.getElementById('previewImage');
  const imageInfo = document.getElementById('imageInfo');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusText = document.getElementById('statusText');
  const resultCard = document.getElementById('resultCard');
  const analysisDescription = document.getElementById('analysisDescription');
  const storyTitle = document.getElementById('storyTitle');
  const storyContent = document.getElementById('storyContent');
  const psychOverall = document.getElementById('psychOverall');
  const psychAdvice = document.getElementById('psychAdvice');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingTitle = document.getElementById('loadingTitle');
  const loadingText = document.getElementById('loadingText');
  const quotaHint = document.getElementById('quotaHint');
  const shareBtn = document.getElementById('shareBtn');
  const sharePanel = document.getElementById('sharePanel');
  const shareLinkInput = document.getElementById('shareLinkInput');
  const copyShareBtn = document.getElementById('copyShareBtn');

  let currentImageDataUrl = '';
  let currentImageName = '';
  let latestResult = null;
  const MAX_IMAGE_EDGE = 1280;
  const JPEG_QUALITY = 0.78;

  function bytesToMB(size) {
    return (size / 1024 / 1024).toFixed(2);
  }

  function dataUrlToApproxMB(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    const bytes = (base64.length * 3) / 4;
    return bytesToMB(bytes);
  }

  function setStatus(text) {
    statusText.textContent = text || '';
  }

  function renderQuota(quota) {
    if (!quotaHint) return;
    if (!quota) {
      quotaHint.textContent = '今日剩余额度：--';
      return;
    }
    quotaHint.textContent = `今日剩余额度：${quota.remaining}/${quota.limit}`;
  }

  function setAnalyzing(isAnalyzing) {
    analyzeBtn.disabled = isAnalyzing;
    analyzeBtn.textContent = isAnalyzing ? 'AI 分析中，请稍候...' : '开始智能解读';
  }

  function showLoading(text = '正在准备分析...', title = '处理中，请稍候') {
    if (loadingTitle) loadingTitle.textContent = title;
    loadingText.textContent = text;
    loadingOverlay.classList.add('is-visible');
    loadingOverlay.hidden = false;
    loadingOverlay.setAttribute('aria-hidden', 'false');
  }

  function updateLoading(text) {
    loadingText.textContent = text;
  }

  function hideLoading() {
    loadingOverlay.classList.remove('is-visible');
    loadingOverlay.hidden = true;
    loadingOverlay.setAttribute('aria-hidden', 'true');
  }

  function bytesToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function base64UrlToBytes(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function encodeSharePayload(payload) {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    return bytesToBase64Url(bytes);
  }

  function decodeSharePayload(token) {
    const bytes = base64UrlToBytes(token);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }

  async function buildShareImageDataUrl(sourceDataUrl) {
    const img = await loadImageFromDataUrl(sourceDataUrl);
    const maxEdge = 720;
    const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const targetW = Math.max(1, Math.round(img.width * ratio));
    const targetH = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  async function callAnalyzeApi() {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: currentImageDataUrl,
        artworkTitle: currentImageName
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      if (data?.quota) renderQuota(data.quota);
      const message = data.error || `请求失败(${response.status})`;
      throw new Error(message);
    }
    if (data?.quota) renderQuota(data.quota);
    return data;
  }

  async function loadQuotaInfo() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.quota) {
        renderQuota(data.quota);
      } else {
        renderQuota(null);
      }
    } catch (error) {
      renderQuota(null);
    }
  }

  function renderResult(analysis, story, psych, warning = '') {
    analysisDescription.textContent = analysis.description || '暂无';
    storyTitle.textContent = story.title ? `《${story.title}》` : '《画里的小故事》';
    storyContent.textContent = story.content || '暂无';
    psychOverall.textContent = warning ? `${psych.overall_assessment || '暂无'}\n\n提示：${warning}` : (psych.overall_assessment || '暂无');
    psychAdvice.textContent = psych.teacher_advice || '暂无';
    latestResult = { analysis, story, psych, warning };
    if (sharePanel) sharePanel.hidden = true;
    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function createShareLink() {
    if (!latestResult || !currentImageDataUrl) {
      alert('请先完成一次分析后再分享');
      return;
    }

    showLoading('正在生成分享链接...', '正在分享，请稍候');
    try {
      const shareImageDataUrl = await buildShareImageDataUrl(currentImageDataUrl);
      const token = encodeSharePayload({
        v: 1,
        artworkTitle: currentImageName || '孩子的画',
        imageDataUrl: shareImageDataUrl,
        analysis: latestResult.analysis,
        story: latestResult.story,
        psych: latestResult.psych,
        createdAt: Date.now()
      });
      const shareUrl = `${window.location.origin}${window.location.pathname}?shareData=${encodeURIComponent(token)}`;
      shareLinkInput.value = shareUrl;
      sharePanel.hidden = false;
      if (navigator.share) {
        try {
          await navigator.share({
            title: '画语星河 - 分享',
            text: '我分享了一份画作解读，点开查看',
            url: shareUrl
          });
        } catch (error) {
          // 用户取消分享时静默处理
        }
      }
    } finally {
      hideLoading();
    }
  }

  async function copyShareLink() {
    const link = shareLinkInput.value.trim();
    if (!link) {
      alert('还没有可复制的链接');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      alert('分享链接已复制');
    } catch (error) {
      shareLinkInput.select();
      document.execCommand('copy');
      alert('分享链接已复制');
    }
  }

  async function tryLoadSharedContent() {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('shareData');
    const shareId = params.get('share');
    if (!shareData && !shareId) return;

    showLoading('正在加载分享内容...', '正在打开分享内容');
    try {
      if (shareData) {
        const decoded = decodeSharePayload(shareData);
        currentImageDataUrl = decoded.imageDataUrl;
        currentImageName = decoded.artworkTitle || '分享画作';
        previewImage.src = currentImageDataUrl;
        imageInfo.textContent = `分享内容：${currentImageName}`;
        previewCard.hidden = false;
        renderResult(decoded.analysis, decoded.story, decoded.psych, '');
        setStatus('当前为分享查看模式');
        return;
      }

      const response = await fetch(`/api/share/${encodeURIComponent(shareId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || '分享内容加载失败');
      }

      currentImageDataUrl = data.imageDataUrl;
      currentImageName = data.artworkTitle || '分享画作';
      previewImage.src = currentImageDataUrl;
      imageInfo.textContent = `分享内容：${currentImageName}`;
      previewCard.hidden = false;
      renderResult(data.analysis, data.story, data.psych, '');
      setStatus('当前为分享查看模式');
    } catch (error) {
      alert(`分享内容加载失败：${error.message}`);
    } finally {
      hideLoading();
    }
  }

  async function compressImageToDataUrl(file) {
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    const longest = Math.max(width, height);
    const scale = longest > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longest : 1;

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }

  async function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('图片太大，请选择 15MB 以内的图片');
      return;
    }

    try {
      showLoading('正在优化图片大小...', '图片处理中');
      const compressedDataUrl = await compressImageToDataUrl(file);
      currentImageDataUrl = compressedDataUrl;
      currentImageName = file.name || '未命名画作';
      previewImage.src = currentImageDataUrl;
      imageInfo.textContent = `已选择：${currentImageName}（原图 ${bytesToMB(file.size)}MB，上传约 ${dataUrlToApproxMB(currentImageDataUrl)}MB）`;
      previewCard.hidden = false;
      resultCard.hidden = true;
      setStatus('');
    } catch (error) {
      alert('图片处理失败，请重试');
    } finally {
      hideLoading();
    }
  }

  cameraInput.addEventListener('change', async (event) => {
    await handleFile(event.target.files?.[0]);
    cameraInput.value = '';
  });

  albumInput.addEventListener('change', async (event) => {
    await handleFile(event.target.files?.[0]);
    albumInput.value = '';
  });

  analyzeBtn.addEventListener('click', async () => {
    if (!currentImageDataUrl) {
      alert('请先选择一张画作图片');
      return;
    }

    try {
      setAnalyzing(true);
      showLoading('正在分析画作内容...', 'AI 分析中，请稍候');
      setStatus('AI 正在分析画作并生成故事，请稍候...');
      updateLoading('第一步：正在分析画作内容...');
      const result = await callAnalyzeApi();
      updateLoading('第二步：正在整理故事与建议...');
      renderResult(result.analysis, result.story, result.psych, result.warning || '');
      setStatus('分析完成');
    } catch (error) {
      console.error(error);
      setStatus('');
      alert(`分析失败：${error.message}`);
    } finally {
      hideLoading();
      setAnalyzing(false);
    }
  });

  if (shareBtn) {
    shareBtn.addEventListener('click', createShareLink);
  }
  if (copyShareBtn) {
    copyShareBtn.addEventListener('click', copyShareLink);
  }

  // 双保险：页面初始化时强制隐藏 loading 遮罩
  hideLoading();
  loadQuotaInfo();
  tryLoadSharedContent();
})();
