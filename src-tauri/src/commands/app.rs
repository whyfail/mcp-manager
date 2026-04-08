use serde::{Deserialize, Serialize};
use tauri::State;

use crate::app_state::AppState;

/// 获取应用配置路径
#[tauri::command]
pub async fn get_app_configs(
    _state: State<'_, AppState>,
) -> Result<Vec<AppConfigInfo>, String> {
    let configs = vec![
        AppConfigInfo {
            id: "qwen-code".to_string(),
            name: "Qwen Code".to_string(),
            config_path: "~/.qwen/settings.json".to_string(),
            mcp_count: 0,
        },
        AppConfigInfo {
            id: "claude".to_string(),
            name: "Claude Code".to_string(),
            config_path: "~/.claude.json".to_string(),
            mcp_count: 0,
        },
        AppConfigInfo {
            id: "codex".to_string(),
            name: "Codex".to_string(),
            config_path: "~/.codex/config.toml".to_string(),
            mcp_count: 0,
        },
        AppConfigInfo {
            id: "gemini".to_string(),
            name: "Gemini CLI".to_string(),
            config_path: "~/.gemini/settings.json".to_string(),
            mcp_count: 0,
        },
        AppConfigInfo {
            id: "opencode".to_string(),
            name: "OpenCode".to_string(),
            config_path: "~/.config/opencode/opencode.json".to_string(),
            mcp_count: 0,
        },
        AppConfigInfo {
            id: "openclaw".to_string(),
            name: "OpenClaw".to_string(),
            config_path: "~/.openclaw/openclaw.json".to_string(),
            mcp_count: 0,
        },
        AppConfigInfo {
            id: "trae".to_string(),
            name: "Trae".to_string(),
            config_path: "~/.trae/config.json".to_string(),
            mcp_count: 0,
        },
    ];
    Ok(configs)
}

/// 从指定应用导入 MCP
#[tauri::command]
pub async fn import_mcp_from_app(
    _state: State<'_, AppState>,
    _app_id: String,
) -> Result<usize, String> {
    // TODO: 实现从单个应用导入
    Ok(0)
}

#[derive(Serialize, Deserialize)]
pub struct AppConfigInfo {
    pub id: String,
    pub name: String,
    pub config_path: String,
    pub mcp_count: usize,
}
