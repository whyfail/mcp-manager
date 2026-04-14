# AI 工具箱

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com)
[![Platform](https://img.shields.io/badge/platform-macOS%2012%2B-lightgrey.svg)](https://github.com)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)

[中文](README.md) | [English](README_EN.md)

</div>

## 📖 简介

AI 工具箱 是一款**通用的 Model Context Protocol (MCP) 服务器管理工具**，旨在帮助开发者统一管理多个 AI 编程工具的 MCP 配置。告别繁琐的手动编辑，一个应用即可管理所有 AI CLI 工具的插件服务。

## ✨ 核心特性

### 🎯 统一管理，一键同步
- 支持 **8 种** 主流 AI 编程工具：Qwen Code, Claude Code, OpenAI Codex, Google Gemini CLI, OpenCode, OpenClaw, Trae, Trae CN, Qoder, CodeBuddy
- 在单一界面中添加、编辑、删除 MCP 服务器
- 自动检测系统中已安装的 AI 工具，新工具发现时弹窗提示
- 切换开关**实时同步**到对应工具的配置文件

### 📋 极简配置
- **JSON 粘贴模式**：直接从 MCP 介绍页面复制 JSON 配置，粘贴即可识别
- **智能解析**：自动提取服务器 ID、名称、命令和参数
- **连接测试**：内置测试连接功能，确保服务器配置有效后再保存
- **原子写入**：临时文件 + 重命名机制，防止配置损坏

### 🔧 开发者友好
- 点击工具名称可快速打开对应的 MCP 配置文件
- 可视化界面，告别手动编辑 JSON/TOML 文件
- 支持多个配置文件路径自动识别

## 📸 界面预览

### 主界面
> [!NOTE]
> ![主界面](assets/screenshots/main-panel.png)
> *统一的 MCP 服务器管理面板，显示已安装工具及其启用状态*

### 添加服务器
> [!NOTE]
> ![添加服务器](assets/screenshots/add-server.png)
> *JSON 粘贴模式，支持实时解析、连接测试和目标工具选择*

### 扫描新工具
> [!NOTE]
> ![扫描新工具](assets/screenshots/scan-agents.png)
> *自动发现新安装的 AI 工具并提示同步 MCP 配置*

## 🖥️ 系统支持

| 系统 | 状态 | 说明 |
|------|------|------|
| **macOS 12+** | ✅ 已支持 | 完整功能支持 |
| **Linux** | 🚧 开发中 | 基础功能可用 |
| **Windows 10+** | 🚧 开发中 | 路径适配进行中 |

## 🚀 快速开始

### macOS 安装

从 [Releases](https://github.com/whyfail/ai-tool-manager/releases) 页面下载最新的 `AI 工具箱_x.x.x_aarch64.dmg` 安装包：

```bash
# 挂载 DMG
hdiutil attach AI\ Toolkit_*.dmg

# 拖动到 Applications 文件夹
cp -R /Volumes/AI\ Toolkit/AI\ Toolkit.app /Applications/
```

### ⚠️ macOS 安全提示（首次运行必看）

由于当前版本未进行 Apple 代码签名和公证，macOS 安全机制可能会拦截未签名应用，提示 **“无法验证开发者”** 或 **“文件已损坏”**。请按以下步骤放行：

**方法一（终端命令 - 最推荐，解决"文件已损坏"）：**
1. 将应用拖入 `/Applications` 文件夹
2. 打开 **终端 (Terminal)**，执行以下命令：
   ```bash
   sudo xattr -cr "/Applications/AI 工具箱.app"
   ```
3. 输入开机密码并回车（密码输入时不显示），提示成功后即可双击打开

**方法二（右键打开）：**
1. 在 `访达 (Finder)` 中找到 `AI 工具箱.app`
2. **右键点击**（或按住 `Control` 键点击）应用图标
3. 在弹出的菜单中选择 **"打开"**
4. 在弹出的系统警告框中，再次点击 **"打开"** 即可

**方法三（系统设置放行）：**
1. 打开 **“系统设置”** -> **“隐私与安全性”**
2. 向下滚动到 **“安全性”** 区域
3. 找到提示 `“AI 工具箱” 已被阻止使用...`
4. 点击 **“仍要打开”**，输入密码确认即可

### 首次使用

1. 启动 AI 工具箱
2. 应用会自动扫描已安装的 AI 工具
3. 点击"添加服务器"粘贴 JSON 配置
4. 点击"测试连接"验证配置
5. 选择要同步的 AI 工具，保存即可生效

## 📁 支持的 AI 工具及配置路径

| 工具 | 配置文件路径 |
|------|-------------|
| Qwen Code | `~/.qwen/settings.json` |
| Claude Code | `~/.claude.json` |
| OpenAI Codex | `~/.codex/config.toml` |
| Google Gemini CLI | `~/.gemini/settings.json` |
| OpenCode | `~/.config/opencode/opencode.json` |
| OpenClaw | `~/.openclaw/openclaw.json` |
| Trae | `~/Library/Application Support/Trae/User/mcp.json` |
| Trae CN | `~/Library/Application Support/Trae CN/User/mcp.json` |
| Qoder | `~/.qoder/settings.json` |
| CodeBuddy | `~/.codebuddy/mcp.json` |

## 🛠️ 技术栈

- **前端**: React 18 · TypeScript · Vite · TailwindCSS · TanStack Query
- **后端**: Tauri 2 · Rust · SQLite (rusqlite)

## 📄 许可证

MIT License

---

<div align="center">
  <p>Made with ❤️ for AI Developers</p>
</div>
