import * as THREE from 'three';
import type { Experience } from '../signs/content';

/** Textures for the HQ: loaders for the CC0 sets in public/hq, and the canvases
 *  drawn for its screens and signs. */

export function makeTextures(manager: THREE.LoadingManager) {
  const loader = new THREE.TextureLoader(manager);
  const cache = new Map<string, THREE.Texture>();
  return (path: string, color = false) => {
    let tex = cache.get(path);
    if (!tex) {
      tex = loader.load(path);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      if (color) tex.colorSpace = THREE.SRGBColorSpace;
      cache.set(path, tex);
    }
    return tex;
  };
}

/** Stretch a geometry's UVs so its texture tiles every `tile` metres. */
export function tileUV(geo: THREE.BufferGeometry, w: number, h: number, tile: number, offset = 0) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile + offset, (uv.getY(i) * h) / tile);
  uv.needsUpdate = true;
  return geo;
}


export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export const WALLPAPERS = [
  ['#0b1730', '#1f4a8a', '#f08a3c'],
  ['#120d22', '#4a2a7a', '#e0567a'],
  ['#08201c', '#1d6157', '#c8e06a'],
  ['#1d1208', '#7a4a1a', '#f2c46a'],
  ['#0c0c14', '#2d3a5e', '#8ad8ff'],
];

/** An iMac desktop: soft wallpaper, a menu bar, and a window naming the project. */
export function desktopTexture(e: Experience, i: number) {
  const [a, b, c] = WALLPAPERS[i % WALLPAPERS.length];
  return canvasTexture(1024, 576, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 1024, 576);
    g.addColorStop(0, a);
    g.addColorStop(0.6, b);
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 576);
    for (let k = 0; k < 3; k++) {
      const r = ctx.createRadialGradient(200 + k * 330, 420 - k * 120, 10, 200 + k * 330, 420 - k * 120, 360);
      r.addColorStop(0, 'rgba(255,255,255,0.16)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, 1024, 576);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, 1024, 26);
    ctx.fillStyle = '#fff';
    ctx.font = '600 15px Helvetica Neue, Arial';
    ctx.fillText('Finder   File   Edit   View   Go   Window', 20, 18);
    // the window
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = 'rgba(22,22,26,0.94)';
    ctx.beginPath();
    ctx.roundRect(150, 110, 724, 360, 18);
    ctx.fill();
    ctx.restore();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, k) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(180 + k * 24, 138, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#ff8a2a';
    ctx.font = '700 17px Helvetica Neue, Arial';
    ctx.fillText(e.role.toUpperCase().slice(0, 52), 190, 214);
    ctx.fillStyle = '#fff';
    ctx.font = '800 44px Montserrat, Helvetica Neue, Arial';
    const words = e.title.split(' ');
    let line = '';
    let y = 268;
    for (const w of words) {
      if (ctx.measureText(line + w).width > 640 && line) {
        ctx.fillText(line.trim(), 190, y);
        line = '';
        y += 52;
      }
      line += w + ' ';
    }
    ctx.fillText(line.trim(), 190, y);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '500 19px Helvetica Neue, Arial';
    ctx.fillText(`${e.where.split(',')[0]} · ${e.when}`, 190, y + 46);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(e.report ? 'Demo · Report' : 'Demo', 190, 440);
  });
}

/** The TV in the Xandvar corner. */
export function xandvarTexture(image: HTMLImageElement | null) {
  return canvasTexture(1280, 720, (ctx) => {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, 1280, 720);
    if (image) {
      ctx.save();
      ctx.filter = 'grayscale(1) contrast(1.1)';
      ctx.drawImage(image, 640, 40, 640, 640);
      ctx.restore();
      const fade = ctx.createLinearGradient(640, 0, 900, 0);
      fade.addColorStop(0, '#050505');
      fade.addColorStop(1, 'rgba(5,5,5,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(640, 0, 260, 720);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '800 120px Montserrat, Helvetica Neue, Arial';
    ctx.fillText('XANDVAR', 80, 330);
    ctx.font = '500 30px Helvetica Neue, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Streetwear · since 2023', 84, 390);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(84, 470, 300, 70, 35);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '600 28px Helvetica Neue, Arial';
    ctx.fillText('Enter the studio  →', 116, 515);
  });
}

export function neonTexture() {
  return canvasTexture(1024, 256, (ctx) => {
    ctx.font = '800 150px Montserrat, Helvetica Neue, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffffff';
    for (const blur of [40, 18, 6]) {
      ctx.shadowBlur = blur;
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText('XANDVAR', 512, 132);
    }
  });
}
