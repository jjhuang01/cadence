import { useState, useEffect } from 'react';
import { ExternalLink, X, CheckCircle, AlertCircle, SkipForward } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { SourceConfig } from '../online/sourceConfig';
import { QUALITY_LABELS, saveSourceConfig } from '../online/sourceConfig';
import type { UploadHistoryEntry } from '../types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

interface Props {
  onClose: () => void;
  deleteFromDisk: boolean;
  setDeleteFromDisk: (v: boolean) => void;
  sourceConfig: SourceConfig;
  onSourceConfigChange: (c: SourceConfig) => void;
  onAddSource: () => Promise<void>;
  onRemoveSource: (id: string) => Promise<void>;
  onSetActiveSource: (id: string) => Promise<void>;
  uploadHistory: UploadHistoryEntry[];
}

export function SettingsPanel({
  onClose,
  deleteFromDisk,
  setDeleteFromDisk,
  sourceConfig,
  onSourceConfigChange,
  onAddSource,
  onRemoveSource,
  onSetActiveSource,
  uploadHistory,
}: Props) {
  const [logPath, setLogPath] = useState<string | null>(null);
  const [addingSource, setAddingSource] = useState(false);

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
    try {
      await onAddSource();
    } finally {
      setAddingSource(false);
    }
  }

  function openLogFile() {
    if (!logPath) return;
    invoke('reveal_in_finder', { path: logPath }).catch(() => {});
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span className="settings-title">设置</span>
        <button className="settings-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="settings-content">

        <div className="settings-section">
          <div className="settings-section-title">在线音乐源</div>

          {sourceConfig.loadedSources.length === 0 ? (
            <div className="settings-field">
              <span className="settings-field-hint">
                导入 lx-music 兼容的 .js 音源文件即可使用在线搜索与播放，无需手动配置 API 地址。
              </span>
            </div>
          ) : (
            <div className="settings-source-list">
              {sourceConfig.loadedSources.map((src) => {
                const isActive = sourceConfig.activeSourceId === src.id;
                return (
                  <div
                    key={src.id}
                    className={`settings-source-item ${isActive ? 'active' : ''}`}
                  >
                    <label className="settings-source-radio">
                      <input
                        type="radio"
                        name="activeSource"
                        checked={isActive}
                        onChange={() => void onSetActiveSource(src.id)}
                      />
                      <div className="settings-source-info">
                        <span className="settings-source-name">{src.name}</span>
                        <span className="settings-source-url">
                          {src.apiBaseUrl || '独立脚本'}
                        </span>
                      </div>
                    </label>
                    <button
                      className="settings-source-remove"
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
            className="settings-apply-btn"
            style={{ marginTop: 8 }}
            disabled={addingSource}
            onClick={() => void handleAddSource()}
            type="button"
          >
            {addingSource ? '导入中…' : '+ 导入音源 (.js)'}
          </button>

          <div className="settings-field" style={{ marginTop: 12 }}>
            <label className="settings-field-label">音质</label>
            <select
              className="settings-select"
              value={sourceConfig.quality}
              onChange={(e) => handleSourceChange('quality', e.target.value)}
            >
              {Object.entries(QUALITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">删除行为</div>
          <label className="settings-option">
            <input
              type="radio"
              name="deleteMode"
              checked={!deleteFromDisk}
              onChange={() => {
                setDeleteFromDisk(false);
                localStorage.setItem('tips-delete-from-disk', 'false');
              }}
            />
            <span className="settings-option-label">
              <span className="settings-option-title">仅从列表移除</span>
              <span className="settings-option-desc">文件保留在硬盘</span>
            </span>
          </label>
          <label className="settings-option">
            <input
              type="radio"
              name="deleteMode"
              checked={deleteFromDisk}
              onChange={() => {
                setDeleteFromDisk(true);
                localStorage.setItem('tips-delete-from-disk', 'true');
              }}
            />
            <span className="settings-option-label">
              <span className="settings-option-title">同时删除文件</span>
              <span className="settings-option-desc">从硬盘彻底删除（不可恢复）</span>
            </span>
          </label>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">上传历史</div>
          {uploadHistory.length === 0 ? (
            <div className="settings-field">
              <span className="settings-field-hint">暂无上传记录</span>
            </div>
          ) : (
            <div className="upload-history-list">
              {uploadHistory.map((entry) => (
                <div key={entry.id} className="upload-history-entry">
                  <div className="upload-history-time">{formatTime(entry.timestamp)}</div>
                  <div className="upload-history-stats">
                    {entry.uploaded > 0 && (
                      <span className="upload-stat upload-stat-ok">
                        <CheckCircle size={11} />{entry.uploaded} 首
                      </span>
                    )}
                    {entry.skipped > 0 && (
                      <span className="upload-stat upload-stat-skip">
                        <SkipForward size={11} />跳过 {entry.skipped}
                      </span>
                    )}
                    {entry.failed.length > 0 && (
                      <span className="upload-stat upload-stat-fail">
                        <AlertCircle size={11} />失败 {entry.failed.length}
                      </span>
                    )}
                  </div>
                  {entry.failed.map((msg, i) => (
                    <div key={i} className="upload-history-error-row">{msg}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="settings-section">
          <div className="settings-section-title">诊断日志</div>
          <div className="settings-field">
            <span className="settings-field-hint">
              {logPath
                ? `日志写入 ~/Library/Application Support/…/logs/runtime.log`
                : '日志路径未找到'}
            </span>
            {logPath && (
              <button className="settings-log-btn" onClick={openLogFile} type="button">
                <ExternalLink size={11} />
                在 Finder 中显示日志文件
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
