use serde::{Deserialize, Serialize};
use tauri::State;
use std::str::FromStr;

use crate::agents::{detect_all_agents, DetectedAgent, get_agent_config_paths, get_agent_name};
use crate::app_state::AppState;
use crate::database::McpApps;
use crate::import::import_from_path;
use crate::mcp::AppType;
use crate::services::sync;
use crate::utils::SuppressConsole;
use std::process::Command;

/// 检测 Node.js 环境并返回需要添加到 PATH 的路径
/// 返回 Ok(bin_dir_path) 或 Err(error_message)
#[cfg(not(windows))]
fn detect_node_environment() -> Result<String, String> {
    let home = std::env::var("HOME").unwrap_or_default();

    // 先检测 node 是否已经可用 (直接用 which)
    if let Ok(output) = Command::new("which").suppress_console().arg("node").output() {
        if output.status.success() {
            let node_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !node_path.is_empty() {
                if let Some(parent) = std::path::Path::new(&node_path).parent() {
                    return Ok(parent.to_string_lossy().to_string());
                }
            }
        }
    }

    // 检查 nvm
    let nvm_prefix = format!("{}/.nvm/versions/node", home);
    if std::path::Path::new(&nvm_prefix).exists() {
        if let Ok(entries) = std::fs::read_dir(&nvm_prefix) {
            if let Some(newest) = entries.filter_map(|e| e.ok())
                .filter_map(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    if name.starts_with('v') {
                        e.path().join("bin/node").exists().then_some(name)
                    } else {
                        None
                    }
                })
                .max() {
                return Ok(format!("{}/.nvm/versions/node/{}/bin", home, newest));
            }
        }
    }

    // 检查 fnm
    let fnm_dir = format!("{}/.fnm", home);
    if std::path::Path::new(&fnm_dir).exists() {
        if let Ok(output) = Command::new("fnm").suppress_console().arg("current").output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !version.is_empty() {
                    let fnm_path = format!("{}/.fnm/versions/{}/installation/bin", home, version);
                    if std::path::Path::new(&fnm_path).exists() {
                        return Ok(fnm_path);
                    }
                }
            }
        }
        let fnm_default = format!("{}/.fnm/versions/node-default/bin", home);
        if std::path::Path::new(&fnm_default).exists() {
            return Ok(fnm_default);
        }
    }

    // 检查 volta
    let volta_path = format!("{}/.volta/bin", home);
    if std::path::Path::new(&volta_path).exists() {
        return Ok(volta_path);
    }

    // 检查 nvmd
    let nvmd_path = format!("{}/.nvmd/bin", home);
    if std::path::Path::new(&nvmd_path).exists() {
        return Ok(nvmd_path);
    }

    // 检查 homebrew node
    if std::path::Path::new("/opt/homebrew/bin/node").exists() {
        return Ok("/opt/homebrew/bin".to_string());
    }
    if std::path::Path::new("/usr/local/bin/node").exists() {
        return Ok("/usr/local/bin".to_string());
    }

    Err("未检测到 Node.js 安装，请先安装: https://nodejs.org".to_string())
}

/// 检测 Node.js 环境并返回需要添加到 PATH 的路径 (Windows 版本)
#[cfg(windows)]
fn detect_node_environment() -> Result<String, String> {
    // 1. 先尝试 where node 找到 node.exe
    if let Ok(output) = Command::new("where").suppress_console().arg("node").output() {
        if output.status.success() {
            let node_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // where 可能返回多行，取第一行
            if let Some(first_line) = node_path.lines().next() {
                let node_path = first_line.trim();
                if !node_path.is_empty() {
                    if let Some(parent) = std::path::Path::new(&node_path).parent() {
                        return Ok(parent.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    let home = std::env::var("USERPROFILE").unwrap_or_default();

    // 2. 检查 fnm (Windows 常用)
    if let Ok(output) = Command::new("fnm").suppress_console().arg("current").output() {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !version.is_empty() {
                let fnm_path = format!("{}\\AppData\\Roaming\\fnm\\versions\\{}\\installation", home, version);
                if std::path::Path::new(&fnm_path).exists() {
                    return Ok(fnm_path);
                }
                let fnm_path2 = format!("{}\\.fnm\\versions\\{}\\installation", home, version);
                if std::path::Path::new(&fnm_path2).exists() {
                    return Ok(fnm_path2);
                }
            }
        }
    }

    // 3. 检查 nvm-windows
    let nvm_home = std::env::var("NVM_HOME").unwrap_or_default();
    if !nvm_home.is_empty() {
        let nvm_symlink = format!("{}\\v{}", nvm_home, std::env::var("NVM_SYMLINK").unwrap_or_default());
        if std::path::Path::new(&nvm_symlink).exists() {
            return Ok(nvm_symlink);
        }
    }

    // 4. 检查 volta
    let volta_path = format!("{}\\AppData\\Local\\Volta\\bin", home);
    if std::path::Path::new(&volta_path).exists() {
        return Ok(volta_path);
    }

    // 5. 检查 nvmd
    let nvmd_path = format!("{}\\.nvmd\\bin", home);
    if std::path::Path::new(&nvmd_path).exists() {
        return Ok(nvmd_path);
    }

    // 6. 检查默认 npm 全局目录
    if let Ok(output) = Command::new("cmd").suppress_console().args(["/C", "npm config get prefix"]).output() {
        if output.status.success() {
            let prefix = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !prefix.is_empty() && std::path::Path::new(&prefix).exists() {
                return Ok(prefix);
            }
        }
    }

    Err("未检测到 Node.js 安装，请先安装: https://nodejs.org".to_string())
}

/// 检测到的 Agent 信息（前端用）
#[derive(Clone, Debug, Serialize, Deserialize)]
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

    // 同步到各工具的配置文件
    let servers = state.db.get_all_mcp_servers().map_err(|e| e.to_string())?;
    sync::sync_all_live_configs(&servers).map_err(|e| e.to_string())?;

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
            .suppress_console()
            .arg(&full_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .suppress_console()
            .args(["/c", "start", &full_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .suppress_console()
            .arg(&full_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

/// 终端类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub name: String,
    pub path: String,
}

/// 检测系统已安装的终端
#[tauri::command]
pub fn get_terminals() -> Vec<TerminalInfo> {
    let mut terminals = Vec::new();

    #[cfg(target_os = "macos")]
    {
        // Terminal.app
        terminals.push(TerminalInfo {
            id: "terminal".to_string(),
            name: "Terminal".to_string(),
            path: "/System/Applications/Utilities/Terminal.app".to_string(),
        });

        // iTerm2
        if std::path::Path::new("/Applications/iTerm.app").exists() {
            terminals.push(TerminalInfo {
                id: "iterm".to_string(),
                name: "iTerm".to_string(),
                path: "/Applications/iTerm.app".to_string(),
            });
        }

        // Warp
        if std::path::Path::new("/Applications/Warp.app").exists() {
            terminals.push(TerminalInfo {
                id: "warp".to_string(),
                name: "Warp".to_string(),
                path: "/Applications/Warp.app".to_string(),
            });
        }

        // Hyper
        if std::path::Path::new("/Applications/Hyper.app").exists() {
            terminals.push(TerminalInfo {
                id: "hyper".to_string(),
                name: "Hyper".to_string(),
                path: "/Applications/Hyper.app".to_string(),
            });
        }

        // Kitty
        if std::path::Path::new("/Applications/kitty.app").exists() {
            terminals.push(TerminalInfo {
                id: "kitty".to_string(),
                name: "Kitty".to_string(),
                path: "/Applications/kitty.app".to_string(),
            });
        }

        // Alacritty
        if std::path::Path::new("/Applications/Alacritty.app").exists() {
            terminals.push(TerminalInfo {
                id: "alacritty".to_string(),
                name: "Alacritty".to_string(),
                path: "/Applications/Alacritty.app".to_string(),
            });
        }

        // Fig
        if std::path::Path::new("/Applications/Fig.app").exists() {
            terminals.push(TerminalInfo {
                id: "fig".to_string(),
                name: "Fig".to_string(),
                path: "/Applications/Fig.app".to_string(),
            });
        }

        // Kaku
        if std::path::Path::new("/Applications/Kaku.app").exists() {
            terminals.push(TerminalInfo {
                id: "kaku".to_string(),
                name: "Kaku".to_string(),
                path: "/Applications/Kaku.app".to_string(),
            });
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows Terminal
        if Command::new("where")
            .suppress_console()
            .arg("wt")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            terminals.push(TerminalInfo {
                id: "windows-terminal".to_string(),
                name: "Windows Terminal".to_string(),
                path: "wt.exe".to_string(),
            });
        }

        // PowerShell 7+
        if Command::new("where")
            .suppress_console()
            .arg("pwsh")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            terminals.push(TerminalInfo {
                id: "pwsh".to_string(),
                name: "PowerShell 7".to_string(),
                path: "pwsh.exe".to_string(),
            });
        }

        // Windows PowerShell (5.1)
        if Command::new("where")
            .suppress_console()
            .arg("powershell")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            terminals.push(TerminalInfo {
                id: "powershell".to_string(),
                name: "Windows PowerShell".to_string(),
                path: "powershell.exe".to_string(),
            });
        }

        // CMD
        if Command::new("where")
            .suppress_console()
            .arg("cmd")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            terminals.push(TerminalInfo {
                id: "cmd".to_string(),
                name: "CMD".to_string(),
                path: "cmd.exe".to_string(),
            });
        }

        // Git Bash
        let git_bash_path = r"C:\Program Files\Git\bin\bash.exe";
        if std::path::Path::new(git_bash_path).exists() {
            terminals.push(TerminalInfo {
                id: "git-bash".to_string(),
                name: "Git Bash".to_string(),
                path: git_bash_path.to_string(),
            });
        }
    }

    terminals
}

/// 查找 Git Bash 的路径
#[cfg(target_os = "windows")]
fn get_git_bash_path() -> Option<String> {
    let candidates = [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    // 尝试通过 where 查找
    if let Ok(output) = Command::new("where").suppress_console().arg("bash").output() {
        if output.status.success() {
            let bash_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if let Some(first_line) = bash_path.lines().next() {
                let first_line = first_line.trim();
                if first_line.to_lowercase().contains("git") && std::path::Path::new(first_line).exists() {
                    return Some(first_line.to_string());
                }
            }
        }
    }
    None
}

fn get_agent_launch_command(app: &AppType) -> Option<String> {
    match app {
        AppType::QwenCode => Some("qwen".to_string()),
        AppType::Claude => Some("claude".to_string()),
        AppType::Codex => Some("codex".to_string()),
        AppType::Gemini => Some("gemini".to_string()),
        AppType::OpenCode => Some("opencode".to_string()),
        AppType::Trae => None,
        AppType::TraeCn => None,
        AppType::TraeSoloCn => None,
        AppType::Qoder => None,
        AppType::Qodercli => Some("qodercli".to_string()),
        AppType::CodeBuddy => Some("codebuddy".to_string()),
    }
}

/// 启动 Agent 工具（打开终端并运行命令）
#[tauri::command]
pub async fn launch_agent(agent_id: String, terminal_id: Option<String>) -> Result<(), String> {
    let app_type = AppType::from_str(&agent_id).map_err(|e| e.to_string())?;

    let Some(command) = get_agent_launch_command(&app_type) else {
        return Err(format!("{} 没有 CLI 命令，无法启动", get_agent_name(&app_type)));
    };

    // 检测 Node.js 环境
    let node_bin_dir = detect_node_environment().map_err(|e| {
        format!("{}: 请先安装 Node.js", e)
    })?;

    let term_id = terminal_id.unwrap_or_else(|| "terminal".to_string());

    #[cfg(target_os = "macos")]
    {
        // 统一写临时脚本文件，避免 full_cmd 中的双引号/$PATH 破坏 AppleScript 语法
        let script_path = format!("/tmp/ai_toolkit_run_{}.sh", std::process::id());
        let full_cmd = format!(
            "cd ~/Desktop && export PATH=\"{}:$PATH:/usr/local/bin:/opt/homebrew/bin\" && {}; exec $SHELL",
            node_bin_dir, command
        );
        std::fs::write(&script_path, &full_cmd)
            .map_err(|e| format!("写入脚本失败: {}", e))?;

        match term_id.as_str() {
            "terminal" => {
                let script = format!(
                    "tell application \"Terminal\"\n\
                     activate\n\
                     do script \"chmod +x {} && {}\"\n\
                     end tell",
                    script_path, script_path
                );
                let output = Command::new("osascript")
                    .suppress_console()
                    .args(["-e", &script])
                    .output()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("启动 {} 失败: {}", agent_id, stderr));
                }
            }
            "iterm" => {
                let script = format!(
                    "tell application \"iTerm\"\n\
                     activate\n\
                     create window with default profile\n\
                     tell current session of current window\n\
                     write text \"source {}\"\n\
                     end tell\n\
                     end tell",
                    script_path
                );
                let output = Command::new("osascript")
                    .suppress_console()
                    .args(["-e", &script])
                    .output()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("启动 {} 失败: {}", agent_id, stderr));
                }
            }
            "warp" => {
                // Warp 不支持 AppleScript do script，需通过 System Events 模拟键盘输入
                let script = format!(
                    "tell application \"Warp\"\n\
                     activate\n\
                     end tell\n\
                     delay 0.5\n\
                     tell application \"System Events\"\n\
                     keystroke \"source {}\" & return\n\
                     end tell",
                    script_path
                );
                let output = Command::new("osascript")
                    .suppress_console()
                    .args(["-e", &script])
                    .output()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if stderr.contains("不允许发送按键") || stderr.contains("not allowed") || stderr.contains("1002") {
                        return Err(format!(
                            "启动 {} 失败: 需要辅助功能权限。请在「系统设置 → 隐私与安全性 → 辅助功能」中添加 AI Toolkit（或终端应用），然后重试。",
                            agent_id
                        ));
                    }
                    return Err(format!("启动 {} 失败: {}", agent_id, stderr));
                }
            }
            "hyper" => {
                let script = format!(
                    "tell application \"Hyper\"\n\
                     activate\n\
                     delay 0.5\n\
                     tell application \"System Events\"\n\
                     keystroke \"source {}\" & return\n\
                     end tell\n\
                     end tell",
                    script_path
                );
                let output = Command::new("osascript")
                    .suppress_console()
                    .args(["-e", &script])
                    .output()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if stderr.contains("不允许发送按键") || stderr.contains("not allowed") || stderr.contains("1002") {
                        return Err(format!(
                            "启动 {} 失败: 需要辅助功能权限。请在「系统设置 → 隐私与安全性 → 辅助功能」中添加 AI Toolkit（或终端应用），然后重试。",
                            agent_id
                        ));
                    }
                    return Err(format!("启动 {} 失败: {}", agent_id, stderr));
                }
            }
            "kitty" => {
                // Kitty 支持 CLI 参数直接执行命令，无需 System Events
                // 直接调用 kitty binary 启动新窗口执行脚本
                let kitty_bin = "/Applications/kitty.app/Contents/MacOS/kitty";
                let kitty_result = Command::new(kitty_bin)
                    .suppress_console()
                    .args(["sh", "-c", &format!("source {}", script_path)])
                    .spawn();
                match kitty_result {
                    Ok(_) => {}
                    Err(e) => {
                        return Err(format!("启动 {} 失败: 无法启动 Kitty ({})", agent_id, e));
                    }
                }
            }
            "alacritty" => {
                // Alacritty 支持 CLI 参数直接执行命令，无需 System Events
                // 直接调用 alacritty binary 启动新窗口执行脚本
                let alacritty_bin = "/Applications/Alacritty.app/Contents/MacOS/alacritty";
                let alacritty_result = Command::new(alacritty_bin)
                    .suppress_console()
                    .args(["-e", "sh", &script_path])
                    .spawn();
                match alacritty_result {
                    Ok(_) => {}
                    Err(e) => {
                        return Err(format!("启动 {} 失败: 无法启动 Alacritty ({})", agent_id, e));
                    }
                }
            }
            "fig" => {
                let script = format!(
                    "tell application \"Fig\"\n\
                     activate\n\
                     delay 0.5\n\
                     tell application \"System Events\"\n\
                     keystroke \"source {}\" & return\n\
                     end tell\n\
                     end tell",
                    script_path
                );
                let output = Command::new("osascript")
                    .suppress_console()
                    .args(["-e", &script])
                    .output()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if stderr.contains("不允许发送按键") || stderr.contains("not allowed") || stderr.contains("1002") {
                        return Err(format!(
                            "启动 {} 失败: 需要辅助功能权限。请在「系统设置 → 隐私与安全性 → 辅助功能」中添加 AI Toolkit（或终端应用），然后重试。",
                            agent_id
                        ));
                    }
                    return Err(format!("启动 {} 失败: {}", agent_id, stderr));
                }
            }
            "kaku" => {
                let script = format!(
                    "tell application \"Kaku\"\n\
                     activate\n\
                     delay 0.5\n\
                     tell application \"System Events\"\n\
                     keystroke \"source {}\" & return\n\
                     end tell\n\
                     end tell",
                    script_path
                );
                let output = Command::new("osascript")
                    .suppress_console()
                    .args(["-e", &script])
                    .output()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if stderr.contains("不允许发送按键") || stderr.contains("not allowed") || stderr.contains("1002") {
                        return Err(format!(
                            "启动 {} 失败: 需要辅助功能权限。请在「系统设置 → 隐私与安全性 → 辅助功能」中添加 AI Toolkit（或终端应用），然后重试。",
                            agent_id
                        ));
                    }
                    return Err(format!("启动 {} 失败: {}", agent_id, stderr));
                }
            }
            _ => {
                return Err(format!("不支持的终端: {}", term_id));
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let desktop_path = dirs::desktop_dir()
            .or_else(|| dirs::home_dir())
            .ok_or("无法获取桌面路径")?
            .to_string_lossy()
            .to_string();

        match term_id.as_str() {
            "windows-terminal" => {
                // Windows Terminal 使用 PowerShell 语法
                let full_cmd = format!(
                    "cd '{}'; $env:PATH = '{};' + $env:PATH; {}",
                    desktop_path,
                    node_bin_dir,
                    command
                );
                Command::new("wt")
                    .args(["new-tab", "powershell", "-NoExit", "-c", &full_cmd])
                    .spawn()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
            }
            "pwsh" => {
                let full_cmd = format!(
                    "cd '{}'; $env:PATH = '{};' + $env:PATH; {}",
                    desktop_path,
                    node_bin_dir,
                    command
                );
                Command::new("pwsh")
                    .args(["-NoExit", "-c", &full_cmd])
                    .spawn()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
            }
            "powershell" => {
                let full_cmd = format!(
                    "cd '{}'; $env:PATH = '{};' + $env:PATH; {}",
                    desktop_path,
                    node_bin_dir,
                    command
                );
                Command::new("powershell")
                    .args(["-NoExit", "-c", &full_cmd])
                    .spawn()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
            }
            "cmd" => {
                // start 命令的第一个带引号参数被当作窗口标题
                let full_cmd = format!(
                    "cd /d \"{}\" && set PATH={};%PATH% && {}",
                    desktop_path,
                    node_bin_dir,
                    command
                );
                Command::new("cmd")
                    .args(["/c", "start", &format!("启动 {}", agent_id), "cmd", "/k", &full_cmd])
                    .spawn()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
            }
            "git-bash" => {
                let git_bash_path = get_git_bash_path()
                    .ok_or("未找到 Git Bash，请确保已安装 Git")?;
                // Git Bash 路径需要转为正斜杠，添加 exec bash 作为 fallback
                let full_cmd = format!(
                    "cd '{}'; export PATH=\"{}:$PATH\"; {}; exec bash",
                    desktop_path.replace("\\", "/"),
                    node_bin_dir.replace("\\", "/"),
                    command
                );
                Command::new(git_bash_path)
                    .args(["-c", &full_cmd])
                    .spawn()
                    .map_err(|e| format!("启动 {} 失败: {}", agent_id, e))?;
            }
            _ => {
                return Err(format!("不支持的终端: {}", term_id));
            }
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        return Err("启动功能仅支持 macOS 和 Windows".to_string());
    }

    Ok(())
}
