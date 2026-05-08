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
  const loadingText = document.getElementById('loadingText');

  let currentImageDataUrl = '';
  let currentImageName = '';
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

  function setAnalyzing(isAnalyzing) {
    analyzeBtn.disabled = isAnalyzing;
    analyzeBtn.textContent = isAnalyzing ? 'AI 分析中，请稍候...' : '开始智能解读';
  }

  function showLoading(text = '正在准备分析...') {
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
      const message = data.error || `请求失败(${response.status})`;
      throw new Error(message);
    }
    return data;
  }

  function renderResult(analysis, story, psych, warning = '') {
    analysisDescription.textContent = analysis.description || '暂无';
    storyTitle.textContent = story.title ? `《${story.title}》` : '《画里的小故事》';
    storyContent.textContent = story.content || '暂无';
    psychOverall.textContent = warning ? `${psych.overall_assessment || '暂无'}\n\n提示：${warning}` : (psych.overall_assessment || '暂无');
    psychAdvice.textContent = psych.teacher_advice || '暂无';
    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      showLoading('正在优化图片大小...');
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
      showLoading('正在分析画作内容...');
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

  // 双保险：页面初始化时强制隐藏 loading 遮罩
  hideLoading();
})();
