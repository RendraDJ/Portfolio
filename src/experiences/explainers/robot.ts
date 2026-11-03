import { gsap } from 'gsap';
import { C, drawable, pts, type Kit } from './kit';

/** QT robot — physical interaction, in six scenes. */

export function robotExplainer(k: Kit) {
  const { tl, add, text, group } = k;

  // ---- QT ----
  const qt = add('g');
  add('rect', { x: 150, y: 250, width: 140, height: 110, rx: 24, fill: '#e6e6e6' }, qt);
  add('path', { d: 'M150 280l-34 60M290 280l34 60', stroke: '#e6e6e6', 'stroke-width': 18, 'stroke-linecap': 'round' }, qt);
  add('rect', { x: 130, y: 80, width: 180, height: 160, rx: 44, fill: '#e6e6e6' }, qt);
  add('rect', { x: 150, y: 104, width: 140, height: 104, rx: 30, fill: '#141414' }, qt);
  const eyes = add('g', {}, qt);
  const eyeL = add('ellipse', { cx: 196, cy: 152, rx: 13, ry: 15, fill: C.blue }, eyes);
  const eyeR = add('ellipse', { cx: 244, cy: 152, rx: 13, ry: 15, fill: C.blue }, eyes);
  const happy = add('path', { d: 'M184 156q12 -16 24 0M232 156q12 -16 24 0', fill: 'none', stroke: C.blue, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0 }, qt);
  const smile = add('path', { d: 'M204 184q16 12 32 0', fill: 'none', stroke: C.blue, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0 }, qt);
  // a blink, now and then
  k.forever(gsap.timeline({ repeat: -1, repeatDelay: 2.4 }).to([eyeL, eyeR], { attr: { ry: 2 }, duration: 0.08, yoyo: true, repeat: 1, ease: 'none' }));

  // ---- the hand, and the touch ----
  const hand = add('g', { opacity: 0 });
  add('path', { d: 'M0 0c10 -8 26 -6 30 6l4 22c2 10 -6 18 -16 18h-12c-10 0 -16 -8 -14 -18z', fill: '#bdbdbd' }, hand);
  add('rect', { x: 2, y: -26, width: 9, height: 30, rx: 4.5, fill: '#bdbdbd' }, hand);
  const ripples = [0, 1, 2].map(() => add('circle', { cx: 222, cy: 82, r: 6, fill: 'none', stroke: C.orange, 'stroke-width': 3, opacity: 0 }));

  // ---- the signal ----
  const sig = group();
  add('rect', { x: 400, y: 70, width: 370, height: 170, rx: 14, fill: '#151515', stroke: C.line }, sig);
  text(416, 94, 'TOUCH SIGNAL', { 'text-anchor': 'start', 'font-size': 12, fill: C.dim, 'letter-spacing': 1.5 }, sig);
  const wave: [number, number][] = [];
  for (let x = 0; x <= 340; x += 4) {
    const t = x / 340;
    const burst = t > 0.3 && t < 0.75 ? 1 : 0;
    const spike = Math.exp(-((t - 0.32) ** 2) / 0.0006) * 55;
    wave.push([415 + x, 185 - spike - burst * (22 + Math.sin(x * 0.45) * 14) + Math.sin(x * 1.7) * 2]);
  }
  const line = add('polyline', { points: pts(wave), fill: 'none', stroke: C.orange, 'stroke-width': 2.5 }, sig);
  drawable(line);
  const windows = [0, 1, 2].map((i) => add('rect', { x: 512 + i * 54, y: 104, width: 50, height: 120, rx: 6, fill: 'rgba(90,180,255,0.1)', stroke: C.blue, 'stroke-width': 1.5, opacity: 0 }, sig));

  // ---- the features ----
  const feats = group();
  const bars = ['duration', 'energy', 'motion'].map((s, i) => {
    const y = 278 + i * 30;
    text(470, y + 12, s, { 'text-anchor': 'end', 'font-size': 14, fill: C.dim }, feats);
    return add('rect', { x: 482, y, width: [120, 200, 160][i], height: 16, rx: 8, fill: [C.blue, C.violet, C.green][i] }, feats);
  });

  // ---- the classes ----
  const classes = ['Tap', 'Stroke', 'Press'].map((s, i) => {
    const g = group();
    const r = add('rect', { x: 690, y: 262 + i * 34, width: 82, height: 28, rx: 14, fill: 'none', stroke: C.line, 'stroke-width': 2 }, g);
    text(731, 281 + i * 34, s, { 'font-size': 14, 'font-weight': 700 }, g);
    return { g, r };
  });

  // ---- the answer ----
  const bubble = group();
  add('path', { d: 'M330 70h160a14 14 0 0 1 14 14v34a14 14 0 0 1 -14 14h-128l-24 18l4 -18h-12a14 14 0 0 1 -14 -14v-34a14 14 0 0 1 14 -14z', fill: C.ink }, bubble);
  text(416, 108, 'That feels nice!', { 'font-size': 18, 'font-weight': 800, fill: '#111' }, bubble);

  // ---- the video ----
  k.scene('Meet QT, a social robot.');
  tl.from(qt, { scale: 0.6, opacity: 0, svgOrigin: '220 250', duration: 0.5, ease: 'back.out(2)' });
  k.hold(0.9);

  k.scene('Touch its head…');
  tl.fromTo(hand, { x: 330, y: -40, opacity: 0, rotation: 160, svgOrigin: '0 0' }, { x: 238, y: 52, opacity: 1, rotation: 180, duration: 0.6, ease: 'power3.out' });
  ripples.forEach((r, i) => tl.fromTo(r, { attr: { r: 6 }, opacity: 1 }, { attr: { r: 46 }, opacity: 0, duration: 0.6 }, `<${i ? 0.15 : 0}`));
  k.hold(0.4);

  k.scene('…the touch becomes a signal.');
  tl.to(sig, { opacity: 1, duration: 0.25 });
  tl.to(line, { strokeDashoffset: 0, duration: 1.1, ease: 'none' }, '<');
  tl.to(hand, { opacity: 0, duration: 0.3 }, '<0.6');
  k.hold(0.3);

  k.scene('Cut into windows, measured.');
  tl.to(windows, { opacity: 1, duration: 0.2, stagger: 0.12 });
  tl.to(feats, { opacity: 1, duration: 0.2 });
  tl.from(bars, { attr: { width: 0 }, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, '<');
  k.hold(0.5);

  k.scene('A classifier names the gesture.');
  tl.to(classes.map((c) => c.g), { opacity: 1, duration: 0.2, stagger: 0.08 });
  tl.to(classes[1].r, { attr: { fill: C.green, stroke: C.green }, duration: 0.25 });
  tl.to(classes[1].g.querySelector('text')!, { attr: { fill: '#06210f' }, duration: 0.25 }, '<');
  k.hold(0.6);

  k.scene('And QT reacts.');
  tl.to([sig, feats, ...classes.map((c) => c.g)], { opacity: 0, duration: 0.25 });
  tl.to(eyes, { opacity: 0, duration: 0.15 }, '<');
  tl.to([happy, smile], { opacity: 1, duration: 0.2 });
  tl.fromTo(bubble, { opacity: 0, scale: 0.5, svgOrigin: '370 140' }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, '<');
  tl.to(qt, { rotation: -4, svgOrigin: '220 360', duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<');
  k.hold(1.4);
}
