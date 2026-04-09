pub mod agents;
pub mod app_state;
pub mod commands;
pub mod database;
pub mod error;
pub mod import;
pub mod mcp;
pub mod services;

use agents::{detect_all_agents, get_last_detected_agents, save_detected_agents};
use app_state::AppState;
use database::Database;
use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // 初始化数据库
            let db = Database::new()?;
            app.manage(AppState::new(db));

            // 自动导入所有已存在的 MCP 配置
            let state = app.state::<AppState>();
            let imported_servers = import::import_all();
            for (_, server) in imported_servers {
                let _ = state.db.save_mcp_server(&server);
            }

            // 检测新安装的 Agent 工具
            let previous = get_last_detected_agents();
            let all_agents = detect_all_agents();
            let current_names: Vec<String> = all_agents
                .iter()
                .filter(|a| a.exists)
                .map(|a| a.app_type.name().to_string())
                .collect();
            let new_agents: Vec<_> = all_agents
                .iter()
                .filter(|a| a.exists && !previous.contains(&a.app_type.name().to_string()))
                .cloned()
                .collect();

            // 保存当前检测状态
            save_detected_agents(&current_names);

            // 如果有新工具，通过事件通知前端
            if !new_agents.is_empty() {
                let _ = app.app_handle().emit("agents-detected", &new_agents);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // MCP 命令
            commands::mcp::get_mcp_servers,
            commands::mcp::upsert_mcp_server,
            commands::mcp::delete_mcp_server,
            commands::mcp::toggle_mcp_app,
            commands::mcp::import_mcp_from_apps,
            commands::mcp::test_mcp_connection,
            // 应用配置命令
            commands::app::get_app_configs,
            commands::app::import_mcp_from_app,
            // Agent 检测命令
            commands::agents::detect_agents,
            commands::agents::sync_agent_mcp,
            commands::agents::open_config_file,
            // 更新命令
            commands::update::check_update,
            commands::update::install_update,
            // 应用信息命令
            commands::app::get_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
