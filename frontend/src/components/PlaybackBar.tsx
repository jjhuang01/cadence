import { Music, Pause, Play, SkipBack, SkipForward, Volume2, Mic2 } from 'lucide-react';
import { Track } from '../types';

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
  volume: number;
  togglePause: () => void;
  previous: () => void;
  next: () => void;
  seekTo: (s: number) => void;
  changeVolume: (v: number) => void;
}

interface Props {
  audio: AudioControls;
  currentTrack: Track | null;
  showLyrics: boolean;
  setShowLyrics: (v: boolean) => void;
  onOpenFullPlayer: () => void;
}

export function PlaybackBar({ audio, currentTrack, showLyrics, setShowLyrics, onOpenFullPlayer }: Props) {
  const progressPercent = audio.duration
    ? Math.min(100, (audio.position / audio.duration) * 100)
    : 0;

  return (
    <div className="playback-bar">
      <div className="pb-left">
        {currentTrack ? (
          <>
            <div
              className="pb-cover"
              onClick={onOpenFullPlayer}
              style={{ cursor: 'pointer' }}
              title="打开全屏播放"
            >
              <Music size={16} />
            </div>
            <div className="pb-info">
              <div className="pb-title">{currentTrack.title}</div>
              <div className="pb-subtitle">{currentTrack.subtitle}</div>
            </div>
          </>
        ) : (
          <div className="pb-empty">未在播放</div>
        )}
      </div>

      <div className="pb-center">
        <div className="pb-controls">
          <button className="pb-btn" onClick={audio.previous}>
            <SkipBack size={16} fill="currentColor" />
          </button>
          <button className="pb-btn pb-play-btn" onClick={audio.togglePause}>
            {audio.isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <button className="pb-btn" onClick={audio.next}>
            <SkipForward size={16} fill="currentColor" />
          </button>
        </div>
        <div className="pb-progress-row">
          <span className="pb-time">{formatTime(audio.position)}</span>
          <div
            className="pb-track"
            onClick={(e) => {
              if (!audio.duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              audio.seekTo(((e.clientX - rect.left) / rect.width) * audio.duration);
            }}
          >
            <div className="pb-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="pb-time">{formatTime(audio.duration)}</span>
        </div>
      </div>

      <div className="pb-right">
        <button
          className={`pb-btn lyrics-btn ${showLyrics ? 'active' : ''}`}
          onClick={() => setShowLyrics(!showLyrics)}
          title={showLyrics ? '隐藏歌词' : '显示歌词'}
          disabled={!currentTrack}
        >
          <Mic2 size={14} />
        </button>
        <div className="volume-ctrl">
          <Volume2 size={14} strokeWidth={2} className="vol-icon" />
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={audio.volume}
            onChange={(e) => audio.changeVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
