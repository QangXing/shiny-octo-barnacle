import type { Camera, Sprite } from '@/store/rendererStore';
import { FILM_WIDTH, FILM_HEIGHT, TILE_SIZE } from '../config';
import { projectOblique, renderSprites } from './spriteRender';

/**
 * 摄像机2：可旋转的斜二侧投影。
 * 先将世界坐标绕摄像机旋转 -θ 得到摄像机参考系 (u_rot, v_rot)，
 * 再按斜二侧法则投影到胶片坐标 (u, v)：
 *   u_rot = (x - n) * cosθ + (y - m) * sinθ
 *   v_rot = -(x - n) * sinθ + (y - m) * cosθ
 *   u = u_rot + v_rot / 2
 *   v = v_rot / 2
 */
export function renderObliqueView(
  filmCtx: CanvasRenderingContext2D,
  tilePattern: CanvasPattern,
  cam: Camera,
  sprites: Sprite[],
): void {
  // 清空胶片
  filmCtx.fillStyle = '#7dd3fc';
  filmCtx.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT);

  filmCtx.save();

  // 定义胶片裁剪区域
  filmCtx.beginPath();
  filmCtx.rect(0, 0, FILM_WIDTH, FILM_HEIGHT);
  filmCtx.clip();

  // Canvas setTransform(a,b,c,d,e,f): x' = a*x + c*y + e, y' = b*x + d*y + f
  const cx = FILM_WIDTH / 2;
  const cy = FILM_HEIGHT / 2;
  const cos = Math.cos(cam.theta);
  const sin = Math.sin(cam.theta);

  // 组合变换：先旋转到摄像机参考系，再斜二侧投影
  // u = x*(cos - sin/2) + y*(sin + cos/2) - n*(cos - sin/2) - m*(sin + cos/2)
  // v = x*(-sin/2)       + y*(cos/2)        + n*(sin/2)       - m*(cos/2)
  const a = cam.zoom * (cos - 0.5 * sin);
  const b = cam.zoom * (-0.5 * sin);
  const c = cam.zoom * (sin + 0.5 * cos);
  const d = cam.zoom * (0.5 * cos);
  const e = cx - cam.n * a - cam.m * c;
  const f = cy - cam.n * b - cam.m * d;

  filmCtx.setTransform(a, b, c, d, e, f);

  // 计算需要填充的世界区域（胶片四角逆投影）
  const bounds = computeObliqueWorldBounds(cam);
  const padding = TILE_SIZE;
  const minX = bounds.minX - padding;
  const minY = bounds.minY - padding;
  const maxX = bounds.maxX + padding;
  const maxY = bounds.maxY + padding;

  // 对齐到 tile 网格
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

  // 绘制带 z 高度的精灵贴图
  renderSprites(filmCtx, sprites, (x, y, z) => projectOblique(cam, x, y, z), cam);
}

/**
 * 根据可旋转斜二侧投影反推胶片四角对应的世界坐标包围盒。
 * 逆过程：v_rot = 2*v, u_rot = u - v
 *         x = n + u_rot*cosθ - v_rot*sinθ
 *         y = m + u_rot*sinθ + v_rot*cosθ
 */
function computeObliqueWorldBounds(cam: Camera): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const hw = FILM_WIDTH / 2 / cam.zoom;
  const hh = FILM_HEIGHT / 2 / cam.zoom;
  const filmCorners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];

  const cos = Math.cos(cam.theta);
  const sin = Math.sin(cam.theta);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [u, v] of filmCorners) {
    const vRot = 2 * v;
    const uRot = u - v;
    const x = cam.n + uRot * cos - vRot * sin;
    const y = cam.m + uRot * sin + vRot * cos;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
}
