use serde::{Deserialize, Serialize};
use tauri::State;
use std::str::FromStr;

use crate::agents::{detect_all_agents, DetectedAgent, resolve_path, get_agent_config_paths};
use crate::app_state::AppState;
use crate::database::McpApps;
use crate::import::import_from_path;
use crate::mcp::AppType;
use std::process::Command;

/// 检测到的 Agent 信息（前端用）
#[derive(Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub config_path: String,
    pub exists: bool,
    pub mcp_count: usize,
}

impl From<DetectedAgent> for AgentInfo {
    fn from(agent: DetectedAgent) -> Self {
        Self {
            id: agent.app_type.name().to_string(),
            name: agent.name,
            config_path: agent.config_path,
            exists: agent.exists,
            mcp_count: agent.mcp_count,
        }
    }
}

/// 检测所有已安装的 Agent 工具
#[tauri::command]
pub async fn detect_agents() -> Vec<AgentInfo> {
    detect_all_agents()
        .into_iter()
        .map(AgentInfo::from)
        .collect()
}

/// 同步指定 Agent 的 MCP 配置
#[tauri::command]
pub async fn sync_agent_mcp(
    state: State<'_, AppState>,
    agent_id: String,
    enabled_apps: Vec<String>,
) -> Result<usize, String> {
    let app_type = AppType::from_str(&agent_id).map_err(|e| e.to_string())?;

    // Get OS-specific paths and try to import from the first existing one
    let paths = get_agent_config_paths(&app_type);
    let mut imported = None;
    
    for path in &paths {
        if let Some(result) = import_from_path(app_type.clone(), path) {
            imported = Some(result);
            break;
        }
    }
    
    let imported = imported.ok_or_else(|| format!("Failed to import from {}", agent_id))?;

    let mut count = 0;
    let enabled_apps_set: Vec<AppType> = enabled_apps
        .iter()
        .filter_map(|id| AppType::from_str(id).ok())
        .collect();

    for (_id, mut server) in imported.servers {
        // 设置启用的应用
        let mut apps = McpApps::default();
        for app in &enabled_apps_set {
            apps.set_enabled_for(app, true);
        }
        server.apps = apps;

        // 保存到数据库（如果已存在则更新）
        let _ = state.db.save_mcp_server(&server);
        count += 1;
    }

    Ok(count)
}

/// 打开配置文件（使用系统默认编辑器）
#[tauri::command]
pub async fn open_config_file(agent_id: String) -> Result<(), String> {
    let app_type = AppType::from_str(&agent_id).map_err(|e| e.to_string())?;
    let paths = get_agent_config_paths(&app_type);
    
    let full_path = paths.first().ok_or_else(|| format!("No config path found for {}", agent_id))?;
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&full_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/c", "start", &full_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&full_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}
