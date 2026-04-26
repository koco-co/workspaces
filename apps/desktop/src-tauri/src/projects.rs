use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectInfo {
    pub name: String,
    pub display_name: Option<String>,
    pub path: PathBuf,
}

pub fn scan(workspace_root: &Path) -> Result<Vec<ProjectInfo>> {
    if !workspace_root.exists() {
        return Ok(Vec::new());
    }
    let mut projects = Vec::new();
    for entry in std::fs::read_dir(workspace_root)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if !metadata.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        projects.push(ProjectInfo {
            name: name.clone(),
            display_name: None,
            path: entry.path(),
        });
    }
    projects.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(projects)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn scan_empty_workspace_returns_empty_list() {
        let dir = tempdir().unwrap();
        assert!(scan(dir.path()).unwrap().is_empty());
    }

    #[test]
    fn scan_lists_project_subdirs() {
        let dir = tempdir().unwrap();
        std::fs::create_dir(dir.path().join("foo")).unwrap();
        std::fs::create_dir(dir.path().join("bar")).unwrap();
        let projects = scan(dir.path()).unwrap();
        assert_eq!(projects.len(), 2);
        assert_eq!(projects[0].name, "bar");
        assert_eq!(projects[1].name, "foo");
    }

    #[test]
    fn scan_skips_dotfiles_and_files() {
        let dir = tempdir().unwrap();
        std::fs::create_dir(dir.path().join(".kata")).unwrap();
        std::fs::write(dir.path().join("README.md"), "x").unwrap();
        std::fs::create_dir(dir.path().join("real")).unwrap();
        let projects = scan(dir.path()).unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "real");
    }
}
