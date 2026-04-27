use crate::diagnostics::read_recent_errors;
use crate::preflight::check;

#[tauri::command]
pub async fn export_diagnostics() -> Result<String, String> {
    let pf = check();
    let errors = read_recent_errors(100).unwrap_or_default();
    let info = serde_json::json!({
        "preflight": pf,
        "tauri_version": env!("CARGO_PKG_VERSION"),
        "errors_tail": errors,
    });
    Ok(serde_json::to_string_pretty(&info).unwrap_or_default())
}
