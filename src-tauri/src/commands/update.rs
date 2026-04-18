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
    let updater = app.updater().map_err(|e| format!("更新器初始化失败: {}", e))?;
    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            version: update.version.clone(),
            body: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        }),
        Ok(None) => Ok(UpdateInfo {
            available: false,
            version: String::new(),
            body: None,
            date: None,
        }),
        Err(e) => {
            let err_msg = e.to_string();
            if err_msg.contains("network")
                || err_msg.contains("fetch")
                || err_msg.contains("connect")
                || err_msg.contains("timeout")
                || err_msg.contains("dns")
            {
                Err(format!("无法连接到更新服务器，请检查网络连接: {}", err_msg))
            } else if err_msg.contains("signature") || err_msg.contains("verify") {
                Err(format!("更新包签名验证失败: {}", err_msg))
            } else if err_msg.contains("parse") || err_msg.contains("json") {
                Err(format!("更新信息解析失败: {}", err_msg))
            } else {
                Err(format!("检查更新失败: {}", err_msg))
            }
        }
    }
}

/// 下载并安装更新
#[tauri::command]
#[allow(unreachable_code)]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("没有可用的更新")?;

    let _ = app.emit("update-status", "downloading");

    // 发送下载进度更新
    let app_handle = app.clone();
    update
        .download_and_install(
            move |_chunk_length, _content_length| {
                let _ = app_handle.emit("update-status", "downloading");
            },
            || {
                log::info!("更新已准备好，正在重启...");
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    // 显式调用重启（tauri-plugin-updater 不会自动重启）
    log::info!("正在重启应用...");
    app.restart();

    Ok(())
}