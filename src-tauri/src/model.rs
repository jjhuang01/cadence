use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Track {
    pub path: PathBuf,
    pub title: String,
    pub subtitle: String,
    pub duration_secs: Option<f64>,
}

impl Track {
    pub fn from_path(path: PathBuf) -> Self {
        let (id3_title, id3_artist, duration_secs) = read_id3_meta(&path);
        let title = id3_title
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| title_from_path(&path));
        let subtitle = id3_artist
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| subtitle_from_path(&path));
        Self { path, title, subtitle, duration_secs }
    }
}

fn read_id3_meta(path: &Path) -> (Option<String>, Option<String>, Option<f64>) {
    use id3::{Tag, TagLike};
    let tag = Tag::read_from_path(path).ok();
    let title = tag.as_ref().and_then(|t| t.title()).map(str::to_owned);
    let artist = tag.as_ref().and_then(|t| t.artist()).map(str::to_owned);
    // TLEN tag is rarely present; fall back to mp3-duration frame scan
    let duration_secs = tag
        .as_ref()
        .and_then(|t| t.duration())
        .map(|ms| ms as f64 / 1000.0)
        .or_else(|| {
            // mp3_duration 0.1.x 在某些损坏/特殊 MP3 上会 panic（除零、越界）
            // 用 catch_unwind 隔离，防止 panic 传播到 spawn_blocking 外层
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                mp3_duration::from_path(path)
            }))
            .ok()
            .and_then(|r| r.ok())
            .map(|d| d.as_secs_f64())
        });
    (title, artist, duration_secs)
}

#[derive(Debug, Clone)]
pub struct ScanSummary {
    pub tracks: Vec<Track>,
    pub roots: Vec<PathBuf>,
    pub skipped_entries: usize,
    pub warnings: Vec<String>,
}

pub fn is_mp3_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("mp3"))
        .unwrap_or(false)
}

pub fn title_from_path(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.trim().is_empty())
        .unwrap_or("Unknown Track");

    // Try to extract title from 《》 brackets (common in Chinese music files)
    if let Some(open_pos) = stem.find('《') {
        // Find the char boundary after '《' (3 UTF-8 bytes)
        let after_open = open_pos + '《'.len_utf8();
        if let Some(close_rel) = stem[after_open..].find('》') {
            let title = &stem[after_open..after_open + close_rel];
            if !title.trim().is_empty() {
                return title.trim().to_string();
            }
        }
    }

    // Try to extract from "Artist - Title" or "01 - Artist - Title" format
    let parts: Vec<&str> = stem.split(" - ").collect();
    if parts.len() >= 2 {
        // Take the last part as title
        let title = parts.last().unwrap_or(&stem);
        if !title.trim().is_empty() {
            return title.trim().to_string();
        }
    }

    // Fallback: just clean up underscores
    stem.replace('_', " ").trim().to_string()
}

pub fn subtitle_from_path(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.trim().is_empty())
        .unwrap_or("");

    // Try to extract artist from "Artist - Title" format
    let parts: Vec<&str> = stem.split(" - ").collect();
    if parts.len() >= 2 {
        // If format is "01 - Artist - Title", take middle part
        // If format is "Artist - Title", take first part
        let artist_idx = if parts.len() >= 3 && parts[0].chars().all(|c| c.is_numeric() || c == '.')
        {
            1
        } else {
            0
        };
        let artist = parts.get(artist_idx).unwrap_or(&"");
        if !artist.trim().is_empty() {
            return artist.trim().to_string();
        }
    }

    // Fallback: use parent folder name
    path.parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("Local File")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_mp3_case_insensitively() {
        assert!(is_mp3_path(Path::new("demo.mp3")));
        assert!(is_mp3_path(Path::new("demo.MP3")));
        assert!(!is_mp3_path(Path::new("demo.wav")));
    }

    #[test]
    fn derives_title_and_subtitle_from_path() {
        let track = Track::from_path(PathBuf::from("/tmp/Albums/Night_drive.mp3"));
        assert_eq!(track.title, "Night drive");
        assert_eq!(track.subtitle, "Albums");
    }

    #[test]
    fn extracts_title_from_brackets() {
        let track = Track::from_path(PathBuf::from("/tmp/Albums/周杰伦《晴天》.mp3"));
        assert_eq!(track.title, "晴天");
    }

    #[test]
    fn extracts_title_from_artist_title_format() {
        let track = Track::from_path(PathBuf::from("/tmp/Albums/Jay Chou - Sunny Day.mp3"));
        assert_eq!(track.title, "Sunny Day");
        assert_eq!(track.subtitle, "Jay Chou");
    }

    #[test]
    fn extracts_from_numbered_format() {
        let track = Track::from_path(PathBuf::from("/tmp/Albums/01 - Artist - Song Name.mp3"));
        assert_eq!(track.title, "Song Name");
        assert_eq!(track.subtitle, "Artist");
    }
}
