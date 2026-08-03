# AGENTS.md

本文件面向 AI 编码助手，介绍本项目（m3u8DL-Sniffer）的结构与开发约定。

## 项目概述

**m3u8DL-Sniffer** 是一个 Chrome 浏览器扩展（Manifest V3），功能是嗅探网页中的视频/音频媒体资源（M3U8、MP4、MPD 等），并将选中的资源一键发送到 **N_m3u8DL-RE-WEB-UI** 远程下载服务器。设计参考了「猫爪」(cat-catch) 扩展的实现方式。

- 无构建系统、无 npm/package.json、无测试框架：纯原生 HTML/CSS/JavaScript，直接在 Chrome 中以「加载已解压的扩展程序」方式运行。
- 唯一的第三方依赖是 `lib/hls.min.js`（hls.js，用于 popup 中预览 HLS 流），以本地文件方式引入。
- 代码注释、UI 文案、README 均使用**中文**，请保持这一惯例。

## 目录结构与模块划分

```
manifest.json      # MV3 清单：权限、service worker、popup、options 页
background.js      # 后台 Service Worker：嗅探逻辑 + 与远程服务器通信
popup.html/.js/.css  # 弹窗 UI：展示嗅探到的资源、预览、发送下载任务
options.html/.js/.css # 设置页：服务器、嗅探类型、代理、下载参数配置
lib/hls.min.js     # hls.js 第三方库（请勿修改）
icons/             # 扩展图标
images/            # README 用截图
```

### 各模块职责

- **`background.js`（核心）**
  - 通过 `chrome.webRequest.onSendHeaders` / `onResponseStarted` 嗅探媒体请求，按 `tabId` 分组存入内存 `state.tabResources`（Map），以 URL 路径部分（去掉 query）去重。
  - 媒体判定逻辑：`isMediaResource()` 结合 URL 扩展名（`MEDIA_EXTENSIONS`）和响应 `Content-Type`（`MEDIA_TYPES`），并特殊处理扩展名为 `.txt/.json` 但 Content-Type 是 m3u8 的情况（`MAYBE_M3U8_EXTENSIONS`）。`IGNORE_PATTERNS` 排除 Facebook/Twitter 等站点及 `data:`/`blob:` URL。
  - 通过 `chrome.runtime.onMessage` 向 popup/options 提供消息接口：`getResources`、`clearResources`、`testConnection`、`sendTask`、`fetchM3u8`、`setRequestHeaders`、`clearRequestHeaders`。
  - 与服务器交互：先 `POST {server}/api/auth/login` 登录，从 `auth_token` cookie（或 `chrome.storage.local` 兜底）取 token，再带 `Cookie` 头 `POST {server}/api/tasks` 创建下载任务。
  - 使用 `chrome.declarativeNetRequest` 会话规则（规则 id 固定为 1）为预览请求注入 Referer 等请求头。

- **`popup.js`**
  - 从 background 拉取当前 tab 的资源列表并渲染；支持勾选、全选、复制链接、清空。
  - m3u8 资源支持预览：优先用 hls.js 播放（先通过 `setRequestHeaders` 注入 Referer），失败时回退到「解析模式」——经 background 代理（`fetchM3u8`）拉取 m3u8 文本并手工解析 master/media playlist（`parseM3u8Content`）。
  - 发送任务时构造 `{ url, output_name, headers(仅Referer), auto_select, thread_count, retry_count, custom_proxy? }`。

- **`options.js`**
  - 读写 `chrome.storage.sync` 中的配置：`server`、`username`、`password`、`enabledExtensions`、`proxy*`（代理类型/地址/端口/认证）、`threadCount`、`retryCount`、`autoSelect`。
  - 「测试连接」通过 background 的 `testConnection` 消息完成。

## 开发、调试与测试

- **没有构建/打包/自动化测试命令。** 任何修改后的验证方式：
  1. 打开 `chrome://extensions/`，开启「开发者模式」；
  2. 「加载已解压的扩展程序」选择本目录（首次），或点击扩展卡片上的刷新按钮（修改后）；
  3. 实际打开含视频的网页播放，点扩展图标验证嗅探结果。
- **调试**：在 `chrome://extensions/` 点扩展的「Service Worker」链接查看 background 日志（代码中日志统一带 `[m3u8DL]` 前缀）；popup/options 页可直接右键检查打开 DevTools。
- **远程服务器**：需要部署 N_m3u8DL-RE-WEB-UI（docker），其 CORS 需允许 `chrome-extension://` 来源（README 中建议设 `ALLOW_ORIGINS=*`）。

## 代码风格约定

- 原生 JavaScript，无模块系统、无框架；各页面脚本通过 `<script>` 标签直接加载（`popup.html` 先加载 `lib/hls.min.js` 再加载 `popup.js`）。
- 注释和 UI 文案使用中文；函数注释用 JSDoc 风格的块注释（`/** ... */`）。
- 字符串多用单引号；缩进 2 空格；分号结尾。
- background 中 Chrome 回调式 API 常包一层 `new Promise` 以便 async/await；popup/options 中 `chrome.runtime.sendMessage` 也统一包成 Promise 使用。
- 配置持久化用 `chrome.storage.sync`；`authToken` 缓存用 `chrome.storage.local`。
- 展示用户可控字符串前用 `escapeHtml()` 转义（popup 渲染资源名/URL 时），避免注入。

## 安全注意事项

- 服务器密码、代理密码存储在 `chrome.storage.sync`（明文，随浏览器账号同步），auth token 存于 cookie 和 `chrome.storage.local`——不要把这些值写入日志或硬编码到代码中。
- manifest 申请了较宽的权限（`webRequest`、`cookies`、`declarativeNetRequest`、`<all_urls>` 的 host_permissions），修改嗅探逻辑时注意不要把用户请求头（含 Cookie、Authorization）泄漏给无关第三方；当前仅提取 `referer/origin/cookie/user-agent/authorization` 及 `x-*` 头，且发送给下载任务时只带 `Referer`。
- `declarativeNetRequest` 会话规则 id 固定为 1，设置新规则前总是先清除旧规则，避免规则残留。
