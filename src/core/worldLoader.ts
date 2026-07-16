/**
 * 大世界存档加载器。
 *
 * 存档文件格式：
 *   普通精灵：  (x1,y1,z1) (x2,y2,z2) image.png
 *   结构定义：  structure name:(
 *                 (x1,y1,z1) (x2,y2,z2) image-1.png
 *                 ...
 *               )
 *   结构调用：  stu name (x,y,z)
 *             （tru 也可作为关键字；偏移量可选，省略时视为 (0,0,0)）
 *
 * 坐标必须满足 xy / xz / yz 平面对齐（即有两个坐标分量相同）。
 * 贴图不拉伸：按最大边对齐，另一方向居中，剩余区域透明。
 */

import type { Sprite, SpritePlane } from '@/core/sprite';

/** world.txt 中 1 个单位对应的世界长度（像素） */
export const UNIT_SCALE = 128;

interface WorldEntry {
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  imageSrc: string;
}

function parseLine(line: string): WorldEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const m = trimmed.match(
    /\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s+(\S+)/,
  );
  if (!m) return null;

  return {
    x1: parseFloat(m[1]) * UNIT_SCALE,
    y1: parseFloat(m[2]) * UNIT_SCALE,
    z1: parseFloat(m[3]) * UNIT_SCALE,
    x2: parseFloat(m[4]) * UNIT_SCALE,
    y2: parseFloat(m[5]) * UNIT_SCALE,
    z2: parseFloat(m[6]) * UNIT_SCALE,
    imageSrc: m[7],
  };
}

interface ParsedWorld {
  entries: WorldEntry[];
  structures: Map<string, WorldEntry[]>;
}

export function parseWorldText(text: string): ParsedWorld {
  const structures = new Map<string, WorldEntry[]>();
  const entries: WorldEntry[] = [];

  const lines = text.split('\n');
  let currentStructure: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const structStart = trimmed.match(/^structure\s+(\w+):\s*\(\s*$/);
    if (structStart) {
      currentStructure = structStart[1];
      structures.set(currentStructure, []);
      continue;
    }

    if (currentStructure && trimmed === ')') {
      currentStructure = null;
      continue;
    }

    const stuCall = trimmed.match(
      /^(?:stu|tru)\s+(\w+)(?:\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\))?\s*$/,
    );
    if (stuCall) {
      const name = stuCall[1];
      const ox = stuCall[2] ? parseFloat(stuCall[2]) * UNIT_SCALE : 0;
      const oy = stuCall[3] ? parseFloat(stuCall[3]) * UNIT_SCALE : 0;
      const oz = stuCall[4] ? parseFloat(stuCall[4]) * UNIT_SCALE : 0;
      const structEntries = structures.get(name);
      if (structEntries) {
        for (const e of structEntries) {
          entries.push({
            ...e,
            x1: e.x1 + ox,
            y1: e.y1 + oy,
            z1: e.z1 + oz,
            x2: e.x2 + ox,
            y2: e.y2 + oy,
            z2: e.z2 + oz,
          });
        }
      } else {
        console.warn(`[WorldLoader] 未找到结构: ${name}`);
      }
      continue;
    }

    const entry = parseLine(trimmed);
    if (entry) {
      if (currentStructure) {
        structures.get(currentStructure)!.push(entry);
      } else {
        entries.push(entry);
      }
    }
  }

  return { entries, structures };
}

function detectPlane(e: WorldEntry): SpritePlane | null {
  if (e.z1 === e.z2 && (e.x1 !== e.x2 || e.y1 !== e.y2)) return 'xy';
  if (e.y1 === e.y2 && (e.x1 !== e.x2 || e.z1 !== e.z2)) return 'xz';
  if (e.x1 === e.x2 && (e.y1 !== e.y2 || e.z1 !== e.z2)) return 'yz';
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`无法加载图片: ${src}`));
    img.src = src;
  });
}

/**
 * 将一张图片绘制到与坐标矩形等大的画布上。
 * 按最大边对齐（不拉伸），另一方向居中，剩余区域透明。
 */
function createAlignedTexture(
  img: HTMLImageElement,
  worldW: number,
  worldH: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(worldW));
  canvas.height = Math.max(1, Math.round(worldH));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 2D 上下文');

  const imgAspect = img.width / img.height;
  const worldAspect = worldW / worldH;

  let drawW: number;
  let drawH: number;
  let offsetX = 0;
  let offsetY = 0;

  if (imgAspect > worldAspect) {
    // 图片更宽 → 宽度对齐
    drawW = worldW;
    drawH = worldW / imgAspect;
    offsetY = (worldH - drawH) / 2;
  } else {
    // 图片更高 → 高度对齐
    drawH = worldH;
    drawW = worldH * imgAspect;
    offsetX = (worldW - drawW) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  return canvas;
}

async function entryToSprite(
  entry: WorldEntry,
  basePath: string,
  materials?: Record<string, string>,
): Promise<Sprite | null> {
  const plane = detectPlane(entry);
  if (!plane) return null;

  // 只允许调用材质包内的纯文件名，禁止路径穿越
  const safeName = entry.imageSrc.replace(/[\\/]/g, '');
  if (!safeName || safeName.includes('..')) {
    throw new Error(`非法贴图路径: ${entry.imageSrc}`);
  }

  const materialUrl = materials?.[safeName];
  const img = await loadImage(materialUrl ?? `${basePath}${safeName}`);

  let worldW: number;
  let worldH: number;
  if (plane === 'xy') {
    worldW = Math.abs(entry.x2 - entry.x1);
    worldH = Math.abs(entry.y2 - entry.y1);
  } else if (plane === 'xz') {
    worldW = Math.abs(entry.x2 - entry.x1);
    worldH = Math.abs(entry.z2 - entry.z1);
  } else {
    worldW = Math.abs(entry.y2 - entry.y1);
    worldH = Math.abs(entry.z2 - entry.z1);
  }

  const texture = createAlignedTexture(img, worldW, worldH);

  return {
    id: `${entry.imageSrc}-${entry.x1},${entry.y1},${entry.z1}`,
    plane,
    x1: entry.x1,
    y1: entry.y1,
    z1: entry.z1,
    x2: entry.x2,
    y2: entry.y2,
    z2: entry.z2,
    texture,
  };
}

/**
 * 加载世界存档文件，返回精灵列表。
 * @param worldFilePath 存档文件路径（相对于 public 目录），如 '/world/world.txt'
 */
export async function buildSpritesFromWorldText(
  text: string,
  basePath: string,
  materials?: Record<string, string>,
): Promise<Sprite[]> {
  const { entries } = parseWorldText(text);
  const sprites: Sprite[] = [];
  for (const entry of entries) {
    try {
      const sprite = await entryToSprite(entry, basePath, materials);
      if (sprite) sprites.push(sprite);
    } catch (err) {
      console.warn(`[WorldLoader] 跳过 ${entry.imageSrc}:`, err);
    }
  }
  return sprites;
}

const MATERIAL_BASE_PATH = '/material/';

export async function loadWorldSprites(
  worldFilePath: string,
): Promise<Sprite[]> {
  let text: string;
  try {
    const resp = await fetch(worldFilePath);
    if (!resp.ok) return [];
    text = await resp.text();
  } catch {
    return [];
  }

  return buildSpritesFromWorldText(text, MATERIAL_BASE_PATH);
}
