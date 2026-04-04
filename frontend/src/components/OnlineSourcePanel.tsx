import { useMemo, useState } from 'react';
import { CloudDownload, Disc3, Heart, Play, Radio } from 'lucide-react';

import type { Track } from '../types';

const PLATFORM_LABELS: Record<string, string> = {
  wy: '网易云',
  kw: '酷我',
  kg: '酷狗',
  tx: 'QQ音乐',
  mg: '咪咕',
};

interface OnlineSourcePanelProps {
  results: Track[];
  isLoading?: boolean;
  isResolvingUrl?: boolean;
  hasSource?: boolean;
  selectedPlatform?: string;
  onPlatformChange?: (platform: string) => void;
  searchQuery: string;
  showFavoritesOnly: boolean;
  favoriteCount: number;
  activeTrackKey: string | null;
  isPlaying: boolean;
  downloadingTrackKeys?: Set<string>;
  onPlay: (track: Track, index: number, queue: Track[]) => void;
  onToggleFavorite: (track: Track) => void;
  onDownload: (track: Track) => void;
  onToggleFavoritesOnly: () => void;
  onOpenSettings?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

function formatDuration(secs?: number): string {
  if (!secs || secs <= 0) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getTrackKey(track: Track): string {
  if (track.online_source_id && track.online_id) {
    return `${track.online_source_id}:${track.online_id}`;
  }

  if (track.online_stream_url) {
    return track.online_stream_url;
  }

  return `${track.title}:${track.subtitle}`;
}

export function OnlineSourcePanel({
  results,
  isLoading = false,
  isResolvingUrl = false,
  hasSource = false,
  selectedPlatform = 'kw',
  onPlatformChange,
  searchQuery,
  showFavoritesOnly,
  favoriteCount,
  activeTrackKey,
  isPlaying,
  downloadingTrackKeys = new Set<string>(),
  onPlay,
  onToggleFavorite,
  onDownload,
  onToggleFavoritesOnly,
  onOpenSettings,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: OnlineSourcePanelProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const visibleResults = useMemo(() => {
    if (!showFavoritesOnly) {
      return results;
    }

    return results.filter((track) => track.is_favorite);
  }, [results, showFavoritesOnly]);

  const noSourceAndNoQuery = !hasSource && searchQuery.trim().length === 0;

  const emptyTitle = isLoading
    ? '\u6b63\u5728\u641c\u7d22\u5728\u7ebf\u76ee\u5f55\u2026'
    : noSourceAndNoQuery
      ? '\u672a\u5bfc\u5165\u97f3\u6e90'
      : searchQuery.trim().length === 0
        ? '\u641c\u7d22\u5728\u7ebf\u97f3\u4e50'
        : showFavoritesOnly
          ? '\u5f53\u524d\u7ed3\u679c\u91cc\u8fd8\u6ca1\u6709\u6536\u85cf\u66f2\u76ee'
          : '\u6ca1\u6709\u627e\u5230\u5339\u914d\u7684\u5728\u7ebf\u66f2\u76ee';

  const emptyHint = isLoading
    ? '\u7a0d\u7b49\u7247\u523b\uff0c\u7ed3\u679c\u4f1a\u5728\u8fd9\u91cc\u51fa\u73b0'
    : noSourceAndNoQuery
      ? null
      : searchQuery.trim().length === 0
        ? '\u8f93\u5165\u6b4c\u540d\u6216\u6b4c\u624b\uff0c\u53cc\u51fb\u7ed3\u679c\u5373\u53ef\u64ad\u653e'
        : showFavoritesOnly
          ? '\u53ef\u5148\u5728\u641c\u7d22\u7ed3\u679c\u91cc\u6807\u8bb0\u6536\u85cf\uff0c\u518d\u5207\u6362\u5230\u4ec5\u770b\u6536\u85cf'
          : '\u6362\u4e00\u4e2a\u5173\u952e\u8bcd\u8bd5\u8bd5\uff0c\u6216\u5173\u95ed\u201c\u4ec5\u770b\u6536\u85cf\u201d\u7b5b\u9009';

  return (
    <div className="online-panel">
      <div className="online-panel-toolbar">
        <div className="online-panel-summary">
          <Radio size={13} />
          <span>
            {searchQuery.trim().length > 0
              ? `在线目录 · ${visibleResults.length} 项结果`
              : '在线目录 · 直接播放与按需下载'}
          </span>
        </div>
        <button
          className={`online-filter-btn ${showFavoritesOnly ? 'active' : ''}`}
          onClick={onToggleFavoritesOnly}
          type="button"
        >
          <Heart size={12} className={showFavoritesOnly ? 'is-favorite' : ''} />
          <span>仅看收藏</span>
          {favoriteCount > 0 && <span className="toolbar-btn-badge">{favoriteCount}</span>}
        </button>
      </div>

      <div className="online-platform-tabs">
        {Object.entries(PLATFORM_LABELS).map(([p, label]) => (
          <button
            key={p}
            className={`online-platform-tab ${selectedPlatform === p ? 'active' : ''}`}
            onClick={() => onPlatformChange?.(p)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="track-list online-track-list">
        {visibleResults.length === 0 ? (
          <div className="empty-state online-empty-state">
            <Disc3 size={48} strokeWidth={1} className="empty-icon" />
            <p>{emptyTitle}</p>
            {emptyHint && <p className="empty-hint">{emptyHint}</p>}
            {noSourceAndNoQuery && (
              <button
                className="online-import-source-btn"
                onClick={onOpenSettings}
                type="button"
              >
                \u5728\u8bbe\u7f6e\u4e2d\u5bfc\u5165\u97f3\u6e90
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="list-header online-list-header">
              <div className="col-num">#</div>
              <div className="col-info">标题</div>
              <div className="col-album">专辑</div>
              <div className="col-duration">时长</div>
            </div>
            {visibleResults.map((track, index) => {
              const trackKey = getTrackKey(track);
              const isActive = activeTrackKey === trackKey;
              const isDownloading = downloadingTrackKeys.has(trackKey);

              return (
                <div
                  key={trackKey}
                  className={[
                    'track-row',
                    'track-row-has-actions',
                    selectedKey === trackKey ? 'is-selected' : '',
                    isActive ? 'is-active' : '',
                  ].join(' ')}
                  onClick={() => setSelectedKey(trackKey)}
                  onDoubleClick={() => onPlay(track, index, visibleResults)}
                  onMouseEnter={() => setHoveredKey(trackKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <div className="col-num">
                    {isActive && isPlaying ? (
                      <span className="eq-bars">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : hoveredKey === trackKey ? (
                      <button
                        aria-label={`播放 ${track.title}`}
                        className="row-play-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPlay(track, index, visibleResults);
                        }}
                        type="button"
                      >
                        <Play size={11} />
                      </button>
                    ) : (
                      <span className="row-num">{index + 1}</span>
                    )}
                  </div>
                  <div className="col-info">
                    <div className="col-title">{track.title}</div>
                    <div className="col-subtitle">
                      <span className="online-badge">{track.online_source_id ?? '在线'}</span>
                      <span>{track.subtitle}</span>
                    </div>
                  </div>
                  <div className="col-album col-album-cell">{track.online_album ?? ''}</div>
                  <div className="col-duration col-duration-cell">{formatDuration(track.duration_secs)}</div>
                  <div className="row-actions">
                    <button
                      aria-label={track.is_favorite ? `取消收藏 ${track.title}` : `收藏 ${track.title}`}
                      className={`row-action-btn ${track.is_favorite ? 'is-favorite' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite(track);
                      }}
                      type="button"
                    >
                      <Heart size={12} fill={track.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      aria-label={isDownloading ? `下载中 ${track.title}` : `下载 ${track.title}`}
                      className="row-action-btn"
                      disabled={isDownloading}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDownload(track);
                      }}
                      type="button"
                    >
                      <CloudDownload size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            {!showFavoritesOnly && hasMore && (
              <div className="online-load-more">
                <button
                  className="online-load-more-btn"
                  disabled={loadingMore}
                  onClick={onLoadMore}
                  type="button"
                >
                  {loadingMore ? '加载中…' : '加载更多'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
