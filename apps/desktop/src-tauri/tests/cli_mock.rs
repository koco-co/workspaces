use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

pub const KATA_MOCK_SESSION_ID: &str = "test-sid";

const MOCK_SCRIPT: &str = r#"#!/bin/bash
SESSION_ID="${KATA_MOCK_SESSION_ID:-test-sid}"
TIMEOUT="${KATA_MOCK_TIMEOUT:-100}"
IFS= read -r input_line
case "$input_line" in
  *"fail-login"*)
    echo '{"type":"system","subtype":"init","session_id":"fail-sid"}'
    echo '{"type":"assistant","message":{"content":[{"type":"text","text":"401 Unauthorized"}]}}'
    echo '{"type":"result","is_error":true,"result":"401 Unauthorized"}'
    ;;
  *)
    echo '{"type":"system","subtype":"init","session_id":"'"$SESSION_ID"'"}'
    echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Mock reply"}]}}'
    echo '{"type":"result","total_cost_usd":0.0,"duration_ms":'"$TIMEOUT"'}'
    ;;
esac
"#;

pub struct MockClaude {
    script_path: PathBuf,
    _data_dir: TempDir,
}

impl MockClaude {
    pub fn new() -> Self {
        let dir = TempDir::new().unwrap();
        let script = dir.path().join("claude");
        fs::write(&script, MOCK_SCRIPT).unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o755)).unwrap();
        Self { script_path: script, _data_dir: dir }
    }

    pub fn bin_path(&self) -> &Path {
        &self.script_path
    }

    pub fn session_id(&self) -> &str {
        KATA_MOCK_SESSION_ID
    }
}
