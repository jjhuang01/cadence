import { X, Upload, CheckCircle, AlertCircle, SkipForward } from 'lucide-react';
import { UploadHistoryEntry } from '../types';

interface Props {
  history: UploadHistoryEntry[];
  onClose: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function UploadHistoryPanel({ history, onClose }: Props) {
  return (
    <div className="upload-history-panel">
      <div className="upload-history-header">
        <Upload size={14} />
        <span>上传历史</span>
        <button className="upload-history-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {history.length === 0 ? (
        <div className="upload-history-empty">暂无上传记录</div>
      ) : (
        <div className="upload-history-list">
          {history.map((entry) => (
            <div key={entry.id} className="upload-history-entry">
              <div className="upload-history-time">{formatTime(entry.timestamp)}</div>
              <div className="upload-history-stats">
                {entry.uploaded > 0 && (
                  <span className="upload-stat upload-stat-ok">
                    <CheckCircle size={11} />
                    {entry.uploaded} 首
                  </span>
                )}
                {entry.skipped > 0 && (
                  <span className="upload-stat upload-stat-skip">
                    <SkipForward size={11} />
                    跳过 {entry.skipped}
                  </span>
                )}
                {entry.failed.length > 0 && (
                  <span className="upload-stat upload-stat-fail">
                    <AlertCircle size={11} />
                    失败 {entry.failed.length}
                  </span>
                )}
              </div>
              {entry.failed.length > 0 && (
                <div className="upload-history-errors">
                  {entry.failed.map((msg, i) => (
                    <div key={i} className="upload-history-error-row">{msg}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
