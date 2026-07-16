#!/usr/bin/env python3
"""生成默认材质包贴图。"""
import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'material')
os.makedirs(OUT_DIR, exist_ok=True)


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT_DIR, name)
    img.save(path)
    print(f'generated {path}')


def brick_texture(width: int, height: int, base_color: tuple, line_color: tuple) -> Image.Image:
    img = Image.new('RGB', (width, height), base_color)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, width - 1, height - 1], outline=line_color)
    rows = 4
    cols = 3
    bh = height // rows
    bw = width // cols
    for r in range(1, rows):
        y = r * bh
        offset = (bw // 2) if (r % 2 == 1) else 0
        draw.line([(0, y), (width, y)], fill=line_color, width=1)
        for c in range(cols):
            x = c * bw + offset
            if x < width:
                draw.line([(x, y), (x, y + bh)], fill=line_color, width=1)
    return img


def panel_texture(width: int, height: int, base_color: tuple) -> Image.Image:
    img = Image.new('RGB', (width, height), base_color)
    draw = ImageDraw.Draw(img)
    dark = tuple(max(0, c - 30) for c in base_color)
    light = tuple(min(255, c + 30) for c in base_color)
    draw.rectangle([4, 4, width - 5, height - 5], outline=dark)
    draw.rectangle([8, 8, width - 9, height - 9], outline=light)
    draw.rectangle([0, 0, width - 1, height - 1], outline=(0, 0, 0))
    return img


def grass_texture(width: int, height: int, base_color: tuple) -> Image.Image:
    img = Image.new('RGB', (width, height), base_color)
    draw = ImageDraw.Draw(img)
    import random
    random.seed(42)
    for _ in range(60):
        x = random.randint(0, width - 1)
        y = random.randint(0, height - 1)
        w = random.randint(1, 3)
        h = random.randint(3, 10)
        draw.rectangle([x, y, x + w, y + h], fill=(255, 255, 255))
    return img


if __name__ == '__main__':
    save(panel_texture(128, 128, (71, 85, 105)), 'platform.png')
    save(brick_texture(128, 128, (146, 64, 14), (60, 20, 0)), 'wall-brown.png')
    save(brick_texture(128, 128, (29, 78, 216), (0, 20, 80)), 'wall-blue.png')
    save(grass_texture(64, 64, (21, 128, 61)), 'grass.png')
