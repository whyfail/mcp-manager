use indexmap::IndexMap;
use std::fs;
use std::path::Path;

use crate::database::McpServer;
use crate::error::AppError;
use crate::mcp::AppType;

/// 同步指定应用的 MCP 配置到其配置文件
pub fn sync_app_config(app: &AppType, servers: &[McpServer]) -> Result<(), AppError> {
    let config_path = expand_home(&get_config_path_for_app(app)?);

    if matches!(app, AppType::Codex) {
        return sync_codex_config(&config_path, servers);
    }

    // 读取现有配置（保留非 MCP 字段）
    let mut config: serde_json::Value = if Path::new(&config_path).exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        // 如果文件不存在，创建目录
        if let Some(parent) = Path::new(&config_path).parent() {
            fs::create_dir_all(parent).map_err(|e| {
                AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
            })?;
        }
        serde_json::json!({})
    };

    // 构建 MCP 服务器对象
    let mcp_servers = build_mcp_json(servers);

    // 根据应用类型确定键名
    let key = match app {
        AppType::OpenCode => "mcp",
        _ => "mcpServers",
    };

    // 更新配置
    if let Some(obj) = config.as_object_mut() {
        obj.insert(key.to_string(), serde_json::Value::Object(mcp_servers));
    }

    // 原子写入
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| AppError::Serialization(e.to_string()))?;
    
    atomic_write(&config_path, &content)?;

    Ok(())
}

fn sync_codex_config(path: &str, servers: &[McpServer]) -> Result<(), AppError> {
    // 读取 TOML
    let mut config: toml::Value = if Path::new(path).exists() {
        let content = fs::read_to_string(path)
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
        toml::from_str(&content).unwrap_or(toml::Value::Table(toml::map::Map::new()))
    } else {
        // 创建目录
        if let Some(parent) = Path::new(path).parent() {
            fs::create_dir_all(parent).map_err(|e| {
                AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
            })?;
        }
        toml::Value::Table(toml::map::Map::new())
    };

    // 构建 mcp_servers 表
    let mut mcp_table = toml::Table::new();
    for server in servers {
        let mut server_entry = toml::Table::new();
        if let Some(cmd) = &server.server.command {
            server_entry.insert("command".to_string(), toml::Value::String(cmd.clone()));
        }
        if let Some(args) = &server.server.args {
            let arr: Vec<toml::Value> = args.iter().map(|a| toml::Value::String(a.clone())).collect();
            server_entry.insert("args".to_string(), toml::Value::Array(arr));
        }
        if let Some(env) = &server.server.env {
            let mut env_table = toml::Table::new();
            for (k, v) in env {
                env_table.insert(k.clone(), toml::Value::String(v.clone()));
            }
            server_entry.insert("env".to_string(), toml::Value::Table(env_table));
        }
        mcp_table.insert(server.id.clone(), toml::Value::Table(server_entry));
    }

    if let toml::Value::Table(root) = &mut config {
        root.insert("mcp_servers".to_string(), toml::Value::Table(mcp_table));
    }

    // 写入 TOML
    let content = toml::to_string_pretty(&config)
        .map_err(|e| AppError::Serialization(e.to_string()))?;
    
    atomic_write(path, &content)?;
    Ok(())
}

fn build_mcp_json(servers: &[McpServer]) -> serde_json::Map<String, serde_json::Value> {
    let mut mcp_servers = serde_json::Map::new();
    for server in servers {
        let mut entry = serde_json::Map::new();
        
        if let Some(cmd) = &server.server.command {
            entry.insert("command".to_string(), serde_json::Value::String(cmd.clone()));
        }
        if let Some(args) = &server.server.args {
            entry.insert("args".to_string(), serde_json::Value::Array(
                args.iter().map(|a| serde_json::Value::String(a.clone())).collect()
            ));
        }
        if let Some(env) = &server.server.env {
            let env_map: serde_json::Map<String, serde_json::Value> = env
                .iter()
                .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                .collect();
            entry.insert("env".to_string(), serde_json::Value::Object(env_map));
        }
        if let Some(cwd) = &server.server.cwd {
            entry.insert("cwd".to_string(), serde_json::Value::String(cwd.clone()));
        }
        // 保留其他额外字段
        for (k, v) in &server.server.extra {
            entry.insert(k.clone(), v.clone());
        }

        mcp_servers.insert(server.id.clone(), serde_json::Value::Object(entry));
    }
    mcp_servers
}

/// 同步所有启用了 MCP 的应用
pub fn sync_all_live_configs(servers: &IndexMap<String, McpServer>) -> Result<(), AppError> {
    // 按应用分组
    let mut apps: std::collections::HashMap<AppType, Vec<&McpServer>> = std::collections::HashMap::new();
    for server in servers.values() {
        for app in AppType::all() {
            if server.apps.is_enabled_for(&app) {
                apps.entry(app.clone()).or_default().push(server);
            }
        }
    }

    // 同步每个应用
    for (app, servers) in apps {
        let owned_servers: Vec<McpServer> = servers.into_iter().cloned().collect();
        sync_app_config(&app, &owned_servers)?;
    }

    Ok(())
}

fn get_config_path_for_app(app: &AppType) -> Result<String, AppError> {
    match app {
        AppType::QwenCode => Ok("~/.qwen/settings.json".to_string()),
        AppType::Claude => Ok("~/.claude.json".to_string()),
        AppType::Codex => Ok("~/.codex/config.toml".to_string()),
        AppType::Gemini => Ok("~/.gemini/settings.json".to_string()),
        AppType::OpenCode => Ok("~/.config/opencode/opencode.json".to_string()),
        AppType::OpenClaw => Ok("~/.openclaw/openclaw.json".to_string()),
        AppType::Trae => Ok("~/Library/Application Support/Trae/User/mcp.json".to_string()),
        AppType::TraeCn => Ok("~/Library/Application Support/Trae CN/User/mcp.json".to_string()),
        AppType::Qoder => Ok("~/.qoder/settings.json".to_string()),
        AppType::CodeBuddy => Ok("~/.codebuddy/mcp.json".to_string()),
    }
}

fn expand_home(path: &str) -> String {
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped).to_string_lossy().to_string();
        }
    }
    path.to_string()
}

fn atomic_write(path: &str, content: &str) -> Result<(), AppError> {
    let temp_path = format!("{}.tmp", path);
    fs::write(&temp_path, content)
        .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    fs::rename(&temp_path, path)
        .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    Ok(())
}
