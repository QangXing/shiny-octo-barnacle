import { useState, useCallback } from 'react';
import { MaterialManager } from './MaterialManager';
import { Download, Upload, RefreshCw, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

interface WorldFileEditorProps {
  worldText: string;
  setWorldText: (text: string) => void;
  onLoadDefault: () => void;
}

export function WorldFileEditor({ worldText, setWorldText, onLoadDefault }: WorldFileEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);

  const handleDownload = useCallback(() => {
    const blob = new Blob([worldText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [worldText]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setWorldText(String(reader.result));
      setError(null);
    };
    reader.onerror = () => setError('文件读取失败');
    reader.readAsText(file);
  }, [setWorldText]);

  return (
    <div className={`world-editor-tab ${maximized ? 'world-editor-tab-maximized' : ''}`}>
      <div className="world-editor-toolbar">
        <button
          type="button"
          onClick={onLoadDefault}
          className="world-editor-toolbar-btn"
          title="重载默认 world.txt"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="world-editor-toolbar-btn"
          title="下载 world.txt"
        >
          <Download className="h-4 w-4" />
        </button>
        <label className="world-editor-toolbar-btn cursor-pointer" title="上传 world.txt">
          <Upload className="h-4 w-4" />
          <input type="file" accept=".txt" onChange={handleUpload} className="hidden" />
        </label>
        <div className="world-editor-toolbar-spacer" />
        <button
          type="button"
          onClick={() => setMaximized((v) => !v)}
          className="world-editor-toolbar-btn"
          title={maximized ? '恢复原状' : '放大编辑区'}
        >
          {maximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {error && (
        <div className="world-editor-error">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className={`world-editor-split ${maximized ? 'world-editor-split-maximized' : ''}`}>
        <textarea
          className="world-editor-textarea"
          value={worldText}
          onChange={(e) => setWorldText(e.target.value)}
          spellCheck={false}
          placeholder="# world.txt 格式说明：&#10;# 贴图必须放在 /material/ 文件夹，world.txt 中只写文件名&#10;# 普通精灵: (x1,y1,z1) (x2,y2,z2) image.png&#10;# 结构定义: structure name:( ... )&#10;# 结构调用: stu name (x,y,z)&#10;# 坐标支持小数值，自动乘以 128（如 (1,1,1) 表示 (128,128,128)）"
        />
        {!maximized && <MaterialManager />}
      </div>
    </div>
  );
}
