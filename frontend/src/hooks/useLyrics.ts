import { useState, useCallback, useRef } from "react";
import { writeRuntimeLog } from '../utils/runtimeLog';

export interface LyricLine {
  time: number; // seconds
  text: string;
}

interface LyricsState {
  lines: LyricLine[];
  isSynced: boolean;
  isLoading: boolean;
  error: string | null;
}

interface LrcLibResult {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
  duration?: number;
}

// Parse LRC format: [00:17.12] lyrics text
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const timeTagRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const rawLine of lrc.split(/\r?\n/)) {
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;

    while ((match = timeTagRegex.exec(rawLine)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fraction = match[3] ?? '0';
      const divisor = fraction.length === 3 ? 1000 : 100;
      const time = minutes * 60 + seconds + parseInt(fraction, 10) / divisor;
      timestamps.push(time);
    }

    const text = rawLine.replace(timeTagRegex, '').trim();
    if (!text || timestamps.length === 0) continue;

    for (const time of timestamps) {
      lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

export function useLyrics() {
  const [state, setState] = useState<LyricsState>({
    lines: [],
    isSynced: false,
    isLoading: false,
    error: null,
  });
  const [offset, setOffset] = useState(0); // seconds to shift timestamps (positive = delay, negative = advance)
  const abortRef = useRef<AbortController | null>(null);
  const lastRequestKeyRef = useRef<string | null>(null);

  const fetchLyrics = useCallback(
    async (trackName: string, artistName?: string, duration?: number, force = false) => {
      const durationKey = duration && duration > 0 ? Math.round(duration).toString() : 'unknown';
      const requestKey = `${trackName}::${artistName ?? ''}::${durationKey}`;
      if (!force && lastRequestKeyRef.current === requestKey) {
        return;
      }

      lastRequestKeyRef.current = requestKey;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ lines: [], isSynced: false, isLoading: true, error: null });
      void writeRuntimeLog(
        'info',
        `lyrics fetch track=${trackName} artist=${artistName ?? 'n/a'} duration=${duration ? duration.toFixed(3) : 'n/a'} force=${force ? 'yes' : 'no'}`,
      );

      try {
        const params = new URLSearchParams({ track_name: trackName });
        // Pass artist only when it looks like a real name, not a folder slug (e.g. "classic_songs")
        const looksLikeFolder = artistName && /^[a-z0-9_\-]+$/.test(artistName);
        if (artistName && !looksLikeFolder) params.append('artist_name', artistName);

        // /api/search: only needs track_name, returns an array of results
        // /api/get: requires artist_name (mandatory) → not suitable here
        const res = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const results: LrcLibResult[] = await res.json();
        const withLyrics = results.filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics));

        // When we know the song duration, pick the version with the closest duration
        // to avoid selecting live/karaoke/remixed versions with mismatched timestamps
        let best: LrcLibResult | null = null;
        if (duration && duration > 0 && withLyrics.length > 0) {
          const scored = withLyrics.map((r) => ({
            r,
            diff: Math.abs((r.duration ?? 0) - duration),
          }));
          scored.sort((a, b) => a.diff - b.diff);
          // Prefer synced lyrics among close matches (within 10s of duration)
          const closeSynced = scored.find((s) => s.diff <= 10 && s.r.syncedLyrics);
          best = closeSynced?.r ?? scored[0]?.r ?? null;
        } else {
          best = withLyrics.find((r) => r.syncedLyrics) ?? withLyrics[0] ?? null;
        }

        if (!best) {
          setState({ lines: [], isSynced: false, isLoading: false, error: null });
          void writeRuntimeLog('warn', `lyrics not found track=${trackName} artist=${artistName ?? 'n/a'}`);
          return;
        }

        if (best.syncedLyrics) {
          const parsed = parseLrc(best.syncedLyrics);
          setState({ lines: parsed, isSynced: parsed.length > 0, isLoading: false, error: null });
          void writeRuntimeLog(
            'info',
            `lyrics resolved synced=${parsed.length > 0 ? 'yes' : 'no'} lines=${parsed.length} durationCandidate=${best.duration ?? 'n/a'}`,
          );
        } else if (best.plainLyrics) {
          const lines = best.plainLyrics.split('\n')
            .filter((t: string) => t.trim())
            .map((text: string, i: number) => ({ time: i, text }));
          setState({ lines, isSynced: false, isLoading: false, error: null });
          void writeRuntimeLog(
            'warn',
            `lyrics resolved without timestamps lines=${lines.length} durationCandidate=${best.duration ?? 'n/a'}`,
          );
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setState({ lines: [], isSynced: false, isLoading: false, error: String(e) });
        void writeRuntimeLog(
          'error',
          `lyrics fetch failed track=${trackName} artist=${artistName ?? 'n/a'} error=${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [],
  );

  const clearLyrics = useCallback(() => {
    abortRef.current?.abort();
    lastRequestKeyRef.current = null;
    setState({ lines: [], isSynced: false, isLoading: false, error: null });
    setOffset(0);
  }, []);

  const adjustOffset = useCallback((delta: number) => {
    setOffset((prev) => Math.round((prev + delta) * 10) / 10);
  }, []);

  const resetOffset = useCallback(() => setOffset(0), []);

  return {
    ...state,
    offset,
    fetchLyrics,
    clearLyrics,
    adjustOffset,
    resetOffset,
  };
}
