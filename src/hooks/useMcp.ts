import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mcpApi } from "@/lib/api";
import type { McpServer } from "@/types";

// 查询所有 MCP 服务器
export function useAllMcpServers() {
  return useQuery({
    queryKey: ["mcp", "all"],
    queryFn: () => mcpApi.getAllServers(),
  });
}

// 添加或更新 MCP 服务器
export function useUpsertMcpServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (server: McpServer) => mcpApi.upsertServer(server),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "all"] });
    },
  });
}

// 切换应用启用状态
export function useToggleMcpApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      serverId,
      app,
      enabled,
    }: {
      serverId: string;
      app: string;
      enabled: boolean;
    }) => mcpApi.toggleApp(serverId, app, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "all"] });
    },
  });
}

// 删除 MCP 服务器
export function useDeleteMcpServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mcpApi.deleteServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "all"] });
    },
  });
}

// 从所有应用导入
export function useImportMcpFromApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mcpApi.importFromApps(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "all"] });
    },
  });
}
