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

#[tauri::command]
pub async fn resume_session(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    project: String,
    session_id: String,
) -> Result<(), String> {
    state.pty_manager.kill(&project).await.map_err(|e| e.to_string())?;
    let cwd: PathBuf = workspace_root().join(&project);
    if !cwd.exists() {
        return Err(format!("project missing: {}", cwd.display()));
    }

    let pool = state.project_db(&project).await.map_err(|e| e.to_string())?;
    let log_paths: Vec<String> = {
        let conn = pool.get().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT log_path FROM tasks WHERE session_id = ?1 ORDER BY started_at ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([&session_id], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        let mut paths = Vec::new();
        for row in rows {
            if let Ok(p) = row {
                paths.push(p);
            }
        }
        paths
    };

    let mut events: Vec<serde_json::Value> = Vec::new();
    for path in log_paths {
        if let Ok(content) = std::fs::read_to_string(&path) {
            for line in content.lines() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    events.push(v);
                }
            }
        }
    }
    let _ = app.emit("session:resumed", serde_json::json!({
        "project": project, "session_id": session_id, "events": events,
    }));

    state.pty_manager.get_or_spawn(&project, cwd, Some(&session_id))
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

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

fn text_for_summary(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() > 80 {
        let truncated: String = trimmed.chars().take(77).collect();
        format!("{}...", truncated)
    } else {
        trimmed.to_string()
    }
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

    state
        .current_task_id
        .write()
        .await
        .insert(project.clone(), task_id.clone());

    let task_log = Arc::new(TaskLog::open(log_path).map_err(|e| e.to_string())?);

    let (handle, mut rx) = state
        .pty_manager
        .get_or_spawn(&project, cwd, None)
        .await
        .map_err(|e| e.to_string())?;

    *handle.state.write().await = PtyState::Active;
    match handle.write_input(&text).await {
        Ok(()) => {}
        Err(e) => {
            let _ = finish_task(&project_db, &task_id, "cancelled", now_secs());
            *handle.state.write().await = PtyState::Closed;
            return Err(format!("PTY write failed (will respawn on next input): {e}"));
        }
    }

    let command_for_session = text.clone();
    let state_arc = state.inner().clone();
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
                            let summary = text_for_summary(&command_for_session);
                            let _ = crate::sessions::record_session(&project_db_clone, &crate::db::SessionRow {
                                session_id: sid.to_string(),
                                first_task_id: task_id_for_task.clone(),
                                first_input_summary: Some(summary),
                                created_at: now_secs(),
                                last_active_at: now_secs(),
                                task_count: 1,
                            });
                            if let Ok(conn) = project_db_clone.get() {
                                let _ = conn.execute(
                                    "UPDATE tasks SET session_id = ?1 WHERE id = ?2",
                                    rusqlite::params![sid, task_id_for_task],
                                );
                            }
                        }
                    }
                    let _ = app_for_task.emit(
                        "task:event",
                        serde_json::json!({ "task_id": task_id_for_task, "event": ev }),
                    );
                    if let StreamEvent::Result { ref payload } = ev {
                        let is_error = payload.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                        let result_text = payload.get("result").and_then(|v| v.as_str()).unwrap_or("");
                        let likely_auth = result_text.to_lowercase().contains("unauthorized")
                            || result_text.contains("401")
                            || result_text.to_lowercase().contains("login");

                        let final_status = if is_error || likely_auth { "failed" } else { "success" };
                        let _ = finish_task(&project_db_clone, &task_id_for_task, final_status, now_secs());
                        state_arc
                            .current_task_id
                            .write()
                            .await
                            .remove(&project_for_task);

                        if likely_auth {
                            let _ = app_for_task.emit("preflight:changed", serde_json::json!({
                                "status": { "kind": "not_logged_in", "version": "" }
                            }));
                        }
                        *handle_clone.state.write().await = PtyState::Idle;
                        let _ = app_for_task.emit(
                            "task:status",
                            serde_json::json!({
                                "task_id": task_id_for_task,
                                "status": final_status,
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
    if let Some(task_id) = state.current_task_id.write().await.remove(&project) {
        if let Ok(pool) = state.project_db(&project).await {
            let _ = finish_task(&pool, &task_id, "cancelled", now_secs());
        }
    }
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

#[tauri::command]
pub async fn pin_task_cmd(
    state: State<'_, Arc<AppState>>,
    project: String,
    task_id: String,
    pinned: bool,
) -> Result<(), String> {
    let pool = state.project_db(&project).await.map_err(|e| e.to_string())?;
    crate::db::pin_task(&pool, &task_id, pinned).map_err(|e| e.to_string())
}
