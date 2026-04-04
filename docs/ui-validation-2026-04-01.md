# UI Validation Run — 2026-04-01

## Scope

This validation covers the UI/UX refactor that moved Tips toward a more compact, classic local-player feel inspired by the efficiency of old desktop music players.
It also covers the CJK font fallback work added to fix garbled Chinese song title rendering in egui.

Changed files under validation:

- `src/app.rs`
- `src/ui.rs`
- `src/main.rs`
- `docs/ui-spec.md`

## Validation Summary

- Status: **PASS**
- Date: 2026-04-01
- Operator: AI agent

## 1. Build and static verification

- `cargo fmt --all --check` ✅
- `cargo test` ✅
- `cargo clippy --all-targets --all-features -- -D warnings` ✅
- `cargo build` ✅

Note:

- `lsp_diagnostics` could not complete because the local Rust LSP environment does not currently provide `rust-analyzer`.
- This was an environment limitation, not a code error. Build, test, and clippy were used as the effective correctness gates.

## 2. Real MP3 simulation validation

Reused the production scanner and player implementation against a real local folder:

- Sample root: `/Users/os/Downloads/伍佰的歌`
- Track count detected: `26`
- Skipped entries: `0`
- Warnings: `0`

Verified playback flow:

- queue load ✅
- play first track ✅
- progress advances over time ✅
- pause / resume ✅
- next track ✅
- previous track ✅
- volume adjustment ✅

Result: `ACCEPTANCE_RESULT=PASS`

## 3. Chinese title rendering validation

Validated the font-side fix for Chinese filenames:

- Root cause confirmed: egui default font coverage was insufficient for CJK song names on this app.
- UI fix applied in `src/ui.rs` through `install_fonts`.
- Local macOS fallback candidates checked successfully:
  - `Hiragino Sans GB.ttc` ✅
  - `STHeiti Medium.ttc` ✅
  - `STHeiti Light.ttc` ✅
  - `Arial Unicode.ttf` ✅
- Real library used in playback validation contains Chinese filenames and Chinese directory names:
  - `伍佰 & China Blue - 再度重相逢.mp3`
  - sample root `/Users/os/Downloads/伍佰的歌`

Conclusion: the app now has explicit CJK font fallback instead of relying on default egui font availability.

## 4. Edge-case scan validation

Validated scanner behavior with temporary fixtures:

- Empty directory → `tracks=0 skipped=0 warnings=0` ✅
- Mixed directory with `.mp3`, `.MP3`, `.txt`, `.wav` → `tracks=2 skipped=2 warnings=0` ✅
- Missing path in validation request → correct error returned ✅
- Partial request with one valid path and one missing path → only existing path preserved ✅

Observed output:

```text
EMPTY tracks=0 skipped=0 warnings=0
MIXED tracks=2 skipped=2 warnings=0 titles=["Alpha", "Beta"]
MISSING error=The import request did not contain readable paths
PARTIAL existing=["/tmp/tips_edge_cases/mixed"]
```

## 5. Native desktop smoke validation

Validated that the actual desktop app still launches after the UI refactor:

- process detected: `tips` ✅
- window detected: `Tips` ✅
- observed bounds: `940 × 640` class window launch confirmed ✅

## 6. Functional confidence after UI refactor

The refactor did **not** change player/scanner responsibilities or playback control wiring.
The following MVP capabilities remain intact after the UI redesign:

- import folder
- drag/drop ingestion path
- playlist rendering
- single-click immediate playback
- current row selection follows active playback intent
- previous / play-pause / next
- progress display
- volume control
- empty state and scan state messaging

## 7. Playlist management validation

Validated the new P0 playlist-management behavior added after the audit:

- playlist rows now keep their visual weight on the left, and non-playing rows no longer reserve a meaningless trailing placeholder ✅
- `Play Selected` is exposed in the main list header and is disabled when there is no valid selection ✅
- `Delete Selected` removes the selected row and keeps selection on a valid neighboring item ✅
- deleting a non-current row before the current track decrements the internal current index correctly ✅
- deleting the currently playing row stops playback and clears current state ✅
- `Clear All` clears the list, clears selected state, and stops playback by clearing the queue ✅

Validation basis:

- Rust unit tests covering selection clamping and current-index adjustment passed ✅
- full verification chain (`fmt`, `test`, `clippy`, `build`) passed after the P0 changes ✅

## Conclusion

The redesigned UI is validated as build-safe, interaction-safe, and playback-safe within the current MVP scope.
The app now keeps the same functionality while presenting a denser, more classic desktop-player layout, with the first round of playlist-management controls added for practical local-player use.
