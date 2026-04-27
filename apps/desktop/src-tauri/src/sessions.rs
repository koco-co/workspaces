use crate::db::{list_sessions, upsert_session, SessionRow};
use crate::db::DbPool;
use anyhow::Result;

pub fn record_session(pool: &DbPool, row: &SessionRow) -> Result<()> {
    upsert_session(pool, row)
}

pub fn fetch_sessions(pool: &DbPool, limit: usize) -> Result<Vec<SessionRow>> {
    list_sessions(pool, limit)
}
