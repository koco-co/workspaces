mod cli_mock;

use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration;
use kata_workbench_lib::pty::{PtyManager, PtyState};

/// Shared mock instance used by all tests to avoid env-var races
/// during parallel execution. Since `KATA_CLAUDE_BIN` is process-global,
/// all tests must reference the same binary path.
fn shared_mock() -> &'static cli_mock::MockClaude {
    static MOCK: OnceLock<cli_mock::MockClaude> = OnceLock::new();
    MOCK.get_or_init(|| {
        let mock = cli_mock::MockClaude::new();
        std::env::set_var("KATA_CLAUDE_BIN", mock.bin_path());
        std::env::set_var("KATA_MOCK_SESSION_ID", mock.session_id());
        std::env::set_var("KATA_MOCK_TIMEOUT", "100");
        mock
    })
}

/// Ensure the shared mock env vars are set for this test thread.
/// Safe to call multiple times — the once_cell guarantees one-time init.
fn ensure_mock_env() {
    shared_mock();
}

// helper to create a temp workspace dir
fn tmp_workspace() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::TempDir::new().unwrap();
    let cwd = dir.path().join("project");
    std::fs::create_dir_all(&cwd).unwrap();
    (dir, cwd)
}

#[tokio::test]
async fn pty_parses_normal_output() {
    ensure_mock_env();
    let (_tmp, cwd) = tmp_workspace();
    let mgr = PtyManager::new();

    let (handle, mut rx) = mgr.get_or_spawn("test", cwd, None).await.unwrap();
    handle.write_input("hello").await.unwrap();

    let mut events = Vec::new();
    while let Some(line) = rx.recv().await {
        if line.contains("\"result\"") {
            events.push(line);
            break;
        }
        events.push(line);
    }

    assert!(events.iter().any(|l| l.contains("system") && l.contains("init")));
    assert!(events.iter().any(|l| l.contains("assistant")));
    assert!(events.iter().any(|l| l.contains("result")));
}

#[tokio::test]
async fn pty_detects_cli_crash() {
    ensure_mock_env();
    let (_tmp, cwd) = tmp_workspace();
    let mgr = PtyManager::new();

    let (handle, _rx) = mgr.get_or_spawn("crash-test", cwd, None).await.unwrap();

    // simulate crash by killing the child directly
    handle.kill().await.unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;

    assert_eq!(*handle.state.read().await, PtyState::Closed);
}

#[tokio::test]
async fn pty_kill_during_active() {
    ensure_mock_env();
    let (_tmp, cwd) = tmp_workspace();
    let mgr = PtyManager::new();

    let (handle, _rx) = mgr.get_or_spawn("kill-test", cwd, None).await.unwrap();
    *handle.state.write().await = PtyState::Active;

    handle.kill().await.unwrap();
    assert_eq!(*handle.state.read().await, PtyState::Closed);
}

#[tokio::test]
async fn session_id_captured_on_handle() {
    ensure_mock_env();
    let (_tmp, cwd) = tmp_workspace();

    let mgr = PtyManager::new();
    let (handle, mut rx) = mgr.get_or_spawn("session-test", cwd, None).await.unwrap();
    handle.write_input("hello").await.unwrap();

    // wait for the session_id from system.init event
    let mut session_id = None;
    while let Some(line) = rx.recv().await {
        if let Some(sid) = line.split("session_id").nth(1)
            .and_then(|s| s.split('"').nth(2))
        {
            session_id = Some(sid.to_string());
        }
        if line.contains("\"result\"") { break; }
    }

    let sid = session_id.expect("should have received a session_id");
    assert_eq!(*handle.session_id.read().await, Some(sid));
}
