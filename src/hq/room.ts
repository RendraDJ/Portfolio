import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { experiences, type Experience, type SignKind } from '../signs/content';
import { makeTextures, tileUV, canvasTexture, xandvarTexture } from './textures';
import hoodieDontFollow from '../assets/brand/hoodie-dontfollow.webp';
import hoodieModel from '../assets/brand/hoodie-model.webp';
import palletlensCassette from '../assets/tapes/palletlens-cassette.webp';
import escoCassette from '../assets/tapes/esco-cassette.webp';
import lirmmCassette from '../assets/tapes/lirmm-cassette.webp';
import { publicUrl } from '../url';

/**
 * The HQ: a cosy, modern geek room at night, seen from high in a corner
 * (after the reference shot) — warm LED coves along the ceiling, blinds
 * over a city window, a low bookcase, a long oak desk with two monitors,
 * a TV on the wall over a console, a lit mini fridge, a cream sofa, a rug.
 *   - the display shelves: one collectible per experience (a drone, a UR10
 *     desk arm, QT, a letter tray that sorts mail, a mannequin wearing the
 *     posture sensor);
 *   - the screens open the site's sections: About me and Projects on the
 *     desk, Xandvar on the TV.
 * Fabric, wood and plaster textures and the plants are CC0 (Poly Haven, in
 * public/hq). Metres; the floor is y = 0, the desk wall is at the back (−z).
 */

export interface Hotspot {
  id: string;
  /** An experience (opens its panel) or a screen (opens a section of the site). */
  kind: 'experience' | 'section';
  label: string;
  experience?: Experience;
  /** The page a screen opens. */
  section?: string;
  hits: THREE.Object3D[];
  /** Centre and outward normal (world), and size, to frame it. */
  center: THREE.Vector3;
  normal: THREE.Vector3;
  size: number;
  highlight: (on: boolean) => void;
}

export interface View {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface Zone {
  id: 'experiences' | 'desk' | 'xandvar';
  label: string;
  hint: string;
  hit: THREE.Mesh;
  anchor: THREE.Vector3;
  view: View;
  spots: Hotspot[];
}

export const ROOM = { x0: -2.3, x1: 2.3, z0: -2.6, z1: 2.6, h: 2.6 };
const H = ROOM.h;
const BACK = ROOM.z0;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- materials

const plasticWhite = () => new THREE.MeshPhysicalMaterial({ color: '#eeeeec', roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.4 });
const plasticGrey = () => new THREE.MeshStandardMaterial({ color: '#c9cacc', roughness: 0.45 });
const plasticBlack = () => new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.4 });
const aluminium = () => new THREE.MeshStandardMaterial({ color: '#c4c7cc', roughness: 0.3, metalness: 1 });
const glossBlack = () => new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });

// ---------------------------------------------------------------- canvases

function sectionTexture(title: string, sub: string, images: HTMLImageElement[], accent: string) {
  return canvasTexture(1280, 720, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 1280, 720);
    g.addColorStop(0, '#101014');
    g.addColorStop(1, '#1c1a22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
    const glow = ctx.createRadialGradient(1000, 200, 20, 1000, 200, 700);
    glow.addColorStop(0, accent + '55');
    glow.addColorStop(1, accent + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1280, 720);
    images.forEach((img, k) => {
      const w = 250;
      const hgt = (img.height / img.width) * w;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 30;
      ctx.drawImage(img, 640 + k * 190, 150 + k * 50, w, hgt);
      ctx.restore();
    });
    ctx.fillStyle = '#fff';
    ctx.font = '800 108px Montserrat, Helvetica Neue, Arial';
    ctx.fillText(title, 80, 400);
    ctx.font = '500 30px Helvetica Neue, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(sub, 84, 460);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(84, 540, 230, 64, 32);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '600 26px Helvetica Neue, Arial';
    ctx.fillText('Open  →', 140, 582);
  });
}

/** The rug: a pixel "LOADING" bar, cream on black. */
function rugTexture() {
  return canvasTexture(1024, 704, (ctx) => {
    ctx.fillStyle = '#121212';
    ctx.beginPath();
    ctx.roundRect(0, 0, 1024, 704, 120);
    ctx.fill();
    ctx.fillStyle = '#ece5d6';
    ctx.beginPath();
    ctx.roundRect(36, 36, 952, 632, 96);
    ctx.fill();
    ctx.fillStyle = '#151515';
    ctx.font = '700 86px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOADING…', 512, 300);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#151515';
    ctx.strokeRect(222, 380, 580, 90);
    for (let k = 0; k < 11; k++) ctx.fillRect(244 + k * 50, 400, 38, 50);
    ctx.font = '700 54px "Courier New", monospace';
    ctx.fillText('96%', 512, 560);
    for (let k = 0; k < 14000; k++) {
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.06})`;
      ctx.fillRect(rnd() * 1024, rnd() * 704, 2, 2);
    }
  });
}

/** The city behind the blinds: towers and lit windows. */
function cityTexture() {
  return canvasTexture(1024, 768, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 768);
    sky.addColorStop(0, '#0a0d18');
    sky.addColorStop(1, '#1a1a26');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 768);
    for (let k = 0; k < 22; k++) {
      const w = 60 + rnd() * 110;
      const x = rnd() * 1024 - 40;
      const top = 160 + rnd() * 380;
      ctx.fillStyle = `rgb(${12 + rnd() * 10},${12 + rnd() * 10},${18 + rnd() * 12})`;
      ctx.fillRect(x, top, w, 768 - top);
      for (let y = top + 10; y < 760; y += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) {
        if (rnd() < 0.32) {
          ctx.fillStyle = rnd() < 0.75 ? `rgba(255,${190 + rnd() * 50},${110 + rnd() * 60},${0.5 + rnd() * 0.5})` : 'rgba(170,200,255,0.7)';
          ctx.fillRect(wx, y, 6, 8);
        }
      }
    }
  });
}

/** A screen face for QT: two eyes, blinking. */
function faceTexture(open: boolean) {
  return canvasTexture(256, 192, (ctx) => {
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = '#8ad8ff';
    for (const x of [86, 170]) {
      ctx.beginPath();
      if (open) ctx.ellipse(x, 88, 20, 24, 0, 0, Math.PI * 2);
      else ctx.rect(x - 22, 86, 44, 6);
      ctx.fill();
    }
    ctx.strokeStyle = '#8ad8ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 126, 22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  });
}

function labelTexture(text: string) {
  return canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#f2efe8';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#222';
    ctx.font = '700 34px Helvetica Neue, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 44);
  });
}

// ---------------------------------------------------------------- helpers

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, r2 = r, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}
/** A rod from a to b. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 16), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
function ellipsoid(rx: number, ry: number, rz: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  m.scale.set(rx, ry, rz);
  m.position.set(x, y, z);
  return m;
}
function markShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.noShadow) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}
function loadImage(url: string) {
  return new Promise<HTMLImageElement>((done) => {
    const img = new Image();
    img.onload = () => done(img);
    img.src = url;
  });
}

// ---------------------------------------------------------------- collectibles
// Each about 20–30 cm, on a small acrylic plinth, animated while idle.

interface Collectible {
  group: THREE.Group;
  tick: (t: number) => void;
}

function plinth(group: THREE.Group, r = 0.085) {
  const acrylic = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 0.9, thickness: 0.02, transparent: true, opacity: 0.6 });
  const p = cyl(r, 0.012, acrylic, 0, 0.006, 0, r, 48);
  p.userData.noShadow = true;
  group.add(p);
}

/** Audensiel: a compact quadcopter with a gimbal camera, hovering over its stand. */
function drone(): Collectible {
  const group = new THREE.Group();
  plinth(group);
  group.add(rod(v3(0, 0.012, 0), v3(0, 0.07, 0), 0.003, new THREE.MeshPhysicalMaterial({ color: '#fff', transmission: 0.9, roughness: 0.05, transparent: true, opacity: 0.5 })));
  const craft = new THREE.Group();
  craft.position.y = 0.095;
  const shell = plasticGrey();
  const dark = plasticBlack();
  craft.add(rbox(0.11, 0.035, 0.07, 0.014, shell));
  craft.add(rbox(0.07, 0.018, 0.05, 0.008, dark, 0, 0.024, -0.005));
  const props: THREE.Mesh[] = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const tip = v3(sx * 0.085, 0.006, sz * 0.07);
    craft.add(rod(v3(sx * 0.03, 0, sz * 0.02), tip, 0.0055, shell));
    craft.add(cyl(0.011, 0.016, dark, tip.x, tip.y + 0.008, tip.z));
    const prop = rbox(0.1, 0.0015, 0.011, 0.0007, new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.4, transparent: true, opacity: 0.9 }), tip.x, tip.y + 0.018, tip.z);
    props.push(prop);
    craft.add(prop);
    craft.add(rod(v3(sx * 0.05, -0.012, sz * 0.03), v3(sx * 0.055, -0.035, sz * 0.035), 0.002, dark));
  }
  const gimbal = new THREE.Group();
  gimbal.position.set(0, -0.025, 0.035);
  gimbal.add(rbox(0.03, 0.022, 0.024, 0.006, dark));
  const lens = cyl(0.007, 0.006, glossBlack(), 0, 0, 0.014);
  lens.rotation.x = Math.PI / 2;
  gimbal.add(lens);
  craft.add(gimbal);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4a2a').multiplyScalar(3), toneMapped: false }));
  led.position.set(0, 0.0, -0.036);
  craft.add(led);
  group.add(craft);
  return {
    group,
    tick: (t) => {
      craft.position.y = 0.095 + Math.sin(t * 1.4) * 0.006;
      craft.rotation.z = Math.sin(t * 0.9) * 0.04;
      props.forEach((p, i) => (p.rotation.y = t * (i % 2 ? 9 : -9)));
      (led.material as THREE.MeshBasicMaterial).color.setScalar(Math.sin(t * 5) > 0 ? 3 : 0.3).multiply(new THREE.Color('#ff4a2a'));
    },
  };
}

/** Convergence: a UR10 in miniature — aluminium links, blue joint caps — moving slowly. */
function urArm(): Collectible {
  const group = new THREE.Group();
  plinth(group, 0.07);
  const alu = aluminium();
  const blue = new THREE.MeshStandardMaterial({ color: '#4aa3df', roughness: 0.35 });
  const joint = (r: number, len: number) => {
    const j = new THREE.Group();
    const c = cyl(r, len, alu);
    c.rotation.z = Math.PI / 2;
    const capA = cyl(r * 1.02, 0.006, blue, len / 2 + 0.002);
    const capB = cyl(r * 1.02, 0.006, blue, -len / 2 - 0.002);
    capA.rotation.z = capB.rotation.z = Math.PI / 2;
    j.add(c, capA, capB);
    return j;
  };
  group.add(cyl(0.03, 0.02, alu, 0, 0.022, 0));
  const yaw = new THREE.Group();
  yaw.position.y = 0.032;
  group.add(yaw);
  yaw.add(cyl(0.022, 0.035, alu, 0, 0.017, 0));
  const shoulder = new THREE.Group();
  shoulder.position.y = 0.048;
  shoulder.add(joint(0.02, 0.04));
  yaw.add(shoulder);
  const upper = cyl(0.012, 0.13, alu, 0, 0.065, 0.022);
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.set(0, 0.13, 0.022);
  elbow.add(joint(0.016, 0.034));
  shoulder.add(elbow);
  const fore = cyl(0.01, 0.11, alu, 0, 0.055, -0.016);
  elbow.add(fore);
  const wrist = new THREE.Group();
  wrist.position.set(0, 0.11, -0.016);
  wrist.add(joint(0.011, 0.026));
  const tool = cyl(0.009, 0.03, alu, 0, 0.02, 0.012);
  tool.rotation.x = Math.PI / 2;
  wrist.add(tool, cyl(0.0095, 0.004, blue, 0, 0.02, 0.028));
  elbow.add(wrist);
  return {
    group,
    tick: (t) => {
      yaw.rotation.y = Math.sin(t * 0.35) * 0.9;
      shoulder.rotation.x = -0.35 + Math.sin(t * 0.5) * 0.25;
      elbow.rotation.x = 1.4 + Math.sin(t * 0.5 + 1) * 0.3;
      wrist.rotation.x = 0.6 + Math.sin(t * 0.7) * 0.4;
    },
  };
}

/** First Contact: the QT social robot, its screen face blinking. */
function qtRobot(): Collectible {
  const group = new THREE.Group();
  plinth(group, 0.07);
  const white = plasticWhite();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.06, 8, 24), white);
  body.position.y = 0.065;
  body.scale.set(1, 1, 0.85);
  const neck = cyl(0.012, 0.016, plasticGrey(), 0, 0.128, 0);
  const head = rbox(0.085, 0.07, 0.065, 0.022, white, 0, 0.17, 0);
  const open = faceTexture(true);
  const shut = faceTexture(false);
  const faceMat = new THREE.MeshBasicMaterial({ map: open, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.046), faceMat);
  face.position.set(0, 0.17, 0.0327);
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.045, 0.1, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.045, 6, 12), white);
    a.position.y = -0.028;
    arm.add(a);
    arms.push(arm);
    group.add(arm);
  }
  group.add(body, neck, head, face);
  return {
    group,
    tick: (t) => {
      faceMat.map = Math.sin(t * 1.2) > 0.97 ? shut : open;
      arms[1].rotation.z = 0.2 + Math.max(0, Math.sin(t * 0.6)) * 1.4 * Math.abs(Math.sin(t * 4));
      head.rotation.y = face.rotation.y = Math.sin(t * 0.4) * 0.25;
    },
  };
}

/** The Classifier: a steel letter tray, envelopes sorted into RFQ / TECH / SPAM, one gliding in. */
function mailTray(): Collectible {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.35, metalness: 0.85 });
  const paper = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.85 });
  group.add(rbox(0.2, 0.008, 0.11, 0.003, steel, 0, 0.004, 0));
  const labels = ['RFQ', 'TECH', 'SPAM'];
  labels.forEach((name, k) => {
    const y = 0.02 + k * 0.035;
    const tray = new THREE.Group();
    tray.position.set(0, y, -0.005 + k * 0.004);
    tray.add(rbox(0.19, 0.004, 0.1, 0.002, steel));
    tray.add(box(0.19, 0.016, 0.003, steel, 0, 0.008, 0.05));
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.0125), new THREE.MeshStandardMaterial({ map: labelTexture(name), roughness: 0.8 }));
    tag.position.set(0.05, 0.009, 0.052);
    tray.add(tag);
    for (let n = 0; n < 2 + k; n++) tray.add(box(0.15, 0.0018, 0.08, paper, (rnd() - 0.5) * 0.01, 0.004 + n * 0.0021, (rnd() - 0.5) * 0.008));
    group.add(tray);
  });
  for (const sx of [-0.098, 0.098]) for (const sz of [-0.05, 0.05]) group.add(box(0.004, 0.11, 0.004, steel, sx, 0.055, sz));
  const letter = box(0.15, 0.0018, 0.08, paper);
  group.add(letter);
  return {
    group,
    tick: (t) => {
      const k = (t % 4) / 4; // every 4 s, a letter flies into the RFQ tray
      const slot = Math.floor(t / 4) % 3;
      const y = 0.022 + slot * 0.035 + 0.008;
      letter.position.set(0, y + (1 - k) * 0.1 + Math.sin(k * Math.PI) * 0.03, 0.18 * (1 - k));
      letter.rotation.x = (1 - k) * -0.5;
      letter.visible = k < 0.95;
    },
  };
}

/** Phantom Posture: a wooden artist's mannequin, hunched at work, the sensor on its back. */
function mannequin(): Collectible {
  const group = new THREE.Group();
  const beech = new THREE.MeshStandardMaterial({ color: '#c99d6a', roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: '#7a5634', roughness: 0.5 });
  group.add(cyl(0.05, 0.012, dark, 0, 0.006, 0, 0.055));
  group.add(rod(v3(0, 0.012, 0), v3(0, 0.085, 0), 0.0035, dark));
  const hips = new THREE.Group();
  hips.position.y = 0.09;
  group.add(hips);
  hips.add(ellipsoid(0.022, 0.014, 0.014, beech));
  for (const side of [-1, 1]) {
    // seated: thighs forward, shins down
    const knee = v3(side * 0.012, -0.004, 0.05);
    hips.add(rod(v3(side * 0.012, -0.004, 0), knee, 0.0065, beech), ellipsoid(0.007, 0.007, 0.007, beech, knee.x, knee.y, knee.z));
    hips.add(rod(knee, v3(knee.x, -0.075, 0.055), 0.0055, beech));
  }
  const spine = new THREE.Group();
  spine.position.y = 0.01;
  hips.add(spine);
  spine.add(ellipsoid(0.018, 0.026, 0.012, beech, 0, 0.03, 0));
  const chest = ellipsoid(0.024, 0.02, 0.014, beech, 0, 0.065, 0);
  spine.add(chest);
  const neckHead = new THREE.Group();
  neckHead.position.y = 0.088;
  neckHead.add(rod(v3(0, 0, 0), v3(0, 0.012, 0), 0.0035, beech), ellipsoid(0.012, 0.016, 0.013, beech, 0, 0.027, 0.002));
  spine.add(neckHead);
  for (const side of [-1, 1]) {
    const elbow = v3(side * 0.03, 0.04, 0.025);
    spine.add(rod(v3(side * 0.026, 0.074, 0), elbow, 0.005, beech), ellipsoid(0.006, 0.006, 0.006, beech, elbow.x, elbow.y, elbow.z));
    spine.add(rod(elbow, v3(side * 0.018, 0.03, 0.06), 0.0045, beech));
  }
  // the sensor (ESP32 + MPU6050) strapped on its back, its LED blinking
  const sensor = rbox(0.016, 0.022, 0.007, 0.002, new THREE.MeshStandardMaterial({ color: '#ff6a00', roughness: 0.45 }), 0, 0.055, -0.016);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(0, 3, 0.8) }));
  led.position.set(0.004, 0.063, -0.0205);
  spine.add(sensor, led);
  return {
    group,
    tick: (t) => {
      // slowly slouching over the work, then sitting up again
      const slouch = 0.5 + 0.5 * Math.sin(t * 0.45);
      spine.rotation.x = 0.1 + slouch * 0.5;
      neckHead.rotation.x = 0.1 + slouch * 0.4;
      led.visible = Math.sin(t * 6) > 0;
    },
  };
}

const COLLECTIBLES: Record<SignKind, () => Collectible> = {
  drone,
  arm: urArm,
  robot: qtRobot,
  mailbox: mailTray,
  desk: mannequin,
};

// ---------------------------------------------------------------- furniture

function monitor(w: number, screen: THREE.MeshStandardMaterial) {
  const h = w * 0.5625;
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.45, metalness: 0.2 });
  const body = rbox(w + 0.012, h + 0.012, 0.018, 0.004, shell);
  const back = rbox(w * 0.5, h * 0.5, 0.03, 0.01, shell, 0, -h * 0.05, -0.02);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screen);
  display.position.z = 0.0095;
  display.userData.noShadow = true;
  const alu = aluminium();
  const neck = box(0.05, h * 0.62, 0.016, alu, 0, -h * 0.42, -0.045);
  const foot = rbox(0.26, 0.012, 0.19, 0.005, alu, 0, -h / 2 - h * 0.62 + 0.006 + 0.05, -0.03);
  g.add(body, back, display, neck, foot);
  return { group: g, display, parts: [body, display], height: h };
}

function officeChair(fabric: THREE.Material) {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: '#d4d6da', roughness: 0.18, metalness: 1 });
  const dark = plasticBlack();
  g.add(rbox(0.5, 0.08, 0.48, 0.035, fabric, 0, 0.48, 0));
  const back = rbox(0.46, 0.56, 0.07, 0.035, fabric, 0, 0.86, -0.25);
  back.rotation.x = -0.12;
  g.add(back);
  g.add(rod(v3(0, 0.46, -0.18), v3(0, 0.7, -0.28), 0.018, dark));
  for (const sx of [-0.27, 0.27]) {
    g.add(rod(v3(sx, 0.47, -0.05), v3(sx, 0.66, -0.06), 0.012, dark));
    g.add(rbox(0.05, 0.025, 0.24, 0.01, dark, sx, 0.67, -0.02));
  }
  g.add(cyl(0.025, 0.3, chrome, 0, 0.29, 0));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    g.add(rod(v3(0, 0.1, 0), v3(Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3), 0.016, chrome));
    g.add(ellipsoid(0.025, 0.025, 0.025, dark, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3));
  }
  return g;
}

function headphones(stand: THREE.Material, cups: THREE.Material) {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.012, stand, 0, 0.006, 0), cyl(0.008, 0.24, stand, 0, 0.13, 0));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 12, 40, Math.PI), cups);
  band.position.y = 0.245;
  g.add(band);
  for (const sx of [-0.085, 0.085]) {
    const cup = rbox(0.035, 0.085, 0.07, 0.02, cups, sx, 0.21, 0);
    g.add(cup);
  }
  return g;
}

// ---------------------------------------------------------------- the room

export function buildRoom(manager: THREE.LoadingManager) {
  const group = new THREE.Group();
  const tex = makeTextures(manager);
  const gltf = new GLTFLoader(manager);
  const ticks: ((t: number) => void)[] = [];
  const put = (id: string, x: number, y: number, z: number, o: { rotY?: number; scale?: number } = {}) =>
    gltf.load(publicUrl(`/hq/models/${id}/${id}.gltf`), (m) => {
      const s = m.scene;
      if (o.scale) s.scale.setScalar(o.scale);
      s.rotation.y = o.rotY ?? 0;
      s.position.set(x, 0, z);
      s.updateMatrixWorld(true);
      s.position.y = y - new THREE.Box3().setFromObject(s).min.y;
      markShadows(s);
      group.add(s);
    });

  // ---- materials ----
  // smooth painted walls, warm white (lit orange by the coves)
  const wallMat = new THREE.MeshStandardMaterial({ color: '#cdbda5', roughness: 0.94 });
  const carpet = new THREE.MeshStandardMaterial({
    color: '#3b3a3d',
    normalMap: tex('/hq/tex/wool_boucle_nor.jpg'),
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 1,
  });
  const oak = new THREE.MeshStandardMaterial({
    map: tex('/hq/tex/wood_table_001_diff.jpg', true),
    normalMap: tex('/hq/tex/wood_table_001_nor.jpg'),
    roughnessMap: tex('/hq/tex/wood_table_001_rough.jpg'),
    color: '#f6d6ae', // a light oak
  });
  // (the texture's colours are a plaid: only its weave is kept)
  const boucle = new THREE.MeshStandardMaterial({
    normalMap: tex('/hq/tex/wool_boucle_nor.jpg'),
    roughnessMap: tex('/hq/tex/wool_boucle_rough.jpg'),
    color: '#e9dfcd',
  });
  const charcoal = boucle.clone();
  charcoal.color.set('#3a3d44');
  const black = new THREE.MeshStandardMaterial({ color: '#111113', roughness: 0.5, metalness: 0.2 });
  const matte = new THREE.MeshStandardMaterial({ color: '#1c1c1f', roughness: 0.8 });

  // ---- shell, with a cove of warm LEDs round the ceiling ----
  const W = ROOM.x1 - ROOM.x0;
  const D = ROOM.z1 - ROOM.z0;
  const floor = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(W, D), W, D, 0.35), carpet);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#cbb89c', roughness: 0.95 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  group.add(ceiling);
  const wall = (w: number, x: number, z: number, rotY: number) => {
    const m = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(w, H), w, H, 2.4), wallMat);
    m.position.set(x, H / 2, z);
    m.rotation.y = rotY;
    group.add(m);
  };
  wall(W, 0, BACK, 0);
  wall(D, ROOM.x0, 0, Math.PI / 2);
  wall(D, ROOM.x1, 0, -Math.PI / 2);
  wall(W, 0, ROOM.z1, Math.PI);
  const soffit = new THREE.MeshStandardMaterial({ color: '#d8c6aa', roughness: 0.9 });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3c').multiplyScalar(2.6), toneMapped: false });
  const covePieces: [number, number, number, number][] = [
    [W, 0.28, 0, BACK + 0.14],
    [W, 0.28, 0, ROOM.z1 - 0.14],
    [0.28, D, ROOM.x0 + 0.14, 0],
    [0.28, D, ROOM.x1 - 0.14, 0],
  ];
  for (const [w, d, x, z] of covePieces) group.add(box(w, 0.1, d, soffit, x, H - 0.05, z));
  // the strip itself, along the inner edge of the cove
  const stripW = 0.012;
  group.add(
    box(W - 0.56, stripW, stripW, led, 0, H - 0.1, BACK + 0.29),
    box(W - 0.56, stripW, stripW, led, 0, H - 0.1, ROOM.z1 - 0.29),
    box(stripW, stripW, D - 0.56, led, ROOM.x0 + 0.29, H - 0.1, 0),
    box(stripW, stripW, D - 0.56, led, ROOM.x1 - 0.29, H - 0.1, 0),
  );
  // its light washing down the walls
  const wash = (w: number, x: number, z: number, look: THREE.Vector3) => {
    const l = new THREE.RectAreaLight('#ff9d4a', 3.2, w, 0.25);
    l.position.set(x, H - 0.12, z);
    l.lookAt(look);
    group.add(l);
  };
  wash(W - 0.6, 0, BACK + 0.3, v3(0, 0.2, BACK - 1.5));
  wash(W - 0.6, 0, ROOM.z1 - 0.3, v3(0, 0.2, ROOM.z1 + 1.5));
  wash(D - 0.6, ROOM.x0 + 0.3, 0, v3(ROOM.x0 - 1.5, 0.2, 0));
  wash(D - 0.6, ROOM.x1 - 0.3, 0, v3(ROOM.x1 + 1.5, 0.2, 0));
  // and a soft light down into the room (the one that casts shadows)
  const fill = new THREE.SpotLight('#ffc48a', 6, 0, 1.15, 1, 2);
  fill.position.set(0.2, H - 0.05, 0);
  fill.target.position.set(0, 0, -0.4);
  fill.castShadow = true;
  fill.shadow.mapSize.set(2048, 2048);
  fill.shadow.bias = -0.0004;
  fill.shadow.normalBias = 0.02;
  fill.shadow.radius = 6;
  group.add(fill, fill.target);

  // ---- the window, behind blinds, and the bookcase under it ----
  const win = { x0: -2.2, x1: -0.95, y0: 0.85, y1: 2.3 };
  const ww = win.x1 - win.x0;
  const wh = win.y1 - win.y0;
  const wcx = (win.x0 + win.x1) / 2;
  const wcy = (win.y0 + win.y1) / 2;
  const city = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: cityTexture(), toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.2) }));
  city.position.set(wcx, wcy, BACK + 0.005);
  city.userData.noShadow = true;
  group.add(city);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.5 });
  group.add(box(ww + 0.06, 0.04, 0.06, frameMat, wcx, win.y1, BACK + 0.02), box(ww + 0.06, 0.04, 0.1, frameMat, wcx, win.y0, BACK + 0.04));
  group.add(box(0.04, wh, 0.06, frameMat, win.x0, wcy, BACK + 0.02), box(0.04, wh, 0.06, frameMat, win.x1, wcy, BACK + 0.02));
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(ww - 0.02, 0.003, 0.035), new THREE.MeshStandardMaterial({ color: '#232326', roughness: 0.55, metalness: 0.3 }), 48);
  const d = new THREE.Object3D();
  for (let k = 0; k < 48; k++) {
    d.position.set(wcx, win.y1 - 0.03 - k * (wh - 0.04) / 48, BACK + 0.06);
    d.rotation.set(0.9, 0, 0);
    d.updateMatrix();
    slats.setMatrixAt(k, d.matrix);
  }
  group.add(slats);
  const windowGlow = new THREE.RectAreaLight('#7f95ff', 1.2, ww, wh);
  windowGlow.position.set(wcx, wcy, BACK + 0.08);
  windowGlow.lookAt(wcx, wcy, 2);
  group.add(windowGlow);
  // the bookcase
  const bc = { x: wcx, w: 1.5, h: 0.72, d: 0.32 };
  const bcz = BACK + bc.d / 2;
  group.add(box(bc.w, 0.03, bc.d, oak, bc.x, bc.h, bcz), box(bc.w, 0.03, bc.d, oak, bc.x, 0.05, bcz), box(bc.w, 0.02, bc.d, oak, bc.x, 0.38, bcz));
  for (const sx of [-1, -0.33, 0.33, 1]) group.add(box(0.02, bc.h, bc.d, oak, bc.x + (sx * (bc.w - 0.02)) / 2, bc.h / 2, bcz));
  group.add(box(bc.w, bc.h, 0.01, oak, bc.x, bc.h / 2, BACK + 0.005));
  const spines = ['#7a3b2e', '#2e4a5a', '#c9b48a', '#3b3b3b', '#8a6a3a', '#4a5a3a', '#d8d0c0', '#5a2e3a'];
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.75 }), 90);
  let n = 0;
  for (const shelfY of [0.065, 0.395]) {
    let x = bc.x - bc.w / 2 + 0.03;
    while (x < bc.x + bc.w / 2 - 0.05 && n < 90) {
      if (Math.abs(x - (bc.x + (-0.33 * (bc.w - 0.02)) / 2)) < 0.02 || Math.abs(x - (bc.x + (0.33 * (bc.w - 0.02)) / 2)) < 0.02) {
        x += 0.03;
        continue;
      }
      const t = 0.02 + rnd() * 0.025;
      const hgt = 0.2 + rnd() * 0.08;
      d.position.set(x + t / 2, shelfY + hgt / 2, bcz + 0.01);
      d.rotation.set(0, 0, rnd() < 0.08 ? 0.25 : 0);
      d.scale.set(t, hgt, 0.2 + rnd() * 0.04);
      d.updateMatrix();
      books.setMatrixAt(n, d.matrix);
      books.setColorAt(n, new THREE.Color(spines[Math.floor(rnd() * spines.length)]));
      n++;
      x += t + 0.002;
      if (rnd() < 0.08) x += 0.12; // a gap now and then
    }
  }
  books.count = n;
  group.add(books);
  put('potted_plant_04', bc.x - 0.45, bc.h + 0.015, bcz, { scale: 1.2 });
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(2.2), toneMapped: false });
  group.add(cyl(0.04, 0.12, lampMat, bc.x + 0.5, bc.h + 0.075, bcz, 0.045), cyl(0.03, 0.02, black, bc.x + 0.5, bc.h + 0.025, bcz));
  const lampLight = new THREE.PointLight('#ffc27a', 0.9, 1.6, 2);
  lampLight.position.set(bc.x + 0.5, bc.h + 0.2, bcz + 0.1);
  group.add(lampLight);

  // ---- the desk, its screens and the shelf above (zone: desk) ----
  const desk = { x: 0.62, w: 2.6, d: 0.68, top: 0.74 };
  const dz = BACK + desk.d / 2;
  const top = new THREE.Mesh(tileUV(new RoundedBoxGeometry(desk.w, 0.035, desk.d, 2, 0.008), desk.w, desk.d, 1.4), oak);
  top.position.set(desk.x, desk.top, dz);
  group.add(top);
  group.add(box(0.03, desk.top, desk.d - 0.06, black, desk.x - desk.w / 2 + 0.04, desk.top / 2, dz), box(0.03, desk.top, desk.d - 0.06, black, desk.x + desk.w / 2 - 0.04, desk.top / 2, dz));
  group.add(box(desk.w - 0.1, 0.3, 0.02, black, desk.x, desk.top - 0.17, BACK + 0.05)); // modesty panel
  // the wall shelf over it, lit from beneath
  group.add(box(desk.w - 0.2, 0.035, 0.24, oak, desk.x, 1.62, BACK + 0.12));
  group.add(box(desk.w - 0.3, 0.008, 0.008, led, desk.x, 1.6, BACK + 0.22));
  const underShelf = new THREE.RectAreaLight('#ffb06a', 2.5, desk.w - 0.3, 0.15);
  underShelf.position.set(desk.x, 1.595, BACK + 0.16);
  underShelf.lookAt(desk.x, 0, BACK + 0.4);
  group.add(underShelf);

  const images = { about: [] as HTMLImageElement[], projects: [] as HTMLImageElement[] };
  const aboutScreen = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveIntensity: 0.9, roughness: 0.5, emissiveMap: sectionTexture('About me.', 'Rendra Djunaedi — robotics & software', [], '#ff6a00') });
  const projectsScreen = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveIntensity: 0.9, roughness: 0.5, emissiveMap: sectionTexture('Projects.', 'Drones, robots, AI — the tapes', [], '#4aa3df') });
  void Promise.all([palletlensCassette, escoCassette, lirmmCassette].map(loadImage)).then((imgs) => {
    images.projects = imgs;
    projectsScreen.emissiveMap?.dispose();
    projectsScreen.emissiveMap = sectionTexture('Projects.', 'Drones, robots, AI — the tapes', imgs, '#4aa3df');
    projectsScreen.needsUpdate = true;
  });
  void loadImage(hoodieModel).then((img) => {
    images.about = [img];
  });
  const screens: { mat: THREE.MeshStandardMaterial; x: number; rot: number; section: string; label: string }[] = [
    { mat: aboutScreen, x: desk.x - 0.62, rot: 0.18, section: 'about', label: 'About me' },
    { mat: projectsScreen, x: desk.x + 0.55, rot: -0.18, section: 'work', label: 'Projects' },
  ];
  const deskSpots: Hotspot[] = [];
  for (const s of screens) {
    const m = monitor(0.64, s.mat);
    const cy = desk.top + 0.02 + 0.07 + m.height / 2 + m.height * 0.12;
    m.group.position.set(s.x, cy, BACK + 0.24);
    m.group.rotation.y = s.rot;
    markShadows(m.group);
    group.add(m.group);
    const normal = v3(Math.sin(s.rot), 0, Math.cos(s.rot));
    const spot: Hotspot = {
      id: s.section,
      kind: 'section',
      label: s.label,
      section: s.section,
      hits: m.parts,
      center: m.group.position.clone().addScaledVector(normal, 0.01),
      normal,
      size: 0.64,
      highlight: (on) => (s.mat.emissiveIntensity = on ? 1.1 : 0.9),
    };
    for (const p of m.parts) p.userData.spot = spot.id;
    deskSpots.push(spot);
  }
  // keyboards on felt mats, mice, a mug, a clock, headphones, the tower
  for (const [x, rot] of [[desk.x - 0.62, 0.12], [desk.x + 0.55, -0.12]] as const) {
    const pad = rbox(0.8, 0.004, 0.3, 0.002, matte, x, desk.top + 0.02, BACK + 0.5);
    pad.rotation.y = rot;
    const kb = rbox(0.36, 0.016, 0.12, 0.004, new THREE.MeshStandardMaterial({ color: '#e8e6e2', roughness: 0.5 }), x - 0.05, desk.top + 0.03, BACK + 0.5);
    kb.rotation.y = rot;
    const mouse = rbox(0.06, 0.025, 0.1, 0.012, plasticBlack(), x + 0.26, desk.top + 0.032, BACK + 0.52);
    group.add(pad, kb, mouse);
  }
  const mug = cyl(0.042, 0.095, new THREE.MeshStandardMaterial({ color: '#f1ede6', roughness: 0.35 }), desk.x, desk.top + 0.065, BACK + 0.34, 0.04);
  group.add(mug);
  const clock = rbox(0.16, 0.055, 0.04, 0.008, black, desk.x - 0.05, 1.67, BACK + 0.12);
  const digits = new THREE.Mesh(
    new THREE.PlaneGeometry(0.13, 0.04),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 80, (ctx) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 256, 80);
        ctx.fillStyle = '#fff';
        ctx.font = '700 64px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('12:40', 128, 62);
      }),
      toneMapped: false,
    }),
  );
  digits.position.set(desk.x - 0.05, 1.67, BACK + 0.141);
  group.add(clock, digits);
  const phones = headphones(aluminium(), plasticBlack());
  phones.position.set(desk.x + 1.1, desk.top + 0.02, BACK + 0.3);
  group.add(phones);
  const tower = new THREE.Group();
  tower.add(rbox(0.22, 0.46, 0.44, 0.01, black));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#6a8cff').multiplyScalar(0.6), toneMapped: false, transparent: true, opacity: 0.5 }));
  glass.rotation.y = -Math.PI / 2;
  glass.position.x = -0.111;
  tower.add(glass);
  tower.position.set(desk.x + 1.05, 0.23, BACK + 0.32);
  group.add(tower);
  for (const [x, r] of [[desk.x - 0.6, 0.35], [desk.x + 0.55, -0.25]] as const) {
    const chair = officeChair(charcoal);
    chair.position.set(x, 0, BACK + 1.05);
    chair.rotation.y = Math.PI + r;
    markShadows(chair);
    group.add(chair);
  }
  // framed prints over the shelf
  const frame = (url: string, w: number, h: number, x: number) => {
    const f = new THREE.Group();
    f.add(box(w, h, 0.025, black));
    const art = tex(url, true);
    art.wrapS = art.wrapT = THREE.ClampToEdgeWrapping;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, h - 0.05), new THREE.MeshStandardMaterial({ map: art, roughness: 0.4 }));
    p.position.z = 0.013;
    f.add(p);
    f.position.set(x, 2.05, BACK + 0.015);
    group.add(f);
  };
  frame(hoodieModel, 0.42, 0.42, desk.x - 0.5);
  frame(palletlensCassette, 0.32, 0.42, desk.x + 0.3);
  frame(hoodieDontFollow, 0.42, 0.42, desk.x + 0.95);

  const deskZone: Zone = {
    id: 'desk',
    label: 'Desk',
    hint: 'About me · Projects',
    hit: new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.2), new THREE.MeshBasicMaterial({ visible: false })),
    anchor: v3(desk.x, 1.4, BACK + 0.4),
    view: { position: v3(desk.x, 1.55, BACK + 2.05), target: v3(desk.x, 1.05, BACK + 0.2) },
    spots: deskSpots,
  };
  deskZone.hit.position.set(desk.x, 0.9, BACK + 0.6);
  group.add(deskZone.hit);

  // ---- the TV wall: Xandvar on the screen, a console below ----
  const tvZ = -0.35;
  const tvMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveIntensity: 0.9, roughness: 0.5, emissiveMap: xandvarTexture(null) });
  void loadImage(hoodieDontFollow).then((img) => {
    tvMat.emissiveMap?.dispose();
    tvMat.emissiveMap = xandvarTexture(img);
    tvMat.needsUpdate = true;
  });
  const tv = new THREE.Group();
  const tvBody = rbox(1.32, 0.76, 0.035, 0.006, new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.4, metalness: 0.3 }));
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.29, 0.725), tvMat);
  tvScreen.position.z = 0.018;
  tvScreen.userData.noShadow = true;
  tv.add(tvBody, tvScreen);
  tv.position.set(ROOM.x1 - 0.04, 1.28, tvZ);
  tv.rotation.y = -Math.PI / 2;
  group.add(tv);
  const tvGlow = new THREE.RectAreaLight('#c8d2ff', 1.4, 1.2, 0.7);
  tvGlow.position.set(ROOM.x1 - 0.08, 1.28, tvZ);
  tvGlow.lookAt(0, 1.0, tvZ);
  group.add(tvGlow);
  // the light bar over it
  group.add(box(0.03, 0.03, 0.9, black, ROOM.x1 - 0.03, 1.85, tvZ), box(0.006, 0.01, 0.86, led, ROOM.x1 - 0.05, 1.835, tvZ));
  // the console stand
  const con = { w: 1.7, h: 0.48, d: 0.42 };
  const cx = ROOM.x1 - con.d / 2;
  group.add(box(con.d, 0.03, con.w, oak, cx, con.h, tvZ), box(con.d, 0.03, con.w, oak, cx, 0.09, tvZ), box(con.d, 0.02, con.w, oak, cx, 0.28, tvZ));
  for (const sz of [-1, 1]) group.add(box(con.d, con.h, 0.03, oak, cx, con.h / 2, tvZ + (sz * (con.w - 0.03)) / 2));
  for (const sz of [-0.62, 0.62]) group.add(box(0.03, 0.09, 0.03, black, cx, 0.045, tvZ + sz));
  // consoles and controllers, kept generic
  group.add(rbox(0.26, 0.06, 0.3, 0.012, plasticWhite(), cx, 0.32, tvZ - 0.35));
  group.add(rbox(0.32, 0.07, 0.24, 0.01, plasticBlack(), cx, 0.32, tvZ + 0.3));
  const pad = (x: number, z: number, rot: number, mat: THREE.Material) => {
    const p = new THREE.Group();
    p.add(rbox(0.13, 0.025, 0.07, 0.02, mat), ellipsoid(0.03, 0.018, 0.035, mat, -0.05, -0.004, 0.025), ellipsoid(0.03, 0.018, 0.035, mat, 0.05, -0.004, 0.025));
    p.position.set(x, con.h + 0.03, z);
    p.rotation.y = rot;
    group.add(p);
  };
  pad(cx - 0.05, tvZ - 0.5, 0.4 - Math.PI / 2, plasticBlack());
  pad(cx + 0.02, tvZ + 0.6, -0.3 - Math.PI / 2, plasticWhite());
  const tvSpot: Hotspot = {
    id: 'brand',
    kind: 'section',
    label: 'Xandvar — enter the studio',
    section: 'brand',
    hits: [tvBody, tvScreen],
    center: v3(ROOM.x1 - 0.06, 1.28, tvZ),
    normal: v3(-1, 0, 0),
    size: 1.32,
    highlight: (on) => (tvMat.emissiveIntensity = on ? 1.1 : 0.9),
  };
  for (const p of tvSpot.hits) p.userData.spot = tvSpot.id;
  const tvZone: Zone = {
    id: 'xandvar',
    label: 'Xandvar',
    hint: 'Click the TV to enter the studio',
    hit: new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 1.9), new THREE.MeshBasicMaterial({ visible: false })),
    anchor: v3(ROOM.x1 - 0.2, 1.85, tvZ),
    view: { position: v3(0.15, 1.45, tvZ + 0.25), target: v3(ROOM.x1, 1.15, tvZ) },
    spots: [tvSpot],
  };
  tvZone.hit.position.set(ROOM.x1 - 0.45, 0.9, tvZ);
  group.add(tvZone.hit);

  // ---- the display shelves: one collectible per experience (zone: experiences) ----
  const sh = { x: ROOM.x1 - 0.2, z: -1.95, w: 0.7, d: 0.34, h: 1.95 };
  const frameBlack = new THREE.MeshStandardMaterial({ color: '#151517', roughness: 0.4, metalness: 0.6 });
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) group.add(box(0.025, sh.h, 0.025, frameBlack, sh.x + (sx * sh.d) / 2, sh.h / 2, sh.z + (sz * sh.w) / 2));
  const levels = [0.32, 0.7, 1.08, 1.46, 1.84];
  const shelfSpots: Hotspot[] = [];
  levels.forEach((y) => group.add(box(sh.d, 0.025, sh.w, oak, sh.x, y - 0.0125, sh.z)));
  group.add(box(sh.d, 0.025, sh.w, oak, sh.x, 0.06, sh.z));
  experiences.forEach((e, i) => {
    const y = levels[i % levels.length];
    const item = COLLECTIBLES[e.kind]();
    item.group.position.set(sh.x, y, sh.z);
    item.group.rotation.y = -Math.PI / 2 + (i % 2 ? 0.35 : -0.35);
    item.group.scale.setScalar(1.15);
    markShadows(item.group);
    group.add(item.group);
    ticks.push(item.tick);
    // a puck light over each one, like a display case
    const puck = new THREE.SpotLight('#ffe2bd', 0.18, 0.6, 0.9, 0.8, 2);
    puck.position.set(sh.x, y + 0.34, sh.z);
    puck.target.position.set(sh.x, y, sh.z);
    group.add(puck, puck.target, cyl(0.02, 0.006, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2bd').multiplyScalar(2), toneMapped: false }), sh.x, y + 0.352, sh.z));
    const hits: THREE.Object3D[] = [];
    item.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.userData.spot = e.slug;
        hits.push(o);
      }
    });
    const base = puck.intensity;
    shelfSpots.push({
      id: e.slug,
      kind: 'experience',
      label: e.title,
      experience: e,
      hits,
      center: v3(sh.x, y + 0.11, sh.z),
      normal: v3(-1, 0, 0),
      size: 0.3,
      highlight: (on) => (puck.intensity = on ? base * 1.8 : base),
    });
  });
  const shelfZone: Zone = {
    id: 'experiences',
    label: 'Experiences',
    hint: 'Hover a collectible, click to open',
    hit: new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.0, 0.9), new THREE.MeshBasicMaterial({ visible: false })),
    anchor: v3(sh.x - 0.1, 2.1, sh.z),
    view: { position: v3(sh.x - 1.25, 1.7, sh.z + 1.45), target: v3(sh.x, 1.05, sh.z) }, // over the chairs
    spots: shelfSpots,
  };
  shelfZone.hit.position.set(sh.x - 0.1, 1.0, sh.z);
  group.add(shelfZone.hit);

  // ---- the lounge: sofa, rug, fridge, prints, plant ----
  const sofa = new THREE.Group();
  const sw = 2.05;
  sofa.add(rbox(sw, 0.36, 0.92, 0.08, boucle, 0, 0.2, 0));
  sofa.add(rbox(sw, 0.42, 0.24, 0.1, boucle, 0, 0.58, -0.36));
  for (const sx of [-1, 1]) sofa.add(rbox(0.2, 0.52, 0.92, 0.09, boucle, (sx * (sw - 0.2)) / 2, 0.3, 0));
  for (const sx of [-0.42, 0.42]) {
    sofa.add(rbox(0.8, 0.13, 0.68, 0.06, boucle, sx, 0.44, 0.06));
    const pillow = rbox(0.42, 0.42, 0.14, 0.07, boucle, sx * 1.2, 0.68, -0.18);
    pillow.rotation.set(-0.2, sx > 0 ? -0.2 : 0.25, sx > 0 ? 0.1 : -0.12);
    sofa.add(pillow);
  }
  sofa.position.set(ROOM.x0 + 0.5, 0, 1.25);
  sofa.rotation.y = Math.PI / 2;
  markShadows(sofa);
  group.add(sofa);
  const rug = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.014, 1.05, 2, 0.006), new THREE.MeshStandardMaterial({ map: rugTexture(), normalMap: tex('/hq/tex/wool_boucle_nor.jpg'), roughness: 1, transparent: false }));
  rug.position.set(-0.55, 0.007, 1.0);
  rug.rotation.y = Math.PI / 2 - 0.22;
  group.add(rug);
  // the mini fridge, lit from inside
  const fridge = new THREE.Group();
  fridge.add(rbox(0.5, 0.84, 0.5, 0.02, black, 0, 0.42, 0));
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.72), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e9f2ff').multiplyScalar(0.75), toneMapped: false }));
  inside.position.set(0, 0.43, 0.2);
  fridge.add(inside);
  const cans = ['#c0262d', '#1d6e2a', '#d8d8d8', '#e0a020', '#2a4ac0'];
  for (let row = 0; row < 3; row++) for (let k = 0; k < 5; k++) fridge.add(cyl(0.032, 0.115, new THREE.MeshStandardMaterial({ color: cans[(row + k) % 5], roughness: 0.3, metalness: 0.7 }), -0.16 + k * 0.08, 0.16 + row * 0.24, 0.22));
  for (let row = 0; row < 3; row++) fridge.add(box(0.42, 0.006, 0.05, new THREE.MeshStandardMaterial({ color: '#cfd6df', roughness: 0.3 }), 0, 0.1 + row * 0.24, 0.22));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.8), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.18 }));
  door.position.set(0, 0.42, 0.252);
  door.userData.noShadow = true;
  fridge.add(door);
  const fridgeLight = new THREE.PointLight('#dbe8ff', 0.6, 1.6, 2);
  fridgeLight.position.set(0, 0.45, 0.45);
  fridge.add(fridgeLight);
  fridge.position.set(ROOM.x0 + 0.27, 0, -0.55);
  fridge.rotation.y = Math.PI / 2;
  group.add(fridge);
  // prints on the left wall, over the sofa
  [hoodieModel, lirmmCassette, escoCassette].forEach((url, k) => {
    const f = new THREE.Group();
    f.add(box(0.36, 0.48, 0.025, black));
    const art = tex(url, true);
    art.wrapS = art.wrapT = THREE.ClampToEdgeWrapping;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), new THREE.MeshStandardMaterial({ map: art, roughness: 0.4 }));
    p.position.z = 0.013;
    f.add(p);
    f.position.set(ROOM.x0 + 0.015, 1.4 + (k === 1 ? 0.12 : 0), 0.55 + k * 0.5);
    f.rotation.y = Math.PI / 2;
    group.add(f);
  });
  put('potted_plant_02', ROOM.x1 - 0.45, 0, ROOM.z1 - 0.55, { scale: 1.7, rotY: 0.6 });
  put('potted_plant_04', desk.x - 1.15, desk.top + 0.02, BACK + 0.25, { scale: 1.1 });

  markShadows(group);
  return {
    group,
    zones: [shelfZone, deskZone, tvZone] as Zone[],
    tick: (t: number) => ticks.forEach((f) => f(t)),
  };
}
