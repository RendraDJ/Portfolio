import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * The hideout around the pole: a dark tech den seen from above — speckled
 * concrete floor, walls of server racks covered in blinking LEDs, cables
 * everywhere on the floor, desks with screens full of code, white PC towers
 * covered in stickers, a red tool chest, energy-drink cans and a desk lamp.
 *
 * All generated in code. The room stays still; only the pole turns.
 * `tick` blinks the LEDs.
 */

const FLOOR_Y = -3.56;

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** A tiny seeded random, so the room is the same on every visit. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mat(color: string, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...opts });
}

function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

// ---- Textures ------------------------------------------------------------------------------

/** Concrete: grey with dark and light speckles and a few stains. */
function concreteTexture() {
  const rnd = random(7);
  const tex = canvasTexture(1024, 1024, (ctx, W, H) => {
    ctx.fillStyle = '#45474a';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      const g = ctx.createRadialGradient(rnd() * W, rnd() * H, 0, rnd() * W, rnd() * H, 80 + rnd() * 220);
      g.addColorStop(0, 'rgba(30,30,32,0.35)');
      g.addColorStop(1, 'rgba(30,30,32,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 26000; i++) {
      const v = rnd();
      ctx.fillStyle = v < 0.5 ? `rgba(20,20,22,${0.2 + rnd() * 0.5})` : `rgba(200,200,205,${0.1 + rnd() * 0.35})`;
      ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    // a few red/orange bits of litter
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rnd() < 0.5 ? '#c3341f' : '#e36a1a';
      ctx.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 8, 2 + rnd() * 4);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/** A screen full of code: blue background, lines of text-like dashes. */
function codeTexture(seed: number, bg = '#1f3fae', ink = ['#e8f0ff', '#ffe36e', '#9fd0ff']) {
  const rnd = random(seed);
  return canvasTexture(512, 320, (ctx, W, H) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    let y = 14;
    while (y < H - 10) {
      let x = 12 + Math.floor(rnd() * 4) * 18;
      const words = 2 + Math.floor(rnd() * 7);
      for (let i = 0; i < words && x < W - 20; i++) {
        const w = 10 + rnd() * 50;
        ctx.fillStyle = ink[Math.floor(rnd() * ink.length)];
        ctx.globalAlpha = 0.65 + rnd() * 0.35;
        ctx.fillRect(x, y, w, 5);
        x += w + 7;
      }
      ctx.globalAlpha = 1;
      y += 11 + (rnd() < 0.15 ? 9 : 0);
    }
  });
}

/** Stickers stuck all over a PC tower. */
function stickerSideTexture(seed: number) {
  const rnd = random(seed);
  return canvasTexture(256, 384, (ctx, W, H) => {
    ctx.fillStyle = '#e9e8e3';
    ctx.fillRect(0, 0, W, H);
    const colours = ['#d4141c', '#ff6a00', '#111111', '#ffd60a', '#2b7bd6', '#2bff6a', '#ffffff'];
    for (let i = 0; i < 26; i++) {
      ctx.save();
      ctx.translate(rnd() * W, rnd() * H);
      ctx.rotate((rnd() - 0.5) * 0.8);
      ctx.fillStyle = colours[Math.floor(rnd() * colours.length)];
      const s = 14 + rnd() * 40;
      if (rnd() < 0.4) {
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-s / 2, -s / 3, s, (s * 2) / 3);
      ctx.restore();
    }
  });
}

/** A normal map from a height canvas (bright = high), for surface relief under the lights. */
function normalMapFrom(height: HTMLCanvasElement, strength = 2) {
  const W = height.width;
  const H = height.height;
  const src = height.getContext('2d')!.getImageData(0, 0, W, H).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const h = (x: number, y: number) => src[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * W + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Concrete relief and wear: pits and bumps (normal map) and patchy shine (roughness). */
function concreteDetail() {
  const rnd = random(19);
  const height = document.createElement('canvas');
  height.width = height.height = 512;
  const ctx = height.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.floor(rnd() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    const r = 0.5 + rnd() * 2.2;
    ctx.beginPath();
    ctx.arc(rnd() * 512, rnd() * 512, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // a couple of hairline cracks
  ctx.strokeStyle = 'rgba(20,20,20,0.8)';
  for (let c = 0; c < 4; c++) {
    ctx.lineWidth = 1 + rnd();
    ctx.beginPath();
    let x = rnd() * 512;
    let y = rnd() * 512;
    ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) ctx.lineTo((x += (rnd() - 0.5) * 50), (y += (rnd() - 0.3) * 40));
    ctx.stroke();
  }
  const normalMap = normalMapFrom(height, 3);
  const roughnessMap = canvasTexture(256, 256, (r, W, H) => {
    r.fillStyle = '#e6e6e6';
    r.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) {
      const g = r.createRadialGradient(rnd() * W, rnd() * H, 0, rnd() * W, rnd() * H, 20 + rnd() * 60);
      g.addColorStop(0, 'rgba(120,120,120,0.6)'); // worn, shinier patches
      g.addColorStop(1, 'rgba(120,120,120,0)');
      r.fillStyle = g;
      r.fillRect(0, 0, W, H);
    }
  });
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  return { normalMap, roughnessMap };
}

/** Perforated steel (rack doors): holes cut out by alpha. */
function perforationTexture() {
  const tex = canvasTexture(64, 64, (ctx, W, H) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000000';
    for (const [x, y] of [[16, 16], [48, 16], [0, 48], [32, 48], [64, 48]]) {
      ctx.beginPath();
      ctx.arc(x, y, 13.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** An energy-drink label. */
function canTexture() {
  return canvasTexture(256, 128, (ctx, W, H) => {
    ctx.fillStyle = '#b81d17';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, H * 0.32, W, H * 0.36);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '800 34px Montserrat, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('VOLT ⚡ VOLT', 10, H / 2 + 2);
  });
}

const steel = mat('#6f737a', { metalness: 0.85, roughness: 0.35 });

/** Four steel legs, a cross bar and a drawer unit under a desk top. */
function addDeskFrame(desk: THREE.Group, w: number, d: number, h: number) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) desk.add(box(0.05, h, 0.05, steel, sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08)));
  }
  desk.add(box(w - 0.16, 0.04, 0.04, steel, 0, 0.18, -(d / 2 - 0.08)));
  const drawers = mat('#2b2d33', { metalness: 0.5, roughness: 0.45 });
  desk.add(box(0.5, h - 0.12, d - 0.2, drawers, w / 2 - 0.4, (h - 0.12) / 2 + 0.06, 0));
  for (let k = 0; k < 3; k++) desk.add(box(0.2, 0.025, 0.02, steel, w / 2 - 0.4, 0.3 + k * 0.28, d / 2 - 0.09));
}

/** An office chair: five-star base on casters, gas lift, seat, backrest, armrests. */
function officeChair(material: THREE.Material) {
  const chair = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const leg = box(0.34, 0.04, 0.05, material, Math.cos(a) * 0.17, 0.08, Math.sin(a) * 0.17);
    leg.rotation.y = -a;
    chair.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), material);
    wheel.position.set(Math.cos(a) * 0.33, 0.035, Math.sin(a) * 0.33);
    chair.add(wheel);
  }
  chair.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.4, 12), steel).translateY(0.3));
  chair.add(new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.09, 0.54, 3, 0.04), material).translateY(0.55));
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.66, 0.08, 3, 0.04), material);
  back.position.set(0, 0.96, -0.26);
  back.rotation.x = -0.12;
  chair.add(back);
  for (const sx of [-1, 1]) chair.add(box(0.05, 0.03, 0.32, material, sx * 0.29, 0.75, -0.02), box(0.03, 0.18, 0.03, steel, sx * 0.29, 0.66, -0.08));
  return chair;
}

// ---- The room ---------------------------------------------------------------------------------

export function buildRoom() {
  const group = new THREE.Group();
  const rnd = random(42);

  // floor
  const detail = concreteDetail();
  detail.normalMap.repeat.set(9, 9);
  detail.roughnessMap.repeat.set(5, 5);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    mat('#ffffff', { map: concreteTexture(), roughness: 0.95, normalMap: detail.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: detail.roughnessMap }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  group.add(floor);

  // walls (barely there — the racks make the room)
  const wallMat = mat('#0b0c0e', { roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), wallMat);
  back.position.set(0, FLOOR_Y + 6, -9);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), wallMat);
  left.position.set(-10, FLOOR_Y + 6, 0);
  left.rotation.y = Math.PI / 2;
  const right = left.clone();
  right.position.x = 10;
  right.rotation.y = -Math.PI / 2;
  group.add(back, left, right);

  // ---- server racks along the walls, their fronts covered in LEDs ----
  const rackMat = mat('#17181c', { metalness: 0.75, roughness: 0.42 });
  const perforation = perforationTexture();
  const doorMat = mat('#0d0e11', { metalness: 0.85, roughness: 0.38, alphaMap: perforation, alphaTest: 0.5, side: THREE.DoubleSide });
  const handleMat = mat('#8b8f96', { metalness: 0.9, roughness: 0.25 });
  const unitMat = mat('#24262c', { metalness: 0.4, roughness: 0.5 });
  const racks: { x: number; z: number; ry: number; h: number }[] = [];
  for (let i = 0; i < 9; i++) racks.push({ x: -8 + i * 2, z: -8.4, ry: 0, h: 3.6 + rnd() * 1.6 });
  for (let i = 0; i < 6; i++) racks.push({ x: -9.4, z: -6.3 + i * 2, ry: Math.PI / 2, h: 3.4 + rnd() * 1.6 });
  for (let i = 0; i < 6; i++) racks.push({ x: 9.4, z: -6.3 + i * 2, ry: -Math.PI / 2, h: 3.4 + rnd() * 1.6 });

  const ledPositions: THREE.Matrix4[] = [];
  const ledColours: THREE.Color[] = [];
  const palette = ['#ff2a1a', '#ff6a00', '#ff6a00', '#ff2a1a', '#2bff6a', '#ffd60a'];
  const units: THREE.Matrix4[] = [];
  for (const r of racks) {
    const rack = new THREE.Group();
    rack.position.set(r.x, FLOOR_Y, r.z);
    rack.rotation.y = r.ry;
    rack.add(box(1.8, r.h, 1.1, rackMat, 0, r.h / 2 + 0.06, 0));
    // little feet; a perforated front door on some racks (LEDs glow through its
    // holes), the others stand open with their servers and LEDs in plain view
    for (const fx of [-0.8, 0.8]) for (const fz of [-0.45, 0.45]) rack.add(box(0.1, 0.06, 0.1, handleMat, fx, 0.03, fz));
    const hasDoor = rnd() < 0.35;
    const doorTex = perforation.clone();
    doorTex.repeat.set(1.7 / 0.05, (r.h - 0.12) / 0.05);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, r.h - 0.12), doorMat.clone());
    (door.material as THREE.MeshStandardMaterial).alphaMap = doorTex;
    door.position.set(0, r.h / 2 + 0.06, 0.62);
    if (hasDoor) rack.add(door, box(0.03, 0.4, 0.04, handleMat, 0.78, r.h / 2 + 0.06, 0.65));
    rack.updateMatrixWorld();
    // the units (slots) and their LEDs, gathered for instancing
    for (let y = 0.3; y < r.h - 0.2; y += 0.28) {
      if (rnd() < 0.15) continue;
      const u = new THREE.Matrix4().compose(new THREE.Vector3(0, y + 0.06, 0.56), new THREE.Quaternion(), new THREE.Vector3(1.6, 0.22, 0.02));
      units.push(new THREE.Matrix4().multiplyMatrices(rack.matrixWorld, u));
      const n = 2 + Math.floor(rnd() * 8);
      for (let k = 0; k < n; k++) {
        const led = new THREE.Matrix4().compose(new THREE.Vector3(-0.7 + rnd() * 1.4, y + 0.06 + (rnd() - 0.5) * 0.1, 0.58), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        ledPositions.push(new THREE.Matrix4().multiplyMatrices(rack.matrixWorld, led));
        ledColours.push(new THREE.Color(palette[Math.floor(rnd() * palette.length)]));
      }
    }
    group.add(rack);
  }
  const unitMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), unitMat, units.length);
  units.forEach((m, i) => unitMesh.setMatrixAt(i, m));
  group.add(unitMesh);

  const ledMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), new THREE.MeshBasicMaterial({ toneMapped: false }), ledPositions.length);
  ledPositions.forEach((m, i) => {
    ledMesh.setMatrixAt(i, m);
    ledMesh.setColorAt(i, ledColours[i].clone().multiplyScalar(2.2));
  });
  group.add(ledMesh);

  // ---- cables all over the floor ----
  // mostly dark, olive and black; the odd orange-red one
  const cableMats = [mat('#1c1d1a', { roughness: 0.6 }), mat('#2b2a1f', { roughness: 0.6 }), mat('#3a3626', { roughness: 0.6 }), mat('#111', { roughness: 0.5 }), mat('#1c1d1a', { roughness: 0.6 }), mat('#7a2614', { roughness: 0.5 })];
  for (let i = 0; i < 70; i++) {
    const a = new THREE.Vector3((rnd() - 0.5) * 18, FLOOR_Y + 0.03, (rnd() - 0.5) * 16);
    const pts = [a];
    for (let k = 0; k < 4; k++) {
      const prev = pts[pts.length - 1];
      pts.push(new THREE.Vector3(prev.x + (rnd() - 0.5) * 4, FLOOR_Y + 0.03 + (k === 3 && rnd() < 0.3 ? 1.2 : 0), prev.z + (rnd() - 0.5) * 4));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.008 + rnd() * 0.009, 5), cableMats[Math.floor(rnd() * cableMats.length)]);
    tube.userData.noShadow = true;
    group.add(tube);
  }
  // cables sagging down from the tops of the racks to the floor
  for (let i = 0; i < 9; i++) {
    const r = racks[Math.floor(rnd() * racks.length)];
    const out = new THREE.Vector3(Math.sin(r.ry), 0, Math.cos(r.ry)); // the rack's front
    const top = new THREE.Vector3(r.x + (rnd() - 0.5) * 1.4, FLOOR_Y + r.h + 0.06, r.z).addScaledVector(out, 0.5);
    const floorEnd = top.clone().addScaledVector(out, 2 + rnd() * 2.5);
    floorEnd.x += (rnd() - 0.5) * 2;
    floorEnd.y = FLOOR_Y + 0.03;
    const mid = top.clone().lerp(floorEnd, 0.35);
    mid.y = FLOOR_Y + r.h * 0.3;
    mid.addScaledVector(out, 0.6);
    const curve = new THREE.CatmullRomCurve3([top, top.clone().addScaledVector(out, 0.25).setY(top.y + 0.05), mid, floorEnd, floorEnd.clone().add(new THREE.Vector3((rnd() - 0.5) * 2, 0, (rnd() - 0.5) * 2))]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.012 + rnd() * 0.01, 6), cableMats[Math.floor(rnd() * cableMats.length)]);
    group.add(cable);
  }

  // ---- desk with two curved screens of code (back left) ----
  const deskTop = mat('#d9d7d0', { roughness: 0.8 });
  const dark = mat('#141519', { roughness: 0.6, metalness: 0.3 });
  const screens: THREE.MeshStandardMaterial[] = [];
  const desk = new THREE.Group();
  desk.position.set(-5.4, FLOOR_Y, -5.2);
  desk.rotation.y = 0.35;
  desk.add(box(3, 0.06, 1.2, deskTop, 0, 1.0, 0));
  addDeskFrame(desk, 3, 1.2, 0.97);
  for (const [i, x] of [-0.72, 0.72].entries()) {
    const screenMat = new THREE.MeshStandardMaterial({ map: codeTexture(11 + i), emissiveMap: codeTexture(11 + i), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.2, roughness: 0.4 });
    screens.push(screenMat);
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.82, 32, 1, true, Math.PI - 0.24, 0.48), dark);
    bezel.material = dark;
    const screen = new THREE.Mesh(new THREE.CylinderGeometry(3.18, 3.18, 0.76, 32, 1, true, Math.PI - 0.235, 0.47), screenMat);
    screen.material.side = THREE.BackSide;
    for (const m of [bezel, screen]) {
      m.position.set(x * 0.98, 1.55, 2.8);
      m.rotation.y = -x * 0.32;
    }
    desk.add(bezel, screen);
    // the screen's stand
    const sx = x * 0.98 - Math.sin(-x * 0.32) * 3.2;
    const sz = 2.8 - Math.cos(-x * 0.32) * 3.2 + 0.08;
    desk.add(box(0.06, 0.5, 0.05, dark, sx, 1.27, sz), box(0.36, 0.02, 0.22, dark, sx, 1.04, sz + 0.05));
  }
  desk.add(box(0.9, 0.04, 0.3, mat('#222'), 0, 1.06, 0.15));
  // energy-drink cans
  const canMat = mat('#ffffff', { map: canTexture(), metalness: 0.6, roughness: 0.3 });
  for (const [x, z] of [[-1.1, 0.3], [-0.95, 0.4], [1.2, 0.25]]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16), canMat);
    can.position.set(x, 1.15, z);
    desk.add(can);
  }
  // an empty office chair, pushed back
  const chair = officeChair(dark);
  chair.position.set(0.2, 0, 1.25);
  chair.rotation.y = Math.PI + 0.3;
  desk.add(chair);
  group.add(desk);
  const glowA = new THREE.PointLight('#4f7dff', 18, 9, 1.8);
  glowA.position.set(-5, FLOOR_Y + 2.2, -3.4);
  group.add(glowA);

  // ---- second desk: an old CRT and an orange screen (back right) ----
  const desk2 = new THREE.Group();
  desk2.position.set(5.4, FLOOR_Y, -5.6);
  desk2.rotation.y = -0.4;
  desk2.add(box(2.6, 0.06, 1.1, deskTop, 0, 0.95, 0));
  addDeskFrame(desk2, 2.6, 1.1, 0.92);
  const crt = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.8, 0.8, 3, 0.06), mat('#cfccc2'));
  crt.position.set(-0.5, 1.4, -0.05);
  const crtScreenMat = new THREE.MeshStandardMaterial({ map: codeTexture(21, '#1a2f8a', ['#dfe8ff']), emissive: new THREE.Color('#ffffff'), emissiveMap: codeTexture(21, '#1a2f8a', ['#dfe8ff']), emissiveIntensity: 1.1 });
  screens.push(crtScreenMat);
  const crtScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.56), crtScreenMat);
  crtScreen.position.set(-0.5, 1.42, 0.36);
  const orangeMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: new THREE.Color('#ff5a1f'), emissiveIntensity: 1.6 });
  const orange = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), orangeMat);
  orange.position.set(0.75, 1.55, 0.05);
  desk2.add(crt, crtScreen, box(1.2, 0.8, 0.06, dark, 0.75, 1.55, 0.01), orange);
  group.add(desk2);
  const glowB = new THREE.PointLight('#ff6a2a', 14, 8, 1.8);
  glowB.position.set(5.2, FLOOR_Y + 2.3, -4.2);
  group.add(glowB);

  // ---- white PC towers covered in stickers ----
  for (const [i, [x, z, ry]] of [[-7.4, 2.4, 0.4], [7.6, 0.4, -0.5], [6.4, -2.6, 0.2]].entries()) {
    const side = new THREE.MeshStandardMaterial({ map: stickerSideTexture(30 + i), roughness: 0.6 });
    const plain = mat('#e9e8e3', { roughness: 0.6 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 1.3), [side, side, plain, plain, plain, side]);
    tower.position.set(x, FLOOR_Y + 0.7, z);
    tower.rotation.y = ry;
    group.add(tower);
  }

  // ---- red tool chest (front left) ----
  const red = mat('#b3261e', { metalness: 0.4, roughness: 0.4 });
  const chest = new THREE.Group();
  chest.position.set(-7.4, FLOOR_Y, -1.4);
  chest.rotation.y = 0.5;
  chest.add(box(1.6, 1.5, 0.9, red, 0, 0.75, 0));
  for (let k = 0; k < 4; k++) chest.add(box(1.5, 0.03, 0.02, mat('#7a1712'), 0, 0.35 + k * 0.3, 0.46));
  group.add(chest);

  // ---- a yellow desk lamp glowing on a crate (front right) ----
  const crate = box(0.9, 0.9, 0.9, mat('#e9e8e3'), 7.2, FLOOR_Y + 0.45, 3.6);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: new THREE.Color('#ffc21a'), emissiveIntensity: 2.5 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampMat);
  lamp.position.set(7.2, FLOOR_Y + 1.05, 3.6);
  const lampLight = new THREE.PointLight('#ffc21a', 10, 6, 1.8);
  lampLight.position.set(7.2, FLOOR_Y + 1.5, 3.6);
  group.add(crate, lamp, lampLight);

  // ---- LEDs blinking now and then ----
  const ledCount = ledPositions.length;
  const lit = new Array<boolean>(ledCount).fill(true);
  const off = new THREE.Color('#1a0a06');
  let next = 0;
  function tick(time: number) {
    if (time < next) return;
    next = time + 0.12;
    for (let k = 0; k < 18; k++) {
      const i = Math.floor(Math.random() * ledCount);
      lit[i] = !lit[i];
      ledMesh.setColorAt(i, lit[i] ? ledColours[i].clone().multiplyScalar(2.2) : off);
    }
    if (ledMesh.instanceColor) ledMesh.instanceColor.needsUpdate = true;
    screens.forEach((s, i) => (s.emissiveIntensity = 1.05 + Math.sin(time * 9 + i * 2) * 0.04)); // a faint flicker
  }

  return { group, tick };
}
