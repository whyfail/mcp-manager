use serde::{Deserialize, Serialize};
use tauri::State;
use std::str::FromStr;

use crate::agents::{detect_all_agents, DetectedAgent};
use crate::app_state::AppState;
use crate::database::{McpApps, McpServer, McpServerSpec};
use crate::import::import_from_path;
use crate::mcp::AppType;
use std::collections::HashMap;
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

    // 从配置文件导入
    let imported = import_from_path(app_type.clone(), &get_config_path(&agent_id))
        .ok_or_else(|| format!("Failed to import from {}", agent_id))?;

    let mut count = 0;
    let enabled_apps_set: Vec<AppType> = enabled_apps
        .iter()
        .filter_map(|id| AppType::from_str(id).ok())
        .collect();

    for (id, mut server) in imported.servers {
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

fn get_config_path(agent_id: &str) -> String {
    match agent_id {
        "qwen-code" => "~/.qwen/settings.json",
        "claude" => "~/.claude.json",
        "codex" => "~/.codex/config.toml",
        "gemini" => "~/.gemini/settings.json",
        "opencode" => "~/.config/opencode/opencode.json",
        "openclaw" => "~/.openclaw/openclaw.json",
        "trae" => "~/Library/Application Support/Trae/User/mcp.json",
        "trae-cn" => "~/Library/Application Support/Trae CN/User/mcp.json",
        "qoder" => "~/.qoder/settings.json",
        "codebuddy" => "~/.codebuddy/mcp.json",
        _ => "",
    }
    .to_string()
}

/// 展开 ~ 为 HOME 目录
fn expand_home(path: &str) -> String {
    if let Some(home) = dirs::home_dir() {
        if let Some(stripped) = path.strip_prefix("~/") {
            return home.join(stripped).to_string_lossy().to_string();
        }
    }
    path.to_string()
}

/// 打开配置文件（使用系统默认编辑器）
#[tauri::command]
pub async fn open_config_file(agent_id: String) -> Result<(), String> {
    let config_path = get_config_path(&agent_id);
    if config_path.is_empty() {
        return Err(format!("Unknown agent: {}", agent_id));
    }

    let full_path = expand_home(&config_path);
    
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
            .args(["/c", "start", &full_path])
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
