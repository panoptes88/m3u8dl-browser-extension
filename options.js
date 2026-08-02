/**
 * m3u8DL Sniffer - Options Script
 */

// DOM 元素
const elements = {
  server: document.getElementById('server'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  threadCount: document.getElementById('threadCount'),
  retryCount: document.getElementById('retryCount'),
  autoSelect: document.getElementById('autoSelect'),
  btnTest: document.getElementById('btnTest'),
  btnSave: document.getElementById('btnSave'),
  testResult: document.getElementById('testResult'),
  saveResult: document.getElementById('saveResult'),
  extGrid: document.getElementById('extGrid'),
  proxyEnable: document.getElementById('proxyEnable'),
  proxySettings: document.getElementById('proxySettings'),
  proxyType: document.getElementById('proxyType'),
  proxyHost: document.getElementById('proxyHost'),
  proxyPort: document.getElementById('proxyPort'),
  proxyAuth: document.getElementById('proxyAuth'),
  proxyAuthSettings: document.getElementById('proxyAuthSettings'),
  proxyUsername: document.getElementById('proxyUsername'),
  proxyPassword: document.getElementById('proxyPassword')
};

// 默认支持的资源类型
const DEFAULT_EXTENSIONS = [
  { ext: 'm3u8', label: 'M3U8', enabled: true },
  { ext: 'mp4', label: 'MP4', enabled: true },
  { ext: 'ts', label: 'TS', enabled: true },
  { ext: 'm4s', label: 'M4S', enabled: true },
  { ext: 'm4a', label: 'M4A', enabled: true },
  { ext: 'mpd', label: 'MPD', enabled: true },
  { ext: 'flv', label: 'FLV', enabled: true },
  { ext: 'webm', label: 'WebM', enabled: true },
  { ext: 'mp3', label: 'MP3', enabled: true },
  { ext: 'wav', label: 'WAV', enabled: true },
  { ext: 'ogg', label: 'OGG', enabled: true },
  { ext: 'aac', label: 'AAC', enabled: true },
  { ext: 'mkv', label: 'MKV', enabled: true },
  { ext: 'mov', label: 'MOV', enabled: true },
  { ext: 'avi', label: 'AVI', enabled: true }
];

/**
 * 初始化 - 加载已保存的配置
 */
async function init() {
  const config = await loadConfig();

  // 填充表单
  elements.server.value = config.server || '';
  elements.username.value = config.username || '';
  elements.password.value = config.password || '';
  elements.threadCount.value = config.threadCount || 32;
  elements.retryCount.value = config.retryCount || 15;
  elements.autoSelect.checked = config.autoSelect !== false;

  // 代理配置
  elements.proxyEnable.checked = config.proxyEnable || false;
  elements.proxyType.value = config.proxyType || 'http';
  elements.proxyHost.value = config.proxyHost || '';
  elements.proxyPort.value = config.proxyPort || '';
  elements.proxyAuth.checked = config.proxyAuth || false;
  elements.proxyUsername.value = config.proxyUsername || '';
  elements.proxyPassword.value = config.proxyPassword || '';

  // 显示/隐藏代理设置
  toggleProxySettings();
  toggleProxyAuthSettings();

  // 渲染资源类型网格
  renderExtGrid(config.enabledExtensions);

  // 绑定事件
  bindEvents();
}

/**
 * 加载配置
 */
function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['server', 'username', 'password', 'threadCount', 'retryCount', 'autoSelect', 'enabledExtensions',
       'proxyEnable', 'proxyType', 'proxyHost', 'proxyPort', 'proxyAuth', 'proxyUsername', 'proxyPassword'],
      function(data) {
        resolve(data);
      }
    );
  });
}

/**
 * 渲染资源类型网格
 */
function renderExtGrid(enabledExtensions) {
  // 如果没有保存过配置，使用默认值
  const enabledSet = new Set(enabledExtensions || DEFAULT_EXTENSIONS.filter(e => e.enabled).map(e => e.ext));

  const html = DEFAULT_EXTENSIONS.map(item => {
    const isChecked = enabledSet.has(item.ext);
    return `
      <div class="ext-item">
        <input type="checkbox" id="ext_${item.ext}" value="${item.ext}" ${isChecked ? 'checked' : ''}>
        <label for="ext_${item.ext}">${item.label}</label>
      </div>
    `;
  }).join('');

  elements.extGrid.innerHTML = html;
}

/**
 * 保存配置
 */
function saveConfig() {
  // 获取启用的扩展名
  const enabledExtensions = [];
  elements.extGrid.querySelectorAll('input[type="checkbox"]:checked').forEach(function(checkbox) {
    enabledExtensions.push(checkbox.value);
  });

  const config = {
    server: elements.server.value.trim().replace(/\/+$/, ''), // 移除末尾斜杠
    username: elements.username.value.trim(),
    password: elements.password.value,
    threadCount: parseInt(elements.threadCount.value) || 32,
    retryCount: parseInt(elements.retryCount.value) || 15,
    autoSelect: elements.autoSelect.checked,
    enabledExtensions: enabledExtensions,
    // 代理配置
    proxyEnable: elements.proxyEnable.checked,
    proxyType: elements.proxyType.value,
    proxyHost: elements.proxyHost.value.trim(),
    proxyPort: parseInt(elements.proxyPort.value) || 0,
    proxyAuth: elements.proxyAuth.checked,
    proxyUsername: elements.proxyUsername.value.trim(),
    proxyPassword: elements.proxyPassword.value
  };

  return new Promise((resolve) => {
    chrome.storage.sync.set(config, function() {
      resolve(config);
    });
  });
}

/**
 * 切换代理设置显示
 */
function toggleProxySettings() {
  if (elements.proxyEnable.checked) {
    elements.proxySettings.classList.remove('hide');
  } else {
    elements.proxySettings.classList.add('hide');
  }
}

/**
 * 切换代理认证设置显示
 */
function toggleProxyAuthSettings() {
  if (elements.proxyAuth.checked) {
    elements.proxyAuthSettings.classList.remove('hide');
  } else {
    elements.proxyAuthSettings.classList.add('hide');
  }
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 测试连接按钮
  elements.btnTest.addEventListener('click', handleTest);

  // 保存按钮
  elements.btnSave.addEventListener('click', handleSave);

  // 代理启用切换
  elements.proxyEnable.addEventListener('change', toggleProxySettings);

  // 代理认证切换
  elements.proxyAuth.addEventListener('change', toggleProxyAuthSettings);
}

/**
 * 测试服务器连接
 */
async function handleTest() {
  const server = elements.server.value.trim();
  const username = elements.username.value.trim();
  const password = elements.password.value;

  if (!server) {
    showTestResult('请输入服务器地址', 'error');
    return;
  }

  if (!username || !password) {
    showTestResult('请输入用户名和密码', 'error');
    return;
  }

  // 禁用按钮
  elements.btnTest.disabled = true;
  elements.btnTest.textContent = '测试中...';

  try {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'testConnection',
          server: server,
          username: username,
          password: password
        },
        resolve
      );
    });

    if (result.success) {
      showTestResult(`连接成功！用户: ${result.user.username || username}`, 'success');
    } else {
      showTestResult(`连接失败: ${result.error}`, 'error');
    }
  } catch (e) {
    showTestResult(`连接错误: ${e.message}`, 'error');
  } finally {
    elements.btnTest.disabled = false;
    elements.btnTest.textContent = '测试连接';
  }
}

/**
 * 保存配置
 */
async function handleSave() {
  const config = await saveConfig();
  showSaveResult('配置已保存');
}

/**
 * 显示测试结果
 */
function showTestResult(message, type) {
  elements.testResult.textContent = message;
  elements.testResult.className = 'test-result ' + type;
}

/**
 * 显示保存提示
 */
function showSaveResult(message) {
  elements.saveResult.textContent = message;
  elements.saveResult.className = 'save-result show success';
  setTimeout(() => {
    elements.saveResult.className = 'save-result';
  }, 2000);
}

// 初始化
init();
