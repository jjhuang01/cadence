use std::path::{Path, PathBuf};
use tauri::Manager;

const SOURCE_CONFIG_FILE: &str = "source-config.json";

pub fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(SOURCE_CONFIG_FILE))
}

pub fn load_config(path: &Path) -> Result<Option<serde_json::Value>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let v = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(Some(v))
}

pub fn save_config(path: &Path, config: &serde_json::Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_round_trip() {
        let temp = tempfile::tempdir().expect("create tempdir");
        let path = temp.path().join("source-config.json");
        let config = serde_json::json!({
            "apiBaseUrl": "https://example.com",
            "activeSource": "wy",
            "quality": "128k"
        });
        save_config(&path, &config).expect("save");
        let loaded = load_config(&path).expect("load").expect("some");
        assert_eq!(loaded["apiBaseUrl"], "https://example.com");
    }

    #[test]
    fn load_missing_returns_none() {
        let temp = tempfile::tempdir().expect("create tempdir");
        let path = temp.path().join("missing.json");
        assert!(load_config(&path).expect("ok").is_none());
    }
}
