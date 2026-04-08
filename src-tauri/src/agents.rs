use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::mcp::AppType;

/// 已检测到的 Agent 工具信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedAgent {
    pub app_type: AppType,
    pub name: String,
    pub config_path: String,
    pub exists: bool,
    pub mcp_count: usize,
}

/// 所有 Agent 工具的配置路径
const AGENT_CONFIGS: &[(AppType, &str, &str)] = &[
    (AppType::QwenCode, "Qwen Code", "~/.qwen/settings.json"),
    (AppType::Claude, "Claude Code", "~/.claude.json"),
    (AppType::Codex, "Codex", "~/.codex/config.toml"),
    (AppType::Gemini, "Gemini CLI", "~/.gemini/settings.json"),
    (AppType::OpenCode, "OpenCode", "~/.config/opencode/opencode.json"),
    (AppType::OpenClaw, "OpenClaw", "~/.openclaw/openclaw.json"),
    (AppType::Trae, "Trae", "~/Library/Application Support/Trae/User/mcp.json"),
    (AppType::TraeCn, "Trae CN", "~/Library/Application Support/Trae CN/User/mcp.json"),
    (AppType::Qoder, "Qoder", "~/.qoder/settings.json"),
    (AppType::CodeBuddy, "CodeBuddy", "~/.codebuddy/mcp.json"),
];

/// 展开 ~ 路径
fn expand_home(path: &str) -> String {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]).to_string_lossy().to_string();
        }
    }
    path.to_string()
}

/// 统计配置文件中的 MCP 服务器数量
fn count_mcp_in_config(path: &str) -> usize {
    let expanded = expand_home(path);
    let content = match fs::read_to_string(&expanded) {
        Ok(c) => c,
        Err(_) => return 0,
    };

    if path.ends_with(".toml") {
        // Codex TOML 格式
        if let Ok(toml) = toml::from_str::<toml::Value>(&content) {
            if let Some(servers) = toml.get("mcp_servers") {
                return servers.as_table().map(|t| t.len()).unwrap_or(0);
            }
        }
    } else {
        // JSON 格式
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // 多种可能的键名
            for key in ["mcpServers", "mcpServers", "mcp"] {
                if let Some(obj) = json.get(key) {
                    if let Some(servers) = obj.as_object() {
                        return servers.len();
                    }
                    if let Some(arr) = obj.as_array() {
                        return arr.len();
                    }
                }
            }
            // OpenClaw models.providers
            if let Some(models) = json.get("models") {
                if let Some(providers) = models.get("providers") {
                    if let Some(obj) = providers.as_object() {
                        return obj.len();
                    }
                }
            }
        }
    }

    0
}

/// 检测系统中所有已安装的 Agent 工具
pub fn detect_all_agents() -> Vec<DetectedAgent> {
    AGENT_CONFIGS
        .iter()
        .map(|(app_type, name, config_path)| {
            let expanded = expand_home(config_path);
            let exists = Path::new(&expanded).exists();
            let mcp_count = if exists { count_mcp_in_config(config_path) } else { 0 };

            DetectedAgent {
                app_type: app_type.clone(),
                name: name.to_string(),
                config_path: config_path.to_string(),
                exists,
                mcp_count,
            }
        })
        .collect()
}

/// 检测新安装的工具（与上次检测对比）
pub fn detect_new_agents(previous: &[String]) -> Vec<DetectedAgent> {
    let current = detect_all_agents();
    current
        .into_iter()
        .filter(|agent| {
            agent.exists && !previous.contains(&agent.app_type.name().to_string())
        })
        .collect()
}

/// 获取上次检测的工具列表（从状态文件读取）
pub fn get_last_detected_agents() -> Vec<String> {
    let state_path = expand_home("~/.mcp-manager/detected.json");
    if let Ok(content) = fs::read_to_string(&state_path) {
        if let Ok(agents) = serde_json::from_str::<Vec<String>>(&content) {
            return agents;
        }
    }
    vec![]
}

/// 保存检测到的工具列表
pub fn save_detected_agents(agents: &[String]) {
    let state_dir = expand_home("~/.mcp-manager");
    let _ = fs::create_dir_all(&state_dir);
    let state_path = format!("{}/detected.json", state_dir);
    if let Ok(json) = serde_json::to_string_pretty(agents) {
        let _ = fs::write(&state_path, json);
    }
}
