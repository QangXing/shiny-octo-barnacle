import { useEffect, useState, useCallback, useRef } from 'react';
import { useRendererStore } from '@/store/rendererStore';
import { EditorCanvas } from './EditorCanvas';
import { EditorControls } from './EditorControls';
import { WorldFileEditor } from './WorldFileEditor';
import { IntroPanel } from './IntroPanel';
import { Camera, FileText, Info, GripHorizontal } from 'lucide-react';

type EditorTab = 'camera' | 'world' | 'intro';

const MIN_BOTTOM_HEIGHT = 180;
const MAX_BOTTOM_RATIO = 0.75;
const DEFAULT_BOTTOM_HEIGHT = 280;

export function WorldEditor() {
  const [activeTab, setActiveTab] = useState<EditorTab>('camera');
  const [worldText, setWorldText] = useState<string>('');
  const [bottomHeight, setBottomHeight] = useState<number>(DEFAULT_BOTTOM_HEIGHT);
  const mainRef = useRef<HTMLElement>(null);
  const draggingRef = useRef(false);

  const loadDefaultWorld = useCallback(async () => {
    try {
      const resp = await fetch('/world/world.txt');
      if (!resp.ok) throw new Error('加载失败');
      const text = await resp.text();
      setWorldText(text);
    } catch {
      setWorldText('# 默认 world.txt 加载失败，请手动编辑');
    }
  }, []);

  useEffect(() => {
    loadDefaultWorld();
  }, [loadDefaultWorld]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    const startY = e.clientY;
    const startHeight = bottomHeight;
    const mainHeight = mainRef.current?.clientHeight ?? window.innerHeight;

    const handleMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const delta = ev.clientY - startY;
      const newHeight = Math.max(
        MIN_BOTTOM_HEIGHT,
        Math.min(mainHeight * MAX_BOTTOM_RATIO, startHeight - delta),
      );
      setBottomHeight(newHeight);
    };

    const handleUp = () => {
      draggingRef.current = false;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [bottomHeight]);

  return (
    <div className="world-editor">
      <header className="world-editor-header">
        <h1 className="world-editor-title">World 编辑器</h1>
      </header>

      <main className="world-editor-main" ref={mainRef}>
        <section className="world-editor-preview">
          <EditorCanvas worldText={worldText} />
        </section>

        <div
          className="world-editor-resizer"
          onPointerDown={handlePointerDown}
          role="separator"
          aria-label="调整上下区域大小"
        >
          <GripHorizontal className="h-4 w-4" />
        </div>

        <section className="world-editor-bottom" style={{ height: bottomHeight }}>
          <div className="world-editor-tab-content" role="tabpanel">
            {activeTab === 'camera' && <EditorControls />}
            {activeTab === 'world' && (
              <WorldFileEditor
                worldText={worldText}
                setWorldText={setWorldText}
                onLoadDefault={loadDefaultWorld}
              />
            )}
            {activeTab === 'intro' && <IntroPanel />}
          </div>
        </section>
      </main>

      <nav className="world-editor-nav" role="tablist">
        <div className="world-editor-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'camera'}
            onClick={() => setActiveTab('camera')}
            className={`world-editor-tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
          >
            <Camera className="h-4 w-4" />
            摄像机调试
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'world'}
            onClick={() => setActiveTab('world')}
            className={`world-editor-tab-btn ${activeTab === 'world' ? 'active' : ''}`}
          >
            <FileText className="h-4 w-4" />
            world 文件编辑
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'intro'}
            onClick={() => setActiveTab('intro')}
            className={`world-editor-tab-btn ${activeTab === 'intro' ? 'active' : ''}`}
          >
            <Info className="h-4 w-4" />
            介绍
          </button>
        </div>
      </nav>
    </div>
  );
}
