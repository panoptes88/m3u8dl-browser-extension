# m3u8DL Sniffer

浏览器视频嗅探插件，一键发送到 N_m3u8DL-RE-WEB-UI 远程下载器。

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `browser-extension` 目录

## 配置

1. 点击扩展图标，打开设置页面
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
```

## 使用

1. 打开包含视频的网页
2. 播放视频（触发资源嗅探）
3. 点击扩展图标查看嗅探到的资源
4. 勾选要下载的资源
5. 点击「发送到远程下载」

## 调试

如果遇到问题，可以查看扩展的 Service Worker 日志：

1. 访问 `chrome://extensions/`
2. 找到 m3u8DL Sniffer
3. 点击「Service Worker」链接
4. 在打开的 DevTools 中查看 Console 日志
