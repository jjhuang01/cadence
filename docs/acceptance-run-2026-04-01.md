# Acceptance Run — 2026-04-01

## Summary

- Date: 2026-04-01
- Operator: AI agent
- Sample library: `/Users/os/Downloads/伍佰的歌`
- Real MP3 sample count: 26
- Result: **PASS**

## What was verified

### Runtime / desktop app

- The native app started successfully.
- The main window title was observed as `Tips — Minimal Local MP3 Player`.

### Real sample scan

- Used the production scanner implementation from `src/scanner.rs`.
- Scanned the real directory `/Users/os/Downloads/伍佰的歌`.
- Result:
  - `SCAN_TRACKS=26`
  - `SCAN_ROOTS=1`
  - `SCAN_SKIPPED=0`
  - `SCAN_WARNINGS=0`

### Real sample playback

- Used the production player implementation from `src/player.rs`.
- Loaded the scanned queue into `PlayerHandle`.
- Started playback of track index `0`.
- Verified runtime snapshot transitions on a real audio device:
  - `Idle` → `Playing`
  - progress advanced from `0ms` to `1185ms`
  - `Playing` → `Paused` → `Playing`
  - `Next` switched to index `1`
  - `Previous` returned to index `0`
  - volume updated to `0.42`

## Key evidence

### Queue and playback snapshots

```text
SNAPSHOT_QUEUE=state=Idle;current_index=None;current_title=None;position_ms=0;duration_ms=None;volume=0.90;queue_len=26;last_error=None;has_output_device=false
SNAPSHOT_PLAY_1=state=Playing;current_index=Some(0);current_title=Some("伍佰 & China Blue - Last Dance");position_ms=0;duration_ms=Some(271533);volume=1.00;queue_len=26;last_error=None;has_output_device=true
SNAPSHOT_PROGRESS=state=Playing;current_index=Some(0);current_title=Some("伍佰 & China Blue - Last Dance");position_ms=1185;duration_ms=Some(271533);volume=1.00;queue_len=26;last_error=None;has_output_device=true
SNAPSHOT_PAUSED=state=Paused;current_index=Some(0);current_title=Some("伍佰 & China Blue - Last Dance");position_ms=1275;duration_ms=Some(271533);volume=1.00;queue_len=26;last_error=None;has_output_device=true
SNAPSHOT_RESUMED=state=Playing;current_index=Some(0);current_title=Some("伍佰 & China Blue - Last Dance");position_ms=1280;duration_ms=Some(271533);volume=1.00;queue_len=26;last_error=None;has_output_device=true
SNAPSHOT_NEXT=state=Playing;current_index=Some(1);current_title=Some("伍佰 & China Blue - 再度重相逢");position_ms=0;duration_ms=Some(209866);volume=1.00;queue_len=26;last_error=None;has_output_device=true
SNAPSHOT_PREVIOUS=state=Playing;current_index=Some(0);current_title=Some("伍佰 & China Blue - Last Dance");position_ms=0;duration_ms=Some(271533);volume=1.00;queue_len=26;last_error=None;has_output_device=true
SNAPSHOT_VOLUME=state=Playing;current_index=Some(0);current_title=Some("伍佰 & China Blue - Last Dance");position_ms=340;duration_ms=Some(271533);volume=0.42;queue_len=26;last_error=None;has_output_device=true
ACCEPTANCE_RESULT=PASS
```

### Playback log excerpts

```text
INFO playback started track=/Users/os/Downloads/伍佰的歌/伍佰 & China Blue - Last Dance.mp3 index=0
INFO playback paused
INFO playback resumed
INFO playback started track=/Users/os/Downloads/伍佰的歌/伍佰 & China Blue - 再度重相逢.mp3 index=1
INFO playback started track=/Users/os/Downloads/伍佰的歌/伍佰 & China Blue - Last Dance.mp3 index=0
```

## Notes

- This acceptance run used the real production scanner and player modules, not mocks.
- A native window launch was verified separately before the runtime acceptance harness was used.
- Native `egui` controls are self-rendered, so system-level UI automation for the import button was not stable enough to treat as reliable acceptance evidence in this environment.
- The core product path required by the MVP — scanning a local MP3 folder and playing tracks with basic controls — was verified against real user files and a real audio output device.
