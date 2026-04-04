use std::path::{Path, PathBuf};
use tauri::Manager;

const ONLINE_FAVORITES_FILE: &str = "online-favorites.json";

pub fn favorites_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(ONLINE_FAVORITES_FILE))
}

pub fn load_favorites(path: &Path) -> Result<Vec<String>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

pub fn save_favorites(path: &Path, ids: &[String]) -> Result<(), String> {
    let json = serde_json::to_string(ids).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn favorites_round_trip() {
        let items = vec!["demo:1".to_string(), "demo:2".to_string()];
        let json = serde_json::to_string(&items).expect("serialize favorites");
        let restored: Vec<String> = serde_json::from_str(&json).expect("deserialize favorites");
        assert_eq!(restored, items);
    }

    #[test]
    fn load_missing_file_returns_empty_list() {
        let temp_dir = tempfile::tempdir().expect("create tempdir");
        let file = temp_dir.path().join("missing-online-favorites.json");
        let loaded = load_favorites(&file).expect("load missing file");
        assert!(loaded.is_empty());
    }

    #[test]
    fn save_then_load_returns_same_ids() {
        let temp_dir = tempfile::tempdir().expect("create tempdir");
        let file = temp_dir.path().join("online-favorites.json");
        let ids = vec!["demo:10".to_string(), "demo:99".to_string()];
        save_favorites(&file, &ids).expect("save favorites");

        let loaded = load_favorites(&file).expect("load saved favorites");
        assert_eq!(loaded, ids);
    }
}
