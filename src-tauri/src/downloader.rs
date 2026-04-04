use std::path::{Path, PathBuf};

pub fn sanitize_filename(title: &str) -> String {
    let mut sanitized = String::with_capacity(title.len());

    for ch in title.trim().chars() {
        let mapped = match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ if ch.is_control() => '_',
            _ => ch,
        };
        sanitized.push(mapped);
    }

    let trimmed = sanitized.trim_matches([' ', '.']).trim();
    let mut collapsed = String::with_capacity(trimmed.len());
    let mut prev_is_underscore = false;

    for ch in trimmed.chars() {
        let is_underscore = ch == '_';
        if is_underscore && prev_is_underscore {
            continue;
        }
        collapsed.push(ch);
        prev_is_underscore = is_underscore;
    }

    let cleaned = collapsed.trim_matches('_').trim();

    if cleaned.is_empty() {
        return "track".to_string();
    }

    match cleaned.strip_suffix(".mp3") {
        Some(base) if !base.is_empty() => base.to_string(),
        _ => cleaned.to_string(),
    }
}

pub fn build_download_path(base_dir: &Path, title: &str) -> PathBuf {
    let file_name = format!("{}.mp3", sanitize_filename(title));
    base_dir.join(file_name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_download_filename() {
        assert_eq!(sanitize_filename("A/B:C"), "A_B_C");
    }

    #[test]
    fn sanitize_filename_falls_back_for_empty_or_unsafe_input() {
        assert_eq!(sanitize_filename("   "), "track");
        assert_eq!(sanitize_filename("..."), "track");
        assert_eq!(sanitize_filename("/\\:*?\"<>|"), "track");
    }

    #[test]
    fn build_download_path_always_uses_mp3_extension() {
        let base_dir = PathBuf::from("/tmp/downloads");
        let path = build_download_path(&base_dir, "Blue Sky.mp3");
        assert_eq!(path, PathBuf::from("/tmp/downloads/Blue Sky.mp3"));
    }
}
