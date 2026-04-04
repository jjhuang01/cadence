import { useRef, useState, useCallback, useEffect } from 'react';
import { Track } from '../types';
import { writeRuntimeLog } from '../utils/runtimeLog';


export function useAudio() {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const rafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);
  const [playError, setPlayError] = useState<{ index: number } | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const currentIndexRef = useRef<number | null>(null);
  const presignedUrlsRef = useRef<Map<string, string>>(new Map());
  const MAX_PRESIGNED_CACHE_SIZE = 100;

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = 0.9;

    const stopPositionLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const syncPosition = () => {
      setPosition(audio.currentTime);
    };

    const startPositionLoop = () => {
      if (rafRef.current !== null) return;

      const tick = () => {
        syncPosition();
        if (!audio.paused && !audio.ended) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    const onTimeUpdate = () => syncPosition();
    const onDurationChange = () => {
      const d = audio.duration;
      setDuration(isFinite(d) ? d : 0);
    };
    const onLoadedMetadata = () => {
      const d = audio.duration;
      setDuration(isFinite(d) ? d : 0);
      syncPosition();
      void writeRuntimeLog(
        'info',
        `audio metadata loaded duration=${isFinite(d) ? d.toFixed(3) : '0'} src=${audio.currentSrc || audio.src || 'n/a'}`,
      );
    };
    const onSeeking = () => syncPosition();
    const onSeeked = () => {
      syncPosition();
      if (!audio.paused) startPositionLoop();
    };
    const onEnded = () => {
      stopPositionLoop();
      const idx = currentIndexRef.current;
      if (idx !== null && idx < tracksRef.current.length - 1) {
        playAtIndex(idx + 1);
      } else {
        setIsPlaying(false);
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      startPositionLoop();
      syncPosition();
    };
    const onPause = () => {
      setIsPlaying(false);
      stopPositionLoop();
      syncPosition();
    };
    const onError = () => {
      stopPositionLoop();
      setIsPlaying(false);
      const idx = currentIndexRef.current;
      if (idx !== null) setPlayError({ index: idx });
      const mediaError = audio.error;
      void writeRuntimeLog(
        'error',
        `audio error code=${mediaError?.code ?? 'unknown'} currentTime=${audio.currentTime.toFixed(3)} src=${audio.currentSrc || audio.src || 'n/a'}`,
      );
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('seeking', onSeeking);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('seeking', onSeeking);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      stopPositionLoop();
      audio.pause();
      audio.src = '';
      audio.load();
    };
  }, []);

  const playAtIndex = useCallback((index: number) => {
    const audio = audioRef.current;
    const tracks = tracksRef.current;
    if (index < 0 || index >= tracks.length) return;

    const track = tracks[index];
    let url: string;

    if (track.is_cloud && track.cloud_key) {
      const cached = presignedUrlsRef.current.get(track.cloud_key);
      if (cached) {
        url = cached;
      } else {
        // No URL cached — trigger playError so App.tsx can fetch URL and retry
        setPlayError({ index });
        return;
      }
    } else if (track.is_online) {
      if (!track.online_stream_url) {
        void writeRuntimeLog('warn', `playAtIndex skipped: online track has no stream URL index=${index} title=${track.title}`);
        setIsPlaying(false);
        return;
      }
      url = track.online_stream_url;
    } else {
      url = `stream://localhost/${encodeURIComponent(track.path)}`;
    }

    audio.src = url;
    audio.currentTime = 0;
    void writeRuntimeLog(
      'info',
      `audio play request index=${index} title=${track.title} cloud=${track.is_cloud ? 'yes' : 'no'} src=${url}`,
    );
    audio.play().catch(err => {
      console.error('Play failed:', err);
      void writeRuntimeLog(
        'error',
        `audio play failed index=${index} title=${track.title} error=${err instanceof Error ? err.message : String(err)}`,
      );
    });
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setPosition(0);
    setDuration(0);
  }, []);

  const togglePause = useCallback(() => {
    const audio = audioRef.current;
    if (audio.paused) {
      audio.play().catch(err => {
        console.error('Resume failed:', err);
        void writeRuntimeLog(
          'error',
          `audio resume failed currentIndex=${currentIndexRef.current ?? 'none'} error=${err instanceof Error ? err.message : String(err)}`,
        );
      });
    } else {
      audio.pause();
    }
  }, []);

  const next = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx !== null && idx < tracksRef.current.length - 1) {
      playAtIndex(idx + 1);
    }
  }, [playAtIndex]);

  const previous = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx !== null && idx > 0) {
      playAtIndex(idx - 1);
    }
  }, [playAtIndex]);

  const changeVolume = useCallback((v: number) => {
    setVolumeState(v);
    audioRef.current.volume = v;
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (isFinite(seconds) && seconds >= 0) {
      audio.currentTime = seconds;
      setPosition(seconds);
      void writeRuntimeLog(
        'info',
        `audio seek seconds=${seconds.toFixed(3)} currentIndex=${currentIndexRef.current ?? 'none'}`,
      );
    }
  }, []);

  const setTracks = useCallback((tracks: Track[]) => {
    tracksRef.current = tracks;
  }, []);

  const setPresignedUrl = useCallback((key: string, url: string) => {
    const cache = presignedUrlsRef.current;
    
    // LRU: if cache is full, delete the oldest entry
    if (cache.size >= MAX_PRESIGNED_CACHE_SIZE && !cache.has(key)) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
    
    cache.set(key, url);
  }, []);

  const clearPresignedUrls = useCallback(() => {
    presignedUrlsRef.current.clear();
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audio.pause();
    audio.src = '';
    setCurrentIndex(null);
    currentIndexRef.current = null;
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }, []);

  const clearPlayError = useCallback(() => setPlayError(null), []);

  return {
    isPlaying,
    position,
    duration,
    volume,
    currentIndex,
    playError,
    playAtIndex,
    togglePause,
    next,
    previous,
    changeVolume,
    seekTo,
    setTracks,
    setPresignedUrl,
    clearPresignedUrls,
    clearPlayError,
    stop,
  };
}
