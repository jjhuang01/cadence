import { Play, X, ChevronRight, Upload } from 'lucide-react';

interface Props {
  visible: boolean;
  x: number;
  y: number;
  selectedCount: number;
  canReveal: boolean;
  canUpload: boolean;
  deleteFromDisk: boolean;
  onClose: () => void;
  onPlay: () => void;
  onDelete: () => void;
  onReveal: () => void;
  onUpload: () => void;
}

export function ContextMenu({
  visible, x, y, selectedCount, canReveal, canUpload,
  deleteFromDisk, onClose, onPlay, onDelete, onReveal, onUpload,
}: Props) {
  if (!visible) return null;
  return (
    <>
      <div
        className="ctx-overlay"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        className="ctx-menu"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ctx-item" onClick={onPlay}>
          <Play size={14} />
          <span>播放</span>
        </button>
        {canUpload && (
          <button className="ctx-item ctx-upload" onClick={onUpload}>
            <Upload size={14} />
            <span>上传到云端 ({selectedCount})</span>
          </button>
        )}
        <button className="ctx-item ctx-danger" onClick={onDelete}>
          <X size={14} />
          <span>{deleteFromDisk ? `删除文件 (${selectedCount})` : `从列表移除 (${selectedCount})`}</span>
        </button>
        <div className="ctx-divider" />
        <button className="ctx-item" onClick={onReveal} disabled={!canReveal}>
          <ChevronRight size={14} />
          <span>在 Finder 中显示</span>
        </button>
      </div>
    </>
  );
}
