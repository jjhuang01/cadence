import { useRef, useEffect } from 'react';
import { X, RefreshCw, Plus, Minus, Languages } from 'lucide-react';
import { useSimplify } from '../hooks/useSimplify';
import { Track } from '../types';
import { LyricLine } from '../hooks/useLyrics';

interface LyricsData {
  isLoading: boolean;
  error: string | null;
  lines: LyricLine[];
  isSynced: boolean;
  offset: number;
  fetchLyrics: (title: string, artist?: string, duration?: number, force?: boolean) => Promise<void>;
  adjustOffset: (delta: number) => void;
}

interface Props {
  onClose: () => void;
  position: number;
  duration: number;
  lyrics: LyricsData;
  currentTrack: Track | null;
  simplifyLyrics: boolean;
  onToggleSimplify: () => void;
}

export function LyricsPanel({ onClose, position, duration, lyrics, currentTrack, simplifyLyrics, onToggleSimplify }: Props) {
  const simplify = useSimplify(simplifyLyrics);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef(-1);

  useEffect(() => {
    currentLineRef.current = -1;
    if (lyricsRef.current) lyricsRef.current.scrollTop = 0;
  }, [lyrics.lines]);

  useEffect(() => {
    if (!lyricsRef.current || lyrics.lines.length === 0 || !lyrics.isSynced) return;
    const adjusted = position - lyrics.offset;
    const idx = lyrics.lines.findIndex((line, i) => {
      const next = lyrics.lines[i + 1];
      return adjusted >= line.time && (!next || adjusted < next.time);
    });
    if (idx >= 0 && idx !== currentLineRef.current) {
      currentLineRef.current = idx;
      const el = lyricsRef.current.children[idx] as HTMLElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [position, lyrics.lines, lyrics.offset]);

  return (
    <div className="lyrics-panel">
      <div className="lyrics-header">
        <span className="lyrics-title">{currentTrack?.title}</span>
        <div className="lyrics-controls">
          <button
            className="lyrics-ctrl-btn"
            title={simplifyLyrics ? '当前: 简体 (点击切换繁体)' : '当前: 繁体 (点击切换简体)'}
            onClick={onToggleSimplify}
          >
            <Languages size={12} />
            <span style={{ fontSize: 10, marginLeft: 2 }}>{simplifyLyrics ? '简' : '繁'}</span>
          </button>
          <button
            className="lyrics-ctrl-btn"
            title="重新搜索歌词"
              disabled={!currentTrack || lyrics.isLoading}
              onClick={() => {
                if (currentTrack) {
                  const artist = currentTrack.subtitle.split(' - ')[0] || currentTrack.subtitle;
                  lyrics.fetchLyrics(currentTrack.title, artist, duration, true);
                }
              }}
            >
            <RefreshCw size={12} />
          </button>
          <div className="lyrics-offset-group">
            <button className="lyrics-ctrl-btn" title={lyrics.isSynced ? '歌词提前 0.5s' : '非同步歌词无法调整偏移'} disabled={!lyrics.isSynced} onClick={() => lyrics.adjustOffset(-0.5)}>
              <Minus size={12} />
            </button>
            <span className="lyrics-offset-label">
              {lyrics.isSynced
                ? (lyrics.offset === 0 ? '同步' : `${lyrics.offset > 0 ? '+' : ''}${lyrics.offset}s`)
                : '无时间线'}
            </span>
            <button className="lyrics-ctrl-btn" title={lyrics.isSynced ? '歌词延后 0.5s' : '非同步歌词无法调整偏移'} disabled={!lyrics.isSynced} onClick={() => lyrics.adjustOffset(0.5)}>
              <Plus size={12} />
            </button>
          </div>
          <button className="lyrics-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="lyrics-content" ref={lyricsRef}>
        {lyrics.isLoading ? (
          <div className="lyrics-loading">加载歌词中…</div>
        ) : lyrics.error ? (
          <div className="lyrics-error">{lyrics.error}</div>
        ) : lyrics.lines.length === 0 ? (
          <div className="lyrics-empty">暂无歌词</div>
        ) : (
          lyrics.lines.map((line, i) => {
            const adjusted = position - lyrics.offset;
            const isCurrent =
              lyrics.isSynced &&
              adjusted >= line.time &&
              (i === lyrics.lines.length - 1 || adjusted < lyrics.lines[i + 1].time);
            return (
              <div
                key={`${line.time}-${i}`}
                className={`lyrics-line ${isCurrent ? 'is-current' : ''}`}
              >
                {simplify(line.text)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
