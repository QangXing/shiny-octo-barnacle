import { TILE_SIZE } from '../config';

export function createTileTexture(size = TILE_SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 2D 上下文');
  }

  // 天蓝色背景
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0, 0, size, size);

  // 白色网格线（更细、更柔和）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, size);
  ctx.stroke();

  // 中心小点，便于对齐
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 2, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}
