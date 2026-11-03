import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Experience, SignKind } from './content';

/**
 * Builds the street pole and the objects on it — all in code, no model files.
 * Each experience is an object that tells what it was about:
 *
 *   drone    PalletLens — a quadcopter hovering by the pole, props spinning,
 *            a scan light under its camera
 *   desk     Phantom Posture — someone hunched over a desk, wearing the
 *            sensor on their back, the sore spot pulsing red
 *   mailbox  The Classifier — a mailbox full of letters, with letters flying out
 *   robot    First Contact — a little social robot (QT) waving
 *   arm      Convergence — a UR10-style robot arm coming out of the pole
 *
 * Every object is built in the pole's frame (x = outwards from the pole,
 * +z = the side that faces the camera when the object is opened) and has a
 * `tick` for its idle animation.
 */

export interface SignPart {
  experience: Experience;
  /** Everything of this object — rotated around the pole as one. */
  group: THREE.Group;
  /** Meshes the pointer can hit. */
  hits: THREE.Object3D[];
  /** Materials that glow, and their resting glow. */
  glow: { material: THREE.MeshStandardMaterial; rest: number }[];
  /** The point to look at, in the group's own space (for the camera). */
  focus: THREE.Vector3;
  /** Angle of the object around the pole (radians). */
  angle: number;
  /** Rough size of the object, for framing it. */
  size: number;
  /** Idle animation, every frame. */
  tick: (time: number, dt: number) => void;
}

interface Built {
  group: THREE.Group;
  glow: SignPart['glow'];
  focus: THREE.Vector3;
  size: number;
  tick: (time: number, dt: number) => void;
}

const FONT = '"Montserrat", "Helvetica Neue", Arial, sans-serif';

// ---- Small helpers ----------------------------------------------------------------------

function mat(color: string, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...opts });
}

function glowMat(color: string, intensity: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  return mat(color, { emissive: new THREE.Color(color), emissiveIntensity: intensity, ...opts });
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void, px = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * px);
  canvas.height = Math.round(h * px);
  draw(canvas.getContext('2d')!, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 800) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${FONT}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxW && s > 8);
}

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function rounded(w: number, h: number, d: number, r: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), material);
  m.position.set(x, y, z);
  return m;
}

function sphere(r: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), material);
  m.position.set(x, y, z);
  return m;
}

/** A capsule (rounded rod) from point a to point b. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 14), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/** A cylinder whose axis runs along x / y / z. */
function cylinder(r: number, len: number, axis: 'x' | 'y' | 'z', material: THREE.Material, x = 0, y = 0, z = 0, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, 32), material);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

/** A soft round glow (for sprites). */
function radialTexture(inner: string, outer: string) {
  return canvasTexture(1, 1, (ctx, W, H) => {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }, 128);
}

const metal = mat('#9ea2a8', { metalness: 0.9, roughness: 0.32 });

/** A bracket bolted to the pole, reaching out to x = `to`. */
function bracket(to: number, y = 0) {
  const g = new THREE.Group();
  g.add(cylinder(0.115, 0.14, 'y', metal, 0, y, 0));
  g.add(cylinder(0.025, to - 0.1, 'x', metal, 0.1 + (to - 0.1) / 2, y, 0));
  return g;
}

// ---- PalletLens: a drone ---------------------------------------------------------------

function drone(): Built {
  const group = new THREE.Group();
  const craft = new THREE.Group();
  craft.position.set(1.35, 0, 0.1);
  craft.scale.setScalar(1.55);
  group.add(craft);

  const dark = mat('#1c1e23', { metalness: 0.5, roughness: 0.4 });
  const accent = glowMat('#ff6a00', 0.35);
  craft.add(rounded(0.42, 0.13, 0.34, 0.05, dark));
  craft.add(rounded(0.26, 0.06, 0.2, 0.025, accent, 0, 0.085, 0));

  const props: THREE.Group[] = [];
  const blade = mat('#2a2c31', { roughness: 0.4 });
  const blur = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const end = new THREE.Vector3(sx * 0.32, 0.01, sz * 0.27);
    craft.add(limb(new THREE.Vector3(0, 0.01, 0), end, 0.022, dark));
    craft.add(cylinder(0.045, 0.075, 'y', dark, end.x, 0.03, end.z));
    const prop = new THREE.Group();
    prop.position.set(end.x, 0.075, end.z);
    prop.add(box(0.34, 0.006, 0.035, blade), box(0.035, 0.006, 0.34, blade));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), blur);
    disc.rotation.x = -Math.PI / 2;
    prop.add(disc);
    craft.add(prop);
    props.push(prop);
  }
  // camera on a gimbal, front side, and its scan light
  craft.add(sphere(0.055, dark, 0, -0.1, 0.13));
  const lens = glowMat('#5ad1ff', 1.2);
  const lensMesh = new THREE.Mesh(new THREE.CircleGeometry(0.025, 20), lens);
  lensMesh.position.set(0, -0.1, 0.186);
  craft.add(lensMesh);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.6, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffb066', transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  cone.position.set(0, -0.36, 0.26);
  cone.rotation.x = -0.45;
  craft.add(cone);
  const front = glowMat('#2bff6a', 1.5);
  const backLed = glowMat('#ff2a2a', 1.5);
  craft.add(sphere(0.018, front, 0.12, 0, 0.175), sphere(0.018, backLed, -0.12, 0, -0.175));

  return {
    group,
    glow: [{ material: accent, rest: 0.35 }],
    focus: new THREE.Vector3(1.35, -0.05, 0.1),
    size: 1.5,
    tick: (t, dt) => {
      craft.position.y = Math.sin(t * 1.6) * 0.07;
      craft.rotation.z = Math.sin(t * 0.9) * 0.05;
      craft.rotation.x = Math.sin(t * 0.7) * 0.03;
      for (const p of props) p.rotation.y += dt * 38;
      front.emissiveIntensity = 0.6 + (Math.sin(t * 6) > 0 ? 1.2 : 0);
    },
  };
}

// ---- Convergence: a UR10-style robot arm ----------------------------------------------

function robotArm(): Built {
  const group = new THREE.Group();
  const link = mat('#cfd3d7', { metalness: 0.55, roughness: 0.32 });
  const blue = glowMat('#1f6fd6', 0.35, { metalness: 0.3, roughness: 0.35 });
  const darkRing = mat('#2a2d33', { metalness: 0.4 });

  /** A joint housing: a cylinder along z with blue end caps. */
  const housing = (r: number, len: number) => {
    const g = new THREE.Group();
    g.add(cylinder(r, len, 'z', link));
    g.add(cylinder(r * 1.02, 0.02, 'z', blue, 0, 0, len / 2), cylinder(r * 1.02, 0.02, 'z', blue, 0, 0, -len / 2));
    return g;
  };

  // mount plate on the pole + base (rotates about x: the arm comes out sideways)
  group.add(box(0.06, 0.42, 0.42, darkRing, 0.13, 0, 0));
  group.add(cylinder(0.13, 0.12, 'x', link, 0.22, 0, 0));
  group.add(cylinder(0.135, 0.02, 'x', blue, 0.29, 0, 0));
  const j1 = new THREE.Group();
  j1.position.set(0.3, 0, 0);
  group.add(j1);
  j1.add(cylinder(0.1, 0.14, 'x', link, 0.07, 0, 0));
  // shoulder
  const j2 = new THREE.Group();
  j2.position.set(0.2, 0, 0);
  j1.add(j2);
  j2.add(housing(0.11, 0.24));
  j2.add(cylinder(0.07, 0.9, 'x', link, 0.45, 0, 0.0));
  // elbow
  const j3 = new THREE.Group();
  j3.position.set(0.9, 0, 0);
  j2.add(j3);
  j3.add(housing(0.09, 0.2));
  j3.add(cylinder(0.055, 0.78, 'x', link, 0.39, 0, 0));
  // wrists
  const j4 = new THREE.Group();
  j4.position.set(0.78, 0, 0);
  j3.add(j4);
  j4.add(housing(0.065, 0.15));
  j4.add(cylinder(0.05, 0.14, 'x', link, 0.08, 0, 0));
  const j5 = new THREE.Group();
  j5.position.set(0.16, 0, 0);
  j4.add(j5);
  j5.add(housing(0.06, 0.13));
  j5.add(cylinder(0.045, 0.1, 'x', link, 0.06, 0, 0));
  const j6 = new THREE.Group();
  j6.position.set(0.12, 0, 0);
  j5.add(j6);
  j6.add(cylinder(0.05, 0.03, 'x', blue, 0, 0, 0));
  // a two-finger gripper
  j6.add(box(0.05, 0.12, 0.08, darkRing, 0.04, 0, 0));
  const fingerA = box(0.1, 0.018, 0.04, darkRing, 0.11, 0.035, 0);
  const fingerB = box(0.1, 0.018, 0.04, darkRing, 0.11, -0.035, 0);
  j6.add(fingerA, fingerB);

  return {
    group,
    glow: [{ material: blue, rest: 0.35 }],
    focus: new THREE.Vector3(0.95, 0.25, 0),
    size: 1.9,
    tick: (t) => {
      j1.rotation.x = Math.sin(t * 0.35) * 0.35;
      j2.rotation.z = 0.55 + Math.sin(t * 0.55) * 0.22;
      j3.rotation.z = -1.15 + Math.sin(t * 0.55 + 1.2) * 0.3;
      j4.rotation.z = 0.35 + Math.sin(t * 0.8) * 0.35;
      j5.rotation.y = Math.sin(t * 0.6) * 0.4;
      j6.rotation.x = t * 0.7;
      const grip = 0.02 + (Math.sin(t * 1.3) + 1) * 0.012;
      fingerA.position.y = grip + 0.012;
      fingerB.position.y = -grip - 0.012;
    },
  };
}

// ---- The Classifier: a mailbox, letters flying out --------------------------------------

function envelopeTexture() {
  return canvasTexture(0.6, 0.4, (ctx, W, H) => {
    ctx.fillStyle = '#f6f1e6';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#b9b0a0';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(W / 2, H * 0.58);
    ctx.lineTo(W - 2, 2);
    ctx.stroke();
    ctx.fillStyle = '#d4141c';
    ctx.fillRect(W * 0.78, H * 0.12, W * 0.12, H * 0.2);
  }, 160);
}

function mailbox(): Built {
  const group = new THREE.Group();
  group.add(bracket(0.75, -0.02));

  const w = 0.46;
  const h = 0.3;
  const len = 0.78;
  const profile = new THREE.Shape();
  profile.moveTo(-w / 2, 0);
  profile.lineTo(w / 2, 0);
  profile.lineTo(w / 2, h);
  profile.absarc(0, h, w / 2, 0, Math.PI, false);
  profile.lineTo(-w / 2, 0);
  const shell = mat('#14161b', { metalness: 0.55, roughness: 0.38 });
  const inside = mat('#08090b', { side: THREE.BackSide });
  const bodyGeo = new THREE.ExtrudeGeometry(profile, { depth: len, bevelEnabled: false, curveSegments: 28 });
  bodyGeo.translate(0, 0, -len / 2);
  const body = new THREE.Mesh(bodyGeo, shell);
  const box0 = new THREE.Group();
  box0.position.set(0.95, 0, 0);
  box0.add(body);
  // dark interior so the open front reads as a hole
  const inner = new THREE.Mesh(bodyGeo.clone().scale(0.94, 0.94, 0.99), inside);
  inner.position.y = 0.01;
  box0.add(inner);
  // the open door, folded down at the front
  const doorGeo = new THREE.ShapeGeometry(profile, 28);
  const door = new THREE.Mesh(doorGeo, mat('#1c1f26', { metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }));
  const hinge = new THREE.Group();
  hinge.position.set(0, 0, len / 2);
  hinge.rotation.x = 1.25;
  hinge.add(door);
  box0.add(hinge);
  // the back wall
  const backWall = new THREE.Mesh(doorGeo, shell);
  backWall.position.z = -len / 2;
  backWall.rotation.y = Math.PI;
  box0.add(backWall);
  // a lit orange label on the side
  const label = canvasTexture(0.5, 0.14, (ctx, W, H) => {
    ctx.fillStyle = '#ff6a00';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#140700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, 'INBOX · AI', W * 0.86, H * 0.7);
    ctx.fillText('INBOX · AI', W / 2, H * 0.55);
  });
  const labelMat = new THREE.MeshStandardMaterial({ map: label, emissiveMap: label, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.25 });
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), labelMat);
  labelMesh.position.set(w / 2 + 0.002, 0.16, 0);
  labelMesh.rotation.y = Math.PI / 2;
  box0.add(labelMesh);
  // the flag, raised: there's mail
  const flag = new THREE.Group();
  flag.position.set(-w / 2 - 0.02, 0.18, -0.1);
  flag.rotation.z = 0.2;
  flag.add(box(0.015, 0.26, 0.025, mat('#d4141c'), 0, 0.13, 0), box(0.015, 0.08, 0.12, mat('#d4141c'), 0, 0.24, 0.05));
  box0.add(flag);

  // stacked letters inside, some poking out
  const envTex = envelopeTexture();
  const paper = new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), paper);
    letter.position.set(-0.13 + i * 0.032, 0.14 + (i % 3) * 0.02, -0.05 + (i % 4) * 0.12);
    letter.rotation.set(-Math.PI / 2 + 0.25 + (i % 3) * 0.2, 0, 0.3 - i * 0.08);
    box0.add(letter);
  }
  group.add(box0);

  // letters flying out of the open front, in a loop
  const flyers: { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; phase: number; side: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const material = new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.8, side: THREE.DoubleSide, transparent: true, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.12, emissiveMap: envTex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.135), material);
    box0.add(mesh);
    flyers.push({ mesh, material, phase: i / 8, side: i % 2 ? 1 : -1 });
  }
  const PERIOD = 4.2;

  return {
    group,
    glow: [{ material: labelMat, rest: 0.25 }],
    focus: new THREE.Vector3(0.95, 0.3, 0.35),
    size: 1.55,
    tick: (t) => {
      for (const f of flyers) {
        const p = (t / PERIOD + f.phase) % 1;
        const e = p * p * (3 - 2 * p);
        // out of the front, up and away, swaying side to side
        f.mesh.position.set(f.side * Math.sin(p * 5 + f.phase * 9) * 0.35 * e, 0.2 + e * 1.5, len / 2 + 0.05 + e * 0.75);
        f.mesh.rotation.set(Math.sin(p * 7 + f.phase * 4) * 0.8, p * 5 * f.side, Math.cos(p * 6) * 0.6);
        f.material.opacity = Math.min(1, p * 8) * (1 - Math.max(0, (p - 0.7) / 0.3));
      }
    },
  };
}

// ---- Phantom Posture: someone at a desk with a sore back -----------------------------------

function deskScene(): Built {
  const group = new THREE.Group();
  const scene = new THREE.Group();
  scene.position.set(0.25, -0.35, 0);
  group.add(scene);

  // a shelf off the pole holds the whole scene
  const shelfMat = mat('#2a2c31', { metalness: 0.6, roughness: 0.4 });
  scene.add(box(1.5, 0.04, 0.8, shelfMat, 0.75, 0, 0));
  scene.add(limb(new THREE.Vector3(-0.15, -0.55, 0), new THREE.Vector3(0.7, -0.02, 0), 0.02, metal));
  group.add(cylinder(0.115, 0.14, 'y', metal, 0, -0.35, 0), cylinder(0.115, 0.14, 'y', metal, 0, -0.9, 0));

  // desk, screen, keyboard
  const wood = mat('#3a2a1f', { roughness: 0.7 });
  const legMat = mat('#1d1f24', { metalness: 0.5 });
  scene.add(box(0.62, 0.03, 0.42, wood, 1.18, 0.47, 0));
  for (const [x, z] of [[0.9, 0.18], [1.46, 0.18], [0.9, -0.18], [1.46, -0.18]]) scene.add(box(0.025, 0.45, 0.025, legMat, x, 0.24, z));
  const screen = glowMat('#7fb7ff', 0.8, { roughness: 0.3 });
  scene.add(box(0.025, 0.24, 0.36, legMat, 1.4, 0.68, 0));
  const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), screen);
  screenFace.position.set(1.386, 0.68, 0);
  screenFace.rotation.y = -Math.PI / 2;
  scene.add(screenFace);
  scene.add(box(0.02, 0.12, 0.02, legMat, 1.41, 0.54, 0), box(0.1, 0.01, 0.12, legMat, 1.41, 0.49, 0));
  scene.add(box(0.12, 0.012, 0.26, mat('#111'), 1.15, 0.492, 0));
  // a mug
  scene.add(cylinder(0.025, 0.06, 'y', mat('#e8e2d6'), 1.3, 0.52, 0.15));

  // chair
  const chair = mat('#141519', { roughness: 0.6 });
  scene.add(box(0.28, 0.035, 0.28, chair, 0.72, 0.3, 0));
  scene.add(box(0.035, 0.32, 0.26, chair, 0.56, 0.5, 0));
  scene.add(cylinder(0.015, 0.26, 'y', legMat, 0.72, 0.16, 0), cylinder(0.12, 0.015, 'y', legMat, 0.72, 0.03, 0));

  // the person — hunched forward over the keyboard
  const skin = mat('#c69273', { roughness: 0.6 });
  const hoodie = mat('#2d3038', { roughness: 0.8 });
  const jeans = mat('#1e2a3d', { roughness: 0.8 });
  const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
  const hips = v(0.72, 0.38);
  const midBack = v(0.79, 0.56);
  const shoulders = v(0.93, 0.67);
  const head = v(1.04, 0.69);
  const body = new THREE.Group();
  scene.add(body);
  body.add(limb(hips, midBack, 0.085, hoodie), limb(midBack, shoulders, 0.09, hoodie));
  body.add(limb(shoulders, v(0.99, 0.68), 0.03, skin));
  const headMesh = sphere(0.075, skin, head.x, head.y, head.z);
  headMesh.scale.set(1, 1.08, 0.92);
  body.add(headMesh);
  body.add(sphere(0.077, mat('#16110e', { roughness: 0.9 }), head.x - 0.015, head.y + 0.02, 0)); // hair
  for (const s of [1, -1]) {
    const shoulder = v(0.92, 0.65, s * 0.11);
    const elbow = v(1.02, 0.5, s * 0.13);
    const hand = v(1.13, 0.51, s * 0.07);
    body.add(limb(shoulder, elbow, 0.035, hoodie), limb(elbow, hand, 0.03, hoodie), sphere(0.03, skin, hand.x, hand.y, hand.z));
    const hip = v(0.74, 0.36, s * 0.07);
    const knee = v(0.98, 0.36, s * 0.08);
    const foot = v(0.99, 0.06, s * 0.08);
    scene.add(limb(hip, knee, 0.045, jeans), limb(knee, foot, 0.04, jeans), box(0.1, 0.03, 0.05, mat('#e9e6e0'), foot.x + 0.03, 0.035, foot.z));
  }

  // the device: a sensor box strapped on the upper back, its LED blinking
  const pcb = mat('#0f5132', { roughness: 0.5 });
  const sensorPos = v(0.8, 0.6);
  const sensor = box(0.04, 0.07, 0.09, pcb, sensorPos.x - 0.09, sensorPos.y, 0);
  sensor.rotation.z = 0.7;
  body.add(sensor);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.008, 8, 32), mat('#0a0a0a'));
  strap.position.copy(sensorPos);
  strap.rotation.set(Math.PI / 2, 0.75, 0);
  body.add(strap);
  const led = glowMat('#2bff6a', 2);
  body.add(sphere(0.009, led, sensorPos.x - 0.115, sensorPos.y + 0.02, 0.02));
  // the sore spot, pulsing red on the lower back
  const pain = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,40,30,0.95)', 'rgba(255,40,30,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pain.position.set(0.66, 0.47, 0.02);
  body.add(pain);
  const painCore = glowMat('#ff2a1a', 1.5);
  body.add(sphere(0.022, painCore, 0.665, 0.47, 0));

  return {
    group,
    glow: [{ material: screen, rest: 0.8 }],
    focus: new THREE.Vector3(1.05, -0.05, 0),
    size: 1.45,
    tick: (t) => {
      const pulse = (Math.sin(t * 3.2) + 1) / 2;
      pain.scale.setScalar(0.16 + pulse * 0.14);
      painCore.emissiveIntensity = 0.8 + pulse * 1.6;
      led.emissiveIntensity = Math.sin(t * 5) > 0.6 ? 3 : 0.4;
      // breathing and the odd wince
      body.position.y = Math.sin(t * 1.4) * 0.004;
      headMesh.position.y = head.y + Math.sin(t * 0.7) * 0.006;
    },
  };
}

// ---- First Contact: a small social robot (QT), waving ------------------------------------------

function faceTexture(blink: boolean) {
  return canvasTexture(0.6, 0.4, (ctx, W, H) => {
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#4fd8ff';
    for (const x of [0.33, 0.67]) {
      ctx.beginPath();
      if (blink) ctx.fillRect(W * x - W * 0.08, H * 0.48, W * 0.16, H * 0.05);
      else ctx.ellipse(W * x, H * 0.48, W * 0.07, H * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#4fd8ff';
    ctx.lineWidth = H * 0.04;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.62, W * 0.08, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }, 200);
}

function socialRobot(): Built {
  const group = new THREE.Group();
  group.add(bracket(0.62, -0.02));
  const shell = mat('#f2f2ef', { roughness: 0.35, metalness: 0.05 });
  const joint = mat('#2a2d33');
  const bot = new THREE.Group();
  bot.position.set(0.68, 0, 0.02);
  bot.scale.setScalar(1.35);
  group.add(bot);
  bot.add(cylinder(0.1, 0.03, 'y', joint, 0, 0, 0)); // stand
  bot.add(rounded(0.2, 0.24, 0.15, 0.06, shell, 0, 0.15, 0)); // body
  bot.add(cylinder(0.03, 0.05, 'y', joint, 0, 0.29, 0)); // neck
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.4, 0);
  bot.add(headGroup);
  headGroup.add(rounded(0.26, 0.2, 0.19, 0.07, shell));
  const open = faceTexture(false);
  const shut = faceTexture(true);
  const faceMat = new THREE.MeshStandardMaterial({ map: open, emissiveMap: open, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.9, roughness: 0.2 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.135), faceMat);
  face.position.z = 0.096;
  headGroup.add(face);
  // arms: the left one hangs, the right one waves
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.115, 0.22, 0);
  leftArm.add(sphere(0.03, joint), limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.03, -0.14, 0.02), 0.025, shell));
  leftArm.rotation.z = -0.15;
  const rightArm = new THREE.Group();
  rightArm.position.set(0.115, 0.22, 0);
  rightArm.add(sphere(0.03, joint), limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, 0.14, 0.02), 0.025, shell));
  bot.add(leftArm, rightArm);

  return {
    group,
    glow: [{ material: faceMat, rest: 0.9 }],
    focus: new THREE.Vector3(0.68, 0.32, 0.02),
    size: 0.85,
    tick: (t) => {
      rightArm.rotation.z = -0.35 + Math.sin(t * 5) * 0.4;
      headGroup.rotation.y = Math.sin(t * 0.8) * 0.25;
      headGroup.rotation.z = Math.sin(t * 1.1) * 0.06;
      const blink = t % 3.2 < 0.13;
      const map = blink ? shut : open;
      if (faceMat.map !== map) {
        faceMat.map = map;
        faceMat.emissiveMap = map;
        faceMat.needsUpdate = true;
      }
    },
  };
}

const BUILDERS: Record<SignKind, () => Built> = {
  drone,
  desk: deskScene,
  mailbox,
  robot: socialRobot,
  arm: robotArm,
};

// Where each object sits on the pole: height and angle around it (in content order).
const PLACES: { y: number; angle: number }[] = [
  { y: 1.35, angle: 0.25 }, // drone
  { y: -2.15, angle: 1.35 }, // desk
  { y: -0.55, angle: -1.7 }, // mailbox
  { y: 0.35, angle: 2.75 }, // robot
  { y: 2.35, angle: -2.35 }, // arm
];

// ---- Stickers ----------------------------------------------------------------------------

const STICKERS = ['X', 'AI', 'ROS2', '★', 'xandvar', '01', '⚡', 'R'];
const STICKER_COLOURS = ['#ff5a1f', '#ffd60a', '#ffffff', '#d4141c', '#2bff6a', '#111111'];

function sticker(i: number) {
  const text = STICKERS[i % STICKERS.length];
  const bg = STICKER_COLOURS[i % STICKER_COLOURS.length];
  const round = i % 3 === 0;
  const tex = canvasTexture(1, round ? 1 : 0.6, (ctx, W, H) => {
    ctx.fillStyle = bg;
    if (round) {
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = bg === '#111111' || bg === '#d4141c' ? '#ffffff' : '#111111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, text, W * 0.8, H * 0.55);
    ctx.fillText(text, W / 2, H * 0.54);
  }, 128);
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.7 });
}

// ---- The whole object -------------------------------------------------------------------------

export function buildPole(experiences: readonly Experience[]) {
  const root = new THREE.Group();

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 6.6, 40), metal);
  pole.position.y = -0.2;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal);
  cap.position.y = 3.13;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.12, 40), metal);
  base.position.y = -3.5;
  root.add(pole, cap, base);

  for (let i = 0; i < 16; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.16, i % 3 === 0 ? 0.16 : 0.1), sticker(i));
    const a = i * 2.39;
    const y = -3 + ((i * 0.37) % 5.6);
    s.position.set(Math.sin(a) * 0.1, y, Math.cos(a) * 0.1);
    s.rotation.set(0, a, (i % 5) * 0.12 - 0.24);
    root.add(s);
  }

  const parts: SignPart[] = experiences.map((experience, i) => {
    const place = PLACES[i % PLACES.length];
    const built = BUILDERS[experience.kind]();
    const group = new THREE.Group();
    group.position.y = place.y;
    group.rotation.y = place.angle;
    group.add(built.group);
    root.add(group);

    const hits: THREE.Object3D[] = [];
    built.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.userData.slug = experience.slug;
        hits.push(o);
      }
    });
    return { experience, group, hits, glow: built.glow, focus: built.focus, angle: place.angle, size: built.size, tick: built.tick };
  });

  return { root, parts };
}
