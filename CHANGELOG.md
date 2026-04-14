# Changelog

## v1.1.0 (2026-04-14)

### 新增功能

#### Skills 管理模块
- **Skills 列表管理**：新增独立的 Skills 管理面板，支持查看所有已安装的 Skills
- **批量同步**：支持选择多个 Skills 同步到多个目标工具，提高操作效率
- **Git 仓库安装**：支持从 GitHub/GitLab 仓库安装 Skills，自动解析仓库结构
- **本地导入**：支持从本地目录导入 Skills 到集中仓库
- **在线搜索**：支持从 skills.sh 在线搜索热门 Skills
- **精选推荐**：展示精选 Skills 列表，包含安装量和星标信息
- **更新检测**：自动检测有更新的 Skills（支持 Git 仓库更新）
- **一键同步**：单个技能可快速同步到选定的 AI 工具
- **选择性安装**：支持多 Skills 仓库的选择性子目录安装

#### 工具检测与同步
- **多工具支持**：支持 Qwen Code, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, Trae, Trae CN, TRAE SOLO CN, Qoder, CodeBuddy
- **自动发现**：启动时自动检测系统中已安装的 AI 工具
- **实时同步**：MCP 服务器配置切换实时同步到对应工具配置文件
- **冲突检测**：检测同名 Skills 在不同工具中的安装情况

### 改进
- **项目重命名**：项目更名为 AI Tool Manager
- **数据库路径**：`~/.mcp-manager/` → `~/.ai-tool-manager/`
- **弹窗优化**：Skills 相关弹窗宽度优化，提升用户体验

### 修复
- 若干 bug 修复和稳定性提升

---

## v1.0.0 (2026-04-09)

### 首发版本
- MCP 服务器统一管理
- 支持 8+ 主流 AI 编程工具
- JSON 粘贴模式与智能解析
- 内置连接测试功能
- 配置文件原子写入保护
