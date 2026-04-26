use std::path::PathBuf;

pub fn kata_root() -> PathBuf {
    if let Ok(v) = std::env::var("KATA_ROOT") {
        return PathBuf::from(v);
    }
    if let Some(home) = dirs::home_dir() {
        return home.join("Projects").join("kata");
    }
    PathBuf::from(".")
}

pub fn workspace_root() -> PathBuf {
    kata_root().join("workspace")
}

pub fn kata_data_root() -> PathBuf {
    kata_root().join(".kata")
}

pub fn config_json_path() -> PathBuf {
    kata_root().join("config.json")
}

pub fn desktop_state_dir() -> PathBuf {
    kata_data_root().join("_desktop")
}

pub fn ui_db_path() -> PathBuf {
    desktop_state_dir().join("ui.db")
}

pub fn project_data_dir(project: &str) -> PathBuf {
    kata_data_root().join(project)
}

pub fn project_tasks_dir(project: &str) -> PathBuf {
    project_data_dir(project).join("tasks")
}

pub fn project_db_path(project: &str) -> PathBuf {
    project_data_dir(project).join("tasks.db")
}

pub fn errors_log_path() -> PathBuf {
    desktop_state_dir().join("errors.log")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kata_root_uses_env_when_set() {
        std::env::set_var("KATA_ROOT", "/tmp/test-kata");
        assert_eq!(kata_root(), PathBuf::from("/tmp/test-kata"));
        std::env::remove_var("KATA_ROOT");
    }

    #[test]
    fn project_paths_resolve_under_kata_data_root() {
        std::env::set_var("KATA_ROOT", "/tmp/x");
        assert_eq!(project_data_dir("foo"), PathBuf::from("/tmp/x/.kata/foo"));
        assert_eq!(project_db_path("foo"), PathBuf::from("/tmp/x/.kata/foo/tasks.db"));
        std::env::remove_var("KATA_ROOT");
    }
}
