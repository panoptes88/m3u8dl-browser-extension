/**
 * m3u8DL Sniffer - Background Service Worker
 * 嗅探网页媒体资源
 */

// 全局状态
const state = {
  // 按 tabId 分组存储嗅探到的资源
  tabResources: new Map(),
  // 临时存储请求头
  requestHeaders: new Map(),
  // 已处理的 requestId 集合（去重）
  processedRequests: new Set(),
  // 启用的扩展名列表（默认全部启用）
  enabledExtensions: null
};

// 加载启用的扩展名配置
async function loadEnabledExtensions() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['enabledExtensions'], function(data) {
      if (data.enabledExtensions && data.enabledExtensions.length > 0) {
        state.enabledExtensions = new Set(data.enabledExtensions);
      } else {
        // 默认全部启用
        state.enabledExtensions = new Set([
          'm3u8', 'mp4', 'ts', 'm4s', 'm4a', 'mpd', 'flv', 'webm',
          'mp3', 'wav', 'ogg', 'aac', 'mkv', 'mov', 'avi'
        ]);
      }
      resolve();
    });
  });
}

// 初始化时加载配置
loadEnabledExtensions();

// 监听配置变化
chrome.storage.onChanged.addListener(function(changes) {
  if (changes.enabledExtensions) {
    loadEnabledExtensions();
  }
});

// 媒体类型匹配
const MEDIA_TYPES = [
  'video/', 'audio/',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'application/mpegurl',
  'application/dash+xml',
  'application/octet-stream'
];

// M3U8 相关 Content-Type（用于检测非标准扩展名的 m3u8）
const M3U8_CONTENT_TYPES = [
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'application/mpegurl',
  'audio/mpegurl',
  'audio/x-mpegurl',
  'video/mp2t'  // TS 文件
];

// 可能是 m3u8 的扩展名（需要进一步检查 Content-Type）
const MAYBE_M3U8_EXTENSIONS = /\.(txt|json|m3u8|html|htm)(\?|$|#)/i;

// 媒体扩展名匹配
const MEDIA_EXTENSIONS = /\.(m3u8|m3u|mp4|m4s|m4a|m4v|ts|f4v|flv|webm|mpd|mp3|wav|ogg|ogv|aac|mov|mkv|avi|wmv)(\?|$|#)/i;

// 忽略的 URL 模式
const IGNORE_PATTERNS = [
  /^https?:\/\/.*\.facebook\.com\//i,
  /^https?:\/\/.*\.fbcdn\.net\//i,
  /^https?:\/\/.*\.twitter\.com\//i,
  /^https?:\/\/.*\.twimg\.com\//i,
  /^https?:\/\/.*\.googlevideo\.com\/videoplayback.*ratebypass/i,
  /^data:/i,
  /^blob:/i,
  /^chrome-extension:\/\//i
];

/**
 * 检查 URL 是否应该被忽略
 */
function shouldIgnoreUrl(url) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * 从 URL 提取文件扩展名
 */
function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : '';
  } catch {
    return '';
  }
}

/**
 * 从 Content-Type 推断扩展名
 */
function getExtFromContentType(contentType) {
  if (!contentType) return '';
  const ct = contentType.toLowerCase();
  if (ct.includes('mpegurl') || ct.includes('m3u8')) return 'm3u8';
  if (ct.includes('video/mp4')) return 'mp4';
  if (ct.includes('video/webm')) return 'webm';
  if (ct.includes('audio/mp4')) return 'm4a';
  if (ct.includes('audio/mpeg')) return 'mp3';
  if (ct.includes('video/mp2t')) return 'ts';
  if (ct.includes('application/dash+xml')) return 'mpd';
  if (ct.includes('video/x-flv')) return 'flv';
  if (ct.includes('video/quicktime')) return 'mov';
  if (ct.includes('video/x-msvideo') || ct.includes('video/avi')) return 'avi';
  if (ct.includes('video/x-matroska')) return 'mkv';
  if (ct.includes('audio/ogg') || ct.includes('video/ogg')) return 'ogg';
  if (ct.includes('audio/aac')) return 'aac';
  if (ct.includes('audio/wav')) return 'wav';
  return '';
}

/**
 * 检查扩展名是否启用
 */
function isExtensionEnabled(ext) {
  if (!ext) return true;
  if (!state.enabledExtensions) return true;
  return state.enabledExtensions.has(ext.toLowerCase());
}

/**
 * 判断是否为媒体资源
 */
function isMediaResource(url, contentType) {
  if (shouldIgnoreUrl(url)) return false;

  const ext = getExtensionFromUrl(url);
  const contentTypeExt = getExtFromContentType(contentType);

  // 特殊处理：.txt/.json 等扩展名但 Content-Type 是 m3u8
  // 这种情况需要优先检查，不能被扩展名过滤掉
  if (ext && MAYBE_M3U8_EXTENSIONS.test('.' + ext)) {
    if (contentType) {
      const ct = contentType.toLowerCase();
      if (M3U8_CONTENT_TYPES.some(type => ct.includes(type))) {
        // Content-Type 是 m3u8，检查 m3u8 是否启用
        return isExtensionEnabled('m3u8');
      }
    }
    // 既不是 m3u8 Content-Type，也不是媒体扩展名，跳过
    return false;
  }

  // 先检查扩展名是否启用
  const detectedExt = ext || contentTypeExt;
  if (detectedExt && !isExtensionEnabled(detectedExt)) return false;

  // 检查 Content-Type 是否为媒体类型
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (MEDIA_TYPES.some(type => ct.includes(type))) return true;
  }

  // 检查 URL 扩展名是否为媒体
  if (MEDIA_EXTENSIONS.test(url)) return true;

  return false;
}

/**
 * 从 URL 生成文件名
 */
function generateFileName(url, ext) {
  try {
    const urlObj = new URL(url);
    let pathName = urlObj.pathname;
    // 取路径最后一段作为文件名
    let name = pathName.split('/').filter(Boolean).pop() || 'media';
    // 解码 URL 编码的中文
    try { name = decodeURIComponent(name); } catch {}
    // 如果没有扩展名，添加一个
    if (ext && !name.match(/\.[a-z0-9]+$/i)) {
      name += '.' + ext;
    }
    return name;
  } catch {
    return 'media.' + (ext || 'mp4');
  }
}

/**
 * 提取请求头中的关键信息
 */
function extractHeaders(requestHeaders) {
  if (!requestHeaders) return '';
  const headers = {};
  const importantHeaders = ['referer', 'origin', 'cookie', 'user-agent', 'authorization'];

  for (const header of requestHeaders) {
    const name = header.name.toLowerCase();
    if (importantHeaders.includes(name) || name.startsWith('x-')) {
      headers[header.name] = header.value;
    }
  }

  const result = Object.keys(headers).length > 0
    ? Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')
    : '';

  if (result) {
    console.log('[m3u8DL] 提取到 headers:', result);
  }

  return result;
}

/**
 * 添加资源到指定 tab
 */
function addResource(tabId, resource) {
  if (!state.tabResources.has(tabId)) {
    state.tabResources.set(tabId, new Map());
  }

  const resources = state.tabResources.get(tabId);
  const key = resource.url.split('?')[0]; // 用 URL 路径部分去重

  if (!resources.has(key)) {
    resources.set(key, resource);
    // 通知 popup 更新（如果打开的话）
    chrome.runtime.sendMessage({
      type: 'resourceAdded',
      tabId,
      resource
    }).catch(() => {});
  }
}

// 监听请求头
chrome.webRequest.onSendHeaders.addListener(
  function(details) {
    if (details.requestHeaders) {
      state.requestHeaders.set(details.requestId, details.requestHeaders);
    }
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', chrome.webRequest.OnBeforeSendHeadersOptions.EXTRA_HEADERS].filter(Boolean)
);

// 监听响应
chrome.webRequest.onResponseStarted.addListener(
  function(details) {
    try {
      const url = details.url;
      if (shouldIgnoreUrl(url)) return;

      // 获取 Content-Type
      let contentType = '';
      if (details.responseHeaders) {
        const ctHeader = details.responseHeaders.find(
          h => h.name.toLowerCase() === 'content-type'
        );
        if (ctHeader) contentType = ctHeader.value || '';
      }

      // 判断是否为媒体资源
      if (!isMediaResource(url, contentType)) return;

      // 获取请求头
      const requestHeaders = state.requestHeaders.get(details.requestId);
      const headersStr = extractHeaders(requestHeaders);
      state.requestHeaders.delete(details.requestId);

      // 获取文件大小
      let size = 0;
      if (details.responseHeaders) {
        const clHeader = details.responseHeaders.find(
          h => h.name.toLowerCase() === 'content-length'
        );
        if (clHeader) size = parseInt(clHeader.value) || 0;
      }

      // 推断扩展名
      let ext = getExtFromContentType(contentType) || getExtensionFromUrl(url);

      // 特殊处理：如果 URL 是 .txt 但 Content-Type 是 m3u8，标记为 m3u8
      const urlExt = getExtensionFromUrl(url);
      if (urlExt && MAYBE_M3U8_EXTENSIONS.test('.' + urlExt) && ext === 'm3u8') {
        // 已经通过 Content-Type 推断为 m3u8，保持不变
      }

      // 生成资源对象
      const resource = {
        url: url,
        ext: ext,
        size: size,
        contentType: contentType,
        headers: headersStr,
        tabId: details.tabId,
        title: '',
        timestamp: Date.now()
      };

      // 尝试从 tab 获取标题
      if (details.tabId > 0) {
        chrome.tabs.get(details.tabId, function(tab) {
          if (chrome.runtime.lastError) return;
          if (tab && tab.title) {
            resource.title = tab.title;
          }
          addResource(details.tabId, resource);
        });
      } else {
        addResource(details.tabId, resource);
      }
    } catch (e) {
      console.error('Error processing response:', e);
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// 清理失败请求的请求头
chrome.webRequest.onErrorOccurred.addListener(
  function(details) {
    state.requestHeaders.delete(details.requestId);
  },
  { urls: ['<all_urls>'] }
);

// Tab 关闭时清理资源
chrome.tabs.onRemoved.addListener(function(tabId) {
  state.tabResources.delete(tabId);
});

// 页面导航时清理资源（刷新或跳转）
chrome.webNavigation.onCommitted.addListener(function(details) {
  // 只处理主框架（frameId === 0）的刷新或跳转
  if (details.frameId === 0 && details.tabId > 0) {
    // 刷新：reload
    // 跳转：typed, link, auto_bookmark, auto_subframe, manual_subframe, generated, auto_toplevel, form_submit, keyword, keyword_generated
    const transitionTypes = ['reload', 'link', 'typed', 'form_submit', 'auto_bookmark', 'generated'];
    if (transitionTypes.includes(details.transitionType)) {
      state.tabResources.delete(details.tabId);
      console.log('[m3u8DL] 页面刷新/跳转，清除资源:', details.tabId);
    }
  }
});

// Tab 标题变化时更新资源标题
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.title && state.tabResources.has(tabId)) {
    const resources = state.tabResources.get(tabId);
    resources.forEach(function(resource) {
      if (!resource.title) {
        resource.title = changeInfo.title;
      }
    });
  }
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'getResources') {
    const tabId = message.tabId;
    const resources = state.tabResources.get(tabId) || new Map();
    sendResponse({
      resources: Array.from(resources.values())
    });
    return true;
  }

  if (message.type === 'clearResources') {
    const tabId = message.tabId;
    state.tabResources.delete(tabId);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'testConnection') {
    // 测试服务器连接
    testServerConnection(message.server, message.username, message.password)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'sendTask') {
    // 发送下载任务
    sendDownloadTask(message.server, message.auth, message.task)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'fetchM3u8') {
    // 代理获取 m3u8 内容
    fetchM3u8Content(message.url, message.headers)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'setRequestHeaders') {
    // 设置请求头
    setRequestHeaders(message.headers)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'clearRequestHeaders') {
    // 清除请求头
    clearRequestHeaders()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * 登录服务器并获取 auth_token
 */
async function loginAndSaveCookie(server, username, password) {
  try {
    // 确保 server 地址格式正确
    const serverUrl = server.replace(/\/+$/, ''); // 移除末尾斜杠
    const loginUrl = `${serverUrl}/api/auth/login`;
    console.log('[m3u8DL] 尝试登录:', loginUrl);
    console.log('[m3u8DL] 服务器地址:', serverUrl);

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    console.log('[m3u8DL] 登录响应状态:', response.status);
    console.log('[m3u8DL] 响应 Content-Type:', response.headers.get('content-type'));

    // 获取响应文本以便调试
    const responseText = await response.text();
    console.log('[m3u8DL] 响应内容前200字符:', responseText.substring(0, 200));

    if (!response.ok) {
      try {
        const err = JSON.parse(responseText);
        return { success: false, error: err.error || `登录失败 (${response.status})` };
      } catch {
        return { success: false, error: `服务器返回非 JSON 响应 (${response.status})` };
      }
    }

    // 解析成功响应
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return { success: false, error: '服务器返回无效的 JSON 响应' };
    }
    console.log('[m3u8DL] 登录成功:', data);

    // 等待一小段时间让浏览器处理 Set-Cookie
    await new Promise(resolve => setTimeout(resolve, 300));

    // 通过 chrome.cookies API 获取 auth_token
    const parsedUrl = new URL(serverUrl);
    const cookies = await chrome.cookies.getAll({
      domain: parsedUrl.hostname,
      name: 'auth_token'
    });

    console.log('[m3u8DL] 获取到 cookies:', cookies.length);

    let token = null;
    if (cookies.length > 0) {
      token = cookies[0].value;
      // 保存到 storage 以便后续使用
      await chrome.storage.local.set({ authToken: token });
      console.log('[m3u8DL] auth_token 已保存');
    } else {
      console.warn('[m3u8DL] 未找到 auth_token cookie');
    }

    return { success: true, user: data, token: token };
  } catch (e) {
    console.error('[m3u8DL] 登录异常:', e);
    return { success: false, error: '无法连接到服务器: ' + e.message };
  }
}

/**
 * 获取保存的 auth_token
 */
async function getAuthToken(server) {
  const serverUrl = server.replace(/\/+$/, '');
  const parsedUrl = new URL(serverUrl);

  // 先从 chrome.cookies 获取
  const cookies = await chrome.cookies.getAll({
    domain: parsedUrl.hostname,
    name: 'auth_token'
  });

  if (cookies.length > 0) {
    return cookies[0].value;
  }

  // 从 storage 获取
  const data = await chrome.storage.local.get(['authToken']);
  return data.authToken || null;
}

/**
 * 测试服务器连接
 */
async function testServerConnection(server, username, password) {
  return await loginAndSaveCookie(server, username, password);
}

/**
 * 发送下载任务到远程服务器
 */
async function sendDownloadTask(server, auth, task) {
  try {
    // 先登录获取 cookie
    const loginResult = await loginAndSaveCookie(server, auth.username, auth.password);
    if (!loginResult.success) {
      return loginResult;
    }

    // 获取 token
    const token = loginResult.token || await getAuthToken(server);

    // 创建任务 - 手动携带 Cookie 头
    const serverUrl = server.replace(/\/+$/, '');
    const taskUrl = `${serverUrl}/api/tasks`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Cookie'] = `auth_token=${token}`;
    }

    const taskResp = await fetch(taskUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(task)
    });

    if (taskResp.ok) {
      const data = await taskResp.json();
      return { success: true, task: data };
    } else {
      const err = await taskResp.json().catch(() => ({}));
      return { success: false, error: err.error || '创建任务失败' };
    }
  } catch (e) {
    return { success: false, error: '请求失败: ' + e.message };
  }
}

/**
 * 代理获取 m3u8 内容
 * 通过 background 发起请求，可以设置 Referer 头
 */
async function fetchM3u8Content(url, headers) {
  try {
    const fetchOptions = {
      method: 'GET',
      mode: 'cors'
    };

    // 设置请求头
    if (headers) {
      fetchOptions.headers = {};
      for (const [key, value] of Object.entries(headers)) {
        fetchOptions.headers[key] = value;
      }
    }

    console.log('[m3u8DL] 代理请求:', url, headers);

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    console.log('[m3u8DL] 代理响应:', contentType, text.substring(0, 200));

    return { success: true, data: text, contentType: contentType };
  } catch (e) {
    console.error('[m3u8DL] 代理请求失败:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 设置请求头（使用 declarativeNetRequest）
 * 参考猫爪实现
 */
async function setRequestHeaders(headers) {
  return new Promise((resolve) => {
    // 先清除旧规则
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1] }, function() {
      if (!headers || Object.keys(headers).length === 0) {
        resolve();
        return;
      }

      // 添加新规则
      const rules = {
        addRules: [{
          id: 1,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: Object.keys(headers).map(key => ({
              header: key,
              operation: "set",
              value: headers[key]
            }))
          },
          condition: {
            resourceTypes: ["xmlhttprequest", "media"]
          }
        }],
        removeRuleIds: [1]
      };

      chrome.declarativeNetRequest.updateSessionRules(rules, function() {
        console.log('[m3u8DL] 已设置请求头:', headers);
        resolve();
      });
    });
  });
}

/**
 * 清除请求头规则
 */
async function clearRequestHeaders() {
  return new Promise((resolve) => {
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1] }, function() {
      resolve();
    });
  });
}

console.log('m3u8DL Sniffer background loaded');
