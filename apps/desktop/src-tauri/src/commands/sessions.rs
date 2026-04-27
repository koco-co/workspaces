use crate::sessions::fetch_sessions;
use crate::state::AppState;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct SessionDto {
    pub session_id: String,
    pub first_task_id: String,
    pub first_input_summary: Option<String>,
    pub created_at: i64,
    pub last_active_at: i64,
    pub task_count: i64,
}

#[tauri::command]
pub async fn list_sessions_cmd(
    state: State<'_, Arc<AppState>>,
    project: String,
    limit: Option<usize>,
) -> Result<Vec<SessionDto>, String> {
    let pool = state
        .project_db(&project)
        .await
        .map_err(|e| e.to_string())?;
    let rows = fetch_sessions(&pool, limit.unwrap_or(50)).map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| SessionDto {
            session_id: r.session_id,
            first_task_id: r.first_task_id,
            first_input_summary: r.first_input_summary,
            created_at: r.created_at,
            last_active_at: r.last_active_at,
            task_count: r.task_count,
        })
        .collect())
}
