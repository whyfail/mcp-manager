import { invoke } from "@tauri-apps/api/core";
import type { McpServer, AppConfigInfo } from "@/types";

// MCP API
export const mcpApi = {
  // 获取所有 MCP 服务器
  async getAllServers(): Promise<Record<string, McpServer>> {
    return invoke<Record<string, McpServer>>("get_mcp_servers");
  },

  // 添加或更新 MCP 服务器
  async upsertServer(server: McpServer): Promise<void> {
    return invoke("upsert_mcp_server", { server });
  },

  // 删除 MCP 服务器
  async deleteServer(id: string): Promise<void> {
    return invoke("delete_mcp_server", { id });
  },

  // 切换应用启用状态
  async toggleApp(
    serverId: string,
    app: string,
    enabled: boolean
  ): Promise<void> {
    return invoke("toggle_mcp_app", { serverId, app, enabled });
  },

  // 从所有应用导入
  async importFromApps(): Promise<number> {
    return invoke<number>("import_mcp_from_apps");
  },
};

// 应用配置 API
export const appApi = {
  // 获取应用配置
  async getAppConfigs(): Promise<AppConfigInfo[]> {
    return invoke<AppConfigInfo[]>("get_app_configs");
  },

  // 从指定应用导入
  async importFromApp(appId: string): Promise<number> {
    return invoke<number>("import_mcp_from_app", { appId });
  },
};
