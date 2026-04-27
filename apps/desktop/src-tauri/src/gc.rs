use crate::paths::{kata_data_root, project_db_path};
use crate::pty::{PtyManager, PtyState};
use std::sync::Arc;
use std::time::Duration;

pub const IDLE_TIMEOUT_SECS: i64 = 30 * 60;
pub const DEFAULT_RETENTION_DAYS: i64 = 30;

pub fn spawn_idle_gc(manager: Arc<PtyManager>) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            let map = manager.handles.read().await;
            let to_close: Vec<String> = {
                let mut v = Vec::new();
                for (name, h) in map.iter() {
                    let state = h.state.read().await.clone();
                    let last = *h.last_activity.read().await;
                    if state == PtyState::Idle && now - last > IDLE_TIMEOUT_SECS {
                        v.push(name.clone());
                    }
                }
                v
            };
            drop(map);
            for name in to_close {
                let _ = manager.kill(&name).await;
            }
        }
    });
}

pub async fn sweep_task_logs() -> anyhow::Result<usize> {
    let kata_root = kata_data_root();
    if !kata_root.exists() { return Ok(0); }
    let mut deleted = 0;
    let now_sec = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;
    let cutoff = now_sec - DEFAULT_RETENTION_DAYS * 86_400;

    for entry in std::fs::read_dir(&kata_root)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('_') || !entry.metadata()?.is_dir() { continue; }
        let db_path = project_db_path(&name);
        if !db_path.exists() { continue; }

        let pool = crate::db::open_project_pool(&db_path)?;
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, log_path FROM tasks
             WHERE pinned = 0
               AND COALESCE(retain_until, started_at + ?1) < ?2",
        )?;
        let candidates: Vec<(String, String)> = stmt
            .query_map([DEFAULT_RETENTION_DAYS * 86_400, cutoff], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect();

        for (id, log_path) in candidates {
            let _ = std::fs::remove_file(&log_path);
            let _ = conn.execute("DELETE FROM tasks WHERE id = ?1", [&id]);
            deleted += 1;
        }
    }
    Ok(deleted)
}

pub fn spawn_log_gc_on_startup() {
    tauri::async_runtime::spawn(async move {
        let _ = sweep_task_logs().await;
    });
}
