import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Search,
  FolderPlus,
  Cloud,
  Play,
  Pause,
  Music,
  X,
  Disc3,
  CheckSquare,
  Square,
  Settings,
  Radio,
  Trash2,
} from 'lucide-react';
import { Track } from './types';
import { writeRuntimeLog } from './utils/runtimeLog';
import { useAudio } from './hooks/useAudio';
import { useCloudStorage } from './hooks/useCloudStorage';
import { useLyrics } from './hooks/useLyrics';
import { FullPlayer } from './components/FullPlayer';
import { LyricsPanel } from './components/LyricsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsView } from './components/SettingsView';
import { ContextMenu } from './components/ContextMenu';
import { PlaybackBar } from './components/PlaybackBar';
import { SplashScreen } from './components/SplashScreen';
import { OnlineSourcePanel } from './components/OnlineSourcePanel';
import { searchCatalog } from './online/catalog';
import { loadFavorites, saveFavorites } from './online/favorites';
import { downloadOnlineTrack } from './online/download';
import {
  loadSourceConfig,
  saveSourceConfig,
  DEFAULT_SOURCE_CONFIG,
  type SourceConfig,
  type LoadedSourceMeta,
} from './online/sourceConfig';
import { resolveStreamUrl, searchKuwo } from './online/musicSearch';
import {
  LxSourceEngine,
  extractApiBaseUrl,
  extractScriptName,
} from './online/lxSourceEngine';

type ViewMode = 'library' | 'online' | 'cloud' | 'settings';

function formatDuration(secs?: number): string {
  if (!secs || secs <= 0) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getOnlineTrackKey(track: Track): string | null {
  if (track.online_source_id && track.online_id) {
    return `${track.online_source_id}:${track.online_id}`;
  }

  if (track.is_online && track.online_stream_url) {
    return track.online_stream_url;
  }

  return null;
}

function getTrackKey(track: Track): string {
  if (track.is_cloud) {
    return track.cloud_key ?? `${track.title}:${track.subtitle}`;
  }

  return getOnlineTrackKey(track) ?? track.path;
}

export default function App() {
  const [tracks, setTracksState] = useState<Track[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [onlineSearch, setOnlineSearch] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [activeView, setActiveView] = useState<ViewMode>('library');
  const [playbackContext, setPlaybackContext] = useState<ViewMode>('library');
  const [playbackTracks, setPlaybackTracks] = useState<Track[]>([]);
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlinePage, setOnlinePage] = useState(1);
  const [hasMoreOnlineResults, setHasMoreOnlineResults] = useState(false);
  const [loadingMoreOnline, setLoadingMoreOnline] = useState(false);
  const ONLINE_PAGE_SIZE = 30;
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showOnlineFavoritesOnly, setShowOnlineFavoritesOnly] = useState(false);
  const [downloadingTrackKeys, setDownloadingTrackKeys] = useState<Set<string>>(new Set());
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>(DEFAULT_SOURCE_CONFIG);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const loadedEnginesRef = useRef<Map<string, LxSourceEngine>>(new Map());
  const engineLoadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  const previewFallbackAttemptsRef = useRef<Set<string>>(new Set());
  const cloudPlayRetryRef = useRef<Map<string, number>>(new Map());
  const [selectedOnlinePlatform, setSelectedOnlinePlatform] = useState('kw');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [lastSelectedVisualIndex, setLastSelectedVisualIndex] = useState<
    number | null
  >(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [simplifyLyrics, setSimplifyLyrics] = useState(() => {
    return localStorage.getItem('tips-simplify-lyrics') !== 'false';
  });
  const toggleSimplifyLyrics = () => {
    setSimplifyLyrics((v) => {
      const next = !v;
      localStorage.setItem('tips-simplify-lyrics', String(next));
      return next;
    });
  };

  const getSavedPaths = async (): Promise<string[]> => {
    return invoke<string[]>('load_library_paths');
  };
  const addSavedPaths = async (newPaths: string[]) => {
    const existing = await getSavedPaths();
    const merged = Array.from(new Set([...existing, ...newPaths]));
    await invoke('save_library_paths', { paths: merged });
  };
  const [deleteFromDisk, setDeleteFromDisk] = useState(() => {
    const saved = localStorage.getItem('tips-delete-from-disk');
    return saved === 'true';
  });
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });

  const audio = useAudio();
  const cloud = useCloudStorage();
  const lyrics = useLyrics();
  const listRef = useRef<HTMLDivElement>(null);
  const activeSearch = activeView === 'online' ? onlineSearch : librarySearch;

  const filteredTracks = useMemo(() => {
    const q = librarySearch.toLowerCase().trim();
    return tracks
      .map((t, i) => ({ ...t, originalIndex: i }))
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.subtitle.toLowerCase().includes(q),
      );
  }, [tracks, librarySearch]);

  const currentTrack = useMemo(() => {
    if (audio.currentIndex === null) return null;
    return playbackTracks[audio.currentIndex] || null;
  }, [audio.currentIndex, playbackTracks]);

  const activeOnlineTrackKey = useMemo(() => {
    if (!currentTrack || playbackContext !== 'online') {
      return null;
    }

    return getTrackKey(currentTrack);
  }, [currentTrack, playbackContext]);

  const currentTrackKey = useMemo(() => {
    if (!currentTrack) return null;
    if (currentTrack.is_online) {
      return getOnlineTrackKey(currentTrack) ?? `${currentTrack.title}:${currentTrack.subtitle}`;
    }
    if (currentTrack.is_cloud) {
      return currentTrack.cloud_key ?? `${currentTrack.title}:${currentTrack.subtitle}`;
    }
    return currentTrack.path;
  }, [currentTrack]);

  const currentArtist = useMemo(() => {
    if (!currentTrack) return undefined;
    return currentTrack.subtitle.split(' - ')[0] || currentTrack.subtitle;
  }, [currentTrack]);

  const lyricsPanelOpen = showLyrics || showFullPlayer;

  const cloudCount = useMemo(
    () => tracks.filter((t) => t.is_cloud).length,
    [tracks],
  );

  const favoriteCount = favoriteIds.size;

  const localSelectedCount = useMemo(() => {
    return [...selectedIndices].filter((i) => !tracks[i]?.is_cloud).length;
  }, [selectedIndices, tracks]);

  async function handleDeleteCloudTrack(cloudKey: string) {
    try {
      await cloud.deleteCloudTrack(cloudKey);
      setTracksState((prev) => prev.filter((t) => t.cloud_key !== cloudKey));
    } catch (e) {
      setErrorMsg(`云端删除失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleUploadSelected() {
    const localTracksToUpload = [...selectedIndices]
      .map((i) => tracks[i])
      .filter((t) => t && !t.is_cloud && t.path);

    if (localTracksToUpload.length === 0) return;

    const existingCloudKeys = tracks
      .filter((t) => t.is_cloud && t.cloud_key)
      .map((t) => t.cloud_key!);

    try {
      const result = await cloud.uploadTracks(localTracksToUpload, existingCloudKeys);
      const parts: string[] = [];
      if (result.uploaded > 0) parts.push(`已上传 ${result.uploaded} 首`);
      if (result.skipped > 0) parts.push(`跳过 ${result.skipped} 首（已存在）`);
      if (result.failed.length > 0) {
        setErrorMsg(result.failed[0]);
      } else {
        setInfoMsg(parts.join('，'));
      }
    } catch (e) {
      setErrorMsg(`上传失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  useEffect(() => {
    audio.setTracks(playbackTracks);
  }, [audio.setTracks, playbackTracks]);

  useEffect(() => {
    if (playbackContext === 'library') {
      setPlaybackTracks(tracks);
    }
  }, [playbackContext, tracks]);

  useEffect(() => {
    if (!audio.playError) return;
    const { index } = audio.playError;
    const track = playbackTracks[index];
    audio.clearPlayError();
    if (track?.is_online) {
      setErrorMsg(`在线播放失败：音频流中断，请重新点击播放`);
      return;
    }
    if (!track?.is_cloud || !track.cloud_key) return;
    const key = track.cloud_key;
    const retries = cloudPlayRetryRef.current.get(key) ?? 0;
    if (retries >= 2) {
      cloudPlayRetryRef.current.delete(key);
      setErrorMsg('云端播放失败，请检查网络后重试');
      return;
    }
    cloudPlayRetryRef.current.set(key, retries + 1);
    cloud.buildPresignedUrl(key)
      .then((url) => {
        audio.setPresignedUrl(key, url);
        audio.playAtIndex(index);
      })
      .catch((e) => {
        cloudPlayRetryRef.current.delete(key);
        setErrorMsg(`云端链接刷新失败: ${e instanceof Error ? e.message : e}`);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.playError, playbackTracks]);

  const enginesInitialized = useRef(false);

  useEffect(() => {
    if (enginesInitialized.current) return;
    enginesInitialized.current = true;
    loadSourceConfig().then(async (config) => {
      setSourceConfig(config);
      if (config.loadedSources.length > 0) {
        for (const meta of config.loadedSources) {
          if (loadedEnginesRef.current.has(meta.id)) continue;
          const engine = new LxSourceEngine();
          try {
            await engine.load(meta.scriptContent);
            loadedEnginesRef.current.set(meta.id, engine);
          } catch (e) {
            console.error('Failed to init source engine', meta.name, e);
          }
        }
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadFavorites()
      .then((ids) => {
        if (!cancelled) {
          setFavoriteIds(ids);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErrorMsg(`加载在线收藏失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    setLastSelectedVisualIndex(null);
  }, [librarySearch]);

  useEffect(() => {
    if (!errorMsg) return;
    const t = window.setTimeout(() => setErrorMsg(''), 6000);
    return () => window.clearTimeout(t);
  }, [errorMsg]);

  useEffect(() => {
    if (!infoMsg) return;
    const t = window.setTimeout(() => setInfoMsg(''), 4000);
    return () => window.clearTimeout(t);
  }, [infoMsg]);

  useEffect(() => {
    setOnlineResults((prev) => prev.map((track) => {
      const onlineKey = getOnlineTrackKey(track);
      return {
        ...track,
        is_favorite: onlineKey ? favoriteIds.has(onlineKey) : false,
      };
    }));
  }, [favoriteIds]);

  // Detect NetEase 30s preview and auto-fallback to Kuwo
  useEffect(() => {
    if (audio.currentIndex === null) return;
    const track = playbackTracks[audio.currentIndex];
    if (!track?.is_online || track.online_source_id !== 'wy') return;
    if (!track.duration_secs || track.duration_secs <= 60) return;
    if (!audio.duration || audio.duration <= 0 || audio.duration > 35) return;

    const trackKey = `${track.online_source_id}:${track.online_id}`;
    if (previewFallbackAttemptsRef.current.has(trackKey)) return;
    previewFallbackAttemptsRef.current.add(trackKey);

    void handleKuwoFallback(track, audio.currentIndex, playbackTracks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.duration, audio.currentIndex]);

  useEffect(() => {
    if (activeView !== 'online') {
      return;
    }

    const query = onlineSearch.trim();

    if (!query) {
      setOnlineLoading(false);
      setOnlineResults([]);
      return;
    }

    setOnlinePage(1);
    setHasMoreOnlineResults(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setOnlineLoading(true);
      searchCatalog(query, sourceConfig, selectedOnlinePlatform, 1)
        .then((results) => {
          if (cancelled) return;
          setHasMoreOnlineResults(results.length >= ONLINE_PAGE_SIZE);
          setOnlineResults(results.map((track) => {
            const onlineKey = getOnlineTrackKey(track);
            return {
              ...track,
              is_favorite: onlineKey ? favoriteIds.has(onlineKey) : false,
            };
          }));
        })
        .catch((e) => {
          if (!cancelled) {
            setOnlineResults([]);
            setErrorMsg(`在线目录搜索失败: ${e instanceof Error ? e.message : String(e)}`);
          }
        })
        .finally(() => {
          if (!cancelled) setOnlineLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  // NOTE: favoriteIds intentionally excluded – a separate effect below syncs is_favorite on results
  }, [activeView, onlineSearch, sourceConfig, selectedOnlinePlatform]);

  useEffect(() => {
    lyrics.clearLyrics();
  }, [currentTrackKey, lyrics.clearLyrics]);

  useEffect(() => {
    if (!lyricsPanelOpen || !currentTrack || lyrics.isLoading) return;
    void lyrics.fetchLyrics(
      currentTrack.title,
      currentArtist,
      audio.duration > 0 ? audio.duration : undefined,
    );
  }, [lyricsPanelOpen, currentTrackKey, currentTrack?.title, currentArtist, audio.duration, lyrics.isLoading, lyrics.fetchLyrics]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    listen<{ paths: string[] }>('tauri://drag-drop', async (ev) => {
      setIsDragOver(false);
      if (ev.payload.paths?.length) {
        setIsScanning(true);
        try {
          await addSavedPaths(ev.payload.paths);
          const allPaths = await getSavedPaths();
          const result = await invoke<Track[]>('scan_paths', { paths: allPaths });
          setTracksState((prev) => {
            const cloudTracks = prev.filter((t) => t.is_cloud);
            return [...result, ...cloudTracks];
          });
        } catch (e) {
          setErrorMsg(`导入失败: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
          setIsScanning(false);
        }
      }
    }).then((u) => unlisteners.push(u));

    listen('tauri://drag-enter', () => setIsDragOver(true)).then((u) =>
      unlisteners.push(u),
    );
    listen('tauri://drag-leave', () => setIsDragOver(false)).then((u) =>
      unlisteners.push(u),
    );

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT') return;

      if (e.key === ' ') {
        e.preventDefault();
        audio.togglePause();
      } else if (activeView === 'library' && e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndices.size === 1) {
          const idx = [...selectedIndices][0];
          startLibraryPlayback(idx);
        }
      } else if (activeView === 'library' && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedIndices.size > 0) {
          e.preventDefault();
          deleteSelectedTracks();
        }
      } else if (activeView === 'library' && e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSelection(1);
      } else if (activeView === 'library' && e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSelection(-1);
      } else if (activeView === 'library' && e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape') {
        clearSelection();
        closeContextMenu();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeView, selectedIndices, tracks, audio.togglePause, audio.playAtIndex]);

  async function fetchTracks() {
    const minDelay = new Promise((r) => setTimeout(r, 700));
    try {
      const savedPaths = await getSavedPaths();
      if (savedPaths.length > 0) {
        const [result] = await Promise.all([
          invoke<Track[]>('scan_paths', { paths: savedPaths }),
          minDelay,
        ]);
        setTracksState(result as Track[]);
      } else {
        await minDelay;
      }
    } catch (e) {
      console.error('fetch tracks:', e);
      setErrorMsg(`加载音乐库失败: ${e instanceof Error ? e.message : String(e)}`);
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      setIsInitializing(false);
      invoke('show_main_window').catch((e) => console.error('show_main_window:', e));
    }
  }

  async function scanDir() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setIsScanning(true);
      try {
        await addSavedPaths([selected as string]);
        const allPaths = await getSavedPaths();
        const result = await invoke<Track[]>('scan_paths', { paths: allPaths });
        setTracksState((prev) => {
          const cloudTracks = prev.filter((t) => t.is_cloud);
          return [...result, ...cloudTracks];
        });
        setSelectedIndices(new Set());
        setLastSelectedVisualIndex(null);
      } catch (e) {
        setErrorMsg(`扫描失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsScanning(false);
      }
    }
  }

  async function scanCloud() {
    try {
      const { tracks: cloudTracks } = await cloud.scanCloud();
      setTracksState((prev) => {
        const local = prev.filter((t) => !t.is_cloud);
        return [...local, ...cloudTracks];
      });
    } catch (e) {
      setErrorMsg(String(e));
    }
  }

  function startLibraryPlayback(index: number) {
    setPlaybackContext('library');
    setPlaybackTracks(tracks);
    audio.setTracks(tracks);
    audio.playAtIndex(index);
  }

  async function loadMoreOnlineResults() {
    const query = onlineSearch.trim();
    if (!query || loadingMoreOnline) return;
    const nextPage = onlinePage + 1;
    setLoadingMoreOnline(true);
    try {
      const results = await searchCatalog(query, sourceConfig, selectedOnlinePlatform, nextPage);
      if (results.length === 0) {
        setHasMoreOnlineResults(false);
        return;
      }
      setHasMoreOnlineResults(results.length >= ONLINE_PAGE_SIZE);
      setOnlinePage(nextPage);
      setOnlineResults((prev) => [
        ...prev,
        ...results.map((track) => {
          const onlineKey = getOnlineTrackKey(track);
          return {
            ...track,
            is_favorite: onlineKey ? favoriteIds.has(onlineKey) : false,
          };
        }),
      ]);
    } catch (e) {
      setErrorMsg(`加载更多失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingMoreOnline(false);
    }
  }

  async function handleKuwoFallback(track: Track, index: number, currentPlaybackTracks: Track[]) {
    void writeRuntimeLog(
      'warn',
      `[previewFallback] detected NetEase 30s preview: "${track.title}" (expected ${track.duration_secs ?? '?'}s) — trying Kuwo`,
    );

    const allEngineIds = Array.from(loadedEnginesRef.current.keys());
    const activeId = sourceConfig.activeSourceId;
    const engineOrder = [
      ...(activeId && loadedEnginesRef.current.has(activeId) ? [activeId] : []),
      ...allEngineIds.filter((id) => id !== activeId),
    ];

    try {
      const q = `${track.title} ${track.subtitle ?? ''}`.trim();
      const kuwoResults = await searchKuwo(q, 1, 10);

      const titleLower = track.title.toLowerCase();
      const match =
        kuwoResults.find((r) => r.name.toLowerCase() === titleLower) ??
        kuwoResults.find((r) => r.name.toLowerCase().includes(titleLower));

      if (!match) {
        void writeRuntimeLog('warn', `[previewFallback] no Kuwo match for "${track.title}"`);
        return;
      }
      void writeRuntimeLog('info', `[previewFallback] Kuwo match: "${match.name}" id=${match.id}`);

      let kuwoUrl: string | undefined;
      for (const sourceId of engineOrder) {
        const engine = loadedEnginesRef.current.get(sourceId);
        if (!engine?.isLoaded() || !engine.sources['kw']) continue;
        try {
          kuwoUrl = await engine.resolveUrl('kw', match.id, sourceConfig.quality, {
            name: match.name,
            singer: match.artist,
            album: match.album,
            interval: match.duration,
          });
          void writeRuntimeLog('info', `[previewFallback] Kuwo URL resolved via engine ${sourceId}`);
          break;
        } catch (e) {
          void writeRuntimeLog(
            'warn',
            `[previewFallback] engine ${sourceId} kw failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (!kuwoUrl) {
        void writeRuntimeLog('warn', `[previewFallback] could not resolve Kuwo URL for "${match.name}"`);
        return;
      }

      const updatedTrack = { ...track, online_stream_url: kuwoUrl };
      const updatedTracks = [...currentPlaybackTracks];
      updatedTracks[index] = updatedTrack;
      setPlaybackTracks(updatedTracks);
      audio.setTracks(updatedTracks);
      audio.playAtIndex(index);
      void writeRuntimeLog('info', `[previewFallback] switched to Kuwo: "${track.title}"`);
    } catch (e) {
      void writeRuntimeLog(
        'warn',
        `[previewFallback] error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async function startOnlinePlayback(track: Track, index: number, queue: Track[]) {
    setShowFullPlayer(false);
    setShowLyrics(false);

    let resolvedTrack = track;
    if (!track.online_stream_url && track.online_id && track.online_source_id) {
      setIsResolvingUrl(true);
      try {
        const activeId = sourceConfig.activeSourceId;

        // Build ordered engine list: active first, then others
        const allEngineIds = Array.from(loadedEnginesRef.current.keys());
        const engineOrder = [
          ...(activeId && loadedEnginesRef.current.has(activeId) ? [activeId] : []),
          ...allEngineIds.filter((id) => id !== activeId),
        ];

        // Wait for all pending engine loads upfront
        await Promise.allSettled(
          engineOrder.map((id) => engineLoadPromisesRef.current.get(id) ?? Promise.resolve()),
        );

        const resolveExtra = {
          name: track.title,
          singer: track.subtitle,
          album: track.online_album,
          interval: track.duration_secs,
        };

        let url: string | undefined;
        let lastErr: unknown;

        // Try each engine in order
        for (const sourceId of engineOrder) {
          const engine = loadedEnginesRef.current.get(sourceId);
          if (!engine?.isLoaded()) continue;
          // Skip engine if it declares supported sources but doesn't include this one
          const declaredSources = engine.sources;
          const hasDeclared = Object.keys(declaredSources).length > 0;
          if (hasDeclared && !declaredSources[track.online_source_id]) {
            void writeRuntimeLog('info', `[resolveUrl] engine ${sourceId} skipped (no support for ${track.online_source_id})`);
            continue;
          }
          try {
            url = await engine.resolveUrl(
              track.online_source_id,
              track.online_id,
              sourceConfig.quality,
              resolveExtra,
            );
            break;
          } catch (e) {
            lastErr = e;
            void writeRuntimeLog('warn', `[resolveUrl] engine ${sourceId} failed, trying next: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // Fallback to legacy apiBaseUrl if all engines failed
        if (!url && sourceConfig.apiBaseUrl) {
          url = await resolveStreamUrl(
            track.online_id,
            sourceConfig.apiBaseUrl,
            track.online_source_id,
            sourceConfig.quality,
          ).catch(() => undefined);
        }

        // Proactive cross-platform fallback: if wy completely fails, search Kuwo
        if (!url && track.online_source_id === 'wy') {
          void writeRuntimeLog('info', `[proactiveFallback] wy failed, searching Kuwo for "${track.title}"`);
          const q = `${track.title} ${track.subtitle ?? ''}`.trim();
          const kuwoResults = await searchKuwo(q, 1, 10).catch(() => [] as Awaited<ReturnType<typeof searchKuwo>>);
          const titleLower = track.title.toLowerCase();
          const kwMatch =
            kuwoResults.find((r) => r.name.toLowerCase() === titleLower) ??
            kuwoResults.find((r) => r.name.toLowerCase().includes(titleLower));
          if (kwMatch) {
            void writeRuntimeLog('info', `[proactiveFallback] found Kuwo match: "${kwMatch.name}" id=${kwMatch.id}`);
            for (const sourceId of engineOrder) {
              const engine = loadedEnginesRef.current.get(sourceId);
              if (!engine?.isLoaded()) continue;
              const declaredSources = engine.sources;
              const hasDeclared = Object.keys(declaredSources).length > 0;
              if (hasDeclared && !declaredSources['kw']) continue;
              try {
                url = await engine.resolveUrl('kw', kwMatch.id, sourceConfig.quality, {
                  name: kwMatch.name,
                  singer: kwMatch.artist,
                  album: kwMatch.album,
                  interval: kwMatch.duration,
                });
                void writeRuntimeLog('info', `[proactiveFallback] wy→kw resolved via engine ${sourceId}`);
                break;
              } catch (e) {
                void writeRuntimeLog('warn', `[proactiveFallback] engine ${sourceId} kw failed: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          }
        }

        if (!url) {
          throw lastErr ?? new Error('未导入音源，无法获取播放链接。请在设置中导入 .js 音源文件。');
        }

        resolvedTrack = { ...track, online_stream_url: url };
      } catch (e) {
        setErrorMsg(
          `获取在线音频链接失败: ${e instanceof Error ? e.message : String(e)}`,
        );
        setIsResolvingUrl(false);
        return;
      } finally {
        setIsResolvingUrl(false);
      }
    }

    const resolvedQueue = queue.map((t, i) =>
      i === index ? resolvedTrack : t,
    );

    setPlaybackContext('online');
    setPlaybackTracks(resolvedQueue);
    audio.setTracks(resolvedQueue);
    audio.playAtIndex(index);
  }

  async function handleAddSource() {
    const filePath = await open({
      multiple: false,
      filters: [{ name: 'LX Music Source', extensions: ['js'] }],
      title: '选择音源文件 (.js)',
    });
    if (!filePath || typeof filePath !== 'string') return;
    try {
      const scriptContent = await invoke<string>('read_text_file', { path: filePath });
      const name = extractScriptName(scriptContent);
      const apiBaseUrl = extractApiBaseUrl(scriptContent) ?? '';
      const id = `src-${Date.now()}`;
      const meta: LoadedSourceMeta = { id, name, scriptContent, apiBaseUrl };
      const newConfig: SourceConfig = {
        ...sourceConfig,
        loadedSources: [...sourceConfig.loadedSources, meta],
        activeSourceId: id,
      };
      await saveSourceConfig(newConfig);
      setSourceConfig(newConfig);
      // Load engine in background — don't block source registration
      const engine = new LxSourceEngine();
      const loadPromise = engine.load(scriptContent)
        .then(() => { loadedEnginesRef.current.set(id, engine); })
        .catch((e) => { console.warn('[LxEngine] load failed for', name, e); });
      engineLoadPromisesRef.current.set(id, loadPromise);
    } catch (e) {
      setErrorMsg(`导入音源失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleRemoveSource(id: string) {
    loadedEnginesRef.current.delete(id);
    const remaining = sourceConfig.loadedSources.filter((s) => s.id !== id);
    const nextActiveId = remaining[0]?.id ?? null;
    const newConfig: SourceConfig = {
      ...sourceConfig,
      loadedSources: remaining,
      activeSourceId: nextActiveId,
    };
    await saveSourceConfig(newConfig);
    setSourceConfig(newConfig);
  }

  async function handleSetActiveSource(id: string) {
    const newConfig: SourceConfig = { ...sourceConfig, activeSourceId: id };
    await saveSourceConfig(newConfig);
    setSourceConfig(newConfig);
    setOnlineResults([]);
  }

  async function toggleFavorite(track: Track) {
    const onlineKey = getOnlineTrackKey(track);
    if (!onlineKey) return;

    const previous = new Set(favoriteIds);
    const next = new Set(previous);
    if (next.has(onlineKey)) {
      next.delete(onlineKey);
    } else {
      next.add(onlineKey);
    }

    setFavoriteIds(next);

    try {
      await saveFavorites(next);
    } catch (e) {
      setFavoriteIds(previous);
      setErrorMsg(`保存在线收藏失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleOnlineDownload(track: Track) {
    const trackKey = getTrackKey(track);

    setDownloadingTrackKeys((prev) => {
      const next = new Set(prev);
      next.add(trackKey);
      return next;
    });

    try {
      await downloadOnlineTrack(track);
    } catch (e) {
      setErrorMsg(`下载在线曲目失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDownloadingTrackKeys((prev) => {
        const next = new Set(prev);
        next.delete(trackKey);
        return next;
      });
    }
  }

  async function deleteSingleTrack(frontendIndex: number) {
    if (activeView !== 'library') return;

    const track = tracks[frontendIndex];
    if (!track) return;
    const wasPlaying = playbackContext === 'library' && audio.currentIndex === frontendIndex;
    try {
      if (track.is_cloud) {
        setTracksState((prev) => prev.filter((_, i) => i !== frontendIndex));
      } else {
        if (deleteFromDisk && track.path) {
          await invoke('delete_file', { path: track.path });
        }
        const backendIdx = tracks
          .slice(0, frontendIndex)
          .filter((t) => !t.is_cloud).length;
        const updatedLocal = await invoke<Track[]>('remove_tracks', {
          indices: [backendIdx],
        });
        setTracksState((prev) => [
          ...updatedLocal,
          ...prev.filter((t) => t.is_cloud),
        ]);
      }
      if (wasPlaying) audio.stop();
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        next.delete(frontendIndex);
        return next;
      });
    } catch (e) {
      console.error('Delete failed:', e);
    }
  }

  async function deleteSelectedTracks() {
    if (activeView !== 'library' || selectedIndices.size === 0) return;

    const selected = [...selectedIndices];
    const localFrontendIndices = selected.filter((i) => !tracks[i]?.is_cloud);
    const cloudFrontendIndices = new Set(
      selected.filter((i) => tracks[i]?.is_cloud),
    );
    const wasPlayingDeleted =
      playbackContext === 'library' &&
      audio.currentIndex !== null &&
      selected.includes(audio.currentIndex);
    try {
      if (deleteFromDisk) {
        for (const fi of localFrontendIndices) {
          const track = tracks[fi];
          if (track?.path) {
            await invoke('delete_file', { path: track.path });
          }
        }
      }
      let newLocal: Track[];
      if (localFrontendIndices.length > 0) {
        const backendIndices = localFrontendIndices.map(
          (fi) => tracks.slice(0, fi).filter((t) => !t.is_cloud).length,
        );
        newLocal = await invoke<Track[]>('remove_tracks', {
          indices: backendIndices,
        });
      } else {
        newLocal = tracks.filter((t) => !t.is_cloud);
      }
      const remainingCloud = tracks.filter(
        (t, i) => t.is_cloud && !cloudFrontendIndices.has(i),
      );
      setTracksState([...newLocal, ...remainingCloud]);
      if (wasPlayingDeleted) audio.stop();
      setSelectedIndices(new Set());
    } catch (e) {
      console.error('Batch delete failed:', e);
    }
  }

  function handleRowClick(
    e: React.MouseEvent,
    visIdx: number,
    origIdx: number,
  ) {
    if (activeView !== 'library') return;

    if (e.metaKey || e.ctrlKey) {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        next.has(origIdx) ? next.delete(origIdx) : next.add(origIdx);
        return next;
      });
      setLastSelectedVisualIndex(visIdx);
    } else if (e.shiftKey && lastSelectedVisualIndex !== null) {
      const start = Math.min(lastSelectedVisualIndex, visIdx);
      const end = Math.max(lastSelectedVisualIndex, visIdx);
      const next = new Set<number>();
      for (let i = start; i <= end; i++) {
        if (filteredTracks[i]) next.add(filteredTracks[i].originalIndex);
      }
      setSelectedIndices(next);
    } else {
      setSelectedIndices(new Set([origIdx]));
      setLastSelectedVisualIndex(visIdx);
    }
  }

  function handleRowDoubleClick(track: { originalIndex: number }) {
    startLibraryPlayback(track.originalIndex);
  }

  function handleContextMenu(
    e: React.MouseEvent,
    visIdx: number,
    origIdx: number,
  ) {
    if (activeView !== 'library') return;

    e.preventDefault();
    if (!selectedIndices.has(origIdx)) {
      setSelectedIndices(new Set([origIdx]));
      setLastSelectedVisualIndex(visIdx);
    }
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  }

  function closeContextMenu() {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }

  function clearSelection() {
    setSelectedIndices(new Set());
    setLastSelectedVisualIndex(null);
  }

  function selectAll() {
    if (activeView !== 'library') return;

    const allOrigIndices = filteredTracks.map((t) => t.originalIndex);
    const allSelected =
      allOrigIndices.length > 0 &&
      allOrigIndices.every((i) => selectedIndices.has(i));
    if (allSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(allOrigIndices));
    }
  }

  function navigateSelection(direction: number) {
    if (activeView !== 'library' || filteredTracks.length === 0) return;

    let targetVisual = 0;
    if (lastSelectedVisualIndex !== null) {
      targetVisual = Math.max(
        0,
        Math.min(
          filteredTracks.length - 1,
          lastSelectedVisualIndex + direction,
        ),
      );
    }
    const target = filteredTracks[targetVisual];
    setSelectedIndices(new Set([target.originalIndex]));
    setLastSelectedVisualIndex(targetVisual);
  }

  async function revealInFinder() {
    if (selectedIndices.size === 1) {
      const idx = [...selectedIndices][0];
      const track = tracks[idx];
      if (track && !track.is_cloud) {
        await invoke('reveal_in_finder', { path: track.path });
      }
    }
    closeContextMenu();
  }

  return (
    <>
      <SplashScreen visible={isInitializing} />
      <div className={`app-container ${isDragOver ? 'drag-over' : ''}`}>
        <div className="sidebar" data-tauri-drag-region>
          <div className="sidebar-header" data-tauri-drag-region>
            <div className="traffic-spacer" data-tauri-drag-region />
          </div>
          <div className="sidebar-nav">
            <div className="nav-section-title">资料库</div>
            <button
              className={`nav-item nav-item-button ${activeView === 'library' ? 'active' : ''}`}
              onClick={() => setActiveView('library')}
              type="button"
            >
              <Music size={14} />
              <span>全部音乐</span>
              {tracks.length > 0 && (
                <span className="nav-badge">{tracks.length}</span>
              )}
            </button>
            <button
              className={`nav-item nav-item-button ${activeView === 'cloud' ? 'active' : ''}`}
              onClick={async () => { await scanCloud(); setActiveView('cloud'); }}
              disabled={cloud.isScanning}
              type="button"
            >
              <Cloud size={14} className={cloud.isScanning ? 'spinning' : ''} />
              <span>{cloud.isScanning ? '扫描中…' : '云端音乐'}</span>
              {cloudCount > 0 && (
                <span className="nav-badge cloud-badge">{cloudCount}</span>
              )}
            </button>
            <button
              className={`nav-item nav-item-button ${activeView === 'online' ? 'active' : ''}`}
              onClick={() => setActiveView('online')}
              type="button"
            >
              <Radio size={14} />
              <span>在线目录</span>
              {favoriteCount > 0 && (
                <span className="nav-badge online-nav-badge">{favoriteCount}</span>
              )}
            </button>

          </div>
          <div className="sidebar-section-label">管理</div>
          <div className="sidebar-actions">
            <button className="sidebar-btn" onClick={scanDir}>
              <FolderPlus size={14} />
              <span>添加文件夹</span>
            </button>
          </div>
          <div className="sidebar-footer">
            <button
              className={`sidebar-footer-btn ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveView((v) => v === 'settings' ? 'library' : 'settings')}
              title="设置"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        <div className="main-content">
          <div className="toolbar" data-tauri-drag-region>
            <div className="search-box">
              <Search size={13} className="search-icon" />
              <input
                type="text"
                placeholder={
                  activeView === 'online'
                    ? '搜索在线目录…'
                    : '搜索…'
                }
                value={activeSearch}
                onChange={(e) => {
                  const { value } = e.target;
                  if (activeView === 'online') {
                    setOnlineSearch(value);
                  } else {
                    setLibrarySearch(value);
                  }
                }}
              />
            </div>
            {activeView === 'library' && tracks.length > 0 && (
              <div className="toolbar-actions">
                {librarySearch && (
                  <span className="search-count">
                    {filteredTracks.length} / {tracks.length}
                  </span>
                )}
                <button
                  className="toolbar-btn"
                  onClick={selectAll}
                  title={
                    selectedIndices.size === filteredTracks.length &&
                    filteredTracks.length > 0
                      ? '取消全选'
                      : '全选 (⌘A)'
                  }
                >
                  {selectedIndices.size === filteredTracks.length &&
                  filteredTracks.length > 0 ? (
                    <CheckSquare size={14} />
                  ) : (
                    <Square size={14} />
                  )}
                </button>
              </div>
            )}
          </div>

          {infoMsg && (
            <div className="info-bar">
              <span>{infoMsg}</span>
              <button onClick={() => setInfoMsg('')}>
                <X size={12} />
              </button>
            </div>
          )}
          {errorMsg && (
            <div className="error-bar">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg('')}>
                <X size={12} />
              </button>
            </div>
          )}

          {activeView === 'settings' ? (
            <SettingsView
              deleteFromDisk={deleteFromDisk}
              setDeleteFromDisk={setDeleteFromDisk}
              sourceConfig={sourceConfig}
              onSourceConfigChange={setSourceConfig}
              onAddSource={handleAddSource}
              onRemoveSource={handleRemoveSource}
              onSetActiveSource={handleSetActiveSource}
              uploadHistory={cloud.uploadHistory}
              cloudTracks={tracks.filter((t) => t.is_cloud)}
              isScanning={cloud.isScanning}
              isUploading={cloud.isUploading}
              onScanCloud={scanCloud}
              onDeleteCloudTrack={handleDeleteCloudTrack}
            />
          ) : activeView === 'cloud' ? (
            <div className="cloud-mgmt-view">
              {cloudCount === 0 ? (
                <div className="empty-state">
                  <Cloud size={48} strokeWidth={1} className="empty-icon" />
                  <p>云端暂无音乐</p>
                  <p className="empty-hint">点击左侧「云端音乐」扫描 R2 存储</p>
                </div>
              ) : (
                <>
                  <div className="list-header cloud-mgmt-header">
                    <div className="col-num">#</div>
                    <div className="col-info">标题</div>
                    <div className="cloud-mgmt-actions-placeholder" />
                  </div>
                  {tracks
                    .map((t, idx) => ({ ...t, originalIndex: idx }))
                    .filter((t) => t.is_cloud)
                    .map((track, i) => (
                      <div
                        key={track.cloud_key}
                        className={[
                          'track-row cloud-mgmt-row',
                          playbackContext === 'library' && audio.currentIndex === track.originalIndex ? 'is-active' : '',
                        ].join(' ')}
                        onDoubleClick={() => startLibraryPlayback(track.originalIndex)}
                        onMouseEnter={() => setHoveredIndex(track.originalIndex)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <div className="col-num">
                          {playbackContext === 'library' && audio.currentIndex === track.originalIndex && audio.isPlaying ? (
                            <span className="eq-bars"><span /><span /><span /></span>
                          ) : playbackContext === 'library' && audio.currentIndex === track.originalIndex ? (
                            <Pause className="row-pause-icon" size={11} />
                          ) : hoveredIndex === track.originalIndex ? (
                            <button
                              className="row-play-btn"
                              onClick={(e) => { e.stopPropagation(); startLibraryPlayback(track.originalIndex); }}
                            >
                              <Play size={11} />
                            </button>
                          ) : (
                            <span className="row-num">{i + 1}</span>
                          )}
                        </div>
                        <div className="col-info">
                          <div className="col-title">{track.title}</div>
                          <div className="col-subtitle">
                            <span className="cloud-badge-icon">
                              <Cloud size={10} />
                            </span>
                            {track.subtitle}
                          </div>
                        </div>
                        <button
                          className="cloud-mgmt-delete-btn"
                          title="从云端删除"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (track.cloud_key) void handleDeleteCloudTrack(track.cloud_key);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                </>
              )}
            </div>
          ) : activeView === 'online' ? (
            <OnlineSourcePanel
              activeTrackKey={activeOnlineTrackKey}
              downloadingTrackKeys={downloadingTrackKeys}
              favoriteCount={favoriteCount}
              selectedPlatform={selectedOnlinePlatform}
              onPlatformChange={(p) => { setSelectedOnlinePlatform(p); setOnlineResults([]); }}
              hasSource={true}
              isLoading={onlineLoading}
              isResolvingUrl={isResolvingUrl}
              isPlaying={audio.isPlaying}
              onOpenSettings={() => setActiveView('settings')}
              onDownload={handleOnlineDownload}
              onPlay={startOnlinePlayback}
              onToggleFavorite={toggleFavorite}
              onToggleFavoritesOnly={() => setShowOnlineFavoritesOnly((prev) => !prev)}
              results={onlineResults}
              searchQuery={onlineSearch}
              showFavoritesOnly={showOnlineFavoritesOnly}
              hasMore={hasMoreOnlineResults}
              loadingMore={loadingMoreOnline}
              onLoadMore={loadMoreOnlineResults}
            />
          ) : (
            <div className="track-list" ref={listRef}>
              {filteredTracks.length === 0 ? (
                <div className="empty-state">
                  <Disc3 size={48} strokeWidth={1} className="empty-icon" />
                  <p>拖拽音乐文件到这里</p>
                  <p className="empty-hint">或点击左侧「添加文件夹」</p>
                </div>
              ) : (
                <>
                  <div className="list-header">
                    <div className="col-num">#</div>
                    <div className="col-info">标题</div>
                    <div className="col-duration">时长</div>
                  </div>
                  {filteredTracks.map((track, visIdx) => (
                    <div
                      key={track.is_cloud ? track.cloud_key : track.path}
                      className={[
                        'track-row',
                        selectedIndices.has(track.originalIndex)
                          ? 'is-selected'
                          : '',
                        playbackContext === 'library' && audio.currentIndex === track.originalIndex
                          ? 'is-active'
                          : '',
                      ].join(' ')}
                      onClick={(e) =>
                        handleRowClick(e, visIdx, track.originalIndex)
                      }
                      onDoubleClick={() => handleRowDoubleClick(track)}
                      onContextMenu={(e) =>
                        handleContextMenu(e, visIdx, track.originalIndex)
                      }
                      onMouseEnter={() => setHoveredIndex(track.originalIndex)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <div className="col-num">
                        {playbackContext === 'library' && track.originalIndex === audio.currentIndex &&
                        audio.isPlaying ? (
                          <span className="eq-bars">
                            <span />
                            <span />
                            <span />
                          </span>
                        ) : playbackContext === 'library' && track.originalIndex === audio.currentIndex ? (
                          <Pause className="row-pause-icon" size={11} />
                        ) : hoveredIndex === track.originalIndex ? (
                          <button
                            className="row-play-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              startLibraryPlayback(track.originalIndex);
                            }}
                          >
                            <Play size={11} />
                          </button>
                        ) : (
                          <span className="row-num">{visIdx + 1}</span>
                        )}
                      </div>
                      <div className="col-info">
                        <div className="col-title">{track.title}</div>
                        <div className="col-subtitle">
                          {track.is_cloud && (
                            <Cloud
                              className="cloud-badge-icon"
                              size={10}
                              strokeWidth={2}
                            />
                          )}
                          {track.subtitle}
                        </div>
                      </div>
                      <div className="col-duration col-duration-cell">
                        {formatDuration(track.duration_secs)}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {showLyrics && (
            <LyricsPanel
              onClose={() => setShowLyrics(false)}
              position={audio.position}
              duration={audio.duration}
              lyrics={lyrics}
              currentTrack={currentTrack}
              simplifyLyrics={simplifyLyrics}
              onToggleSimplify={toggleSimplifyLyrics}
            />
          )}

          <PlaybackBar
            audio={audio}
            currentTrack={currentTrack}
            showLyrics={showLyrics}
            setShowLyrics={setShowLyrics}
            onOpenFullPlayer={() => setShowFullPlayer(true)}
          />
        </div>

        {isDragOver && (
          <div className="drop-overlay">
            <FolderPlus size={48} strokeWidth={1.2} />
            <p>释放以导入音乐</p>
          </div>
        )}

        <ContextMenu
          visible={activeView === 'library' && contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          selectedCount={selectedIndices.size}
          canReveal={selectedIndices.size === 1 && !tracks[[...selectedIndices][0]]?.is_cloud}
          canUpload={localSelectedCount > 0}
          deleteFromDisk={deleteFromDisk}
          onClose={closeContextMenu}
          onPlay={() => {
            if (selectedIndices.size === 1) startLibraryPlayback([...selectedIndices][0]);
            closeContextMenu();
          }}
          onDelete={() => { deleteSelectedTracks(); closeContextMenu(); }}
          onReveal={revealInFinder}
          onUpload={() => { void handleUploadSelected(); closeContextMenu(); }}
        />

        {showFullPlayer && (
          <FullPlayer
            audio={audio}
            lyrics={lyrics}
            currentTrack={currentTrack}
            onClose={() => setShowFullPlayer(false)}
            simplifyLyrics={simplifyLyrics}
            onToggleSimplify={toggleSimplifyLyrics}
          />
        )}
      </div>
    </>
  );
}
