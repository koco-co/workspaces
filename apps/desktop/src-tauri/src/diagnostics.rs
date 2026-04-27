use crate::paths::{desktop_state_dir, errors_log_path};
use anyhow::Result;
use std::fs::OpenOptions;
use std::io::{Read, Seek, SeekFrom, Write};

pub fn append_error(line: &str) -> Result<()> {
    std::fs::create_dir_all(desktop_state_dir())?;
    let mut f = OpenOptions::new().create(true).append(true).open(errors_log_path())?;
    writeln!(f, "{}\t{}", chrono_like_now(), line)?;
    enforce_size_cap(10 * 1024 * 1024)?;
    Ok(())
}

fn chrono_like_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("ts={}", secs)
}

fn enforce_size_cap(max: u64) -> Result<()> {
    let path = errors_log_path();
    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    if size > max {
        let mut f = OpenOptions::new().read(true).write(true).open(&path)?;
        let cut = size / 2;
        f.seek(SeekFrom::Start(cut))?;
        let mut tail = String::new();
        f.read_to_string(&mut tail)?;
        std::fs::write(&path, tail)?;
    }
    Ok(())
}

pub fn read_recent_errors(lines: usize) -> Result<String> {
    let path = errors_log_path();
    if !path.exists() { return Ok(String::new()); }
    let content = std::fs::read_to_string(&path)?;
    let collected: Vec<&str> = content.lines().rev().take(lines).collect();
    Ok(collected.into_iter().rev().collect::<Vec<_>>().join("\n"))
}
