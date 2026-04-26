use crate::db::{create_task, finish_task, list_recent_tasks, TaskRow};
use crate::log::TaskLog;
use crate::paths::{project_tasks_dir, workspace_root};
use crate::pty::PtyState;
use crate::state::AppState;
use crate::stream::{parse_line, ParseOutcome, StreamEvent};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct TaskStarted {
    pub task_id: String,
    pub session_id: Option<String>,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub async fn send_input(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    project: String,
    text: String,
) -> Result<TaskStarted, String> {
    let cwd: PathBuf = workspace_root().join(&project);
    if !cwd.exists() {
        return Err(format!("project path missing: {}", cwd.display()));
    }

    let task_id = Uuid::new_v4().to_string();
    let log_dir = project_tasks_dir(&project);
    let log_path = log_dir.join(format!("{}.jsonl", task_id));

    let project_db = state
        .project_db(&project)
        .await
        .map_err(|e| e.to_string())?;
    create_task(
        &project_db,
        &TaskRow {
            id: task_id.clone(),
            command: text.clone(),
            session_id: None,
            started_at: now_secs(),
            ended_at: None,
            status: "running".into(),
            log_path: log_path.to_string_lossy().into(),
            retain_until: None,
            pinned: false,
        },
    )
    .map_err(|e| e.to_string())?;

    let task_log = Arc::new(TaskLog::open(log_path).map_err(|e| e.to_string())?);

    let (handle, mut rx) = state
        .pty_manager
        .get_or_spawn(&project, cwd, None)
        .await
        .map_err(|e| e.to_string())?;

    *handle.state.write().await = PtyState::Active;
    handle
        .write_input(&text)
        .await
        .map_err(|e| e.to_string())?;

    let app_for_task = app.clone();
    let task_id_for_task = task_id.clone();
    let project_for_task = project.clone();
    let project_db_clone = project_db.clone();
    let log_clone = task_log.clone();
    let handle_clone = handle.clone();

    tokio::spawn(async move {
        while let Some(line) = rx.recv().await {
            let _ = log_clone.append_line(&line).await;
            match parse_line(&line) {
                ParseOutcome::Event(ev) => {
                    if let StreamEvent::System {
                        ref payload, ..
                    } = ev
                    {
                        if let Some(sid) = payload.get("session_id").and_then(|v| v.as_str()) {
                            *handle_clone.session_id.write().await = Some(sid.to_string());
                        }
                    }
                    let is_result = matches!(ev, StreamEvent::Result { .. });
                    let _ = app_for_task.emit(
                        "task:event",
                        serde_json::json!({ "task_id": task_id_for_task, "event": ev }),
                    );
                    if is_result {
                        let _ = finish_task(
                            &project_db_clone,
                            &task_id_for_task,
                            "success",
                            now_secs(),
                        );
                        *handle_clone.state.write().await = PtyState::Idle;
                        let _ = app_for_task.emit(
                            "task:status",
                            serde_json::json!({
                                "task_id": task_id_for_task,
                                "status": "success",
                                "project": project_for_task,
                            }),
                        );
                        let _ = log_clone.close().await;
                        break;
                    }
                }
                ParseOutcome::Skip { reason, .. } => {
                    eprintln!("[stream] skipped line: {reason}");
                }
            }
        }
    });

    Ok(TaskStarted {
        task_id,
        session_id: None,
    })
}

#[tauri::command]
pub async fn stop_task(
    state: State<'_, Arc<AppState>>,
    project: String,
) -> Result<(), String> {
    state
        .pty_manager
        .kill(&project)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskDto {
    pub id: String,
    pub command: String,
    pub session_id: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub status: String,
    pub pinned: bool,
}

#[tauri::command]
pub async fn list_recent_tasks_cmd(
    state: State<'_, Arc<AppState>>,
    project: String,
    limit: Option<usize>,
) -> Result<Vec<TaskDto>, String> {
    let project_db = state
        .project_db(&project)
        .await
        .map_err(|e| e.to_string())?;
    let rows = list_recent_tasks(&project_db, limit.unwrap_or(50))
        .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| TaskDto {
            id: r.id,
            command: r.command,
            session_id: r.session_id,
            started_at: r.started_at,
            ended_at: r.ended_at,
            status: r.status,
            pinned: r.pinned,
        })
        .collect())
}
