import type { SignKind } from './content';

/**
 * Live demos in the experience panel (signs.ts): one small interactive
 * simulation per experience, showing what the project does. Each one is
 * rebuilt from its report (mission order, categories, control law, data
 * pipeline…) with made-up sample data. mountDemo() returns a function that
 * stops it; signs.ts calls it when the panel closes.
 */

type Stop = () => void;

interface Kit {
  screen: HTMLElement;
  controls: HTMLElement;
  button(label: string, onClick: () => void): HTMLButtonElement;
  range(label: string, min: number, max: number, value: number, onInput: (v: number) => void): HTMLInputElement;
  caption(text: string): void;
  note(text: string): void;
}

const VW = 400; // canvases draw in this virtual size, scaled to fit
const VH = 250;
const INK = '#f4f2ee';
const DIM = 'rgba(244, 242, 238, 0.5)';
const ACCENT = '#ff6a00';
const GOOD = '#4ade80';
const ALERT = '#ff4d3d';
const SANS = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function mountDemo(kind: SignKind, host: HTMLElement): Stop {
  const root = el('section', 'demo');
  const bar = el('div', 'demo__bar');
  const noteEl = el('span', 'demo__note', 'Simulated · rebuilt from the report');
  bar.append(el('span', 'demo__dot'), el('span', 'demo__label', 'Live demo'), noteEl);
  const screen = el('div', 'demo__screen');
  const controls = el('div', 'demo__controls');
  const cap = el('p', 'demo__caption');
  root.append(bar, screen, controls, cap);
  host.append(root);

  const kit: Kit = {
    screen,
    controls,
    button(label, onClick) {
      const b = el('button', 'demo__btn', label);
      b.type = 'button';
      b.addEventListener('click', onClick);
      controls.append(b);
      return b;
    },
    range(label, min, max, value, onInput) {
      const wrap = el('label', 'demo__range', label);
      const input = el('input');
      Object.assign(input, { type: 'range', min: String(min), max: String(max), value: String(value) });
      input.addEventListener('input', () => onInput(Number(input.value)));
      wrap.append(input);
      controls.append(wrap);
      return input;
    },
    caption: (text) => (cap.textContent = text),
    note: (text) => (noteEl.textContent = text),
  };
  return DEMOS[kind](kit);
}

// ---------------------------------------------------------------- helpers

/** A canvas filling the demo screen, drawn in VW × VH units. */
function canvas2d(screen: HTMLElement) {
  const cv = el('canvas');
  screen.append(cv);
  const ctx = cv.getContext('2d')!;
  const fit = () => {
    const w = cv.clientWidth;
    const hgt = cv.clientHeight;
    if (!w || !hgt) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(hgt * dpr);
    ctx.setTransform((dpr * w) / VW, 0, 0, (dpr * hgt) / VH, 0, 0);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(cv);
  fit();
  return {
    cv,
    ctx,
    clear(color = '#0b0b0d') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, VW, VH);
    },
    at(e: PointerEvent) {
      const r = cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * VW, y: ((e.clientY - r.top) / r.height) * VH };
    },
    dispose: () => ro.disconnect(),
  };
}

/** requestAnimationFrame loop with a clamped time step; returns stop. */
function loop(fn: (time: number, dt: number) => void): Stop {
  let raf = 0;
  let last = 0;
  const step = (now: number) => {
    raf = requestAnimationFrame(step);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    fn(now / 1000, dt);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size?: number; color?: string; weight?: number; align?: CanvasTextAlign; mono?: boolean } = {}) {
  ctx.font = `${o.weight ?? 600} ${o.size ?? 8}px ${o.mono ? MONO : SANS}`;
  ctx.fillStyle = o.color ?? INK;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function line(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number, dash: number[] = []) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Fixed-size history of samples. */
class Series {
  values: number[] = [];
  constructor(readonly cap: number) {}
  push(v: number) {
    this.values.push(v);
    if (this.values.length > this.cap) this.values.shift();
  }
}

/** A small Grafana-like time chart. */
function chart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  series: { s: Series; color: string; fill?: boolean }[],
  range: [number, number],
  o: { threshold?: number; value?: string; valueColor?: string; playhead?: number } = {},
) {
  box(ctx, x, y, w, h, 4, '#111217', 'rgba(255,255,255,0.08)');
  text(ctx, title, x + 6, y + 8, { size: 6.5, color: DIM });
  if (o.value) text(ctx, o.value, x + w - 6, y + 9, { size: 10, weight: 700, align: 'right', color: o.valueColor ?? INK, mono: true });
  const top = y + 18;
  const bottom = y + h - 5;
  const left = x + 5;
  const right = x + w - 5;
  const toY = (v: number) => bottom - ((clamp(v, range[0], range[1]) - range[0]) / (range[1] - range[0])) * (bottom - top);
  for (let i = 1; i < 4; i++) line(ctx, [[left, top + ((bottom - top) * i) / 4], [right, top + ((bottom - top) * i) / 4]], 'rgba(255,255,255,0.05)', 0.5);
  if (o.threshold !== undefined) line(ctx, [[left, toY(o.threshold)], [right, toY(o.threshold)]], 'rgba(255,77,61,0.8)', 0.8, [3, 3]);
  for (const { s, color, fill } of series) {
    const n = s.values.length;
    if (n < 2) continue;
    const dx = (right - left) / (s.cap - 1);
    const x0 = right - (n - 1) * dx;
    const pts = s.values.map((v, i) => [x0 + i * dx, toY(v)] as [number, number]);
    if (fill) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], bottom);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(pts[n - 1][0], bottom);
      ctx.fillStyle = color.replace(')', ', 0.16)').replace('rgb(', 'rgba(');
      ctx.fill();
    }
    line(ctx, pts, color, 1.1);
  }
  if (o.playhead !== undefined) {
    const px = left + o.playhead * (right - left);
    line(ctx, [[px, top - 2], [px, bottom]], INK, 0.8);
  }
}

// ------------------------------------------------------------ PalletLens

/** Drone inspection of one rack: serpentine mission, PID alignment, capture, tag reading. */
function droneDemo(kit: Kit): Stop {
  const g = canvas2d(kit.screen);
  const { ctx } = g;
  kit.caption(
    'A drone inspects one rack in serpentine order (A1 → A4, B4 → B1, C1 → C4), aligns on each tag with a PID controller, captures from its 20° camera, then detects the tag and reads its text and barcode. Slots without a tag are skipped. Click a slot to send the drone there. Tags are fictitious, as in the project.',
  );

  const ORDER = ['A1', 'A2', 'A3', 'A4', 'B4', 'B3', 'B2', 'B1', 'C1', 'C2', 'C3', 'C4'];
  const EMPTY = new Set(['B2', 'C4']);
  const RACK = { x: 14, y: 40, w: 180, h: 186 };
  const cellW = RACK.w / 4;
  const cellH = RACK.h / 3;
  interface Slot { id: string; cx: number; floor: number; tagX: number; tagY: number; sku: string; lot: string; ean: string; conf: number }
  const slots = new Map<string, Slot>();
  ORDER.forEach((id, i) => {
    const level = 'ABC'.indexOf(id[0]);
    const col = Number(id[1]) - 1;
    const cx = RACK.x + (col + 0.5) * cellW;
    const floor = RACK.y + (3 - level) * cellH - 5;
    const n = (30417 + i * 7331) % 90000;
    slots.set(id, {
      id,
      cx,
      floor,
      tagX: cx,
      tagY: floor - 19,
      sku: `PL-${String(n).padStart(5, '0')}`,
      lot: `LOT 26-${String(31 + i * 17).padStart(3, '0')}`,
      ean: `3760${String(1234567 + i * 98731).slice(0, 7)}${(i * 7) % 10}${(i * 3) % 10}`,
      conf: 0.9 + ((i * 37) % 9) / 100,
    });
  });

  const home = { x: RACK.x + RACK.w / 2, y: RACK.y - 18 };
  const p = { ...home };
  const v = { x: 0, y: 0 };
  let queue: string[] = [];
  let current: Slot | null = null;
  let phase: 'idle' | 'fly' | 'capture' | 'analyse' = 'idle';
  let timer = 0;
  let idleFor = 2.5;
  let shown: Slot | null = null;
  const results: { id: string; text: string; ok: boolean }[] = [];

  function next() {
    current = null;
    while (queue.length) {
      const id = queue.shift()!;
      if (EMPTY.has(id)) {
        results.push({ id, text: 'no tag actor · skipped', ok: false });
        continue;
      }
      current = slots.get(id)!;
      break;
    }
    phase = current ? 'fly' : 'idle';
    timer = 0;
    idleFor = 0;
  }
  function run() {
    results.length = 0;
    queue = ORDER.slice();
    next();
  }
  function reset() {
    queue = [];
    current = null;
    shown = null;
    phase = 'idle';
    idleFor = -6; // stay put a while before the mission loops again
    results.length = 0;
    Object.assign(p, home);
    v.x = v.y = 0;
  }
  kit.button('Run mission', run);
  kit.button('Reset', reset);

  g.cv.addEventListener('pointerdown', (e) => {
    const { x, y } = g.at(e);
    if (x < RACK.x || x > RACK.x + RACK.w || y < RACK.y || y > RACK.y + RACK.h) return;
    const id = 'ABC'[2 - Math.floor((y - RACK.y) / cellH)] + (Math.floor((x - RACK.x) / cellW) + 1);
    queue = [id];
    next();
  });

  function drawDrone(time: number) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(clamp(v.x * 0.006, -0.35, 0.35));
    line(ctx, [[-12, 0], [12, 0]], '#9aa0a8', 2);
    for (const s of [-12, 12]) {
      ctx.beginPath();
      ctx.ellipse(s, -2, 7, 1.4 + Math.abs(Math.sin(time * 40 + s)) * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,225,232,0.45)';
      ctx.fill();
    }
    box(ctx, -6, -3, 12, 6, 2, '#2b2f36', '#666c75', 0.6);
    ctx.beginPath();
    ctx.arc(0, 4.5, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, -1, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = Math.sin(time * 6) > 0 ? GOOD : '#1a3';
    ctx.fill();
    ctx.restore();
  }

  function drawTag(s: Slot, cx: number, cy: number, z: number) {
    const w = 14 * z;
    const hgt = 9 * z;
    box(ctx, cx - w / 2, cy - hgt / 2, w, hgt, 0.6 * z, '#f3f1ea');
    text(ctx, s.sku, cx - w / 2 + 1.2 * z, cy - hgt / 2 + 1.7 * z, { size: 1.5 * z, color: '#111', weight: 800 });
    text(ctx, s.lot, cx - w / 2 + 1.2 * z, cy - hgt / 2 + 3.4 * z, { size: 1.1 * z, color: '#333', weight: 600 });
    // barcode
    let bx = cx - w / 2 + 1.2 * z;
    for (let i = 0; i < 26; i++) {
      const bw = ((Number(s.ean[i % 13]) + i) % 3) * 0.14 * z + 0.12 * z;
      if (i % 2 === 0) {
        ctx.fillStyle = '#111';
        ctx.fillRect(bx, cy + 0.2 * z, bw, 2.8 * z);
      }
      bx += bw + 0.12 * z;
    }
  }

  const CAM = { x: 206, y: 40, w: 182, h: 108 };
  function drawCamera(time: number) {
    ctx.save();
    box(ctx, CAM.x, CAM.y, CAM.w, CAM.h, 4, '#16130f');
    ctx.clip();
    // the nearest occupied slot, seen through the 20° camera (zoomed, moves with the drone)
    let near: Slot | null = null;
    let best = Infinity;
    for (const s of slots.values()) {
      if (EMPTY.has(s.id)) continue;
      const d = Math.hypot(s.tagX - p.x, s.tagY - 14 - p.y);
      if (d < best) [best, near] = [d, s];
    }
    const z = 4.6;
    if (near) {
      const cx = CAM.x + CAM.w / 2 - (p.x - near.tagX) * z;
      const cy = CAM.y + CAM.h / 2 - (p.y + 14 - near.tagY) * z;
      // uprights and beam
      ctx.fillStyle = '#c2541b';
      ctx.fillRect(cx - (cellW / 2) * z - 6, cy - 80, 9, 220);
      ctx.fillRect(cx + (cellW / 2) * z - 3, cy - 80, 9, 220);
      ctx.fillStyle = '#2f5d8a';
      ctx.fillRect(cx - 120, cy + 4 * z + 2 * z, 240, 8);
      // box on its pallet
      box(ctx, cx - 15 * z, cy - 18 * z, 30 * z, 24 * z, 2, '#8a6a43');
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(cx - 15 * z, cy - 8 * z, 30 * z, 2);
      drawTag(near, cx, cy, z);
      if (shown === near) {
        const k = timer;
        const w = 14 * z;
        const hgt = 9 * z;
        if (k > 0.15) {
          box(ctx, cx - w / 2 - 3, cy - hgt / 2 - 3, w + 6, hgt + 6, 2, undefined, GOOD, 1.2);
          box(ctx, cx - w / 2 - 3, cy - hgt / 2 - 13, 52, 10, 2, GOOD);
          text(ctx, `tag ${near.conf.toFixed(2)}`, cx - w / 2 + 1, cy - hgt / 2 - 8, { size: 6.5, color: '#04210f', weight: 800 });
        }
        if (k > 0.5) box(ctx, cx - w / 2 + 2, cy - hgt / 2 + 2, w * 0.72, 3.6 * z, 1, undefined, ACCENT, 1);
        if (k > 0.85) box(ctx, cx - w / 2 + 2, cy + 0.6, w * 0.8, 3.2 * z, 1, undefined, '#5ab4ff', 1);
      }
    }
    if (phase === 'capture') {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.5 - timer * 2)})`;
      ctx.fillRect(CAM.x, CAM.y, CAM.w, CAM.h);
    }
    ctx.restore();
    text(ctx, 'cam1 · 1920×1080 · FOV 20°', CAM.x + 6, CAM.y + 8, { size: 6.5, color: INK });
    ctx.beginPath();
    ctx.arc(CAM.x + CAM.w - 40, CAM.y + 8, 2, 0, Math.PI * 2);
    ctx.fillStyle = Math.sin(time * 4) > -0.3 ? ALERT : 'transparent';
    ctx.fill();
    text(ctx, 'UDP · MJPEG', CAM.x + CAM.w - 6, CAM.y + 8, { size: 6, color: DIM, align: 'right' });
  }

  const stop = loop((time, dt) => {
    // ---- mission ----
    let target = home;
    if (current) target = { x: current.tagX, y: current.tagY - 14 };
    if (phase === 'fly' || phase === 'idle') {
      // smoothed PID-like velocity control towards the target
      const kp = 16;
      const kd = 7.6;
      v.x += (kp * (target.x - p.x) - kd * v.x) * dt;
      v.y += (kp * (target.y - p.y) - kd * v.y) * dt;
    } else {
      v.x *= 0.8;
      v.y *= 0.8;
    }
    p.x += v.x * dt;
    p.y += v.y * dt;
    timer += dt;
    if (phase === 'fly' && Math.hypot(target.x - p.x, target.y - p.y) < 0.6 && Math.hypot(v.x, v.y) < 1.5) {
      phase = 'capture';
      timer = 0;
    } else if (phase === 'capture' && timer > 0.35) {
      phase = 'analyse';
      shown = current;
      timer = 0;
    } else if (phase === 'analyse' && timer > 1.5 && current) {
      results.push({ id: current.id, text: `${current.sku}  ${current.lot}  ${current.conf.toFixed(2)}`, ok: true });
      next();
    } else if (phase === 'idle') {
      idleFor += dt;
      if (idleFor > 4) run();
    }

    // ---- draw ----
    g.clear();
    const read = results.filter((r) => r.ok).length;
    text(ctx, 'RACK R1 · SERPENTINE MISSION', RACK.x, 14, { size: 7, weight: 700, color: DIM });
    text(ctx, `${read} tags read · ${results.length - read} skipped`, RACK.x, 25, { size: 7, color: INK, mono: true });
    // path
    line(ctx, ORDER.map((id) => [slots.get(id)!.tagX, slots.get(id)!.tagY - 14] as [number, number]), 'rgba(255,106,0,0.25)', 0.8, [2, 3]);
    // rack
    for (let level = 0; level < 3; level++) {
      const floor = RACK.y + (3 - level) * cellH - 5;
      ctx.fillStyle = '#2f5d8a';
      ctx.fillRect(RACK.x, floor, RACK.w, 4);
      text(ctx, 'ABC'[level], RACK.x - 8, floor - cellH / 2, { size: 7, color: DIM, align: 'center' });
    }
    for (let c = 0; c <= 4; c++) {
      ctx.fillStyle = '#c2541b';
      ctx.fillRect(RACK.x + c * cellW - 1.5, RACK.y, 3, RACK.h);
    }
    for (const s of slots.values()) {
      if (EMPTY.has(s.id)) {
        text(ctx, 'empty', s.cx, s.floor - 14, { size: 6, color: 'rgba(255,255,255,0.25)', align: 'center' });
        continue;
      }
      ctx.fillStyle = '#6b4f2e';
      ctx.fillRect(s.cx - 17, s.floor - 4, 34, 4);
      box(ctx, s.cx - 15, s.floor - 34, 30, 30, 1.5, '#8a6a43');
      const done = results.some((r) => r.id === s.id && r.ok);
      box(ctx, s.tagX - 7, s.tagY - 4.5, 14, 9, 1, done ? '#d9f7e3' : '#f3f1ea', done ? GOOD : undefined, 0.8);
      text(ctx, s.id, s.cx, s.floor - 28, { size: 6, color: 'rgba(255,255,255,0.55)', align: 'center', weight: 700 });
    }
    if (current) box(ctx, current.cx - cellW / 2 + 2, current.floor - cellH + 7, cellW - 4, cellH - 4, 3, undefined, 'rgba(255,106,0,0.7)', 1);
    drawDrone(time);
    drawCamera(time);
    // results
    text(ctx, 'RESULTS', CAM.x, CAM.y + CAM.h + 12, { size: 7, weight: 700, color: DIM });
    results.slice(-5).forEach((r, i) => {
      const y = CAM.y + CAM.h + 24 + i * 11;
      text(ctx, r.id, CAM.x, y, { size: 7, mono: true, weight: 700, color: r.ok ? GOOD : DIM });
      text(ctx, r.text, CAM.x + 16, y, { size: 6.6, mono: true, color: r.ok ? INK : DIM });
    });
  });
  return () => {
    stop();
    g.dispose();
  };
}

// ------------------------------------------------------- Phantom Posture

/** Someone at a desk, a sensor on the back, a webcam, and the live dashboard. */
function postureDemo(kit: Kit): Stop {
  const g = canvas2d(kit.screen);
  const { ctx } = g;
  kit.caption(
    'The MPU6050 on the back measures the torso’s lean, the webcam (MediaPipe) the head’s. Angles go through MQTT → Telegraf → InfluxDB and show live in Grafana; the avatar follows. Move the slider to lean, or replay the last 10 s from the database. The 20° alert threshold is for the demo.',
  );

  const THRESHOLD = 20;
  const RATE = 20; // samples per second
  const torsoS = new Series(RATE * 10);
  const headS = new Series(RATE * 10);
  let torso = 4;
  let head = 6;
  let target = 4;
  let auto = true;
  let autoT = 0;
  let over = 0;
  let acc = 0;
  let mode: 'live' | 'replay' = 'live';
  let replay = { torso: [] as number[], head: [] as number[], i: 0 };

  const slider = kit.range('Lean', 0, 40, 4, (val) => {
    auto = false;
    target = val;
    autoBtn.classList.remove('is-on');
  });
  const autoBtn = kit.button('Auto session', () => {
    auto = !auto;
    autoT = 0;
    autoBtn.classList.toggle('is-on', auto);
  });
  autoBtn.classList.add('is-on');
  kit.button('Replay 10 s', () => {
    if (torsoS.values.length < RATE) return;
    mode = 'replay';
    replay = { torso: torsoS.values.slice(), head: headS.values.slice(), i: 0 };
  });

  const FLOOR = 232;
  function drawAvatar(time: number, t: number, hd: number, alert: boolean) {
    // desk + laptop
    ctx.fillStyle = '#3a2f26';
    ctx.fillRect(112, 160, 66, 5);
    ctx.fillRect(170, 165, 4, FLOOR - 165);
    line(ctx, [[134, 158], [160, 158]], '#8d939c', 2);
    line(ctx, [[160, 158], [166, 132]], '#8d939c', 2.4);
    ctx.beginPath();
    ctx.arc(165.6, 134, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = GOOD;
    ctx.fill();
    // chair
    ctx.fillStyle = '#26282d';
    ctx.fillRect(56, 176, 44, 5);
    line(ctx, [[58, 176], [52, 128]], '#26282d', 4);
    line(ctx, [[78, 181], [78, 220]], '#26282d', 3);
    line(ctx, [[64, 224], [92, 224]], '#26282d', 3);
    // person
    const hip = { x: 80, y: 170 };
    const rad = (d: number) => (d * Math.PI) / 180;
    const sh = { x: hip.x + Math.sin(rad(t)) * 50, y: hip.y - Math.cos(rad(t)) * 50 };
    const neck = { x: sh.x + Math.sin(rad(hd)) * 8, y: sh.y - Math.cos(rad(hd)) * 8 };
    const headC = { x: sh.x + Math.sin(rad(hd)) * 19, y: sh.y - Math.cos(rad(hd)) * 19 };
    line(ctx, [[hip.x, hip.y], [118, 172], [120, FLOOR - 2]], '#3b4250', 9);
    line(ctx, [[hip.x, hip.y], [sh.x, sh.y]], '#cfd3da', 13);
    const elbow = { x: (sh.x + 140) / 2 - 2, y: Math.max(sh.y, 150) + 12 };
    line(ctx, [[sh.x, sh.y], [elbow.x, elbow.y], [140, 156]], '#bfc4cc', 6);
    line(ctx, [[sh.x, sh.y], [neck.x, neck.y]], '#e0b48f', 5);
    ctx.beginPath();
    ctx.arc(headC.x, headC.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#e0b48f';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headC.x - 2, headC.y - 3, 10, Math.PI * 0.95, Math.PI * 1.9);
    ctx.fillStyle = '#2a1d16';
    ctx.fill();
    // pain in the lower back
    if (alert) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      const gx = hip.x + Math.sin(rad(t)) * 14 - 6;
      const gy = hip.y - Math.cos(rad(t)) * 14;
      const grad = ctx.createRadialGradient(gx, gy, 1, gx, gy, 18 + pulse * 6);
      grad.addColorStop(0, 'rgba(255,60,40,0.75)');
      grad.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - 30, gy - 30, 60, 60);
    }
    // the sensor on the back (ESP32 + MPU6050)
    const sx = hip.x + Math.sin(rad(t)) * 32 - Math.cos(rad(t)) * 7;
    const sy = hip.y - Math.cos(rad(t)) * 32 - Math.sin(rad(t)) * 7;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rad(t));
    box(ctx, -3, -5, 6, 10, 1, ACCENT);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(sx, sy - 2, 1, 0, Math.PI * 2);
    ctx.fillStyle = Math.sin(time * 9) > 0 ? '#fff' : ACCENT;
    ctx.fill();
    // MediaPipe landmarks and the webcam's view
    line(ctx, [[165.6, 134], [headC.x + 8, headC.y]], 'rgba(74,222,128,0.18)', 6);
    line(ctx, [[headC.x, headC.y], [neck.x, neck.y], [sh.x, sh.y]], 'rgba(74,222,128,0.9)', 0.7);
    for (const q of [headC, neck, sh]) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = GOOD;
      ctx.fill();
    }
    line(ctx, [[20, FLOOR], [185, FLOOR]], 'rgba(255,255,255,0.15)', 1);
  }

  function drawPipeline(time: number) {
    const nodes = ['ESP32 · cam', 'MQTT', 'Telegraf', mode === 'replay' ? 'InfluxDB → replay' : 'InfluxDB', 'Grafana'];
    const w = 66;
    const gap = (VW - 20 - nodes.length * w) / (nodes.length - 1);
    nodes.forEach((n, i) => {
      const x = 10 + i * (w + gap);
      box(ctx, x, 6, w, 14, 7, '#16171b', 'rgba(255,255,255,0.14)', 0.6);
      text(ctx, n, x + w / 2, 13.5, { size: 6.4, align: 'center', color: INK });
      if (i < nodes.length - 1) {
        line(ctx, [[x + w + 2, 13], [x + w + gap - 2, 13]], 'rgba(255,255,255,0.18)', 0.6);
        const k = (time * 1.4 + i * 0.3) % 1;
        ctx.beginPath();
        ctx.arc(x + w + 2 + k * (gap - 4), 13, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.fill();
      }
    });
  }

  const stop = loop((time, dt) => {
    if (auto) {
      autoT = (autoT + dt) % 15;
      // slowly slouching over the work, then sitting up again
      target = autoT < 9 ? 4 + 30 * Math.pow(autoT / 9, 1.5) : autoT < 11 ? 34 : 4;
      slider.value = String(Math.round(target));
    }
    torso += (target - torso) * Math.min(1, dt * 1.8);
    head += (torso * 0.75 + 3 - head) * Math.min(1, dt * 2.5);
    acc += dt;
    while (acc > 1 / RATE) {
      acc -= 1 / RATE;
      torsoS.push(torso + (Math.random() - 0.5) * 0.8);
      headS.push(head + (Math.random() - 0.5) * 1.6);
      if (mode === 'replay') replay.i += 1;
    }
    let t = torso;
    let hd = head;
    if (mode === 'replay') {
      if (replay.i >= replay.torso.length) mode = 'live';
      else {
        t = replay.torso[replay.i];
        hd = replay.head[replay.i];
      }
    }
    over = t > THRESHOLD ? over + dt : 0;
    const alert = over > 2;

    g.clear();
    drawPipeline(time);
    drawAvatar(time, t, hd, alert);
    if (alert) {
      box(ctx, 14, 30, 160, 16, 8, 'rgba(255,77,61,0.16)', ALERT, 0.8);
      text(ctx, `⚠ Posture deviation · torso ${t.toFixed(0)}° > ${THRESHOLD}°`, 94, 38.5, { size: 6.8, align: 'center', color: '#ffd2cc', weight: 700 });
    } else if (mode === 'replay') {
      box(ctx, 14, 30, 160, 16, 8, 'rgba(90,180,255,0.14)', '#5ab4ff', 0.8);
      text(ctx, 'Replay · recorded session from InfluxDB', 94, 38.5, { size: 6.8, align: 'center', color: '#cfe8ff', weight: 700 });
    }
    const replaying = mode === 'replay' ? replay.i / Math.max(1, replay.torso.length) : undefined;
    const tSeries = mode === 'replay' ? Object.assign(new Series(torsoS.cap), { values: replay.torso }) : torsoS;
    const hSeries = mode === 'replay' ? Object.assign(new Series(headS.cap), { values: replay.head }) : headS;
    chart(ctx, 192, 30, 200, 104, 'Torso pitch · MPU6050 (°)', [{ s: tSeries, color: 'rgb(115,191,105)', fill: true }], [0, 45], {
      threshold: THRESHOLD,
      value: `${t.toFixed(1)}°`,
      valueColor: t > THRESHOLD ? ALERT : 'rgb(115,191,105)',
      playhead: replaying,
    });
    chart(ctx, 192, 140, 200, 104, 'Head pitch · MediaPipe (°)', [{ s: hSeries, color: 'rgb(242,204,12)', fill: true }], [0, 45], {
      value: `${hd.toFixed(1)}°`,
      valueColor: 'rgb(242,204,12)',
      playhead: replaying,
    });
  });
  return () => {
    stop();
    g.dispose();
  };
}

// --------------------------------------------------------- The Classifier

const CATEGORIES = [
  'RFQ › Lab Sales',
  'RFQ › HC Sales',
  'RFQ › Med Sales',
  'Tech Inquiries › Airflow',
  'Tech Inquiries › ULT',
  'Tech Inquiries › Thermostatic',
  'Tech Inquiries › General',
  'Job Application',
  'Collab',
  'Internal Mail',
  'System Notification',
  'Spam',
];

interface Mail { from: string; subject: string; body: string; signature: string; lang?: string; label: string; conf: number }

// fictitious samples, one per kind of e-mail the report describes
const MAILS: Mail[] = [
  { from: 'procurement@unilab.example', subject: 'Quotation request – 4 biosafety cabinets', body: 'Could you send us a quote for four class II cabinets for our new lab?', signature: 'Best regards, J. Tan — Procurement', label: 'RFQ › Lab Sales', conf: 0.94 },
  { from: 'achats@chu-nord.example', subject: 'Demande de devis : incubateurs CO2', body: 'Nous souhaitons un devis pour 6 incubateurs CO2 pour notre service.', signature: 'Cordialement, Service achats', lang: 'FR', label: 'RFQ › HC Sales', conf: 0.91 },
  { from: 'lab.ops@biocore.example', subject: 'Airflow alarm on our cabinet', body: 'The airflow alarm keeps going off on our cabinet since Monday. Can someone help?', signature: 'Thanks, Lab operations', label: 'Tech Inquiries › Airflow', conf: 0.89 },
  { from: 'no-reply@it.example', subject: 'Your password expires in 3 days', body: 'This is an automated message. Please update your password.', signature: '', label: 'System Notification', conf: 0.96 },
  { from: 'a.lim@mail.example', subject: 'Application – Field Service Engineer', body: 'Please find attached my CV for the Field Service Engineer position.', signature: 'Kind regards, A. Lim', label: 'Job Application', conf: 0.97 },
  { from: 'research@genelab.example', subject: 'Quote needed: 2 ULT freezers', body: 'We need two ULT freezers at -80 °C for the research lab. Price and lead time?', signature: 'Dr. R. Ng', label: 'Tech Inquiries › ULT', conf: 0.58 },
  { from: 'events@medlab-asia.example', subject: 'Exhibitor invitation – Medlab Asia', body: 'We would be glad to welcome your company as an exhibitor this year.', signature: 'Events team', label: 'Collab', conf: 0.86 },
  { from: 'winner@prizes.example', subject: 'Congratulations! You won a gift card', body: 'Click here to claim your $500 gift card now!!!', signature: '', label: 'Spam', conf: 0.99 },
  { from: 'hr@company.example', subject: 'Town hall – agenda', body: 'Please find the agenda for Friday’s town hall attached.', signature: 'HR team', label: 'Internal Mail', conf: 0.9 },
  { from: 'biomed@clinic.example', subject: 'Price for sterilizers', body: 'Please quote 3 sterilizers for our medical centre, delivered to Penang.', signature: 'Biomedical dept.', label: 'RFQ › Med Sales', conf: 0.88 },
  { from: 'qc@pharma.example', subject: 'Bath not reaching setpoint', body: 'Our thermostatic bath stays 4 °C below the setpoint. Any advice?', signature: 'QC lab', label: 'Tech Inquiries › Thermostatic', conf: 0.87 },
];

/** A web mailbox where incoming e-mails are cleaned, embedded and sorted; users correct and retrain. */
function mailDemo(kit: Kit): Stop {
  kit.screen.classList.add('demo__screen--dom');
  kit.caption(
    'Incoming e-mails are fetched from Outlook (Microsoft Graph), cleaned (HTML, signatures), translated to English if needed, embedded (MiniLM) and classified, with a second model for sub-categories. Open an e-mail to correct the AI, then retrain. Sample e-mails are made up.',
  );
  const wrap = el('div', 'mail');
  const inbox = el('ul', 'mail__inbox');
  const side = el('div', 'mail__side');
  const steps = el('ol', 'mail__steps');
  const STEPS = ['Graph API', 'Clean', 'Translate', 'MiniLM', 'Classify'];
  for (const s of STEPS) steps.append(el('li', '', s));
  const open = el('div', 'mail__open');
  const counts = el('ul', 'mail__counts');
  side.append(steps, open, counts);
  wrap.append(inbox, side);
  kit.screen.append(wrap);

  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  const tally = new Map<string, number>();
  let corrections = 0;
  let version = 1;
  let picked: { row: HTMLLIElement; mail: Mail } | null = null;
  let userPicked = false;
  let n = 0;

  const retrain = kit.button('Retrain (0)', () => {
    if (!corrections) return;
    retrain.disabled = true;
    retrain.textContent = 'Retraining…';
    later(1600, () => {
      version += 1;
      retrain.textContent = `Model v${version} ✓`;
      corrections = 0;
      later(1400, () => {
        retrain.disabled = false;
        retrain.textContent = 'Retrain (0)';
      });
    });
  });
  const model = el('span', 'demo__status', 'Model v1');
  kit.controls.append(model);

  function renderCounts() {
    const top = ['RFQ', 'Tech Inquiries', 'Job Application', 'Collab', 'Internal Mail', 'System Notification', 'Spam'];
    const max = Math.max(1, ...tally.values());
    counts.replaceChildren(
      ...top.map((c) => {
        const li = el('li');
        const v = tally.get(c) ?? 0;
        const barEl = el('i');
        barEl.style.width = `${(v / max) * 100}%`;
        li.append(el('span', '', c), barEl, el('b', '', String(v)));
        return li;
      }),
    );
  }

  function show(row: HTMLLIElement, mail: Mail) {
    picked = { row, mail };
    for (const r of inbox.children) r.classList.toggle('is-open', r === row);
    const select = el('select');
    for (const c of CATEGORIES) select.append(Object.assign(el('option', '', c), { value: c, selected: c === row.dataset.label }));
    select.addEventListener('change', () => {
      row.dataset.label = select.value;
      const chip = row.querySelector('.mail__chip')!;
      chip.textContent = `${select.value} ✎`;
      chip.classList.remove('is-low');
      chip.classList.add('is-fixed');
      corrections += 1;
      retrain.textContent = `Retrain (${corrections})`;
    });
    const body = el('p', 'mail__body', mail.lang ? `[${mail.lang} → EN] ${translate(mail)}` : mail.body);
    const sig = mail.signature ? el('p', 'mail__sig', mail.signature) : null;
    open.replaceChildren(el('p', 'mail__subject', mail.subject), body, ...(sig ? [sig] : []), el('span', 'mail__ai', `AI ${Math.round(mail.conf * 100)}% ·`), select);
  }

  function translate(m: Mail) {
    return m.lang === 'FR' ? 'We would like a quote for 6 CO2 incubators for our department.' : m.body;
  }

  function arrive() {
    const mail = MAILS[n++ % MAILS.length];
    const row = el('li');
    const chip = el('span', 'mail__chip', '…');
    row.append(el('span', 'mail__from', mail.from), el('span', 'mail__subj', mail.subject), chip);
    row.addEventListener('click', () => {
      userPicked = true;
      show(row, mail);
    });
    inbox.prepend(row);
    while (inbox.children.length > 7) {
      const gone = inbox.lastElementChild as HTMLLIElement;
      if (picked?.row === gone) picked = null;
      gone.remove();
    }
    // the pipeline, one step at a time
    const lis = [...steps.children];
    lis.forEach((li, i) =>
      later(i * 260, () => {
        lis.forEach((x) => x.classList.remove('is-on'));
        li.classList.add('is-on');
        li.classList.toggle('is-skip', i === 2 && !mail.lang);
      }),
    );
    later(STEPS.length * 260, () => {
      lis.forEach((x) => x.classList.remove('is-on'));
      row.dataset.label = mail.label;
      chip.textContent = `${mail.label} · ${Math.round(mail.conf * 100)}%`;
      chip.classList.toggle('is-low', mail.conf < 0.7);
      const topCat = mail.label.split(' › ')[0];
      tally.set(topCat, (tally.get(topCat) ?? 0) + 1);
      renderCounts();
      if (!userPicked) show(row, mail);
    });
  }

  renderCounts();
  arrive();
  const tick = setInterval(arrive, 2600);
  return () => {
    clearInterval(tick);
    timers.forEach(clearTimeout);
  };
}

// --------------------------------------------------------- First Contact

/** The QT robot reacts to being touched: the touch's signal is cut into features and labelled. */
function robotDemo(kit: Kit): Stop {
  const g = canvas2d(kit.screen);
  const { ctx } = g;
  kit.note('Illustration · no report for this project');
  kit.caption(
    'Touch the robot — tap, stroke, or press and hold — on its head, arms or body. The touch signal is cut into features (duration, energy, motion) and labelled, and QT reacts. A simplified illustration of detecting physical interactions with signal processing and machine learning.',
  );

  const signal = new Series(200);
  const CX = 100;
  type Part = 'head' | 'left arm' | 'right arm' | 'body';
  type Label = 'tap' | 'stroke' | 'press';
  let press: { t0: number; part: Part; path: number; energy: number; frames: number; x: number; y: number; speed: number } | null = null;
  let mood: { kind: 'happy' | 'surprised' | 'annoyed' | 'wave'; say: string; until: number } | null = null;
  let last: { label: Label; conf: number; part: Part; d: number; e: number; m: number } | null = null;
  const history: string[] = [];
  let now = 0;
  let idle = 0;
  let ghost: { x: number; y: number } | null = null;
  let script: { at: number; act: () => void }[] = [];

  function partAt(x: number, y: number): Part | null {
    if (Math.abs(x - CX) < 42 && y > 52 && y < 120) return 'head';
    if (x > CX - 62 && x < CX - 38 && y > 132 && y < 212) return 'left arm';
    if (x > CX + 38 && x < CX + 62 && y > 132 && y < 212) return 'right arm';
    if (Math.abs(x - CX) < 44 && y > 124 && y < 236) return 'body';
    return null;
  }
  function begin(x: number, y: number) {
    const part = partAt(x, y);
    if (!part) return;
    press = { t0: now, part, path: 0, energy: 0, frames: 0, x, y, speed: 0 };
  }
  function move(x: number, y: number) {
    if (!press) return;
    const d = Math.hypot(x - press.x, y - press.y);
    press.path += d;
    press.speed = d;
    press.x = x;
    press.y = y;
  }
  function end() {
    if (!press) return;
    const d = now - press.t0;
    const e = press.energy / Math.max(1, press.frames);
    const m = press.path;
    let label: Label;
    let margin: number;
    if (m >= 40) [label, margin] = ['stroke', (m - 40) / 60];
    else if (d < 0.3) [label, margin] = ['tap', (0.3 - d) / 0.3];
    else [label, margin] = ['press', Math.min((d - 0.3) / 0.6, (40 - m) / 40)];
    const conf = clamp(0.7 + margin * 0.3, 0.7, 0.98);
    last = { label, conf, part: press.part, d, e, m };
    history.unshift(`${label} · ${press.part} · ${Math.round(conf * 100)}%`);
    history.length = Math.min(history.length, 3);
    const head = press.part === 'head';
    const arm = press.part.includes('arm');
    mood =
      label === 'press'
        ? { kind: 'annoyed', say: 'Hey, gently!', until: now + 2.2 }
        : label === 'stroke'
          ? { kind: 'happy', say: head ? 'That feels nice' : 'Hehe, that tickles', until: now + 2.2 }
          : arm
            ? { kind: 'wave', say: 'High five!', until: now + 2.2 }
            : { kind: 'surprised', say: head ? 'Oh! Hello!' : 'Yes?', until: now + 2.2 };
    press = null;
  }

  g.cv.addEventListener('pointerdown', (e) => {
    const { x, y } = g.at(e);
    if (!partAt(x, y)) return;
    g.cv.setPointerCapture(e.pointerId);
    script = [];
    ghost = null;
    idle = 0;
    begin(x, y);
  });
  g.cv.addEventListener('pointermove', (e) => {
    const { x, y } = g.at(e);
    move(x, y);
    g.cv.style.cursor = partAt(x, y) ? 'pointer' : 'default';
  });
  const up = () => {
    idle = 0;
    end();
  };
  g.cv.addEventListener('pointerup', up);
  g.cv.addEventListener('pointercancel', up);

  // when nobody touches it for a while, a ghost hand shows the three gestures
  const DEMO_GESTURES = [
    (t: number) => [
      { at: t, act: () => ((ghost = { x: CX + 6, y: 70 }), begin(ghost.x, ghost.y)) },
      { at: t + 0.14, act: end },
      { at: t + 0.9, act: () => (ghost = null) },
    ],
    (t: number) => [
      { at: t, act: () => ((ghost = { x: CX - 28, y: 62 }), begin(ghost.x, ghost.y)) },
      ...Array.from({ length: 24 }, (_, i) => ({
        at: t + 0.04 * (i + 1),
        act: () => {
          ghost = { x: CX - 28 + Math.sin(((i + 1) / 24) * Math.PI) * 56, y: 62 };
          move(ghost.x, ghost.y);
        },
      })),
      { at: t + 1.05, act: end },
      { at: t + 1.6, act: () => (ghost = null) },
    ],
    (t: number) => [
      { at: t, act: () => ((ghost = { x: CX, y: 170 }), begin(ghost.x, ghost.y)) },
      { at: t + 0.9, act: end },
      { at: t + 1.5, act: () => (ghost = null) },
    ],
    (t: number) => [
      { at: t, act: () => ((ghost = { x: CX + 50, y: 190 }), begin(ghost.x, ghost.y)) },
      { at: t + 0.12, act: end },
      { at: t + 0.8, act: () => (ghost = null) },
    ],
  ];
  let demoIndex = 0;

  function drawRobot() {
    const m = mood && mood.until > now ? mood : null;
    // body
    ctx.beginPath();
    ctx.moveTo(CX - 34, 126);
    ctx.lineTo(CX + 34, 126);
    ctx.lineTo(CX + 44, 236);
    ctx.lineTo(CX - 44, 236);
    ctx.closePath();
    ctx.fillStyle = '#e8ebee';
    ctx.fill();
    box(ctx, CX - 10, 116, 20, 12, 3, '#cfd4da');
    // arms (the right one waves)
    const wave = m?.kind === 'wave' ? Math.sin(now * 14) * 0.35 - 1.6 : 0;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(CX + side * 46, 136);
      ctx.rotate(side === 1 ? -wave : 0);
      box(ctx, -8, -6, 16, 44, 7, '#dfe3e7');
      box(ctx, -7, 36, 14, 34, 7, '#d3d8dd');
      ctx.restore();
    }
    // head
    box(ctx, CX - 42, 52, 84, 66, 18, '#eef0f2');
    box(ctx, CX - 32, 64, 64, 42, 8, '#0d1626');
    // face
    const blink = Math.sin(now * 1.3) > 0.985 ? 0.15 : 1;
    ctx.fillStyle = '#8ad8ff';
    for (const s of [-1, 1]) {
      const ex = CX + s * 13;
      ctx.beginPath();
      if (m?.kind === 'happy') {
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#8ad8ff';
        ctx.arc(ex, 86, 6, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        const r = m?.kind === 'surprised' ? 7.5 : 6;
        ctx.ellipse(ex, 84, r, r * blink * (m?.kind === 'annoyed' ? 0.45 : 1), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.beginPath();
    if (m?.kind === 'surprised') ctx.arc(CX, 99, 3, 0, Math.PI * 2);
    else if (m?.kind === 'annoyed') ctx.arc(CX, 104, 6, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(CX, 94, 6, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = '#8ad8ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (m) {
      box(ctx, CX + 20, 26, 82, 18, 9, '#ffffff');
      text(ctx, m.say, CX + 61, 35, { size: 7.5, color: '#111', align: 'center', weight: 700 });
    }
    if (press) {
      ctx.beginPath();
      ctx.arc(press.x, press.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,106,0,0.35)';
      ctx.fill();
    }
    if (ghost) {
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const stop = loop((_time, dt) => {
    now += dt;
    // the touch signal: a contact spike, then a level that rises with motion
    let s = (Math.random() - 0.5) * 0.04;
    if (press) {
      const age = now - press.t0;
      s += 0.3 + Math.exp(-age * 18) * 0.6 + clamp(press.speed / 6, 0, 0.55) + Math.sin(now * 40) * 0.03;
      press.energy += s * s;
      press.frames += 1;
      press.speed *= 0.6;
    }
    signal.push(s);
    // auto demo
    if (!press) idle += dt;
    if (!script.length && idle > 3.5 && !press) {
      script = DEMO_GESTURES[demoIndex++ % DEMO_GESTURES.length](now);
      idle = 0;
    }
    while (script.length && script[0].at <= now) script.shift()!.act();

    g.clear();
    drawRobot();
    chart(ctx, 212, 14, 180, 92, 'Touch signal (normalised)', [{ s: signal, color: 'rgb(255,106,0)', fill: true }], [-0.1, 1.5]);
    box(ctx, 212, 114, 180, 122, 4, '#111217', 'rgba(255,255,255,0.08)');
    text(ctx, 'FEATURES → CLASSIFIER', 218, 124, { size: 6.5, color: DIM, weight: 700 });
    if (last) {
      text(ctx, `duration  ${last.d.toFixed(2)} s`, 218, 138, { size: 7, mono: true });
      text(ctx, `energy    ${last.e.toFixed(2)}`, 218, 149, { size: 7, mono: true });
      text(ctx, `motion    ${Math.round(last.m)} px`, 218, 160, { size: 7, mono: true });
      text(ctx, last.label.toUpperCase(), 218, 180, { size: 16, weight: 800, color: ACCENT });
      text(ctx, `${last.part} · ${Math.round(last.conf * 100)}%`, 386, 180, { size: 7, align: 'right', color: INK });
      box(ctx, 218, 192, 168, 4, 2, 'rgba(255,255,255,0.1)');
      box(ctx, 218, 192, 168 * last.conf, 4, 2, ACCENT);
      history.slice(1).forEach((h, i) => text(ctx, h, 218, 208 + i * 11, { size: 6.6, mono: true, color: DIM }));
    } else {
      text(ctx, 'Waiting for a touch…', 218, 150, { size: 8, color: DIM });
    }
  });
  return () => {
    stop();
    g.dispose();
  };
}

// ----------------------------------------------------------- Convergence

/** A UR10-like arm (side view, 3 joints) driven by the report's control law. */
function armDemo(kit: Kit): Stop {
  const g = canvas2d(kit.screen);
  const { ctx } = g;
  kit.caption(
    'Click to set a target (drag to choose the tool’s angle). The tool follows a quintic trajectory — velocities start and end at zero — under closed-loop control v = ẋd + Kp·e with Kp = 16, and joint speeds from the damped pseudo-inverse q̇ = Jᵀ(JJᵀ + λ²I)⁻¹v (λ = 0.001). “Disturb” knocks the joints: watch the errors converge. A 3-joint side view of the 6-DOF arm; the trajectory lasts 3 s here (10 s in the report).',
  );

  const L = [0.612, 0.572, 0.22]; // UR10 upper arm, forearm, wrist + tool (m)
  const KP = 16;
  const LAMBDA2 = 0.001 ** 2;
  const TF = 3;
  const S = 108; // px per metre
  const BASE = { x: 64, y: 196 };
  const toPx = (x: number, y: number): [number, number] => [BASE.x + x * S, BASE.y - y * S];
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  const q = [1.9, -1.95, -1.5];
  function fk(qq: number[]) {
    const a1 = qq[0];
    const a2 = a1 + qq[1];
    const a3 = a2 + qq[2];
    const p1 = [L[0] * Math.cos(a1), L[0] * Math.sin(a1)];
    const p2 = [p1[0] + L[1] * Math.cos(a2), p1[1] + L[1] * Math.sin(a2)];
    const p3 = [p2[0] + L[2] * Math.cos(a3), p2[1] + L[2] * Math.sin(a3)];
    return { p1, p2, p3, phi: a3, a: [a1, a2, a3] };
  }
  function jacobian(qq: number[]) {
    const { a } = fk(qq);
    const s = a.map(Math.sin);
    const c = a.map(Math.cos);
    return [
      [-L[0] * s[0] - L[1] * s[1] - L[2] * s[2], -L[1] * s[1] - L[2] * s[2], -L[2] * s[2]],
      [L[0] * c[0] + L[1] * c[1] + L[2] * c[2], L[1] * c[1] + L[2] * c[2], L[2] * c[2]],
      [1, 1, 1],
    ];
  }
  function solve3(A: number[][], b: number[]) {
    const det = (m: number[][]) =>
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const d = det(A);
    return [0, 1, 2].map((k) => det(A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / d);
  }

  // trajectory state
  let start = { x: 0, y: 0, phi: 0 };
  let goal = { x: 0, y: 0, phi: 0 };
  let t = TF;
  let rest = 0;
  let userTarget = false;
  const TARGETS = [
    { x: 0.95, y: 0.15, phi: -Math.PI / 2 },
    { x: 0.55, y: 0.85, phi: 0 },
    { x: 1.1, y: 0.55, phi: -Math.PI / 4 },
    { x: 0.45, y: 0.1, phi: -Math.PI / 2 },
    { x: 0.8, y: 0.75, phi: Math.PI / 6 },
  ];
  let ti = 0;
  function goTo(x: number, y: number, phi: number) {
    const now = fk(q);
    start = { x: now.p3[0], y: now.p3[1], phi: now.phi };
    // keep the target within reach
    const wx = x - L[2] * Math.cos(phi);
    const wy = y - L[2] * Math.sin(phi);
    const r = Math.hypot(wx, wy);
    const k = clamp(r, 0.2, (L[0] + L[1]) * 0.96) / (r || 1);
    goal = { x: wx * k + L[2] * Math.cos(phi), y: wy * k + L[2] * Math.sin(phi), phi };
    t = 0;
    rest = 0;
  }
  {
    const now = fk(q);
    goal = start = { x: now.p3[0], y: now.p3[1], phi: now.phi };
  }

  const ep = new Series(300);
  const eo = new Series(300);
  const qd = [new Series(300), new Series(300), new Series(300)];
  let errP = 0;
  let errO = 0;

  // input: press = position, drag = tool angle
  let down: { x: number; y: number } | null = null;
  let dragPhi: number | null = null;
  g.cv.addEventListener('pointerdown', (e) => {
    const { x, y } = g.at(e);
    if (x > 246) return;
    g.cv.setPointerCapture(e.pointerId);
    down = { x, y };
    dragPhi = null;
  });
  g.cv.addEventListener('pointermove', (e) => {
    if (!down) return;
    const { x, y } = g.at(e);
    if (Math.hypot(x - down.x, y - down.y) > 8) dragPhi = Math.atan2(-(y - down.y), x - down.x);
  });
  g.cv.addEventListener('pointerup', () => {
    if (!down) return;
    userTarget = true;
    goTo((down.x - BASE.x) / S, (BASE.y - down.y) / S, dragPhi ?? -Math.PI / 2);
    down = null;
  });
  kit.button('Disturb', () => {
    for (let i = 0; i < 3; i++) q[i] += (Math.random() - 0.5) * 0.5;
  });
  kit.button('Next target', () => {
    userTarget = false;
    const n = TARGETS[ti++ % TARGETS.length];
    goTo(n.x, n.y, n.phi);
  });

  const stop = loop((_time, dt) => {
    // integrate the control law in small steps
    const H = 0.002;
    let lastQd = [0, 0, 0];
    for (let k = 0; k < Math.round(dt / H); k++) {
      t = Math.min(t + H, TF);
      const tau = t / TF;
      const r = 10 * tau ** 3 - 15 * tau ** 4 + 6 * tau ** 5;
      const rd = (30 * tau ** 2 - 60 * tau ** 3 + 30 * tau ** 4) / TF;
      const dphi = wrap(goal.phi - start.phi);
      const xd = [start.x + r * (goal.x - start.x), start.y + r * (goal.y - start.y), start.phi + r * dphi];
      const xdd = [rd * (goal.x - start.x), rd * (goal.y - start.y), rd * dphi];
      const now = fk(q);
      const e = [xd[0] - now.p3[0], xd[1] - now.p3[1], wrap(xd[2] - now.phi)];
      const v = [xdd[0] + KP * e[0], xdd[1] + KP * e[1], xdd[2] + KP * e[2]];
      const J = jacobian(q);
      const JJt = [0, 1, 2].map((i) => [0, 1, 2].map((j) => J[i][0] * J[j][0] + J[i][1] * J[j][1] + J[i][2] * J[j][2] + (i === j ? LAMBDA2 : 0)));
      const w = solve3(JJt, v);
      lastQd = [0, 1, 2].map((j) => clamp(J[0][j] * w[0] + J[1][j] * w[1] + J[2][j] * w[2], -3, 3));
      for (let j = 0; j < 3; j++) q[j] += lastQd[j] * H;
      errP = Math.hypot(e[0], e[1]) * 1000;
      errO = (Math.abs(e[2]) * 180) / Math.PI;
    }
    if (dt) {
      ep.push(errP);
      eo.push(errO);
      lastQd.forEach((v, i) => qd[i].push(v));
    }
    if (t >= TF) {
      rest += dt;
      if (rest > (userTarget ? 6 : 1.6)) {
        userTarget = false;
        const n = TARGETS[ti++ % TARGETS.length];
        goTo(n.x, n.y, n.phi);
      }
    }

    // ---- draw ----
    g.clear();
    line(ctx, [[8, 232], [244, 232]], 'rgba(255,255,255,0.15)', 1);
    box(ctx, BASE.x - 16, BASE.y + 8, 32, 232 - BASE.y - 8, 3, '#2a2d33');
    // the path and the goal
    line(ctx, [toPx(start.x, start.y), toPx(goal.x, goal.y)], 'rgba(255,106,0,0.45)', 0.8, [3, 3]);
    const [gx, gy] = toPx(goal.x, goal.y);
    ctx.beginPath();
    ctx.arc(gx, gy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    line(ctx, [[gx, gy], [gx + Math.cos(goal.phi) * 14, gy - Math.sin(goal.phi) * 14]], ACCENT, 1.2);
    // the arm
    const f = fk(q);
    const pts = [[0, 0], f.p1, f.p2, f.p3].map(([x, y]) => toPx(x, y));
    line(ctx, [pts[0], pts[1]], '#c9ced6', 13);
    line(ctx, [pts[1], pts[2]], '#c9ced6', 10);
    line(ctx, [pts[2], pts[3]], '#aab0b9', 7);
    for (const [i, [x, y]] of pts.slice(0, 3).entries()) {
      ctx.beginPath();
      ctx.arc(x, y, 9 - i * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#dfe3e8';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 5.5 - i, 0, Math.PI * 2);
      ctx.fillStyle = '#5aa9e6';
      ctx.fill();
    }
    // gripper
    const [tx, ty] = pts[3];
    const ux = Math.cos(f.phi);
    const uy = -Math.sin(f.phi);
    for (const s of [-1, 1]) line(ctx, [[tx - uy * s * 4, ty + ux * s * 4], [tx - uy * s * 4 + ux * 6, ty + ux * s * 4 + uy * 6]], '#8b9199', 2);
    if (down) {
      ctx.beginPath();
      ctx.arc(down.x, down.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    text(ctx, 'UR10 · SIDE VIEW (3 OF 6 JOINTS)', 10, 14, { size: 7, weight: 700, color: DIM });
    text(ctx, `t = ${t.toFixed(2)} / ${TF} s`, 10, 26, { size: 7, mono: true });

    chart(ctx, 252, 10, 140, 74, '|ep| position error (mm)', [{ s: ep, color: 'rgb(255,106,0)', fill: true }], [0, 60], { value: errP.toFixed(1) });
    chart(ctx, 252, 90, 140, 74, '|eo| orientation error (°)', [{ s: eo, color: 'rgb(90,180,255)', fill: true }], [0, 10], { value: errO.toFixed(2) });
    chart(
      ctx,
      252,
      170,
      140,
      74,
      'dq/dt joint speeds (rad/s)',
      [
        { s: qd[0], color: 'rgb(74,222,128)' },
        { s: qd[1], color: 'rgb(242,204,12)' },
        { s: qd[2], color: 'rgb(255,120,200)' },
      ],
      [-1.5, 1.5],
    );
  });
  return () => {
    stop();
    g.dispose();
  };
}

const DEMOS: Record<SignKind, (kit: Kit) => Stop> = {
  drone: droneDemo,
  desk: postureDemo,
  mailbox: mailDemo,
  robot: robotDemo,
  arm: armDemo,
};
