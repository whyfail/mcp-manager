use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    pub body: Option<String>,
    pub date: Option<String>,
}

/// 检查更新
#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => Ok(UpdateInfo {
            available: true,
            version: update.version.clone(),
            body: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        }),
        None => Ok(UpdateInfo {
            available: false,
            version: String::new(),
            body: None,
            date: None,
        }),
    }
}

/// 下载并安装更新
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("没有可用的更新")?;

    let _ = app.emit("update-status", "downloading");

    update
        .download_and_install(
            |chunk_length, content_length| {
                log::debug!("下载进度: {} / {:?}", chunk_length, content_length);
            },
            || {
                log::info!("更新已准备好，正在重启...");
            },
        )
        .await
        .map_err(|e| e.to_string())
}
