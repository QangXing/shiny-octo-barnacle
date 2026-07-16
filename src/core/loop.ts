import type { MutableRefObject } from 'react';
import type { Camera, JoystickState, Sprite, ViewMode } from '@/store/rendererStore';
import { useRendererStore } from '@/store/rendererStore';
import {
  FILM_WIDTH,
  FILM_HEIGHT,
  MOVE_SPEED,
  UI_UPDATE_INTERVAL,
  FPS_UPDATE_INTERVAL,
  MAX_DPR,
} from './config';
import { cameraVelocityToWorld } from './camera';
import { normalizeJoystick } from './input';
import { renderCameraView } from './render/cameraView';
import { renderObliqueView } from './render/obliqueView';
import { renderDebugView } from './render/debugView';

export interface LoopRefs {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  filmCanvas: HTMLCanvasElement;
  filmCtx: CanvasRenderingContext2D;
  tilePattern: CanvasPattern;
  spritesRef: MutableRefObject<Sprite[]>;
  cameraRef: MutableRefObject<Camera>;
  keysRef: MutableRefObject<Record<string, boolean>>;
  joystickRef: MutableRefObject<JoystickState>;
  pointerRef: MutableRefObject<{
    rotateDelta?: number;
  } | null>;
}

export interface LoopState {
  animationId: number;
  lastTime: number;
  frameCount: number;
  fpsTime: number;
  lastUiUpdate: number;
}

export function initScreenCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): () => void {
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  resize();
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}

export function startRenderLoop(
  refs: LoopRefs,
  modeRef: MutableRefObject<ViewMode>,
): () => void {
  const state: LoopState = {
    animationId: 0,
    lastTime: 0,
    frameCount: 0,
    fpsTime: 0,
    lastUiUpdate: 0,
  };

  const { setFps, setCamera } = useRendererStore.getState();

  const applyKeyboard = () => {
    const keys = refs.keysRef.current;
    let du = 0;
    let dv = 0;
    if (keys['w'] || keys['arrowup']) dv -= 1;
    if (keys['s'] || keys['arrowdown']) dv += 1;
    if (keys['a'] || keys['arrowleft']) du -= 1;
    if (keys['d'] || keys['arrowright']) du += 1;
    if (du === 0 && dv === 0) return;

    const len = Math.hypot(du, dv) || 1;
    const [wx, wy] = cameraVelocityToWorld(
      refs.cameraRef.current,
      (du / len) * MOVE_SPEED,
      (dv / len) * MOVE_SPEED,
    );
    const cam = refs.cameraRef.current;
    refs.cameraRef.current = { ...cam, n: cam.n + wx, m: cam.m + wy };
  };

  const applyJoystick = () => {
    const joy = refs.joystickRef.current;
    if (!joy.active) return;
    const { dx, dy } = normalizeJoystick(joy.dx, joy.dy);
    if (dx === 0 && dy === 0) return;

    const [wx, wy] = cameraVelocityToWorld(
      refs.cameraRef.current,
      dx * MOVE_SPEED,
      dy * MOVE_SPEED,
    );
    const cam = refs.cameraRef.current;
    refs.cameraRef.current = { ...cam, n: cam.n + wx, m: cam.m + wy };
  };

  const applyPointerRotation = () => {
    const ptr = refs.pointerRef.current;
    if (!ptr || ptr.rotateDelta === undefined || ptr.rotateDelta === 0) return;
    const cam = refs.cameraRef.current;
    refs.cameraRef.current = { ...cam, theta: cam.theta + ptr.rotateDelta };
    ptr.rotateDelta = 0;
  };

  const drawFilmToScreen = (width: number, height: number) => {
    const filmAspect = FILM_WIDTH / FILM_HEIGHT;
    const screenAspect = width / height;
    let drawW: number;
    let drawH: number;
    if (screenAspect > filmAspect) {
      drawW = width;
      drawH = width / filmAspect;
    } else {
      drawH = height;
      drawW = height * filmAspect;
    }
    const drawX = (width - drawW) / 2;
    const drawY = (height - drawH) / 2;

    refs.ctx.drawImage(refs.filmCanvas, drawX, drawY, drawW, drawH);
  };

  const loop = (time: number) => {
    state.lastTime = time;

    // 同步 UI 控制的 zoom 到 cameraRef，避免放大/缩小按钮被渲染循环覆盖
    refs.cameraRef.current.zoom = useRendererStore.getState().camera.zoom;

    applyKeyboard();
    applyJoystick();
    applyPointerRotation();

    const width = refs.canvas.width / (window.devicePixelRatio || 1);
    const height = refs.canvas.height / (window.devicePixelRatio || 1);

    if (modeRef.current === 'camera') {
      renderCameraView(refs.filmCtx, refs.tilePattern, refs.cameraRef.current, refs.spritesRef.current);
      drawFilmToScreen(width, height);
    } else if (modeRef.current === 'camera2') {
      renderObliqueView(refs.filmCtx, refs.tilePattern, refs.cameraRef.current, refs.spritesRef.current);
      drawFilmToScreen(width, height);
    } else {
      renderDebugView(refs.ctx, width, height, refs.cameraRef.current);
    }

    // FPS 计算
    state.frameCount++;
    if (time - state.fpsTime >= FPS_UPDATE_INTERVAL) {
      setFps(state.frameCount);
      state.frameCount = 0;
      state.fpsTime = time;
    }

    // 每 100ms 把 camera ref 同步回 store，供 UI 显示，避免 React 每帧重渲染
    if (time - state.lastUiUpdate >= UI_UPDATE_INTERVAL) {
      setCamera(refs.cameraRef.current);
      state.lastUiUpdate = time;
    }

    state.animationId = requestAnimationFrame(loop);
  };

  state.animationId = requestAnimationFrame(loop);

  return () => cancelAnimationFrame(state.animationId);
}

export function initEditorCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
): () => void {
  const resize = () => {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  resize();
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}

export interface ResponsiveSize {
  width: number;
  height: number;
}

export function initResponsiveEditorCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  dpr: number,
): { getSize: () => ResponsiveSize; cleanup: () => void } {
  const size: ResponsiveSize = { width: 0, height: 0 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    size.width = width;
    size.height = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  resize();

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  const cleanup = () => {
    if (ro) {
      ro.disconnect();
    } else {
      window.removeEventListener('resize', resize);
    }
  };

  return { getSize: () => size, cleanup };
}

export function startEditorRenderLoop(
  refs: LoopRefs,
  modeRef: MutableRefObject<ViewMode>,
  getSize: () => ResponsiveSize,
): () => void {
  const state: LoopState = {
    animationId: 0,
    lastTime: 0,
    frameCount: 0,
    fpsTime: 0,
    lastUiUpdate: 0,
  };

  const { setFps, setCamera } = useRendererStore.getState();

  const wrapTheta = (theta: number): number => {
    const twoPi = Math.PI * 2;
    let t = theta % twoPi;
    if (t < 0) t += twoPi;
    return t;
  };

  const applyPointerRotation = () => {
    const ptr = refs.pointerRef.current;
    if (!ptr || ptr.rotateDelta === undefined || ptr.rotateDelta === 0) return;
    const cam = refs.cameraRef.current;
    refs.cameraRef.current = { ...cam, theta: wrapTheta(cam.theta + ptr.rotateDelta) };
    ptr.rotateDelta = 0;
  };

  const drawFilmToScreen = () => {
    // 编辑器预览使用 cover，让胶片填满整个预览区；摄像机原点位于胶片中心，缩放时保持居中
    const { width, height } = getSize();
    const filmAspect = FILM_WIDTH / FILM_HEIGHT;
    const screenAspect = width / height;
    let drawW: number;
    let drawH: number;
    if (screenAspect > filmAspect) {
      drawW = width;
      drawH = width / filmAspect;
    } else {
      drawH = height;
      drawW = height * filmAspect;
    }
    const drawX = (width - drawW) / 2;
    const drawY = (height - drawH) / 2;

    refs.ctx.drawImage(refs.filmCanvas, drawX, drawY, drawW, drawH);
  };

  const loop = (time: number) => {
    state.lastTime = time;

    refs.cameraRef.current.zoom = useRendererStore.getState().camera.zoom;

    applyPointerRotation();

    const { width, height } = getSize();

    if (modeRef.current === 'camera') {
      renderCameraView(refs.filmCtx, refs.tilePattern, refs.cameraRef.current, refs.spritesRef.current);
      drawFilmToScreen();
    } else if (modeRef.current === 'camera2') {
      renderObliqueView(refs.filmCtx, refs.tilePattern, refs.cameraRef.current, refs.spritesRef.current);
      drawFilmToScreen();
    } else {
      renderDebugView(refs.ctx, width, height, refs.cameraRef.current);
    }

    state.frameCount++;
    if (time - state.fpsTime >= FPS_UPDATE_INTERVAL) {
      setFps(state.frameCount);
      state.frameCount = 0;
      state.fpsTime = time;
    }

    if (time - state.lastUiUpdate >= UI_UPDATE_INTERVAL) {
      setCamera(refs.cameraRef.current);
      state.lastUiUpdate = time;
    }

    state.animationId = requestAnimationFrame(loop);
  };

  state.animationId = requestAnimationFrame(loop);

  return () => cancelAnimationFrame(state.animationId);
}
