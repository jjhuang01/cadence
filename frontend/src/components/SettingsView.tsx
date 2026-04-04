import { useState, useEffect } from 'react';
import {
  ExternalLink, X, RefreshCw, Trash2, Upload, Cloud,
  CheckCircle, AlertCircle, SkipForward,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { SourceConfig } from '../online/sourceConfig';
import { QUALITY_LABELS, saveSourceConfig } from '../online/sourceConfig';
import type { Track, UploadHistoryEntry } from '../types';

type Tab = 'general' | 'cloud' | 'online' | 'diagnostics';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

interface Props {
  deleteFromDisk: boolean;
  setDeleteFromDisk: (v: boolean) => void;
  sourceConfig: SourceConfig;
  onSourceConfigChange: (c: SourceConfig) => void;
  onAddSource: () => Promise<void>;
  onRemoveSource: (id: string) => Promise<void>;
  onSetActiveSource: (id: string) => Promise<void>;
  uploadHistory: UploadHistoryEntry[];
  cloudTracks: Track[];
  isScanning: boolean;
  isUploading: boolean;
  onScanCloud: () => Promise<void>;
  onDeleteCloudTrack: (key: string) => Promise<void>;
}

export function SettingsView({
  deleteFromDisk,
  setDeleteFromDisk,
  sourceConfig,
  onSourceConfigChange,
  onAddSource,
  onRemoveSource,
  onSetActiveSource,
  uploadHistory,
  cloudTracks,
  isScanning,
  isUploading,
  onScanCloud,
  onDeleteCloudTrack,
}: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [logPath, setLogPath] = useState<string | null>(null);
  const [addingSource, setAddingSource] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>('get_log_path').then(setLogPath).catch(() => {});
  }, []);

  function handleSourceChange(field: keyof SourceConfig, value: string) {
    const next = { ...sourceConfig, [field]: value };
    onSourceConfigChange(next);
    saveSourceConfig(next).catch(() => {});
  }

  async function handleAddSource() {
    setAddingSource(true);
    try { await onAddSource(); } finally { setAddingSource(false); }
  }

  async function handleDeleteCloud(key: string) {
    setDeletingKey(key);
    try { await onDeleteCloudTrack(key); } finally { setDeletingKey(null); }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'general', label: '通用' },
    { id: 'cloud', label: '云端存储' },
    { id: 'online', label: '在线音乐' },
    { id: 'diagnostics', label: '诊断' },
  ];

  return (
    <div className="settings-view">
      <div className="settings-view-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`settings-view-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="settings-view-body">

        {/* ── 通用 ── */}
        {tab === 'general' && (
          <div className="sv-section-group">
            <section className="sv-section">
              <h3 className="sv-section-title">删除行为</h3>
              <label className="sv-option">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={!deleteFromDisk}
                  onChange={() => {
                    setDeleteFromDisk(false);
                    localStorage.setItem('tips-delete-from-disk', 'false');
                  }}
                />
                <span className="sv-option-body">
                  <span className="sv-option-title">仅从列表移除</span>
                  <span className="sv-option-desc">文件保留在硬盘上</span>
                </span>
              </label>
              <label className="sv-option">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteFromDisk}
                  onChange={() => {
                    setDeleteFromDisk(true);
                    localStorage.setItem('tips-delete-from-disk', 'true');
                  }}
                />
                <span className="sv-option-body">
                  <span className="sv-option-title">同时删除文件</span>
                  <span className="sv-option-desc">从硬盘彻底删除，操作不可撤销</span>
                </span>
              </label>
            </section>
          </div>
        )}

        {/* ── 云端存储 ── */}
        {tab === 'cloud' && (
          <div className="sv-section-group">
            <section className="sv-section">
              <div className="sv-section-header">
                <h3 className="sv-section-title">
                  <Cloud size={14} style={{ marginRight: 6 }} />
                  云端音乐
                  {cloudTracks.length > 0 && (
                    <span className="sv-count-badge">{cloudTracks.length}</span>
                  )}
                </h3>
                <button
                  className="sv-action-btn"
                  onClick={() => void onScanCloud()}
                  disabled={isScanning}
                  type="button"
                >
                  <RefreshCw size={12} className={isScanning ? 'spinning' : ''} />
                  {isScanning ? '扫描中…' : '刷新'}
                </button>
              </div>

              {cloudTracks.length === 0 ? (
                <p className="sv-empty">云端暂无音乐，点击「刷新」扫描 R2 存储</p>
              ) : (
                <div className="sv-cloud-list">
                  {cloudTracks.map((track) => (
                    <div key={track.cloud_key} className="sv-cloud-row">
                      <div className="sv-cloud-info">
                        <span className="sv-cloud-title">{track.title}</span>
                        <span className="sv-cloud-key">{track.cloud_key?.replace('tips-music/', '')}</span>
                      </div>
                      <button
                        className="sv-delete-btn"
                        title="从云端删除"
                        disabled={deletingKey === track.cloud_key}
                        onClick={() => track.cloud_key && void handleDeleteCloud(track.cloud_key)}
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="sv-section">
              <h3 className="sv-section-title">
                <Upload size={14} style={{ marginRight: 6 }} />
                上传历史
              </h3>
              {uploadHistory.length === 0 ? (
                <p className="sv-empty">暂无上传记录</p>
              ) : (
                <div className="sv-history-list">
                  {uploadHistory.map((entry) => (
                    <div key={entry.id} className="sv-history-row">
                      <span className="sv-history-time">{formatTime(entry.timestamp)}</span>
                      <div className="sv-history-stats">
                        {entry.uploaded > 0 && (
                          <span className="sv-stat sv-stat-ok">
                            <CheckCircle size={11} /> {entry.uploaded} 首
                          </span>
                        )}
                        {entry.skipped > 0 && (
                          <span className="sv-stat sv-stat-skip">
                            <SkipForward size={11} /> 跳过 {entry.skipped}
                          </span>
                        )}
                        {entry.failed.length > 0 && (
                          <span className="sv-stat sv-stat-fail">
                            <AlertCircle size={11} /> 失败 {entry.failed.length}
                          </span>
                        )}
                      </div>
                      {entry.failed.map((msg, i) => (
                        <div key={i} className="sv-history-error">{msg}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── 在线音乐 ── */}
        {tab === 'online' && (
          <div className="sv-section-group">
            <section className="sv-section">
              <h3 className="sv-section-title">音源管理</h3>
              {sourceConfig.loadedSources.length === 0 ? (
                <p className="sv-empty">
                  导入 lx-music 兼容的 .js 音源文件即可使用在线搜索与播放，无需手动配置 API 地址。
                </p>
              ) : (
                <div className="sv-source-list">
                  {sourceConfig.loadedSources.map((src) => {
                    const isActive = sourceConfig.activeSourceId === src.id;
                    return (
                      <div key={src.id} className={`sv-source-item ${isActive ? 'active' : ''}`}>
                        <label className="sv-source-radio">
                          <input
                            type="radio"
                            name="activeSource"
                            checked={isActive}
                            onChange={() => void onSetActiveSource(src.id)}
                          />
                          <div className="sv-source-info">
                            <span className="sv-source-name">{src.name}</span>
                            <span className="sv-source-url">{src.apiBaseUrl || '独立脚本'}</span>
                          </div>
                        </label>
                        <button
                          className="sv-delete-btn"
                          onClick={() => void onRemoveSource(src.id)}
                          type="button"
                          title="移除此音源"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="sv-primary-btn"
                disabled={addingSource}
                onClick={() => void handleAddSource()}
                type="button"
              >
                {addingSource ? '导入中…' : '+ 导入音源 (.js)'}
              </button>

              <div className="sv-field" style={{ marginTop: 16 }}>
                <label className="sv-field-label">默认音质</label>
                <select
                  className="sv-select"
                  value={sourceConfig.quality}
                  onChange={(e) => handleSourceChange('quality', e.target.value)}
                >
                  {Object.entries(QUALITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </section>
          </div>
        )}

        {/* ── 诊断 ── */}
        {tab === 'diagnostics' && (
          <div className="sv-section-group">
            <section className="sv-section">
              <h3 className="sv-section-title">运行日志</h3>
              <p className="sv-empty">
                {logPath
                  ? '日志写入 ~/Library/Application Support/…/logs/runtime.log'
                  : '日志路径未找到'}
              </p>
              {logPath && (
                <button
                  className="sv-primary-btn"
                  onClick={() => invoke('reveal_in_finder', { path: logPath }).catch(() => {})}
                  type="button"
                >
                  <ExternalLink size={12} />
                  在 Finder 中显示日志
                </button>
              )}
            </section>
          </div>
        )}

      </div>
    </div>
  );
}
