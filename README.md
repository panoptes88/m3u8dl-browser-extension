# m3u8DL Sniffer

浏览器视频嗅探插件（Chrome / Manifest V3），嗅探网页中的 m3u8、mp4、mpd 等媒体资源，一键发送到 N_m3u8DL-RE-WEB-UI 远程下载器。

## 功能特性

- **资源嗅探**：自动识别网页中的视频/音频请求，支持 m3u8、mp4、ts、m4s、mpd、flv、webm、mp3 等常见格式，可识别 `.txt`/`.json` 伪装的 m3u8
- **在线预览**：m3u8 资源可直接在弹窗中预览播放（hls.js），并显示清晰度、时长、分片数等信息
- **一键下载**：勾选资源后发送到远程服务器，由 N_m3u8DL-RE 完成实际下载与合并
- **代理支持**：预览和下载任务均可走 HTTP/HTTPS/SOCKS5 代理
- **现代化界面**：统一的设计语言，自动跟随系统切换深色模式
- **可配置嗅探类型**：可在设置中勾选需要嗅探的资源类型

## 工作原理

扩展本身只负责「嗅探 + 转发链接」，不下载视频；实际下载由远程服务器完成。

![工作原理](images/principle.svg)

1. `background.js`（Service Worker）通过 `chrome.webRequest` 监听网络请求，按扩展名 + Content-Type 判定媒体资源，按标签页分组去重后暂存内存
2. 点击扩展图标，popup 拉取当前标签页的资源列表；预览时通过 `declarativeNetRequest` 注入 Referer 绕防盗链
3. 发送任务时先登录服务器获取 `auth_token`，再调用 `POST /api/tasks` 创建下载任务

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目所在目录

## 配置

1. 右键扩展图标，选择「选项」打开设置页面
2. 填写 N_m3u8DL-RE-WEB-UI 服务器地址（如 `http://192.168.1.100:8080`）
3. 填写用户名和密码
4. 点击「测试连接」验证

## CORS 配置（重要）

浏览器扩展的请求来源是 `chrome-extension://...`，服务器默认的 CORS 配置不允许此类来源。

### 解决方法

在 `docker-compose.yml` 中添加环境变量：

```yaml
environment:
  - ALLOW_ORIGINS=*
```

然后重启容器：

```bash
cd /data/m3u8dl
docker compose down
docker compose up -d
```

> **注意**：`ALLOW_ORIGINS=*` 表示允许所有来源访问。如果担心安全问题，可以设置为具体的值，但需要包含扩展的 origin（格式为 `chrome-extension://扩展ID`）。

## 使用

1. 打开包含视频的网页
2. 播放视频（触发资源嗅探）
3. 点击扩展图标查看嗅探到的资源
4. 勾选要下载的资源（m3u8 资源可点击 ▶ 预览）
5. 点击「发送到远程下载」

## 调试

如果遇到问题，可以查看扩展的 Service Worker 日志（日志统一带 `[m3u8DL]` 前缀）：

1. 访问 `chrome://extensions/`
2. 找到 m3u8DL Sniffer
3. 点击「Service Worker」链接
4. 在打开的 DevTools 中查看 Console 日志
