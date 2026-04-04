use crate::model::{is_mp3_path, ScanSummary, Track};

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

pub fn scan_paths(roots: Vec<PathBuf>) -> anyhow::Result<ScanSummary> {
    let mut tracks = Vec::new();
    let mut dedup: HashSet<PathBuf> = HashSet::new();
    let mut seen_roots: HashSet<PathBuf> = HashSet::new();
    let mut normalized_roots = Vec::new();
    let mut skipped_entries = 0usize;
    let mut warnings = Vec::new();

    for root in roots {
        let canonical_root = canonical_or_original(&root);
        if seen_roots.insert(canonical_root.clone()) {
            normalized_roots.push(canonical_root.clone());
        }

        if canonical_root.is_file() {
            if is_mp3_path(&canonical_root) {
                push_track(&canonical_root, &mut dedup, &mut tracks);
            } else {
                skipped_entries += 1;
            }
            continue;
        }

        if !canonical_root.is_dir() {
            warnings.push(format!(
                "Skipped missing or unsupported path: {}",
                canonical_root.display()
            ));
            continue;
        }

        for entry in WalkDir::new(&canonical_root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| !is_hidden(entry))
        {
            match entry {
                Ok(entry) => {
                    if entry.file_type().is_file() {
                        let path = entry.path();
                        if is_mp3_path(path) {
                            push_track(path, &mut dedup, &mut tracks);
                        } else {
                            skipped_entries += 1;
                        }
                    }
                }
                Err(error) => {
                    skipped_entries += 1;
                    warnings.push(format!("Walk error: {error}"));
                }
            }
        }
    }

    tracks.sort_by(|left, right| {
        left.title
            .to_lowercase()
            .cmp(&right.title.to_lowercase())
            .then_with(|| left.path.cmp(&right.path))
    });

    Ok(ScanSummary {
        tracks,
        roots: normalized_roots,
        skipped_entries,
        warnings,
    })
}

fn push_track(path: &Path, dedup: &mut HashSet<PathBuf>, tracks: &mut Vec<Track>) {
    let canonical = canonical_or_original(path);
    if dedup.insert(canonical.clone()) {
        tracks.push(Track::from_path(canonical));
    }
}

fn canonical_or_original(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn is_hidden(entry: &DirEntry) -> bool {
    if entry.depth() == 0 {
        return false;
    }

    entry
        .file_name()
        .to_str()
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, File};
    use tempfile::tempdir;

    #[test]
    fn scans_nested_mp3_files_and_sorts_them() {
        let dir = tempdir().unwrap();
        let albums = dir.path().join("Albums");
        let side_b = albums.join("SideB");
        create_dir_all(&side_b).unwrap();

        File::create(albums.join("Zulu.mp3")).unwrap();
        File::create(side_b.join("Alpha.mp3")).unwrap();
        File::create(side_b.join("notes.txt")).unwrap();

        let summary = scan_paths(vec![dir.path().to_path_buf()]).unwrap();
        assert_eq!(summary.tracks.len(), 2);
        assert_eq!(summary.tracks[0].title, "Alpha");
        assert_eq!(summary.tracks[1].title, "Zulu");
        assert!(summary.skipped_entries >= 1);
    }
}
