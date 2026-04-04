pub mod downloader;
pub mod model;
pub mod online_store;
pub mod scanner;
pub mod source_config_store;
use model::Track;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};
use tauri::{Manager, State};
use tracing::{debug, error, info, warn};
use tracing_subscriber::fmt::writer::MakeWriter;

struct AppState {
    tracks: Mutex<Vec<Track>>,
    http_client: reqwest::Client,
}

const RUNTIME_LOG_FILE: &str = "runtime.log";

// Global concurrent request counter for stream:// protocol
static ACTIVE_STREAM_REQUESTS: AtomicUsize = AtomicUsize::new(0);
const MAX_CONCURRENT_STREAMS: usize = 10;

#[derive(Clone)]
struct RuntimeLogMakeWriter {
    path: Option<PathBuf>,
}

struct RuntimeLogWriter {
    file: Option<std::fs::File>,
}

impl<'a> MakeWriter<'a> for RuntimeLogMakeWriter {
    type Writer = RuntimeLogWriter;

    fn make_writer(&'a self) -> Self::Writer {
        let file = self.path.as_ref().and_then(|path| {
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }

            OpenOptions::new().create(true).append(true).open(path).ok()
        });

        RuntimeLogWriter { file }
    }
}

impl Write for RuntimeLogWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if let Some(file) = self.file.as_mut() {
            file.write(buf)
        } else {
            Ok(buf.len())
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        if let Some(file) = self.file.as_mut() {
            file.flush()
        } else {
            Ok(())
        }
    }
}

#[derive(serde::Serialize)]
struct CloudConfig {
    endpoint: String,
    access_key_id: String,
    secret_access_key: String,
    bucket: String,
}

#[tauri::command]
fn get_cloud_config(app: tauri::AppHandle) -> Result<CloudConfig, String> {
    // Production: .env bundled into app Resources (tauri.conf.json resources)
    if let Ok(resource_dir) = app.path().resource_dir() {
        dotenvy::from_filename(resource_dir.join(".env")).ok();
    }
    // Production fallback: .env next to the executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            dotenvy::from_filename(dir.join(".env")).ok();
        }
    }
    // Dev fallback: project root and src-tauri/
    dotenvy::from_filename("src-tauri/.env").ok();
    dotenvy::dotenv().ok();

    Ok(CloudConfig {
        endpoint: std::env::var("R2_ENDPOINT").map_err(|_| "R2_ENDPOINT not set in .env")?,
        access_key_id: std::env::var("R2_ACCESS_KEY_ID")
            .map_err(|_| "R2_ACCESS_KEY_ID not set in .env")?,
        secret_access_key: std::env::var("R2_SECRET_ACCESS_KEY")
            .map_err(|_| "R2_SECRET_ACCESS_KEY not set in .env")?,
        bucket: std::env::var("R2_BUCKET").map_err(|_| "R2_BUCKET not set in .env")?,
    })
}

#[tauri::command]
async fn scan_paths(paths: Vec<String>, state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let roots: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    // Run CPU/IO-heavy scanning off the async executor thread
    let summary = tauri::async_runtime::spawn_blocking(move || scanner::scan_paths(roots))
        .await
        .map_err(|e| format!("spawn_blocking join: {e}"))?
        .map_err(|e| e.to_string())?;
    let mut state_tracks = state
        .tracks
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    *state_tracks = summary.tracks.clone();
    Ok(summary.tracks)
}

#[tauri::command]
fn get_tracks(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    Ok(state
        .tracks
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?
        .clone())
}

#[tauri::command]
fn remove_tracks(
    mut indices: Vec<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<Track>, String> {
    indices.sort_unstable_by(|a, b| b.cmp(a));
    indices.dedup();
    let mut state_tracks = state
        .tracks
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    for &idx in &indices {
        if idx < state_tracks.len() {
            state_tracks.remove(idx);
        }
    }
    Ok(state_tracks.clone())
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_library_paths(paths: Vec<String>, app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&paths).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("library.json"), json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_library_paths(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let file = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("library.json");
    if !file.exists() {
        return Ok(vec![]);
    }
    let json = std::fs::read_to_string(file).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_online_favorites(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = online_store::favorites_path(&app)?;
    online_store::load_favorites(&path)
}

#[tauri::command]
fn save_online_favorites(app: tauri::AppHandle, ids: Vec<String>) -> Result<(), String> {
    let path = online_store::favorites_path(&app)?;
    online_store::save_favorites(&path, &ids)
}

#[tauri::command]
async fn download_online_track(
    app: tauri::AppHandle,
    url: String,
    title: String,
) -> Result<String, String> {
    let downloads_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("downloads");

    std::fs::create_dir_all(&downloads_dir).map_err(|e| e.to_string())?;

    let output_path = downloader::build_download_path(&downloads_dir, &title);
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "download request failed with status {}",
            response.status()
        ));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&output_path, &bytes).map_err(|e| e.to_string())?;

    Ok(output_path.to_string_lossy().to_string())
}

#[derive(serde::Serialize)]
struct ProxyResponse {
    status: u16,
    text: String,
    ok: bool,
}

#[tauri::command]
async fn proxy_http_request(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    state: State<'_, AppState>,
) -> Result<ProxyResponse, String> {
    let client = &state.http_client;

    let method_str = method.as_deref().unwrap_or("GET").to_uppercase();
    let req = match method_str.as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => client.get(&url),
    };

    let req = if let Some(map) = headers {
        map.iter().fold(req, |r, (k, v)| r.header(k.as_str(), v.as_str()))
    } else {
        req
    };

    let req = if let Some(b) = body {
        req.body(b)
    } else {
        req
    };

    info!("proxy_http_request method={} url={}", method_str, url);
    let response = req.send().await.map_err(|e| {
        let kind = if e.is_timeout() { "timeout" }
            else if e.is_connect() { "connect" }
            else if e.is_builder() { "builder" }
            else if e.is_decode() { "decode" }
            else { "other" };
        // Use {:#} to include the full error source chain (e.g. TLS details)
        warn!("proxy_http_request failed kind={kind} url={url} error={e:#}");
        format!("{kind}: {e:#}")
    })?;

    let status = response.status().as_u16();
    let ok = response.status().is_success();
    let text = response.text().await.map_err(|e| e.to_string())?;

    if !ok {
        warn!("proxy_http_request non-ok status={} url={}", status, url);
    }

    Ok(ProxyResponse { status, text, ok })
}

#[tauri::command]
fn get_log_path(app: tauri::AppHandle) -> Option<String> {
    default_runtime_log_path(&app.config().identifier)
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn load_source_config(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = source_config_store::config_path(&app)?;
    source_config_store::load_config(&path)
}

#[tauri::command]
fn save_source_config(
    app: tauri::AppHandle,
    config: serde_json::Value,
) -> Result<(), String> {
    let path = source_config_store::config_path(&app)?;
    source_config_store::save_config(&path, &config)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read_text_file {path}: {e}"))
}

#[tauri::command]
fn read_file_b64(path: String) -> Result<String, String> {
    use base64::Engine as _;
    let bytes = std::fs::read(&path).map_err(|e| format!("read_file_b64 {path}: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
async fn upload_via_presigned_url(
    path: String,
    url: String,
) -> Result<(), String> {
    let path_owned = path.clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || std::fs::read(&path_owned))
        .await
        .map_err(|e| format!("spawn_blocking: {e}"))?
        .map_err(|e| format!("read {path}: {e}"))?;

    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("build client: {e}"))?;

    let response = client
        .put(&url)
        .header("content-type", "audio/mpeg")
        .body(bytes)
        .send()
        .await
        .map_err(|e| format!("PUT failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("PUT {status}: {body}"));
    }
    Ok(())
}

#[tauri::command]
async fn delete_via_presigned_url(url: String) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("build client: {e}"))?;

    let response = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("DELETE failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("DELETE {status}: {body}"));
    }
    Ok(())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);
    if file_path.exists() {
        std::fs::remove_file(file_path).map_err(|e| e.to_string())?;
        info!("Deleted file: {}", path);
    }
    Ok(())
}

#[tauri::command]
fn write_runtime_log(level: String, message: String) -> Result<(), String> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Ok(());
    }

    match level.as_str() {
        "debug" => debug!("{trimmed}"),
        "warn" => warn!("{trimmed}"),
        "error" => error!("{trimmed}"),
        _ => info!("{trimmed}"),
    }

    Ok(())
}

fn default_runtime_log_path(bundle_identifier: &str) -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join(bundle_identifier)
            .join("logs")
            .join(RUNTIME_LOG_FILE),
    )
}

fn append_runtime_log_line(log_path: Option<&PathBuf>, message: &str) {
    let Some(path) = log_path else {
        return;
    };

    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{message}");
    }
}

pub fn run() {
    let context = tauri::generate_context!();
    let log_path = default_runtime_log_path(&context.config().identifier);

    let default_panic_hook = std::panic::take_hook();
    let panic_log_path = log_path.clone();
    std::panic::set_hook(Box::new(move |panic_info| {
        let thread = std::thread::current();
        append_runtime_log_line(
            panic_log_path.as_ref(),
            &format!(
                "[panic] thread={} {panic_info}",
                thread.name().unwrap_or("unnamed")
            ),
        );
        default_panic_hook(panic_info);
    }));

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .with_ansi(false)
        .compact()
        .with_writer(RuntimeLogMakeWriter {
            path: log_path.clone(),
        })
        .init();

    info!("Tips starting up");
    if let Some(path) = log_path.as_ref() {
        info!("Runtime log file: {}", path.display());
    }

    let run_result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Ok(dir) = app.path().app_data_dir() {
                info!("App data dir: {}", dir.display());
            }
            Ok(())
        })
        .manage(AppState {
            tracks: Mutex::new(Vec::new()),
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .expect("failed to build reqwest client"),
        })
        .register_asynchronous_uri_scheme_protocol("stream", |_ctx, request, responder| {
            let uri = request.uri().to_string();
            let path_encoded = uri
                .strip_prefix("stream://localhost/")
                .unwrap_or("")
                .to_string();
            let decoded = urldecode(&path_encoded);
            let range_header = request
                .headers()
                .get("Range")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());
            std::mem::drop(tauri::async_runtime::spawn_blocking(move || {
                use std::io::{Read, Seek, SeekFrom};

                // Check concurrent request limit
                let current = ACTIVE_STREAM_REQUESTS.load(Ordering::Relaxed);
                if current >= MAX_CONCURRENT_STREAMS {
                    warn!(
                        "stream too many concurrent requests ({}/{}), rejecting path={}",
                        current, MAX_CONCURRENT_STREAMS, decoded
                    );
                    if let Ok(resp) = tauri::http::Response::builder()
                        .status(503)
                        .header("retry-after", "1")
                        .body(Vec::new())
                    {
                        responder.respond(resp);
                    }
                    return;
                }

                ACTIVE_STREAM_REQUESTS.fetch_add(1, Ordering::Relaxed);
                let _guard = scopeguard::guard((), |_| {
                    ACTIVE_STREAM_REQUESTS.fetch_sub(1, Ordering::Relaxed);
                });

                macro_rules! respond_err {
                    ($status:expr, $($arg:tt)*) => {{
                        warn!($($arg)*);
                        if let Ok(resp) = tauri::http::Response::builder()
                            .status($status)
                            .body(Vec::new())
                        {
                            responder.respond(resp);
                        }
                        return;
                    }};
                }

                let file_path = Path::new(&decoded);
                debug!(
                    "stream request path={} range={:?}",
                    file_path.display(),
                    range_header
                );
                let file_size = match std::fs::metadata(file_path) {
                    Ok(m) => m.len(),
                    Err(error) => respond_err!(
                        404,
                        "stream metadata failed path={} error={}",
                        file_path.display(),
                        error
                    ),
                };

                // parse_range returns None for 416 Range Not Satisfiable
                let (start, end, status) = match parse_range(range_header.as_deref(), file_size) {
                    Some(r) => r,
                    None => {
                        warn!(
                            "stream invalid range path={} range={:?} file_size={}",
                            file_path.display(),
                            range_header,
                            file_size
                        );
                        if let Ok(resp) = tauri::http::Response::builder()
                            .status(416)
                            .header("content-range", format!("bytes */{file_size}"))
                            .body(Vec::new())
                        {
                            responder.respond(resp);
                        }
                        return;
                    }
                };

                let mut file = match std::fs::File::open(file_path) {
                    Ok(f) => f,
                    Err(error) => respond_err!(
                        404,
                        "stream open failed path={} error={}",
                        file_path.display(),
                        error
                    ),
                };

                // Cap per-request allocation to 2 MB; browser will issue follow-up Range requests.
                const MAX_CHUNK: u64 = 2 * 1024 * 1024;
                let capped_end = end.min(start + MAX_CHUNK - 1);
                let chunk_len = (capped_end - start + 1) as usize;
                let mut buf = vec![0u8; chunk_len];
                if let Err(error) = file.seek(SeekFrom::Start(start)) {
                    respond_err!(
                        500,
                        "stream seek failed path={} start={} error={}",
                        file_path.display(),
                        start,
                        error
                    );
                }

                let mut total = 0usize;
                while total < chunk_len {
                    match file.read(&mut buf[total..]) {
                        Ok(0) => break,
                        Ok(n) => total += n,
                        Err(error) => {
                            respond_err!(
                                500,
                                "stream read failed path={} start={} end={} error={}",
                                file_path.display(),
                                start,
                                capped_end,
                                error
                            );
                        }
                    }
                }

                buf.truncate(total);

                if buf.is_empty() {
                    respond_err!(
                        500,
                        "stream produced empty response path={} start={} end={} file_size={}",
                        file_path.display(),
                        start,
                        capped_end,
                        file_size
                    );
                }

                let actual_len = buf.len();
                let actual_end = start + actual_len.saturating_sub(1) as u64;
                let mut builder = tauri::http::Response::builder()
                    .status(status)
                    .header("content-type", "audio/mpeg")
                    .header("accept-ranges", "bytes")
                    .header("content-length", actual_len.to_string());
                if status == 206 {
                    builder = builder.header(
                        "content-range",
                        format!("bytes {start}-{actual_end}/{file_size}"),
                    );
                }
                match builder.body(buf) {
                    Ok(resp) => responder.respond(resp),
                    Err(e) => error!("stream failed to build response path={} error={e}", file_path.display()),
                }
            }));
        })
        .invoke_handler(tauri::generate_handler![
            get_cloud_config,
            scan_paths,
            get_tracks,
            remove_tracks,
            reveal_in_finder,
            delete_file,
            write_runtime_log,
            show_main_window,
            save_library_paths,
            load_library_paths,
            load_online_favorites,
            save_online_favorites,
            download_online_track,
            proxy_http_request,
            get_log_path,
            load_source_config,
            save_source_config,
            read_text_file,
            read_file_b64,
            upload_via_presigned_url,
            delete_via_presigned_url,
        ])
        .run(context);

    if let Err(run_error) = run_result {
        error!("error while running tauri application: {run_error}");
    }
}

fn urldecode(s: &str) -> String {
    let mut bytes: Vec<u8> = Vec::with_capacity(s.len());
    let mut iter = s.bytes();
    while let Some(b) = iter.next() {
        if b == b'%' {
            let hi = iter.next().and_then(|c| (c as char).to_digit(16));
            let lo = iter.next().and_then(|c| (c as char).to_digit(16));
            if let (Some(h), Some(l)) = (hi, lo) {
                bytes.push((h * 16 + l) as u8);
            }
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── parse_range ──────────────────────────────────────────────────────────

    #[test]
    fn no_range_header_returns_full_file_200() {
        assert_eq!(parse_range(None, 1000), Some((0, 999, 200)));
    }

    #[test]
    fn open_ended_range_clamps_to_file_end() {
        assert_eq!(parse_range(Some("bytes=500-"), 1000), Some((500, 999, 206)));
    }

    #[test]
    fn explicit_range_returns_206() {
        assert_eq!(parse_range(Some("bytes=0-499"), 1000), Some((0, 499, 206)));
    }

    #[test]
    fn end_beyond_eof_is_clamped() {
        assert_eq!(parse_range(Some("bytes=0-9999"), 1000), Some((0, 999, 206)));
    }

    #[test]
    fn start_equals_last_byte() {
        assert_eq!(
            parse_range(Some("bytes=999-999"), 1000),
            Some((999, 999, 206))
        );
    }

    #[test]
    fn start_at_eof_returns_none_416() {
        // start == file_size → past EOF
        assert_eq!(parse_range(Some("bytes=1000-"), 1000), None);
    }

    #[test]
    fn start_beyond_eof_returns_none_416() {
        assert_eq!(parse_range(Some("bytes=2000-2500"), 1000), None);
    }

    #[test]
    fn inverted_range_start_gt_end_returns_none_416() {
        // After clamping end=999, start=999 is fine; but start=1000 is past EOF → None
        assert_eq!(parse_range(Some("bytes=1000-500"), 1000), None);
    }

    #[test]
    fn zero_file_size_returns_200_with_zero_range() {
        assert_eq!(parse_range(None, 0), Some((0, 0, 200)));
        assert_eq!(parse_range(Some("bytes=0-"), 0), Some((0, 0, 200)));
    }

    #[test]
    fn single_byte_file_full_range() {
        assert_eq!(parse_range(None, 1), Some((0, 0, 200)));
        assert_eq!(parse_range(Some("bytes=0-0"), 1), Some((0, 0, 206)));
    }

    // ── urldecode ────────────────────────────────────────────────────────────

    #[test]
    fn urldecode_plain_ascii() {
        assert_eq!(urldecode("hello"), "hello");
    }

    #[test]
    fn urldecode_percent_encoded_space() {
        assert_eq!(urldecode("hello%20world"), "hello world");
    }

    #[test]
    fn urldecode_chinese_path() {
        // '晴' = E6 99 B4 in UTF-8
        assert_eq!(urldecode("%E6%99%B4"), "晴");
    }

    #[test]
    fn urldecode_mixed() {
        assert_eq!(
            urldecode("Jay%20Chou%20-%20%E6%99%B4%E5%A4%A9.mp3"),
            "Jay Chou - 晴天.mp3"
        );
    }
}

fn parse_range(range: Option<&str>, file_size: u64) -> Option<(u64, u64, u16)> {
    if file_size == 0 {
        return Some((0, 0, 200));
    }
    if let Some(range_str) = range.and_then(|r| r.strip_prefix("bytes=")) {
        let mut parts = range_str.splitn(2, '-');
        let start = parts
            .next()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let end = parts
            .next()
            .filter(|s| !s.is_empty())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(file_size - 1)
            .min(file_size - 1);
        // Guard against start past EOF or malformed range (start > end)
        if start >= file_size || start > end {
            return None; // → 416 Range Not Satisfiable
        }
        Some((start, end, 206))
    } else {
        Some((0, file_size - 1, 200))
    }
}
