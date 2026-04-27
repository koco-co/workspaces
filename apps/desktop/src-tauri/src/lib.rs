pub mod commands;
pub mod db;
pub mod diagnostics;
pub mod gc;
pub mod paths;
pub mod preflight;
pub mod projects;
pub mod pty;
pub mod sessions;
pub mod state;
pub mod log;
pub mod stream;

use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            commands::preflight::get_preflight_status,
            commands::preflight::recheck,
            commands::projects::list_projects_cmd,
            commands::projects::switch_project_cmd,
            commands::workbench::send_input,
            commands::workbench::stop_task,
            commands::workbench::list_recent_tasks_cmd,
            commands::workbench::resume_session,
            commands::workbench::pin_task_cmd,
            commands::files::list_files,
            commands::files::read_file_text,
            commands::files::open_with_default,
            commands::files::open_in_finder,
            commands::sessions::list_sessions_cmd,
            commands::diagnostics::export_diagnostics,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window missing");
            #[cfg(target_os = "macos")]
            {
                apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::UnderWindowBackground,
                    Some(NSVisualEffectState::Active),
                    Some(12.0),
                )
                .expect("vibrancy unsupported on this macOS version");
            }

            let window_handle = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let app_state: tauri::State<Arc<crate::state::AppState>> = window_handle.state();
                    let pty = app_state.pty_manager.clone();
                    let win = window_handle.clone();
                    api.prevent_close();
                    tauri::async_runtime::spawn(async move {
                        let map = pty.handles.read().await;
                        let mut has_active = false;
                        for h in map.values() {
                            if *h.state.read().await == crate::pty::PtyState::Active {
                                has_active = true;
                                break;
                            }
                        }
                        drop(map);
                        if has_active {
                            let _ = win.emit("app:close-requested", ());
                        } else {
                            pty.shutdown_all().await;
                            let _ = win.close();
                        }
                    });
                }
            });

            let ui_db_path = paths::ui_db_path();
            let ui_db = db::open_pool_with_recovery(&ui_db_path).expect("ui.db open failed");
            let state = state::AppState::new(ui_db);
            app.manage(state.clone());
            crate::gc::spawn_idle_gc(state.pty_manager.clone());
            crate::gc::spawn_log_gc_on_startup();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
