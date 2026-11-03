import { C, drawable, pts, type Kit } from './kit';

/** UR10 kinematic control, in six scenes (a side view: three of the six joints). */

const BASE = { x: 170, y: 340 };
const L = [130, 118, 46];
const rad = (d: number) => (d * Math.PI) / 180;

/** The joints' positions for angles q (degrees, each relative to the link before). */
function fk(q: { a: number; b: number; c: number }) {
  const t1 = rad(q.a);
  const t2 = t1 + rad(q.b);
  const t3 = t2 + rad(q.c);
  const p1 = { x: BASE.x + L[0] * Math.cos(t1), y: BASE.y - L[0] * Math.sin(t1) };
  const p2 = { x: p1.x + L[1] * Math.cos(t2), y: p1.y - L[1] * Math.sin(t2) };
  const p3 = { x: p2.x + L[2] * Math.cos(t3), y: p2.y - L[2] * Math.sin(t3) };
  return { p1, p2, p3, phi: t3 };
}

const START = { a: 100, b: -70, c: -50 };
const GOAL = { a: 48, b: -34, c: -60 };
const STRETCH = { a: 22, b: -3, c: -2 };

export function armExplainer(k: Kit) {
  const { tl, add, text, group } = k;

  // ---- the arm ----
  add('rect', { x: BASE.x - 34, y: BASE.y, width: 68, height: 24, rx: 6, fill: '#3a3a3a' });
  const links = [0, 1, 2].map((i) => add('line', { stroke: i === 2 ? C.orange : '#cccccc', 'stroke-width': [26, 20, 12][i], 'stroke-linecap': 'round' }));
  const joints = [0, 1, 2].map(() => add('circle', { r: 11, fill: '#555555', stroke: '#cccccc', 'stroke-width': 3 }));
  const spins = [0, 1, 2].map(() => add('path', { fill: 'none', stroke: C.blue, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }));
  const q = { ...START };
  const draw = () => {
    const { p1, p2, p3 } = fk(q);
    const ends = [BASE, p1, p2, p3];
    links.forEach((l, i) => {
      l.setAttribute('x1', String(ends[i].x));
      l.setAttribute('y1', String(ends[i].y));
      l.setAttribute('x2', String(ends[i + 1].x));
      l.setAttribute('y2', String(ends[i + 1].y));
    });
    joints.forEach((j, i) => {
      j.setAttribute('cx', String(ends[i].x));
      j.setAttribute('cy', String(ends[i].y));
      spins[i].setAttribute('d', `M${ends[i].x + 20} ${ends[i].y}a20 20 0 0 0 -20 -20`);
    });
  };
  k.onFrame(draw);
  draw();

  // ---- the target pose ----
  const goal = fk(GOAL);
  const target = group();
  add('circle', { cx: goal.p3.x, cy: goal.p3.y, r: 14, fill: 'none', stroke: C.green, 'stroke-width': 3 }, target);
  add('path', { d: `M${goal.p3.x - 22} ${goal.p3.y}h44M${goal.p3.x} ${goal.p3.y - 22}v44`, stroke: C.green, 'stroke-width': 2 }, target);
  const ax = goal.p3.x + 50 * Math.cos(goal.phi);
  const ay = goal.p3.y - 50 * Math.sin(goal.phi);
  add('line', { x1: goal.p3.x, y1: goal.p3.y, x2: ax, y2: ay, stroke: C.green, 'stroke-width': 3, 'stroke-dasharray': '6 5' }, target);
  const pulse = add('circle', { cx: goal.p3.x, cy: goal.p3.y, r: 14, fill: 'none', stroke: C.green, 'stroke-width': 2, opacity: 0 });
  const tool = fk(START).p3;
  const path = add('line', { x1: tool.x, y1: tool.y, x2: goal.p3.x, y2: goal.p3.y, stroke: C.orange, 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0 });

  // ---- the panel: the path's timing, then the control law, then the error ----
  const panel = group();
  add('rect', { x: 470, y: 50, width: 300, height: 300, rx: 16, fill: '#151515', stroke: C.line }, panel);
  const curve = (f: (t: number) => number, y0: number, h: number) =>
    pts(Array.from({ length: 41 }, (_, i) => [490 + (i / 40) * 260, y0 - f(i / 40) * h]));
  const quintic = (t: number) => 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5;
  const speed = (t: number) => (30 * t ** 2 - 60 * t ** 3 + 30 * t ** 4) / 1.875;
  text(490, 80, 'POSITION  r(τ) = 10τ³ − 15τ⁴ + 6τ⁵', { 'text-anchor': 'start', 'font-size': 12, fill: C.dim }, panel);
  const pos = add('polyline', { points: curve(quintic, 190, 90), fill: 'none', stroke: C.orange, 'stroke-width': 3 }, panel);
  text(490, 230, 'SPEED  — zero at both ends', { 'text-anchor': 'start', 'font-size': 12, fill: C.dim }, panel);
  const vel = add('polyline', { points: curve(speed, 330, 85), fill: 'none', stroke: C.blue, 'stroke-width': 3 }, panel);
  [pos, vel].forEach((p) => drawable(p));

  const law = group();
  add('rect', { x: 470, y: 50, width: 300, height: 300, rx: 16, fill: '#151515', stroke: C.line }, law);
  text(620, 120, 'v = ẋd + K·e', { 'font-size': 26, 'font-weight': 700, 'font-family': 'Georgia, serif' }, law);
  text(620, 150, 'K = 16 · e = position + orientation error', { 'font-size': 12, fill: C.dim }, law);
  text(620, 220, 'q̇ = Jᵀ(JJᵀ + λ²I)⁻¹ v', { 'font-size': 24, 'font-weight': 700, 'font-family': 'Georgia, serif', fill: C.blue }, law);
  text(620, 250, 'damped pseudo-inverse · λ = 0.001', { 'font-size': 12, fill: C.dim }, law);
  const errPlot = add('polyline', { points: curve((t) => Math.exp(-t * 5.5), 330, 52), fill: 'none', stroke: C.green, 'stroke-width': 3 }, law);
  drawable(errPlot);
  const done = text(740, 300, '≈ 2 s', { 'text-anchor': 'end', 'font-size': 18, 'font-weight': 800, fill: C.green, opacity: 0 }, law);

  const shield = group();
  add('rect', { x: 60, y: 40, width: 250, height: 42, rx: 21, fill: 'rgba(90,180,255,0.15)', stroke: C.blue, 'stroke-width': 2 }, shield);
  text(185, 67, 'near a singularity: still smooth', { 'font-size': 14, 'font-weight': 700, fill: C.blue }, shield);

  // ---- the video ----
  k.scene('A 6-joint industrial arm: the UR10.');
  tl.from([...links, ...joints], { opacity: 0, duration: 0.4, stagger: 0.06 });
  tl.to(q, { a: 92, b: -60, c: -40, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' });

  k.scene('Goal: this position, this angle.');
  tl.fromTo(target, { opacity: 0, scale: 0.4, svgOrigin: `${goal.p3.x} ${goal.p3.y}` }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' });
  tl.fromTo(pulse, { attr: { r: 14 }, opacity: 1 }, { attr: { r: 44 }, opacity: 0, duration: 0.7 });
  k.hold(0.3);

  k.scene('A smooth path: gentle start, gentle stop.');
  tl.to(path, { opacity: 1, duration: 0.2 });
  tl.to(panel, { opacity: 1, duration: 0.25 }, '<');
  tl.to(pos, { strokeDashoffset: 0, duration: 0.8, ease: 'none' });
  tl.to(vel, { strokeDashoffset: 0, duration: 0.8, ease: 'none' });
  k.hold(0.5);

  k.scene('The error becomes joint speeds.');
  tl.to(panel, { opacity: 0, duration: 0.2 });
  tl.to(law, { opacity: 1, duration: 0.25 }, '<');
  tl.to(spins, { opacity: 1, duration: 0.2, stagger: 0.08 });
  k.hold(1);

  k.scene('It moves… and locks on in about 2 s.');
  tl.to(q, { ...GOAL, duration: 1.6, ease: 'power2.inOut' });
  tl.to(errPlot, { strokeDashoffset: 0, duration: 1.6, ease: 'none' }, '<');
  tl.to(path, { opacity: 0, duration: 0.3 }, '<0.6');
  tl.to(spins, { opacity: 0, duration: 0.3 });
  tl.to(done, { opacity: 1, duration: 0.2 }, '<');
  tl.to(target, { scale: 1.25, svgOrigin: `${goal.p3.x} ${goal.p3.y}`, duration: 0.15, yoyo: true, repeat: 1 }, '<');
  k.hold(0.5);

  k.scene('Damping keeps it stable, even stretched out.');
  tl.to([law, target], { opacity: 0, duration: 0.25 });
  tl.fromTo(shield, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 }, '<');
  tl.to(q, { ...STRETCH, duration: 1.2, ease: 'power2.inOut' });
  tl.to(q, { ...START, duration: 1, ease: 'power2.inOut' });
  k.hold(0.4);
}
