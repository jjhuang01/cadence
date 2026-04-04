import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { ChevronDown, SkipBack, SkipForward, Pause, Play, RefreshCw, Plus, Minus, Languages } from 'lucide-react';
import { Track } from '../types';
import { LyricLine } from '../hooks/useLyrics';
import { useSimplify } from '../hooks/useSimplify';

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface AudioControls {
  isPlaying: boolean;
  position: number;
  duration: number;
  currentIndex: number | null;
  togglePause: () => void;
  previous: () => void;
  next: () => void;
  seekTo: (s: number) => void;
}

interface LyricsData {
  isLoading: boolean;
  lines: LyricLine[];
  isSynced: boolean;
  offset: number;
  fetchLyrics: (title: string, artist?: string, duration?: number, force?: boolean) => Promise<void>;
  adjustOffset: (delta: number) => void;
}

interface Props {
  audio: AudioControls;
  lyrics: LyricsData;
  currentTrack: Track | null;
  onClose: () => void;
  simplifyLyrics: boolean;
  onToggleSimplify: () => void;
}

export function FullPlayer({ audio, lyrics, currentTrack, onClose, simplifyLyrics, onToggleSimplify }: Props) {
  const simplify = useSimplify(simplifyLyrics);
  const uid = useId();
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPct, setScrubPct] = useState(0);
  const fpLyricsRef = useRef<HTMLDivElement>(null);
  const fpProgressTrackRef = useRef<HTMLDivElement>(null);
  const fpCurrentLineRef = useRef(-1);
  const scrubHandlersRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null);

  useEffect(() => {
    return () => {
      if (scrubHandlersRef.current) {
        document.removeEventListener('mousemove', scrubHandlersRef.current.move);
        document.removeEventListener('mouseup', scrubHandlersRef.current.up);
        scrubHandlersRef.current = null;
      }
    };
  }, []);

  const progressPercent = useMemo(() => {
    if (!audio.duration) return 0;
    return Math.min(100, (audio.position / audio.duration) * 100);
  }, [audio.position, audio.duration]);

  const needleAngle = useMemo(() => {
    const onRecord = audio.currentIndex !== null && (audio.isPlaying || audio.position > 0);
    if (!onRecord) return -22;
    const pct = isScrubbing ? scrubPct : progressPercent;
    return 14 + (pct / 100) * 16;
  }, [audio.currentIndex, audio.isPlaying, audio.position, isScrubbing, scrubPct, progressPercent]);

  useEffect(() => {
    fpCurrentLineRef.current = -1;
    if (fpLyricsRef.current) fpLyricsRef.current.scrollTop = 0;
  }, [lyrics.lines]);

  useEffect(() => {
    if (!fpLyricsRef.current || lyrics.lines.length === 0 || !lyrics.isSynced) return;
    const adjusted = audio.position - lyrics.offset;
    const idx = lyrics.lines.findIndex((line, i) => {
      const next = lyrics.lines[i + 1];
      return adjusted >= line.time && (!next || adjusted < next.time);
    });
    if (idx >= 0 && idx !== fpCurrentLineRef.current) {
      fpCurrentLineRef.current = idx;
      const el = fpLyricsRef.current.children[idx] as HTMLElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [audio.position, lyrics.lines, lyrics.offset]);

  function handleScrubStart(e: React.MouseEvent<HTMLDivElement>) {
    if (!audio.duration) return;
    e.preventDefault();
    const duration = audio.duration;
    const getPct = (ev: MouseEvent | React.MouseEvent) => {
      if (!fpProgressTrackRef.current) return 0;
      const rect = fpProgressTrackRef.current.getBoundingClientRect();
      return Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    };
    setIsScrubbing(true);
    setScrubPct(getPct(e) * 100);
    const onMove = (ev: MouseEvent) => setScrubPct(getPct(ev) * 100);
    const onUp = (ev: MouseEvent) => {
      audio.seekTo(getPct(ev) * duration);
      setIsScrubbing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      scrubHandlersRef.current = null;
    };
    scrubHandlersRef.current = { move: onMove, up: onUp };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleVinylSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const angle = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1;
    audio.seekTo(angle * audio.duration);
  }

  const displayPct = isScrubbing ? scrubPct : progressPercent;
  const npgId = `${uid}-npg`;
  const nagId = `${uid}-nag`;

  return (
    <div className="full-player">
      <div className="fp-header">
        <button
          className="fp-close-btn"
          onClick={() => { onClose(); setIsScrubbing(false); }}
          title="收起"
        >
          <ChevronDown size={18} />
        </button>
        <div className="fp-header-info">
          <div className="fp-header-title">{currentTrack?.title ?? '未在播放'}</div>
          <div className="fp-header-artist">{currentTrack?.subtitle}</div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      <div className="fp-body">
        {/* Vinyl stage: spinning disc + SVG progress ring (click to seek) */}
        <div className="fp-vinyl-stage" onClick={handleVinylSeek} title="点击进度环跳转">
          {/* Tone arm / needle */}
          <div className="fp-needle" style={{ transform: `rotate(${needleAngle}deg)` }}>
            <svg viewBox="0 0 34 165" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id={npgId} cx="38%" cy="32%" r="60%">
                  <stop offset="0%" stopColor="#e4e4ec" />
                  <stop offset="100%" stopColor="#848490" />
                </radialGradient>
                <linearGradient id={nagId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#b8b8c4" />
                  <stop offset="100%" stopColor="#686874" />
                </linearGradient>
              </defs>
              {/* Pivot base */}
              <circle cx="17" cy="15" r="14" fill={`url(#${npgId})`} />
              <circle cx="17" cy="15" r="9" fill="#6a6a78" />
              <circle cx="17" cy="15" r="4" fill="#3a3a46" />
              {/* Arm */}
              <path d="M16 24 L11 148" stroke={`url(#${nagId})`} strokeWidth="5" strokeLinecap="round" />
              {/* Cartridge head */}
              <rect x="4" y="148" width="18" height="10" rx="3" fill="#a0a0ae" />
              <rect x="8" y="156" width="10" height="5" rx="1.5" fill="#787884" />
            </svg>
          </div>
          <svg className="fp-ring-svg" viewBox="0 0 280 280" aria-hidden="true">
            <circle cx="140" cy="140" r="132" className="fp-ring-bg" />
            <circle
              cx="140" cy="140" r="132"
              className="fp-ring-fill"
              strokeDasharray={`${(2 * Math.PI * 132).toFixed(2)}`}
              strokeDashoffset={`${(2 * Math.PI * 132 * (1 - displayPct / 100)).toFixed(2)}`}
            />
          </svg>
          <div className={`fp-vinyl ${audio.isPlaying ? 'spinning' : ''}`} />
        </div>

        <div className="fp-lyrics-area">
          <div className="fp-lyrics-controls">
            <button
              className="lyrics-ctrl-btn"
              title="重新搜索歌词"
              disabled={!currentTrack || lyrics.isLoading}
              onClick={() => {
                if (currentTrack) {
                  const artist = currentTrack.subtitle.split(' - ')[0] || currentTrack.subtitle;
                  lyrics.fetchLyrics(currentTrack.title, artist, audio.duration, true);
                }
              }}
            >
              <RefreshCw size={11} />
            </button>
            <button
              className="lyrics-ctrl-btn"
              title={simplifyLyrics ? '当前: 简体 (点击切换繁体)' : '当前: 繁体 (点击切换简体)'}
              onClick={onToggleSimplify}
            >
              <Languages size={11} />
              <span style={{ fontSize: 10, marginLeft: 2 }}>{simplifyLyrics ? '简' : '繁'}</span>
            </button>
            <div className="lyrics-offset-group">
              <button className="lyrics-ctrl-btn" title={lyrics.isSynced ? '歌词提前 0.5s' : '非同步歌词无法调整偏移'} disabled={!lyrics.isSynced} onClick={() => lyrics.adjustOffset(-0.5)}>
                <Minus size={11} />
              </button>
              <span className="lyrics-offset-label">
                {lyrics.isSynced
                  ? (lyrics.offset === 0 ? '同步' : `${lyrics.offset > 0 ? '+' : ''}${lyrics.offset}s`)
                  : '无时间线'}
              </span>
              <button className="lyrics-ctrl-btn" title={lyrics.isSynced ? '歌词延后 0.5s' : '非同步歌词无法调整偏移'} disabled={!lyrics.isSynced} onClick={() => lyrics.adjustOffset(0.5)}>
                <Plus size={11} />
              </button>
            </div>
          </div>
          <div className="fp-lyrics-scroll" ref={fpLyricsRef}>
            {lyrics.isLoading ? (
              <div className="fp-lyrics-status">加载歌词中…</div>
            ) : lyrics.lines.length === 0 ? (
              <div className="fp-lyrics-status">暂无歌词</div>
            ) : (
              lyrics.lines.map((line, i) => {
                const adjusted = audio.position - lyrics.offset;
                const isCurrent =
                  lyrics.isSynced &&
                  adjusted >= line.time &&
                  (i === lyrics.lines.length - 1 || adjusted < lyrics.lines[i + 1].time);
                return (
                  <div key={`${line.time}-${i}`} className={`fp-lyric-line ${isCurrent ? 'is-current' : ''}`}>
                    {simplify(line.text)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="fp-footer">
        <div className="fp-progress-row">
          <span className="fp-time">
            {formatTime(isScrubbing ? (scrubPct / 100) * audio.duration : audio.position)}
          </span>
          <div
            ref={fpProgressTrackRef}
            className={`fp-progress-track${isScrubbing ? ' is-scrubbing' : ''}`}
            onMouseDown={handleScrubStart}
          >
            <div
              className="fp-progress-fill"
              style={{
                width: `${displayPct}%`,
                transition: isScrubbing ? 'none' : undefined,
              }}
            />
            <div
              className="fp-progress-thumb"
              style={{ left: `${displayPct}%` }}
            />
          </div>
          <span className="fp-time fp-time-right">{formatTime(audio.duration)}</span>
        </div>
        <div className="fp-controls">
          <button className="fp-ctrl-btn" onClick={audio.previous}>
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="fp-ctrl-btn fp-play-btn" onClick={audio.togglePause}>
            {audio.isPlaying
              ? <Pause size={24} fill="currentColor" />
              : <Play size={24} fill="currentColor" />}
          </button>
          <button className="fp-ctrl-btn" onClick={audio.next}>
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
