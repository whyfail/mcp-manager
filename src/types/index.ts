// MCP 服务器连接参数
export interface McpServerSpec {
  type?: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  [key: string]: any;
}

// 应用启用状态
export type McpApps = Record<string, boolean>;

// MCP 服务器条目
export interface McpServer {
  id: string;
  name: string;
  server: McpServerSpec;
  apps: McpApps;
  description?: string;
  homepage?: string;
  docs?: string;
  tags?: string[];
}

// MCP 服务器映射
export type McpServersMap = Record<string, McpServer>;

// 应用 ID 类型
export type AppId = keyof McpApps;

// 应用配置信息
export interface AppConfigInfo {
  id: string;
  name: string;
  configPath: string;
  mcpCount: number;
}

// 支持的应用列表
export const SUPPORTED_APPS: Array<{ id: string; name: string; icon: string }> = [
  { id: "qwen-code", name: "Qwen Code", icon: "code" },
  { id: "claude", name: "Claude Code", icon: "claude" },
  { id: "codex", name: "Codex", icon: "codex" },
  { id: "gemini", name: "Gemini CLI", icon: "gemini" },
  { id: "opencode", name: "OpenCode", icon: "opencode" },
  { id: "openclaw", name: "OpenClaw", icon: "openclaw" },
  { id: "trae", name: "Trae", icon: "trae" },
];
