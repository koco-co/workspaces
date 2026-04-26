use anyhow::Result;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::{Deserialize, Serialize};
use std::path::Path;

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn open_pool(path: &Path) -> Result<DbPool> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let manager = SqliteConnectionManager::file(path);
    let pool = Pool::builder().max_size(8).build(manager)?;
    run_migrations(&pool)?;
    Ok(pool)
}

pub fn run_migrations(pool: &DbPool) -> Result<()> {
    let conn = pool.get()?;
    conn.execute_batch(include_str!("db/migrations/0001_init.sql"))?;
    Ok(())
}

pub fn open_project_pool(path: &Path) -> Result<DbPool> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let manager = SqliteConnectionManager::file(path);
    let pool = Pool::builder().max_size(4).build(manager)?;
    let conn = pool.get()?;
    conn.execute_batch(include_str!("db/migrations/0001_tasks.sql"))?;
    Ok(pool)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRow {
    pub name: String,
    pub display_name: Option<String>,
    pub path: String,
    pub last_active_at: Option<i64>,
    pub metadata: Option<String>,
}

pub fn upsert_project(pool: &DbPool, row: &ProjectRow) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO projects (name, display_name, path, last_active_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(name) DO UPDATE SET
           display_name = excluded.display_name,
           path = excluded.path,
           metadata = excluded.metadata",
        rusqlite::params![row.name, row.display_name, row.path, row.last_active_at, row.metadata],
    )?;
    Ok(())
}

pub fn list_projects(pool: &DbPool) -> Result<Vec<ProjectRow>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT name, display_name, path, last_active_at, metadata
         FROM projects
         ORDER BY last_active_at DESC NULLS LAST, name ASC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ProjectRow {
            name: r.get(0)?,
            display_name: r.get(1)?,
            path: r.get(2)?,
            last_active_at: r.get(3)?,
            metadata: r.get(4)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn touch_project_active(pool: &DbPool, name: &str, when: i64) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE projects SET last_active_at = ?1 WHERE name = ?2",
        rusqlite::params![when, name],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn migrations_run_idempotently() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("ui.db");
        let pool = open_pool(&db_path).unwrap();
        run_migrations(&pool).unwrap(); // second run = no-op
        let conn = pool.get().unwrap();
        let count: i64 = conn
            .query_row("SELECT count(*) FROM projects", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn project_pool_creates_tasks_schema() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("tasks.db");
        let pool = open_project_pool(&db_path).unwrap();
        let conn = pool.get().unwrap();
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(tables.contains(&"tasks".to_string()));
        assert!(tables.contains(&"sessions".to_string()));
    }

    #[test]
    fn upsert_then_list_returns_project() {
        let dir = tempdir().unwrap();
        let pool = open_pool(&dir.path().join("ui.db")).unwrap();
        upsert_project(&pool, &ProjectRow {
            name: "demo".into(),
            display_name: Some("Demo".into()),
            path: "/tmp/demo".into(),
            last_active_at: None,
            metadata: None,
        }).unwrap();
        let list = list_projects(&pool).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "demo");
    }

    #[test]
    fn touch_active_updates_ordering() {
        let dir = tempdir().unwrap();
        let pool = open_pool(&dir.path().join("ui.db")).unwrap();
        upsert_project(&pool, &ProjectRow {
            name: "a".into(), display_name: None, path: "/tmp/a".into(),
            last_active_at: None, metadata: None,
        }).unwrap();
        upsert_project(&pool, &ProjectRow {
            name: "b".into(), display_name: None, path: "/tmp/b".into(),
            last_active_at: None, metadata: None,
        }).unwrap();
        touch_project_active(&pool, "b", 1000).unwrap();
        let list = list_projects(&pool).unwrap();
        assert_eq!(list[0].name, "b");
    }
}
