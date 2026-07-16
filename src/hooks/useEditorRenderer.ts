import { useEffect, useRef } from 'react';
import { useRendererStore } from '@/store/rendererStore';
import type { Camera } from '@/store/rendererStore';
import { FILM_WIDTH, FILM_HEIGHT, TILE_SIZE } from '@/core/config';
import { createTileTexture } from '@/core/render/tileTexture';
import { createPointerHandlers } from '@/core/input';
import type { PointerState } from '@/core/input';
import { initResponsiveEditorCanvas, startEditorRenderLoop } from '@/core/loop';
import { createSampleSprites } from '@/core/sprite';
import { buildSpritesFromWorldText } from '@/core/worldLoader';

const MATERIAL_BASE_PATH = '/material/';

export const EDITOR_WIDTH = 1000;
export const EDITOR_HEIGHT = 750;

export function useEditorRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  worldText: string,
) {
  const filmCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const filmCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const tilePatternRef = useRef<CanvasPattern | null>(null);
  const tileCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesRef = useRef(createSampleSprites());

  const cameraRef = useRef<Camera>(useRendererStore.getState().camera);
  const modeRef = useRef(useRendererStore.getState().mode);
  const pointerRef = useRef<PointerState | null>(null);
  const joystickCenterRef = useRef({ x: -10000, y: -10000 });

  useEffect(() => {
    const unsubscribe = useRendererStore.subscribe((state) => {
      cameraRef.current = state.camera;
      modeRef.current = state.mode;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const film = document.createElement('canvas');
    film.width = FILM_WIDTH;
    film.height = FILM_HEIGHT;
    const filmCtx = film.getContext('2d', { alpha: false });
    if (!filmCtx) return;
    filmCanvasRef.current = film;
    filmCtxRef.current = filmCtx;

    const tileCanvas = createTileTexture(TILE_SIZE);
    tileCanvasRef.current = tileCanvas;
    const pattern = filmCtx.createPattern(tileCanvas, 'repeat');
    if (pattern) tilePatternRef.current = pattern;
  }, []);

  const materials = useRendererStore((state) => state.materials);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const worldSprites = await buildSpritesFromWorldText(worldText, MATERIAL_BASE_PATH, materials);
        if (cancelled) return;
        spritesRef.current = worldSprites.length > 0 ? worldSprites : createSampleSprites();
      } catch (err) {
        console.warn('[Editor] 世界解析失败:', err);
        spritesRef.current = createSampleSprites();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldText, materials]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const filmCanvas = filmCanvasRef.current;
    const filmCtx = filmCtxRef.current;
    const tilePattern = tilePatternRef.current;
    if (!canvas || !filmCanvas || !filmCtx || !tilePattern) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { getSize, cleanup: cleanupResize } = initResponsiveEditorCanvas(canvas, ctx, dpr);

    const keysRef = { current: {} as Record<string, boolean> };
    const joystickRef = { current: { active: false, dx: 0, dy: 0 } };

    const cancelLoop = startEditorRenderLoop(
      {
        canvas,
        ctx,
        filmCanvas,
        filmCtx,
        tilePattern,
        spritesRef,
        cameraRef,
        keysRef,
        joystickRef,
        pointerRef,
      },
      modeRef,
      getSize,
    );

    return () => {
      cleanupResize();
      cancelLoop();
    };
  }, [canvasRef]);

  const pointerHandlers = createPointerHandlers({
    pointerRef,
    joystickCenterRef,
    setJoystick: () => {},
    getCanvas: () => canvasRef.current,
    rotateSpeedMultiplier: () => useRendererStore.getState().editorRotateSpeed,
  });

  return pointerHandlers;
}
