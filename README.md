# m3u8DL Sniffer

浏览器视频嗅探插件（Chrome / Manifest V3），嗅探网页中的 m3u8、mp4、mpd 等媒体资源，一键发送到 N_m3u8DL-RE-WEB-UI 远程下载器。

## 功能特性

- 🔍 **资源嗅探** - 自动识别网页中的 m3u8、mp4、mpd 等媒体资源
- ▶️ **在线预览** - m3u8/mp4 资源可直接预览播放
- 📥 **一键下载** - 发送到远程服务器下载
- 🌐 **代理支持** - HTTP/HTTPS/SOCKS5 代理，支持快捷开关
- 🌍 **AI 翻译** - 使用 AI 翻译视频标题
- 🎨 **深色模式** - 自动跟随系统切换

## 快速开始

### 1. 部署服务器

```bash
docker run -d \
  --name m3u8dl \
  -p 8080:8080 \
  -e ALLOW_INSECURE=true \
  -e ALLOW_ORIGINS=* \
  -e ADMIN_PASSWORD=admin123 \
  -v ./db:/app/db \
  -v ./downloads:/app/downloads \
  ghcr.io/panoptes88/n_m3u8dl-re-web-ui:latest
```

### 2. 安装插件

1. 下载 [最新版本](https://github.com/panoptes88/m3u8dl-browser-extension/releases)
2. 打开 `chrome://extensions/`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择插件目录

### 3. 配置插件

右键扩展图标 → 选项 → 填写服务器地址、用户名、密码 → 测试连接 → 保存

## 基本使用

1. 打开包含视频的网页
2. 播放视频（触发资源嗅探）
3. 点击扩展图标查看嗅探到的资源
4. 勾选要下载的资源
5. 点击「发送到远程下载」

![嗅探资源](images/plugin-sniff-resources.png)

## 详细文档

📖 完整文档请查看 [Wiki](wiki/)

- [部署教程](wiki/部署教程.md)
- [插件安装](wiki/插件安装.md)
- [使用教程](wiki/使用教程.md)
- [高级配置](wiki/高级配置.md)
- [常见问题](wiki/常见问题.md)

## 相关项目

- [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE) - m3u8 下载器
- [N_m3u8DL-RE-WEB-UI](https://github.com/panoptes88/N_m3u8DL-RE-WEB-UI) - Web 管理界面

## 许可证

MIT License
