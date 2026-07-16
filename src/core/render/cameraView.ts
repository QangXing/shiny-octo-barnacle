import type { Camera, Sprite } from '@/store/rendererStore';
import { FILM_WIDTH, FILM_HEIGHT, TILE_SIZE } from '../config';
import { computeWorldBounds } from '../camera';
import { getVignetteCanvas } from './vignette';
import { projectCamera1, renderSprites } from './spriteRender';

export function renderCameraView(
  filmCtx: CanvasRenderingContext2D,
  tilePattern: CanvasPattern,
  cam: Camera,
  sprites: Sprite[],
): void {
  // 清空胶片
  filmCtx.fillStyle = '#0f172a';
  filmCtx.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT);

  filmCtx.save();

  // 先在胶片坐标系定义裁剪区域，避免旋转时填充过大的世界包围盒
  filmCtx.beginPath();
  filmCtx.rect(0, 0, FILM_WIDTH, FILM_HEIGHT);
  filmCtx.clip();

  // 将世界坐标映射到胶片坐标：film = filmCenter + zoom * rotate(-theta) * (world - cameraPos)
  filmCtx.translate(FILM_WIDTH / 2, FILM_HEIGHT / 2);
  filmCtx.scale(cam.zoom, cam.zoom);
  filmCtx.rotate(-cam.theta);
  filmCtx.translate(-cam.n, -cam.m);

  // 计算需要填充的世界区域
  const bounds = computeWorldBounds(cam);
  // 保留一 tile 外扩，避免裁剪边缘出现缝隙
  const padding = TILE_SIZE;
  const minX = bounds.minX - padding;
  const minY = bounds.minY - padding;
  const maxX = bounds.maxX + padding;
  const maxY = bounds.maxY + padding;

  // 将填充区域对齐到 tile 网格，避免贴图出现抖动
  const alignedMinX = Math.floor(minX / TILE_SIZE) * TILE_SIZE;
  const alignedMinY = Math.floor(minY / TILE_SIZE) * TILE_SIZE;
  const alignedMaxX = Math.ceil(maxX / TILE_SIZE) * TILE_SIZE;
  const alignedMaxY = Math.ceil(maxY / TILE_SIZE) * TILE_SIZE;

  filmCtx.fillStyle = tilePattern;
  filmCtx.fillRect(
    alignedMinX,
    alignedMinY,
    alignedMaxX - alignedMinX,
    alignedMaxY - alignedMinY,
  );

  filmCtx.restore();

  // 摄像机1为纯俯视，只绘制 xy 平面精灵；垂直墙面会缩成线，直接跳过
  const groundSprites = sprites.filter((s) => s.plane === 'xy');
  renderSprites(filmCtx, groundSprites, (x, y) => projectCamera1(cam, x, y), cam);

  // 叠加缓存的暗角与扫描线
  filmCtx.drawImage(getVignetteCanvas(), 0, 0);
}
