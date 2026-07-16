import { useRendererStore } from '@/store/rendererStore';
import { Camera, Video, Crosshair, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '@/core/config';

export function EditorControls() {
  const camera = useRendererStore((state) => state.camera);
  const mode = useRendererStore((state) => state.mode);
  const setCamera = useRendererStore((state) => state.setCamera);
  const setMode = useRendererStore((state) => state.setMode);

  const thetaDeg = ((camera.theta * 180) / Math.PI);
  const wrappedTheta = ((thetaDeg % 360) + 360) % 360;

  const handleThetaChange = (deg: number) => {
    setCamera({ theta: (deg * Math.PI) / 180 });
  };

  return (
    <div className="editor-controls">
      <div className="editor-controls-row">
        <div className="editor-info-grid">
          <div className="editor-info-cell">
            <span>n</span>
            <input
              type="number"
              value={Math.round(camera.n)}
              onChange={(e) => setCamera({ n: parseFloat(e.target.value) || 0 })}
              className="editor-input"
            />
          </div>
          <div className="editor-info-cell">
            <span>m</span>
            <input
              type="number"
              value={Math.round(camera.m)}
              onChange={(e) => setCamera({ m: parseFloat(e.target.value) || 0 })}
              className="editor-input"
            />
          </div>
          <div className="editor-info-cell">
            <span>θ</span>
            <span className="editor-value">{wrappedTheta.toFixed(1)}°</span>
          </div>
          <div className="editor-info-cell">
            <span>zoom</span>
            <span className="editor-value">{camera.zoom.toFixed(2)}x</span>
          </div>
        </div>

        <div className="editor-btn-group">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`control-btn ${mode === 'camera' ? 'control-btn-accent' : ''}`}
          >
            <Camera className="mr-2 h-4 w-4" />
            摄像机1
          </button>
          <button
            type="button"
            onClick={() => setMode('camera2')}
            className={`control-btn ${mode === 'camera2' ? 'control-btn-accent' : ''}`}
          >
            <Video className="mr-2 h-4 w-4" />
            摄像机2
          </button>
          <button
            type="button"
            onClick={() => setMode('debug')}
            className={`control-btn ${mode === 'debug' ? 'control-btn-accent' : ''}`}
          >
            <Crosshair className="mr-2 h-4 w-4" />
            调试
          </button>
        </div>

        <div className="editor-btn-group">
          <button
            type="button"
            onClick={() => setCamera({ zoom: Math.min(MAX_ZOOM, camera.zoom * ZOOM_STEP) })}
            className="control-btn"
            aria-label="放大"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCamera({ zoom: Math.max(MIN_ZOOM, camera.zoom / ZOOM_STEP) })}
            className="control-btn"
            aria-label="缩小"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCamera({ n: 0, m: 0, theta: 0, zoom: 1 })}
            className="control-btn"
            aria-label="重置摄像机"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="editor-slider-row">
        <span>θ 直接调整</span>
        <input
          type="range"
          min={0}
          max={360}
          step={0.5}
          value={wrappedTheta}
          onChange={(e) => handleThetaChange(parseFloat(e.target.value))}
          className="editor-slider"
        />
      </div>
    </div>
  );
}
