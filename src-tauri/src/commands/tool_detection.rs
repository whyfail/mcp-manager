use crate::app_state::{AppState, InstalledToolsReport};
use crate::tool_detection::detect_all_tools;
use tauri::State;

/// 获取已安装工具的缓存数据（如果缓存为空则自动检测）
#[tauri::command]
pub fn get_installed_tools(state: State<'_, AppState>) -> InstalledToolsReport {
    state
        .installed_tools
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
}

/// 手动刷新已安装工具的检测（工具管理模块的刷新按钮）
#[tauri::command]
pub async fn refresh_installed_tools(
    state: State<'_, AppState>,
) -> Result<InstalledToolsReport, String> {
    let report = detect_all_tools()?;
    let mut cache = state.installed_tools.write().map_err(|e| e.to_string())?;
    *cache = report.clone();
    Ok(report)
}
