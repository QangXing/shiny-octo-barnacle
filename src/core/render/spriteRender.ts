import type { Camera } from '@/store/rendererStore';
import type { Sprite, SpritePlane } from '@/core/sprite';
import { getSpriteCorners } from '@/core/sprite';
import { FILM_WIDTH, FILM_HEIGHT } from '../config';

/**
 * 摄像机1：纯俯视正交投影。
 * 只取 (x, y) 绕摄像机旋转 -θ，z 高度不影响屏幕位置。
 * 因此垂直于大地的墙面（xz/yz）会缩成一条线，视觉上不可见。
 */
export function projectCamera1(
  cam: Camera,
  x: number,
  y: number,
): [number, number] {
  const dx = x - cam.n;
  const dy = y - cam.m;
  const cos = Math.cos(cam.theta);
  const sin = Math.sin(cam.theta);
  const u = (dx * cos + dy * sin) * cam.zoom;
  const v = (-dx * sin + dy * cos) * cam.zoom;
  return [u + FILM_WIDTH / 2, v + FILM_HEIGHT / 2];
}

/**
 * 摄像机2：斜二侧投影，z 只影响屏幕竖直方向，使墙面垂直于大地。
 * 先绕摄像机旋转 -θ 得到 (u_rot, v_ground)，
 * 再应用斜二侧法则：u = u_rot + v_ground/2, v = -z + v_ground/2。
 */
export function projectOblique(
  cam: Camera,
  x: number,
  y: number,
  z: number,
): [number, number] {
  const dx = x - cam.n;
  const dy = y - cam.m;
  const cos = Math.cos(cam.theta);
  const sin = Math.sin(cam.theta);
  const uRot = dx * cos + dy * sin;
  const vGround = -dx * sin + dy * cos;
  const u = (uRot + vGround / 2) * cam.zoom;
  const v = (-z + vGround / 2) * cam.zoom;
  return [u + FILM_WIDTH / 2, v + FILM_HEIGHT / 2];
}

/**
 * 屏幕底边中心在 z=0 处的世界坐标。
 * 垂直墙面的 BSP 遍历以此点为“眼睛”参考，而不是直接用摄像机 (n,m)，
 * 这样在摄像机上下移动时能得到更稳定的遮挡顺序。
 */
function getObliqueViewReference(cam: Camera): [number, number, number] {
  const cos = Math.cos(cam.theta);
  const sin = Math.sin(cam.theta);
  const vGround = FILM_HEIGHT / cam.zoom;
  const uRot = -vGround / 2;
  const dx = uRot * cos - vGround * sin;
  const dy = uRot * sin + vGround * cos;
  return [cam.n + dx, cam.m + dy, 0];
}

type ProjectFn = (x: number, y: number, z: number) => [number, number];

interface RenderPatch {
  plane: SpritePlane;
  corners: [number, number, number][];
  texture: HTMLCanvasElement;
  sourceX: number;
  sourceY: number;
  sourceW: number;
  sourceH: number;
}

/**
 * 将一个精灵拆分为 cols × rows 个子贴片。
 * 子贴片共享原贴图，但使用不同的 source 矩形，避免创建额外 canvas。
 */
function subdivideSprite(sprite: Sprite, cols: number, rows: number): RenderPatch[] {
  const corners = getSpriteCorners(sprite);
  const [c0, c1, , c3] = corners;
  const patches: RenderPatch[] = [];
  const texW = sprite.texture.width;
  const texH = sprite.texture.height;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u0 = i / cols;
      const u1 = (i + 1) / cols;
      const v0 = j / rows;
      const v1 = (j + 1) / rows;

      const p00 = lerpCorner(c0, c1, c3, u0, v0);
      const p10 = lerpCorner(c0, c1, c3, u1, v0);
      const p11 = lerpCorner(c0, c1, c3, u1, v1);
      const p01 = lerpCorner(c0, c1, c3, u0, v1);

      patches.push({
        plane: sprite.plane,
        corners: [p00, p10, p11, p01],
        texture: sprite.texture,
        sourceX: (i * texW) / cols,
        sourceY: (j * texH) / rows,
        sourceW: texW / cols,
        sourceH: texH / rows,
      });
    }
  }
  return patches;
}

function lerpCorner(
  c0: [number, number, number],
  c1: [number, number, number],
  c3: [number, number, number],
  u: number,
  v: number,
): [number, number, number] {
  return [
    c0[0] + u * (c1[0] - c0[0]) + v * (c3[0] - c0[0]),
    c0[1] + u * (c1[1] - c0[1]) + v * (c3[1] - c0[1]),
    c0[2] + u * (c1[2] - c0[2]) + v * (c3[2] - c0[2]),
  ];
}

/**
 * 计算 xy 贴片的平均 z 高度。
 */
function patchZ(patch: RenderPatch): number {
  let sum = 0;
  for (const [, , z] of patch.corners) {
    sum += z;
  }
  return sum / patch.corners.length;
}

/**
 * 在指定胶片上下文上绘制一个子贴片。
 * 通过 Canvas 仿射变换把 texture 的 source 矩形映射到投影后的平行四边形。
 */
function renderPatch(
  ctx: CanvasRenderingContext2D,
  patch: RenderPatch,
  project: ProjectFn,
): void {
  const [c0, c1, , c3] = patch.corners;
  const p0 = project(c0[0], c0[1], c0[2]);
  const p1 = project(c1[0], c1[1], c1[2]);
  const p2 = project(c3[0], c3[1], c3[2]);

  const { sourceX, sourceY, sourceW, sourceH } = patch;

  // 仿射变换：texture source (0,0)->p0, (sw,0)->p1, (0,sh)->p2
  const a = (p1[0] - p0[0]) / sourceW;
  const b = (p1[1] - p0[1]) / sourceW;
  const c = (p2[0] - p0[0]) / sourceH;
  const d = (p2[1] - p0[1]) / sourceH;
  const e = p0[0];
  const f = p0[1];

  ctx.save();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(patch.texture, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
  ctx.restore();
}

// ============================================================
//  墙面 BSP：把每个墙面视为一个分割平面，递归切分其它墙面，
//  按“远侧 → 近侧”顺序绘制，得到严格正确的遮挡关系。
// ============================================================

type Axis = 0 | 1 | 2;

interface BSPVertex {
  pos: [number, number, number];
  uv: [number, number];
}

interface BSPPoly {
  plane: SpritePlane;
  verts: BSPVertex[];
  texture: HTMLCanvasElement;
}

interface BSPNode {
  axis: Axis;
  pos: number;
  polys: BSPPoly[];
  front: BSPNode | null;
  back: BSPNode | null;
}

const EPS = 1e-4;

function getPlaneAxis(plane: SpritePlane): Axis {
  if (plane === 'xz') return 1; // y = const
  if (plane === 'yz') return 0; // x = const
  return 2; // xy: z = const
}

function getPlanePos(poly: BSPPoly): number {
  return poly.verts[0].pos[getPlaneAxis(poly.plane)];
}

function spriteToBSPPoly(sprite: Sprite): BSPPoly {
  const corners = getSpriteCorners(sprite);
  const uvs: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  return {
    plane: sprite.plane,
    verts: corners.map((pos, i) => ({ pos, uv: uvs[i] })),
    texture: sprite.texture,
  };
}

function polyAvgScreenY(poly: BSPPoly, project: ProjectFn): number {
  let sum = 0;
  for (const v of poly.verts) {
    const p = project(v.pos[0], v.pos[1], v.pos[2]);
    sum += p[1];
  }
  return sum / poly.verts.length;
}

function vertexDist(v: BSPVertex, axis: Axis, pos: number): number {
  return v.pos[axis] - pos;
}

function classifyPoly(poly: BSPPoly, axis: Axis, pos: number): 'front' | 'back' | 'coplanar' | 'spanning' {
  let hasFront = false;
  let hasBack = false;
  for (const v of poly.verts) {
    const d = vertexDist(v, axis, pos);
    if (d > EPS) hasFront = true;
    else if (d < -EPS) hasBack = true;
  }
  if (hasFront && hasBack) return 'spanning';
  if (hasFront) return 'front';
  if (hasBack) return 'back';
  return 'coplanar';
}

function lerpVertex(a: BSPVertex, b: BSPVertex, t: number): BSPVertex {
  return {
    pos: [
      a.pos[0] + t * (b.pos[0] - a.pos[0]),
      a.pos[1] + t * (b.pos[1] - a.pos[1]),
      a.pos[2] + t * (b.pos[2] - a.pos[2]),
    ],
    uv: [
      a.uv[0] + t * (b.uv[0] - a.uv[0]),
      a.uv[1] + t * (b.uv[1] - a.uv[1]),
    ],
  };
}

function clipPoly(poly: BSPPoly, axis: Axis, pos: number, keepFront: boolean): BSPPoly | null {
  const out: BSPVertex[] = [];
  const n = poly.verts.length;
  for (let i = 0; i < n; i++) {
    const cur = poly.verts[i];
    const next = poly.verts[(i + 1) % n];
    const dCur = vertexDist(cur, axis, pos);
    const dNext = vertexDist(next, axis, pos);
    const curIn = keepFront ? dCur >= -EPS : dCur <= EPS;
    const nextIn = keepFront ? dNext >= -EPS : dNext <= EPS;

    if (curIn && nextIn) {
      out.push(next);
    } else if (curIn && !nextIn) {
      const t = dCur / (dCur - dNext);
      out.push(lerpVertex(cur, next, t));
    } else if (!curIn && nextIn) {
      const t = dCur / (dCur - dNext);
      out.push(lerpVertex(cur, next, t));
      out.push(next);
    }
  }

  if (out.length < 3) return null;
  return { ...poly, verts: out };
}

function polyArea(poly: BSPPoly): number {
  // 轴对齐墙面：取平面内两个轴向的跨度相乘
  const xs = poly.verts.map((v) => v.pos[0]);
  const ys = poly.verts.map((v) => v.pos[1]);
  const zs = poly.verts.map((v) => v.pos[2]);
  const dx = Math.max(...xs) - Math.min(...xs);
  const dy = Math.max(...ys) - Math.min(...ys);
  const dz = Math.max(...zs) - Math.min(...zs);
  if (poly.plane === 'xy') return dx * dy;
  if (poly.plane === 'xz') return dx * dz;
  return dy * dz;
}

function chooseSplitter(polys: BSPPoly[], project: ProjectFn): number {
  let bestIdx = 0;
  let bestSplits = Infinity;
  let bestDepth = Infinity;
  let bestBalance = Infinity;

  for (let i = 0; i < polys.length; i++) {
    const s = polys[i];
    const axis = getPlaneAxis(s.plane);
    const pos = getPlanePos(s);
    let splits = 0;
    let front = 0;
    let back = 0;

    for (let j = 0; j < polys.length; j++) {
      if (i === j) continue;
      const side = classifyPoly(polys[j], axis, pos);
      if (side === 'spanning') splits++;
      else if (side === 'front') front++;
      else if (side === 'back') back++;
    }

    const depth = polyAvgScreenY(s, project); // 越小越远
    const balance = Math.abs(front - back);

    if (
      splits < bestSplits ||
      (splits === bestSplits && depth < bestDepth) ||
      (splits === bestSplits && depth === bestDepth && balance < bestBalance)
    ) {
      bestIdx = i;
      bestSplits = splits;
      bestDepth = depth;
      bestBalance = balance;
    }
  }

  return bestIdx;
}

function buildBSP(polys: BSPPoly[], project: ProjectFn): BSPNode | null {
  if (polys.length === 0) return null;

  const idx = chooseSplitter(polys, project);
  const splitter = polys[idx];
  const axis = getPlaneAxis(splitter.plane);
  const pos = getPlanePos(splitter);

  const nodePolys: BSPPoly[] = [splitter];
  const frontList: BSPPoly[] = [];
  const backList: BSPPoly[] = [];

  for (let i = 0; i < polys.length; i++) {
    if (i === idx) continue;
    const p = polys[i];
    const side = classifyPoly(p, axis, pos);

    if (side === 'front') {
      frontList.push(p);
    } else if (side === 'back') {
      backList.push(p);
    } else if (side === 'coplanar') {
      nodePolys.push(p);
    } else {
      const pf = clipPoly(p, axis, pos, true);
      const pb = clipPoly(p, axis, pos, false);
      if (pf && polyArea(pf) > EPS) frontList.push(pf);
      if (pb && polyArea(pb) > EPS) backList.push(pb);
    }
  }

  return {
    axis,
    pos,
    polys: nodePolys,
    front: buildBSP(frontList, project),
    back: buildBSP(backList, project),
  };
}

function drawBSPPoly(ctx: CanvasRenderingContext2D, poly: BSPPoly, project: ProjectFn): void {
  const pts = poly.verts.map((v) => project(v.pos[0], v.pos[1], v.pos[2]));
  const n = pts.length;
  if (n < 3) return;

  const tex = poly.texture;
  const uv0 = poly.verts[0].uv;
  const uv1 = poly.verts[1].uv;
  const uv2 = poly.verts[2].uv;
  const uv3 = n >= 4 ? poly.verts[3].uv : uv2;

  const sourceX = uv0[0] * tex.width;
  const sourceY = uv0[1] * tex.height;
  const sourceW = (uv1[0] - uv0[0]) * tex.width;
  const sourceH = (uv3[1] - uv0[1]) * tex.height;

  if (Math.abs(sourceW) < 0.5 || Math.abs(sourceH) < 0.5) return;

  const p0 = pts[0];
  const p1 = pts[1];
  const p3 = n >= 4 ? pts[3] : pts[2];

  // 仿射变换：texture source 的 (0,0)->p0, (sw,0)->p1, (0,sh)->p3
  const a = (p1[0] - p0[0]) / sourceW;
  const b = (p1[1] - p0[1]) / sourceW;
  const c = (p3[0] - p0[0]) / sourceH;
  const d = (p3[1] - p0[1]) / sourceH;
  const e = p0[0];
  const f = p0[1];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(tex, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
  ctx.restore();
}

function renderBSP(
  node: BSPNode | null,
  cam: Camera,
  project: ProjectFn,
  ctx: CanvasRenderingContext2D,
): void {
  if (!node) return;

  // 用屏幕底边中心对应的地面点作为“眼睛”参考，判断 splitter 的前后关系
  const ref = getObliqueViewReference(cam);
  const camCoord = node.axis === 0 ? ref[0] : node.axis === 1 ? ref[1] : ref[2];
  const dCam = camCoord - node.pos;

  if (dCam > 0) {
    // 摄像机在正侧：先画背侧（远），再画当前墙面，最后画正侧（近）
    renderBSP(node.back, cam, project, ctx);
    for (const poly of node.polys) drawBSPPoly(ctx, poly, project);
    renderBSP(node.front, cam, project, ctx);
  } else {
    // 摄像机在背侧：先画正侧（远），再画当前墙面，最后画背侧（近）
    renderBSP(node.front, cam, project, ctx);
    for (const poly of node.polys) drawBSPPoly(ctx, poly, project);
    renderBSP(node.back, cam, project, ctx);
  }
}

/**
 * 绘制所有精灵。
 * - xy 平面精灵拆为 2×2，按 z 从低到高绘制。
 * - 垂直墙面（xz/yz）进入 BSP 树：以墙面所在平面递归切分其它墙面，
 *   然后按“远侧 → 近侧”遍历，得到严格正确的遮挡顺序。
 */
export function renderSprites(
  ctx: CanvasRenderingContext2D,
  sprites: Sprite[],
  project: ProjectFn,
  cam: Camera,
): void {
  const xyPatches: RenderPatch[] = [];
  const wallPolys: BSPPoly[] = [];

  for (const s of sprites) {
    if (s.plane === 'xy') {
      xyPatches.push(...subdivideSprite(s, 2, 2));
    } else {
      wallPolys.push(spriteToBSPPoly(s));
    }
  }

  const sortedXY = [...xyPatches].sort((a, b) => patchZ(a) - patchZ(b));
  for (const patch of sortedXY) {
    renderPatch(ctx, patch, project);
  }

  const bsp = buildBSP(wallPolys, project);
  renderBSP(bsp, cam, project, ctx);
}
