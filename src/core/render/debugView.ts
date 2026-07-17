import type { Camera } from '@/store/rendererStore';
import { FILM_WIDTH, FILM_HEIGHT, TILE_SIZE } from '../config';
import { cameraToWorld, computeWorldBounds } from '../camera';

export function renderDebugView(
  screenCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cam: Camera,
): void {
  screenCtx.fillStyle = '#7dd3fc';
  screenCtx.fillRect(0, 0, width, height);

  // 调试视图缩放：让世界中的一个较大范围适配屏幕
  const viewSize = Math.max(FILM_WIDTH, FILM_HEIGHT) * 1.4;
  const scale = Math.min(width, height) / viewSize;
  const offsetX = width / 2 - cam.n * scale;
  const offsetY = height / 2 - cam.m * scale;

  const worldToScreen = (x: number, y: number): [number, number] => [
    offsetX + x * scale,
    offsetY + y * scale,
  ];

  drawTileGrid(screenCtx, cam, worldToScreen);
  drawOrigin(screenCtx, worldToScreen);
  drawCameraFrustum(screenCtx, cam, worldToScreen);
  drawCameraPose(screenCtx, cam, worldToScreen);
  drawLabels(screenCtx, worldToScreen, cam);
}

function drawTileGrid(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  worldToScreen: (x: number, y: number) => [number, number],
): void {
  const bounds = computeWorldBounds(cam);
  const padding = TILE_SIZE * 4;
  const startTx = Math.floor((bounds.minX - padding) / TILE_SIZE);
  const endTx = Math.ceil((bounds.maxX + padding) / TILE_SIZE);
  const startTy = Math.floor((bounds.minY - padding) / TILE_SIZE);
  const endTy = Math.ceil((bounds.maxY + padding) / TILE_SIZE);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.lineWidth = 1;
  for (let tx = startTx; tx <= endTx; tx++) {
    const x = tx * TILE_SIZE;
    const [sx1, sy1] = worldToScreen(x, bounds.minY - padding);
    const [, sy2] = worldToScreen(x, bounds.maxY + padding);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx1, sy2);
    ctx.stroke();
  }
  for (let ty = startTy; ty <= endTy; ty++) {
    const y = ty * TILE_SIZE;
    const [sx1, sy1] = worldToScreen(bounds.minX - padding, y);
    const [sx2] = worldToScreen(bounds.maxX + padding, y);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy1);
    ctx.stroke();
  }
}

function drawOrigin(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (x: number, y: number) => [number, number],
): void {
  const [ox, oy] = worldToScreen(0, 0);
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox - 12, oy);
  ctx.lineTo(ox + 12, oy);
  ctx.moveTo(ox, oy - 12);
  ctx.lineTo(ox, oy + 12);
  ctx.stroke();
}

function drawCameraFrustum(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  worldToScreen: (x: number, y: number) => [number, number],
): void {
  const hw = FILM_WIDTH / 2;
  const hh = FILM_HEIGHT / 2;
  const corners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
    [-hw, -hh],
  ];
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < corners.length; i++) {
    const [wx, wy] = cameraToWorld(cam, corners[i][0], corners[i][1]);
    const [sx, sy] = worldToScreen(wx, wy);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
}

function drawCameraPose(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  worldToScreen: (x: number, y: number) => [number, number],
): void {
  const [cx, cy] = worldToScreen(cam.n, cam.m);
  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  // 朝向箭头：沿摄像机 v 轴正方向（世界坐标中为 (-sinθ, cosθ)）
  const dirLen = FILM_HEIGHT * 0.4;
  const arrowX = cam.n - Math.sin(cam.theta) * dirLen;
  const arrowY = cam.m + Math.cos(cam.theta) * dirLen;
  const [ax, ay] = worldToScreen(arrowX, arrowY);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  // u 轴辅助线（右侧）
  const rightX = cam.n + Math.cos(cam.theta) * (FILM_WIDTH * 0.3);
  const rightY = cam.m + Math.sin(cam.theta) * (FILM_WIDTH * 0.3);
  const [rx, ry] = worldToScreen(rightX, rightY);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(rx, ry);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (x: number, y: number) => [number, number],
  cam: Camera,
): void {
  const [ox, oy] = worldToScreen(0, 0);
  const [cx, cy] = worldToScreen(cam.n, cam.m);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText('世界原点', ox + 10, oy - 10);
  ctx.fillText('摄像机', cx + 12, cy - 12);
}
