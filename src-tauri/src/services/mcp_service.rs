use crate::app_state::AppState;
use crate::database::McpServer;
use crate::error::AppError;
use crate::mcp::AppType;
use crate::services::sync;
use indexmap::IndexMap;

/// MCP 服务业务逻辑层
pub struct McpService;

impl McpService {
    /// 获取所有 MCP 服务器
    pub fn get_all_servers(
        state: &tauri::State<AppState>,
    ) -> Result<IndexMap<String, McpServer>, AppError> {
        state.db.get_all_mcp_servers()
    }

    /// 添加或更新 MCP 服务器
    pub fn upsert_server(
        state: &tauri::State<AppState>,
        server: McpServer,
    ) -> Result<(), AppError> {
        state.db.save_mcp_server(&server)?;
        // 同步到配置文件
        let servers = state.db.get_all_mcp_servers()?;
        sync::sync_all_live_configs(&servers)?;
        Ok(())
    }

    /// 删除 MCP 服务器
    pub fn delete_server(state: &tauri::State<AppState>, id: &str) -> Result<(), AppError> {
        state.db.delete_mcp_server(id)?;
        // 同步到配置文件
        let servers = state.db.get_all_mcp_servers()?;
        sync::sync_all_live_configs(&servers)?;
        Ok(())
    }

    /// 切换指定应用的启用状态
    pub fn toggle_app(
        state: &tauri::State<AppState>,
        server_id: &str,
        app: AppType,
        enabled: bool,
    ) -> Result<(), AppError> {
        let mut servers = state.db.get_all_mcp_servers()?;

        if let Some(server) = servers.get_mut(server_id) {
            server.apps.set_enabled_for(&app, enabled);
            state.db.save_mcp_server(server)?;
            // 同步到配置文件
            sync::sync_all_live_configs(&servers)?;
            Ok(())
        } else {
            Err(AppError::NotFound(format!(
                "MCP server not found: {}",
                server_id
            )))
        }
    }

    /// 从所有应用导入 MCP 服务器
    pub fn import_from_apps(state: &tauri::State<AppState>) -> Result<usize, AppError> {
        let mut total = 0;
        total += Self::import_from_claude(state).unwrap_or(0);
        total += Self::import_from_codex(state).unwrap_or(0);
        total += Self::import_from_gemini(state).unwrap_or(0);
        total += Self::import_from_opencode(state).unwrap_or(0);
        Ok(total)
    }

    /// 从 Claude Code 导入
    fn import_from_claude(_state: &tauri::State<AppState>) -> Result<usize, AppError> {
        // TODO: 实现从 Claude Code 的 .claude/mcp.json 导入
        Ok(0)
    }

    /// 从 Codex 导入
    fn import_from_codex(_state: &tauri::State<AppState>) -> Result<usize, AppError> {
        // TODO: 实现从 Codex 的配置导入
        Ok(0)
    }

    /// 从 Gemini 导入
    fn import_from_gemini(_state: &tauri::State<AppState>) -> Result<usize, AppError> {
        // TODO: 实现从 Gemini CLI 的配置导入
        Ok(0)
    }

    /// 从 OpenCode 导入
    fn import_from_opencode(_state: &tauri::State<AppState>) -> Result<usize, AppError> {
        // TODO: 实现从 OpenCode 的配置导入
        Ok(0)
    }
}
