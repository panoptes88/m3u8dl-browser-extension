/**
 * m3u8DL Sniffer - Popup Script
 * 参考猫爪实现内联视频信息展示
 */

// 当前 tab ID
let currentTabId = null;
// 嗅探到的资源列表
let resources = [];
// 选中的资源索引集合
let selectedIndices = new Set();
// 服务器配置
let serverConfig = {
  server: '',
  username: '',
  password: ''
};

// 代理配置
let proxyConfig = {
  enable: false,
  type: 'http',
  host: '',
  port: 0,
  auth: false,
  username: '',
  password: ''
};

// AI 翻译配置
let aiTranslateConfig = {
  enable: false,
  baseUrl: '',
  modelId: '',
  apiKey: '',
  prompt: ''
};

// 翻译状态
let isTranslating = false;

// DOM 元素
const elements = {
  status: document.getElementById('status'),
  statusDot: document.querySelector('.status-dot'),
  statusText: document.querySelector('.status-text'),
  resourceList: document.getElementById('resourceList'),
  emptyState: document.getElementById('emptyState'),
  resourceCount: document.getElementById('resourceCount'),
  selectedCount: document.getElementById('selectedCount'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnClear: document.getElementById('btnClear'),
  btnSelectAll: document.getElementById('btnSelectAll'),
  btnSend: document.getElementById('btnSend'),
  toast: document.getElementById('toast'),
  proxyToggle: document.getElementById('proxyToggle')
};


/**
 * 初始化
 */
async function init() {
  // 获取当前 tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId = tab.id;
  }

  // 加载配置
  await loadConfig();

  // 加载资源
  await loadResources();

  // 绑定事件
  bindEvents();

  // 更新连接状态
  updateConnectionStatus();

  // 初始化代理开关
  initProxyToggle();

  // 监听页面加载完成事件，自动刷新资源列表
  if (currentTabId) {
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
      if (tabId === currentTabId && changeInfo.status === 'complete') {
        // 页面加载完成，重新加载资源
        loadResources();
      }
    });
  }

  // 监听来自 background 的资源更新消息
  chrome.runtime.onMessage.addListener(function(message) {
    if (message.type === 'resourceAdded' && message.tabId === currentTabId) {
      // 新资源添加，重新加载资源列表
      loadResources();
    }
  });

  // 监听配置变化，自动更新
  chrome.storage.onChanged.addListener(function(changes) {
    // 检查是否有代理配置变化
    if (changes.proxyEnable || changes.proxyType || changes.proxyHost || changes.proxyPort ||
        changes.proxyAuth || changes.proxyUsername || changes.proxyPassword) {
      // 重新加载配置
      loadConfig().then(() => {
        // 更新代理开关状态
        updateProxyToggleState();
        updateConnectionStatus();
      });
    }

    // 检查是否有服务器配置变化
    if (changes.server || changes.username || changes.password) {
      loadConfig().then(() => {
        updateConnectionStatus();
        updateSelectedCount();
      });
    }

    // 检查是否有 AI 翻译配置变化
    if (changes.aiTranslateEnable || changes.aiBaseUrl || changes.aiModelId || changes.aiApiKey || changes.aiPrompt) {
      loadConfig().then(() => {
        updateConnectionStatus();
      });
    }
  });
}

/**
 * 加载服务器配置
 */
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['server', 'username', 'password', 'proxyEnable', 'proxyType', 'proxyHost', 'proxyPort', 'proxyAuth', 'proxyUsername', 'proxyPassword',
       'aiTranslateEnable', 'aiBaseUrl', 'aiModelId', 'aiApiKey', 'aiPrompt'],
      function(data) {
        serverConfig = {
          server: data.server || '',
          username: data.username || '',
          password: data.password || ''
        };
        proxyConfig = {
          enable: data.proxyEnable || false,
          type: data.proxyType || 'http',
          host: data.proxyHost || '',
          port: data.proxyPort || 0,
          auth: data.proxyAuth || false,
          username: data.proxyUsername || '',
          password: data.proxyPassword || ''
        };
        aiTranslateConfig = {
          enable: data.aiTranslateEnable || false,
          baseUrl: data.aiBaseUrl || '',
          modelId: data.aiModelId || '',
          apiKey: data.aiApiKey || '',
          prompt: data.aiPrompt || '请将以下内容翻译成中文，只返回翻译结果，不要添加其他内容：\n\n{text}'
        };
        resolve();
      }
    );
  });
}

/**
 * 更新连接状态显示
 */
function updateConnectionStatus() {
  const isConnected = serverConfig.server && serverConfig.username;
  elements.statusDot.classList.toggle('connected', isConnected);
  let statusText = isConnected ? '已配置' : '未配置';
  if (proxyConfig.enable && proxyConfig.host) {
    statusText += ' | 代理: ' + proxyConfig.host;
  }
  elements.statusText.textContent = statusText;

  // 显示/隐藏翻译按钮
  const btnTranslate = document.getElementById('btnTranslate');
  if (btnTranslate) {
    if (aiTranslateConfig.enable && aiTranslateConfig.baseUrl && aiTranslateConfig.modelId && aiTranslateConfig.apiKey) {
      btnTranslate.classList.remove('hide');
    } else {
      btnTranslate.classList.add('hide');
    }
  }
}

/**
 * 初始化代理开关
 */
function initProxyToggle() {
  // 设置初始状态
  updateProxyToggleState();

  // 监听开关变化
  elements.proxyToggle.addEventListener('change', async function() {
    const isEnabled = this.checked;

    // 保存到配置
    await new Promise((resolve) => {
      chrome.storage.sync.set({ proxyEnable: isEnabled }, resolve);
    });

    // 更新本地配置
    proxyConfig.enable = isEnabled;

    // 更新状态显示
    updateConnectionStatus();

    showToast(isEnabled ? '代理已开启' : '代理已关闭');
  });
}

/**
 * 更新代理开关状态
 */
function updateProxyToggleState() {
  elements.proxyToggle.checked = proxyConfig.enable;

  // 如果没有配置代理，禁用开关
  if (!proxyConfig.host || !proxyConfig.port) {
    elements.proxyToggle.disabled = true;
    elements.proxyToggle.title = '请先在设置中配置代理';
  } else {
    elements.proxyToggle.disabled = false;
    elements.proxyToggle.title = '代理开关';
  }
}

/**
 * 从 background 加载资源
 */
async function loadResources() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'getResources', tabId: currentTabId },
      function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error loading resources:', chrome.runtime.lastError);
          resources = [];
        } else {
          resources = response?.resources || [];
        }
        renderResources();
        resolve();
      }
    );
  });
}

/**
 * 渲染资源列表
 */
function renderResources() {
  // 更新计数
  elements.resourceCount.textContent = `${resources.length} 个资源`;

  // 空状态
  if (resources.length === 0) {
    elements.resourceList.innerHTML = '';
    elements.resourceList.appendChild(elements.emptyState);
    elements.emptyState.style.display = 'block';
    return;
  }

  elements.emptyState.style.display = 'none';

  // 生成列表 HTML
  const html = resources.map((resource, index) => {
    const ext = resource.ext || 'unknown';
    const originalTitle = resource.originalTitle || resource.title || getFileName(resource.url);
    const fileName = resource.translatedTitle || originalTitle;
    const sizeStr = resource.size > 0 ? formatSize(resource.size) : '';
    const isSelected = selectedIndices.has(index);
    const isM3u8 = ['m3u8', 'm3u'].includes(ext);
    const isPlayable = isM3u8 || ext === 'mp4';
    const titleAttr = resource.translatedTitle
      ? `${escapeHtml(originalTitle)}\n${escapeHtml(resource.translatedTitle)}`
      : escapeHtml(resource.url);

    return `
      <div class="resource-panel" data-index="${index}">
        <div class="panel-heading">
          <input type="checkbox" class="check-item" ${isSelected ? 'checked' : ''} data-index="${index}">
          <span class="resource-name" title="${titleAttr}">${escapeHtml(fileName)}</span>
          <span class="resource-size ${sizeStr ? '' : 'hide'}">${sizeStr}</span>
          <span class="resource-ext ${ext}">${ext}</span>
          ${isPlayable ? `<button class="btn-icon btn-play" data-index="${index}" title="预览"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg></button>` : ''}
          <button class="btn-icon btn-copy-url" data-index="${index}" title="复制链接"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
        <div class="panel-body hide" id="panel-${index}">
          <div class="media-info" id="media-info-${index}" data-loaded="false">
            <span class="info-url">${escapeHtml(resource.url)}</span>
          </div>
          <video class="preview-video hide" id="video-${index}" controls></video>
        </div>
      </div>
    `;
  }).join('');

  elements.resourceList.innerHTML = html;
  updateSelectedCount();
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 复选框点击
  elements.resourceList.addEventListener('change', function(e) {
    if (e.target.classList.contains('check-item')) {
      const index = parseInt(e.target.dataset.index);
      if (e.target.checked) {
        selectedIndices.add(index);
      } else {
        selectedIndices.delete(index);
      }
      updateSelectedCount();
    }
  });

  // 点击事件委托
  elements.resourceList.addEventListener('click', function(e) {
    const target = e.target;

    // 播放按钮点击
    if (target.classList.contains('btn-play')) {
      e.stopPropagation();
      const index = parseInt(target.dataset.index);
      togglePanel(index);
      return;
    }

    // 复制链接按钮
    if (target.classList.contains('btn-copy-url')) {
      e.stopPropagation();
      const index = parseInt(target.dataset.index);
      copyToClipboard(resources[index].url);
      showToast('已复制链接');
      return;
    }

    // 面板头部点击（展开/收起）
    const heading = target.closest('.panel-heading');
    if (heading) {
      const panel = heading.closest('.resource-panel');
      const index = parseInt(panel.dataset.index);
      // 如果点击的是复选框、按钮等，不触发展开
      if (target.type === 'checkbox' || target.classList.contains('btn-icon')) {
        return;
      }
      // 切换复选框
      const checkbox = heading.querySelector('.check-item');
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    }
  });

  // 刷新按钮
  elements.btnRefresh.addEventListener('click', async function() {
    // 清理 HLS 实例
    cleanupResources();

    // 清除 background 中该 tab 的资源
    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'clearResources', tabId: currentTabId },
        resolve
      );
    });

    // 刷新页面
    if (currentTabId) {
      chrome.tabs.reload(currentTabId);
      // 等待页面加载完成后重新加载资源
      setTimeout(async () => {
        await loadResources();
        showToast('已刷新');
      }, 1000);
    } else {
      resources = [];
      selectedIndices.clear();
      renderResources();
      showToast('已刷新');
    }
  });

  // 清空按钮
  elements.btnClear.addEventListener('click', function() {
    cleanupResources();
    chrome.runtime.sendMessage(
      { type: 'clearResources', tabId: currentTabId },
      function() {
        resources = [];
        selectedIndices.clear();
        renderResources();
        showToast('已清空');
      }
    );
  });

  // 全选按钮
  elements.btnSelectAll.addEventListener('click', function() {
    if (selectedIndices.size === resources.length) {
      selectedIndices.clear();
    } else {
      resources.forEach((_, i) => selectedIndices.add(i));
    }
    renderResources();
  });

  // 翻译按钮
  const btnTranslate = document.getElementById('btnTranslate');
  if (btnTranslate) {
    btnTranslate.addEventListener('click', handleTranslate);
  }

  // 发送按钮
  elements.btnSend.addEventListener('click', handleSend);
}

/**
 * 切换面板展开/收起
 */
function togglePanel(index) {
  const panel = document.getElementById(`panel-${index}`);
  const mediaInfo = document.getElementById(`media-info-${index}`);
  const video = document.getElementById(`video-${index}`);

  if (!panel.classList.contains('hide')) {
    // 收起
    panel.classList.add('hide');
    // 暂停视频
    if (video && !video.paused) {
      video.pause();
    }
    return;
  }

  // 展开
  panel.classList.remove('hide');

  // 如果还没加载过，开始加载
  if (mediaInfo.dataset.loaded === 'false') {
    mediaInfo.dataset.loaded = 'true';
    loadVideoInfo(index);
  }
}

/**
 * 加载视频信息
 */
async function loadVideoInfo(index) {
  const resource = resources[index];
  const mediaInfo = document.getElementById(`media-info-${index}`);
  const video = document.getElementById(`video-${index}`);

  if (!resource || !mediaInfo) return;

  const isM3u8 = ['m3u8', 'm3u'].includes(resource.ext);

  if (isM3u8) {
    // 先尝试 HLS.js 播放
    if (Hls.isSupported()) {
      const headers = parseHeaders(resource.headers);

      // 使用 declarativeNetRequest 设置请求头（参考猫爪）
      await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'setRequestHeaders', headers: headers },
          resolve
        );
      });

      const hlsConfig = { enableWorker: false };
      const hls = new Hls(hlsConfig);
      hls.loadSource(resource.url);
      hls.attachMedia(video);

      // 监听 manifest 解析完成
      hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
        if (data.levels && data.levels.length > 1) {
          appendMediaInfo(mediaInfo, '清晰度', `${data.levels.length} 个变体`);
          data.levels.forEach((level, i) => {
            const resolution = level.width && level.height ? `${level.width}×${level.height}` : '';
            const bitrate = level.bitrate ? formatBitrate(level.bitrate) : '';
            const quality = resolution ? getQualityLabel(resolution) : `流 ${i + 1}`;
            appendMediaInfo(mediaInfo, quality, `${resolution} ${bitrate}`);
          });
        }
        video.classList.remove('hide');
      });

      // 监听 level 加载
      hls.on(Hls.Events.LEVEL_LOADED, function(event, data) {
        if (data.details && data.details.totalduration) {
          appendMediaInfo(mediaInfo, '时长', formatDuration(data.details.totalduration));
        }
      });

      // 监听视频元数据
      video.addEventListener('loadedmetadata', function() {
        if (video.duration && video.duration !== Infinity) {
          appendMediaInfo(mediaInfo, '时长', formatDuration(video.duration));
        }
        if (video.videoWidth && video.videoHeight) {
          appendMediaInfo(mediaInfo, '分辨率', `${video.videoWidth}×${video.videoHeight}`);
        }
        video.classList.remove('hide');
      });

      // 错误处理 - 失败时回退到解析模式
      hls.on(Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
          hls.destroy();
          chrome.runtime.sendMessage({ type: 'clearRequestHeaders' });
          console.warn('[m3u8DL] HLS 播放失败，回退到解析模式');
          loadM3u8InfoByParsing(index);
        }
      });
    } else {
      // 不支持 HLS，直接解析
      loadM3u8InfoByParsing(index);
    }
  } else {
    // 非 m3u8 文件
    video.src = resource.url;
    video.classList.remove('hide');
    appendMediaInfo(mediaInfo, '类型', resource.ext.toUpperCase());
  }
}

/**
 * 通过解析 m3u8 内容获取信息（备选方案）
 */
async function loadM3u8InfoByParsing(index) {
  const resource = resources[index];
  const mediaInfo = document.getElementById(`media-info-${index}`);

  // 清空之前的内容
  mediaInfo.innerHTML = '<span class="info-url">' + escapeHtml(resource.url) + '</span>';

  const headers = parseHeaders(resource.headers);
  const referer = headers['Referer'] || headers['referer'];
  const fetchHeaders = referer ? { Referer: referer } : {};

  appendMediaInfo(mediaInfo, '状态', '解析中...');

  try {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'fetchM3u8', url: resource.url, headers: fetchHeaders },
        resolve
      );
    });

    if (result.success) {
      const info = parseM3u8Content(result.data, resource.url);
      displayM3u8Info(mediaInfo, info);
    } else {
      mediaInfo.innerHTML = '<span class="info-url">' + escapeHtml(resource.url) + '</span>';
      appendMediaInfo(mediaInfo, '错误', result.error || '加载失败');
    }
  } catch (e) {
    mediaInfo.innerHTML = '<span class="info-url">' + escapeHtml(resource.url) + '</span>';
    appendMediaInfo(mediaInfo, '错误', e.message);
  }
}

/**
 * 解析 m3u8 内容
 */
function parseM3u8Content(content, baseUrl) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  const info = {
    isMaster: false,
    duration: 0,
    segments: 0,
    variants: []
  };

  // 检查是否是 master playlist
  if (content.includes('#EXT-X-STREAM-INF')) {
    info.isMaster = true;

    // 解析变体流
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
        const attrs = parseM3u8Attributes(lines[i]);
        const nextLine = lines[i + 1] || '';
        const url = nextLine.startsWith('#') ? '' : resolveUrl(nextLine, baseUrl);

        info.variants.push({
          bandwidth: parseInt(attrs['BANDWIDTH'] || '0'),
          resolution: attrs['RESOLUTION'] || '',
          codecs: attrs['CODECS'] || '',
          url: url
        });
      }
    }

    // 按带宽排序（从高到低）
    info.variants.sort((a, b) => b.bandwidth - a.bandwidth);
  } else {
    // 是 media playlist，计算时长
    let totalDuration = 0;
    let segmentCount = 0;

    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const match = line.match(/#EXTINF:([\d.]+)/);
        if (match) {
          totalDuration += parseFloat(match[1]);
          segmentCount++;
        }
      }
    }

    info.duration = totalDuration;
    info.segments = segmentCount;
  }

  return info;
}

/**
 * 解析 m3u8 属性
 */
function parseM3u8Attributes(line) {
  const attrs = {};
  const match = line.match(/([A-Z-]+)=(?:"([^"]+)"|([^,]+))/g);
  if (match) {
    match.forEach(m => {
      const [key, value] = m.split('=');
      attrs[key] = value.replace(/"/g, '');
    });
  }
  return attrs;
}

/**
 * 解析相对 URL
 */
function resolveUrl(url, baseUrl) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  try {
    const base = new URL(baseUrl);
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/**
 * 显示 m3u8 信息
 */
function displayM3u8Info(mediaInfo, info) {
  // 清空
  mediaInfo.innerHTML = '';

  if (info.isMaster) {
    // Master playlist - 显示所有变体
    appendMediaInfo(mediaInfo, '类型', 'Master Playlist');
    appendMediaInfo(mediaInfo, '清晰度', `${info.variants.length} 个变体`);

    info.variants.forEach((v, i) => {
      const resolution = v.resolution ? v.resolution.replace('x', '×') : '';
      const bitrate = v.bandwidth > 0 ? formatBitrate(v.bandwidth) : '';
      const quality = resolution ? getQualityLabel(resolution) : `流 ${i + 1}`;
      const infoStr = [resolution, bitrate].filter(Boolean).join(' ');
      appendMediaInfo(mediaInfo, quality, infoStr || '未知');
    });
  } else {
    // Media playlist - 显示时长和分片数
    appendMediaInfo(mediaInfo, '类型', 'Media Playlist');
    if (info.duration > 0) {
      appendMediaInfo(mediaInfo, '时长', formatDuration(info.duration));
    }
    if (info.segments > 0) {
      appendMediaInfo(mediaInfo, '分片数', `${info.segments} 个`);

      // 估算大小（假设 2Mbps 码率）
      if (info.duration > 0) {
        const estimatedSize = (2000000 / 8) * info.duration;
        appendMediaInfo(mediaInfo, '估算大小', `~${formatSize(estimatedSize)} (假设 2Mbps)`);
      }
    }
  }
}

/**
 * 追加媒体信息
 */
function appendMediaInfo(container, label, value) {
  // 检查是否已存在该标签
  const existing = container.querySelector(`[data-label="${label}"]`);
  if (existing) {
    existing.querySelector('.info-value').textContent = value;
    return;
  }

  const infoItem = document.createElement('div');
  infoItem.className = 'info-item';
  infoItem.setAttribute('data-label', label);
  infoItem.innerHTML = `<span class="info-label">${label}:</span> <span class="info-value">${value}</span>`;
  container.appendChild(infoItem);
}

/**
 * 更新选中计数
 */
function updateSelectedCount() {
  elements.selectedCount.textContent = selectedIndices.size;
  elements.btnSend.disabled = selectedIndices.size === 0 || !serverConfig.server;
}

/**
 * 处理发送下载任务
 */
async function handleSend() {
  if (selectedIndices.size === 0) return;

  if (!serverConfig.server || !serverConfig.username || !serverConfig.password) {
    showToast('请先配置服务器', 'error');
    chrome.runtime.openOptionsPage();
    return;
  }

  // 重新加载最新的代理配置
  await loadConfig();

  const selectedResources = Array.from(selectedIndices).map(i => resources[i]);

  elements.btnSend.disabled = true;
  elements.btnSend.querySelector('.btn-label').textContent = '发送中...';

  let successCount = 0;
  let failCount = 0;

  for (const resource of selectedResources) {
    try {
      // 只提取 Referer 头
      const headers = parseHeaders(resource.headers);
      const referer = headers['Referer'] || headers['referer'] || '';

      const task = {
        url: resource.url,
        output_name: generateOutputName(resource),
        headers: referer ? `Referer: ${referer}` : '',
        auto_select: true,
        thread_count: 32,
        retry_count: 15
      };

      // 添加代理配置
      if (proxyConfig.enable && proxyConfig.host && proxyConfig.port) {
        let proxyUrl = `${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`;
        if (proxyConfig.auth && proxyConfig.username) {
          const auth = proxyConfig.password
            ? `${proxyConfig.username}:${proxyConfig.password}`
            : proxyConfig.username;
          proxyUrl = `${proxyConfig.type}://${auth}@${proxyConfig.host}:${proxyConfig.port}`;
        }
        task.custom_proxy = proxyUrl;
      }

      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'sendTask',
            server: serverConfig.server,
            auth: {
              username: serverConfig.username,
              password: serverConfig.password
            },
            task: task
          },
          resolve
        );
      });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.error('Failed to send task:', result.error);
      }
    } catch (e) {
      failCount++;
      console.error('Error sending task:', e);
    }
  }

  elements.btnSend.disabled = false;
  elements.btnSend.querySelector('.btn-label').textContent = '发送到远程下载';

  if (failCount === 0) {
    showToast(`成功发送 ${successCount} 个任务`, 'success');
  } else {
    showToast(`${successCount} 成功，${failCount} 失败`, 'error');
  }
}

/**
 * 处理翻译标题
 */
async function handleTranslate() {
  if (isTranslating) return;

  if (!aiTranslateConfig.enable || !aiTranslateConfig.baseUrl || !aiTranslateConfig.modelId || !aiTranslateConfig.apiKey) {
    showToast('请先配置 AI 翻译', 'error');
    chrome.runtime.openOptionsPage();
    return;
  }

  // 获取需要翻译的资源（已选中的或全部）
  const indicesToTranslate = selectedIndices.size > 0
    ? Array.from(selectedIndices)
    : resources.map((_, i) => i);

  if (indicesToTranslate.length === 0) {
    showToast('没有需要翻译的资源', 'error');
    return;
  }

  isTranslating = true;
  const btnTranslate = document.getElementById('btnTranslate');
  if (btnTranslate) {
    btnTranslate.disabled = true;
    btnTranslate.querySelector('.btn-label').textContent = '翻译中...';
  }

  let successCount = 0;
  let failCount = 0;

  for (const index of indicesToTranslate) {
    const resource = resources[index];
    if (!resource) continue;

    const title = resource.title || getFileName(resource.url);
    if (!title) continue;

    try {
      console.log(`[翻译] 开始翻译 #${index}: "${title}"`);
      const translatedTitle = await callAiTranslate(title);

      // 验证翻译结果
      if (!translatedTitle || translatedTitle.trim() === '') {
        console.error(`[翻译] #${index} 翻译结果为空`);
        failCount++;
        continue;
      }

      // 保存原始标题和翻译后的标题
      if (!resource.originalTitle) {
        resource.originalTitle = title;
      }
      resource.translatedTitle = translatedTitle;
      successCount++;
      console.log(`[翻译] #${index} 成功: "${title}" → "${translatedTitle}"`);
    } catch (e) {
      console.error(`[翻译] #${index} 失败:`, e.message);
      failCount++;
    }
  }

  // 重新渲染资源列表
  console.log('[翻译] 翻译完成，重新渲染资源列表');
  console.log('[翻译] 成功:', successCount, '失败:', failCount);
  renderResources();

  isTranslating = false;
  if (btnTranslate) {
    btnTranslate.disabled = false;
    btnTranslate.querySelector('.btn-label').textContent = '翻译';
  }

  if (failCount === 0) {
    showToast(`成功翻译 ${successCount} 个标题`, 'success');
  } else {
    showToast(`${successCount} 成功，${failCount} 失败`, 'error');
  }
}

/**
 * 调用 AI 翻译 API
 */
async function callAiTranslate(text) {
  const url = `${aiTranslateConfig.baseUrl}/v1/chat/completions`;

  const prompt = aiTranslateConfig.prompt.replace('{text}', text);

  console.log('[翻译] 请求 URL:', url);
  console.log('[翻译] 请求内容:', prompt.substring(0, 100) + '...');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiTranslateConfig.apiKey}`
    },
    body: JSON.stringify({
      model: aiTranslateConfig.modelId,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })
  });

  console.log('[翻译] 响应状态:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[翻译] API 错误:', errorData);
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log('[翻译] API 响应:', JSON.stringify(data).substring(0, 200));

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('[翻译] 无效的 API 响应:', data);
    throw new Error('无效的 API 响应');
  }

  const result = data.choices[0].message.content.trim();
  console.log('[翻译] 翻译结果:', result);

  if (!result) {
    throw new Error('翻译结果为空');
  }

  return result;
}

/**
 * 生成输出文件名
 */
function generateOutputName(resource) {
  let name = '';

  // 优先使用翻译后的标题
  if (resource.translatedTitle && resource.translatedTitle.trim()) {
    name = resource.translatedTitle.trim();
  } else if (resource.title && resource.title.trim()) {
    name = resource.title.trim();
  } else {
    name = getFileName(resource.url);
    name = name.replace(/\.[^.]+$/, '');
  }

  name = name.replace(/[<>:"/\\|?*]/g, '_');
  name = name.replace(/^[\s.]+|[\s.]+$/g, '');

  if (name.length > 50) {
    name = name.substring(0, 50);
  }

  return name || 'media';
}

/**
 * 从 URL 提取文件名
 */
function getFileName(url) {
  try {
    const urlObj = new URL(url);
    let pathName = urlObj.pathname;
    let name = pathName.split('/').filter(Boolean).pop() || 'media';
    try { name = decodeURIComponent(name); } catch {}
    return name;
  } catch {
    return 'media';
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * 格式化时长
 */
function formatDuration(seconds) {
  if (!seconds || seconds === Infinity) return '未知';
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return `${h}时${m}分${s}秒`;
}

/**
 * 格式化码率
 */
function formatBitrate(bps) {
  if (!bps) return '未知';
  if (bps >= 1000000) return (bps / 1000000).toFixed(2) + ' Mbps';
  if (bps >= 1000) return (bps / 1000).toFixed(0) + ' kbps';
  return bps + ' bps';
}

/**
 * 根据分辨率获取清晰度标签
 */
function getQualityLabel(resolution) {
  if (!resolution) return '未知';
  const parts = resolution.split(/[×x]/);
  const height = parseInt(parts[1]);
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  if (height >= 1080) return '1080P';
  if (height >= 720) return '720P';
  if (height >= 480) return '480P';
  if (height >= 360) return '360P';
  return `${height}P`;
}

/**
 * 解析请求头字符串
 */
function parseHeaders(headerStr) {
  const headers = {};
  if (!headerStr) return headers;
  headerStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      headers[key.trim()] = valueParts.join(':').trim();
    }
  });
  return headers;
}

/**
 * 复制到剪贴板
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * HTML 转义
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type = '') {
  elements.toast.textContent = message;
  elements.toast.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => {
    elements.toast.className = 'toast';
  }, 2000);
}

/**
 * 清理资源
 */
function cleanupResources() {
  // 预留清理逻辑
}

// 初始化
init();
