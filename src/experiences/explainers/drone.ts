import { gsap } from 'gsap';
import { C, drawable, pts, type Kit } from './kit';

/** Drone-based logistics inspection, in eight scenes. */

const ORDER = ['A1', 'A2', 'A3', 'A4', 'B4', 'B3', 'B2', 'B1', 'C1', 'C2', 'C3', 'C4'];
const EMPTY = new Set(['B2', 'C4']);
const RX = 60; // the rack's top left corner
const RY = 50;
const CW = 100; // a slot's width and height
const CH = 100;

const slot = (id: string) => {
  const col = Number(id[1]) - 1;
  const top = RY + (2 - 'ABC'.indexOf(id[0])) * CH; // A is the bottom level
  return { cx: RX + col * CW + CW / 2, top };
};
const hover = (id: string) => ({ x: slot(id).cx, y: slot(id).top + 24 });

export function droneExplainer(k: Kit) {
  const { tl, add, text, group } = k;

  // ---- the rack ----
  const frame = add('path', {
    d: [
      `M${RX} ${RY}h${4 * CW}v${3 * CH}h${-4 * CW}z`,
      ...[1, 2].map((l) => `M${RX} ${RY + l * CH}h${4 * CW}`),
      ...[1, 2, 3].map((c) => `M${RX + c * CW} ${RY}v${3 * CH}`),
    ].join(''),
    fill: 'none',
    stroke: '#4a4a4a',
    'stroke-width': 3,
  });
  drawable(frame);
  const tags = new Map<string, SVGRectElement>();
  const boxes = ORDER.filter((id) => !EMPTY.has(id)).map((id) => {
    const { cx, top } = slot(id);
    const g = add('g');
    add('rect', { x: cx - 36, y: top + 42, width: 72, height: 52, rx: 3, fill: '#333333' }, g);
    tags.set(id, add('rect', { x: cx - 13, y: top + 58, width: 26, height: 17, rx: 2, fill: '#f2f2f2' }, g));
    return g;
  });
  const questions = ORDER.filter((id) => !EMPTY.has(id)).map((id) => text(slot(id).cx, slot(id).top + 36, '?', { 'font-size': 24, 'font-weight': 800, fill: C.yellow, opacity: 0 }));
  const crosses = [...EMPTY].map((id) => text(slot(id).cx, slot(id).top + 72, '×', { 'font-size': 34, fill: C.dim, opacity: 0 }));

  // a clock, for "slow"
  const clock = group({ transform: 'translate(620 200)' });
  add('circle', { r: 46, fill: 'none', stroke: C.yellow, 'stroke-width': 4 }, clock);
  const hand = add('line', { x1: 0, y1: 0, x2: 0, y2: -34, stroke: C.yellow, 'stroke-width': 4, 'stroke-linecap': 'round' }, clock);

  // ---- the drone ----
  const trail = add('polyline', { points: pts(ORDER.map((id) => [hover(id).x, hover(id).y])), fill: 'none', stroke: C.orange, 'stroke-width': 2, 'stroke-dasharray': '0', opacity: 0.7 });
  drawable(trail);
  const drone = add('g', { opacity: 0 });
  const body = add('g', {}, drone);
  add('rect', { x: -18, y: -5, width: 36, height: 10, rx: 5, fill: C.ink }, body);
  for (const x of [-22, 22]) {
    add('line', { x1: x - 12, y1: -9, x2: x + 12, y2: -9, stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, body);
    add('line', { x1: x, y1: -9, x2: x * 0.7, y2: -3, stroke: C.ink, 'stroke-width': 2 }, body);
  }
  add('circle', { cx: 0, cy: 7, r: 3.5, fill: C.orange }, body);
  gsap.set(drone, { x: 760, y: 10 });
  k.forever(gsap.to(body, { y: -3, duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: -1 }));

  // ---- the side panel: camera view, tag reading, inventory ----
  const panel = (title: string) => {
    const g = group();
    add('rect', { x: 500, y: 50, width: 270, height: 300, rx: 16, fill: '#151515', stroke: C.line }, g);
    text(516, 76, title, { 'text-anchor': 'start', 'font-size': 12, fill: C.dim, 'letter-spacing': 1.5 }, g);
    return g;
  };

  // PID: the tag drifts into the crosshair
  const pid = panel('TAG CAMERA · 20° FOV');
  const aimTag = add('g', {}, pid);
  add('rect', { x: 585, y: 165, width: 100, height: 66, rx: 4, fill: '#f2f2f2' }, aimTag);
  for (let i = 0; i < 14; i++) add('rect', { x: 595 + i * 6, y: 196, width: i % 3 ? 2 : 4, height: 24, fill: '#222' }, aimTag);
  const aim = add('g', {}, pid);
  for (const d of ['M635 140v36', 'M635 220v36', 'M560 198h40', 'M670 198h40']) add('path', { d, stroke: C.orange, 'stroke-width': 3 }, aim);
  const errText = text(635, 320, 'error 0.42 m', { 'font-size': 20, 'font-weight': 700, fill: C.orange, 'font-family': 'ui-monospace, Menlo, monospace' }, pid);

  // the read: the tag, its boxes, its values
  const read = panel('DETECTION · OCR · BARCODE');
  add('rect', { x: 540, y: 110, width: 190, height: 130, rx: 6, fill: '#f5f5f2' }, read);
  text(556, 146, 'PL-30417', { 'text-anchor': 'start', 'font-size': 24, 'font-weight': 800, fill: '#111' }, read);
  text(556, 168, 'LOT 26-031', { 'text-anchor': 'start', 'font-size': 14, fill: '#111' }, read);
  for (let i = 0; i < 34; i++) add('rect', { x: 556 + i * 4.6, y: 182, width: i % 4 ? 1.6 : 3, height: 40, fill: '#111' }, read);
  const boxTag = add('rect', { x: 534, y: 104, width: 202, height: 142, rx: 6, fill: 'none', stroke: C.yellow, 'stroke-width': 3 }, read);
  const boxText = add('rect', { x: 550, y: 124, width: 120, height: 50, fill: 'none', stroke: C.blue, 'stroke-width': 3 }, read);
  const boxCode = add('rect', { x: 550, y: 177, width: 168, height: 50, fill: 'none', stroke: C.green, 'stroke-width': 3 }, read);
  [boxTag, boxText, boxCode].forEach((r) => drawable(r));
  const scan = add('rect', { x: 552, y: 178, width: 3, height: 48, fill: C.red, opacity: 0 }, read);
  const result = group({}, read);
  add('rect', { x: 540, y: 262, width: 190, height: 40, rx: 20, fill: C.green }, result);
  text(635, 288, 'PL-30417 · 96 %', { 'font-size': 17, 'font-weight': 800, fill: '#06210f' }, result);

  // the inventory
  const inv = panel('INVENTORY');
  const rows = [
    ['A1', 'PL-30417', '96 %'],
    ['A2', 'PL-37748', '94 %'],
    ['A3', 'PL-45079', '91 %'],
    ['A4', 'PL-52410', '97 %'],
    ['B4', 'PL-59741', '95 %'],
  ].map(([s, sku, ocr], i) => {
    const g = group({}, inv);
    const y = 104 + i * 46;
    add('rect', { x: 516, y, width: 238, height: 36, rx: 8, fill: 'rgba(255,255,255,0.05)' }, g);
    text(534, y + 23, s, { 'text-anchor': 'start', 'font-size': 14, 'font-weight': 700 }, g);
    text(570, y + 23, sku, { 'text-anchor': 'start', 'font-size': 14, 'font-family': 'ui-monospace, Menlo, monospace' }, g);
    text(700, y + 23, ocr, { 'text-anchor': 'end', 'font-size': 13, fill: C.dim }, g);
    text(736, y + 24, '✓', { 'font-size': 16, 'font-weight': 800, fill: C.green }, g);
    return g;
  });

  // the stack
  const stack = group();
  add('rect', { x: 0, y: 0, width: 800, height: 450, fill: 'rgba(10,12,16,0.82)' }, stack);
  const chips = ['Unreal Engine', 'AirSim', 'FastAPI', 'React', 'OpenCV'].map((s, i) => {
    const g = add('g', { transform: `translate(${120 + i * 140} 190)` }, stack);
    add('rect', { x: -62, y: -24, width: 124, height: 48, rx: 24, fill: 'none', stroke: [C.orange, C.blue, C.green, C.blue, C.violet][i], 'stroke-width': 2 }, g);
    text(0, 6, s, { 'font-size': 16, 'font-weight': 700 }, g);
    return g;
  });

  // ---- the video ----
  k.scene('A warehouse full of pallets.');
  tl.to(frame, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' });
  tl.from(boxes, { scale: 0, transformOrigin: '50% 100%', duration: 0.35, stagger: 0.04, ease: 'back.out(2)' }, '-=0.2');
  k.hold(0.5);

  k.scene('Checking every tag by hand? Slow.');
  tl.to(questions, { opacity: 1, y: -6, duration: 0.3, stagger: 0.03 });
  tl.to(clock, { opacity: 1, duration: 0.3 }, '<');
  tl.to(hand, { rotation: 720, svgOrigin: '0 0', duration: 1.4, ease: 'none' }, '<');
  tl.to([...questions, clock], { opacity: 0, duration: 0.3 });

  k.scene('So a drone inspects the rack.');
  tl.to(drone, { opacity: 1, x: hover('A1').x, y: hover('A1').y, duration: 0.9, ease: 'power3.out' });
  k.hold(0.2);

  k.scene('Slot by slot, in a serpentine path.');
  const step = 0.2;
  const start = tl.duration();
  tl.to(trail, { strokeDashoffset: 0, duration: step * (ORDER.length - 1), ease: 'none' }, start);
  ORDER.forEach((id, i) => {
    const at = start + i * step;
    if (i) tl.to(drone, { x: hover(id).x, y: hover(id).y, duration: step, ease: 'none' }, at - step);
    if (EMPTY.has(id)) tl.to(crosses[[...EMPTY].indexOf(id)], { opacity: 1, duration: 0.15 }, at);
    else tl.to(tags.get(id)!, { attr: { fill: C.orange }, duration: 0.15 }, at);
  });
  k.hold(0.5);

  k.scene('A PID loop locks onto each tag.');
  tl.to(pid, { opacity: 1, duration: 0.3 });
  const err = { v: 0.42 };
  tl.fromTo(aimTag, { x: 70, y: -50 }, { x: 0, y: 0, duration: 1.6, ease: 'elastic.out(1, 0.45)' }, '<');
  tl.to(err, { v: 0.08, duration: 1.6, ease: 'power3.out', onUpdate: () => (errText.textContent = `error ${err.v.toFixed(2)} m`) }, '<');
  tl.to([...aim.children], { attr: { stroke: C.green }, duration: 0.2 });
  tl.to(errText, { attr: { fill: C.green }, duration: 0.2 }, '<');
  k.hold(0.4);

  k.scene('The camera reads it: OCR + barcode.');
  tl.to(pid, { opacity: 0, duration: 0.25 });
  tl.to(read, { opacity: 1, duration: 0.25 }, '<');
  tl.to(boxTag, { strokeDashoffset: 0, duration: 0.45 });
  tl.to(boxText, { strokeDashoffset: 0, duration: 0.4 });
  tl.to(scan, { opacity: 1, duration: 0.1 });
  tl.to(scan, { x: 160, duration: 0.5, ease: 'none' });
  tl.to(scan, { opacity: 0, duration: 0.1 });
  tl.to(boxCode, { strokeDashoffset: 0, duration: 0.35 }, '<');
  tl.fromTo(result, { opacity: 0, scale: 0.6, svgOrigin: '635 282' }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' });
  k.hold(0.6);

  k.scene('Every read lands in the inventory.');
  tl.to(read, { opacity: 0, duration: 0.25 });
  tl.to(inv, { opacity: 1, duration: 0.25 }, '<');
  tl.fromTo(rows, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.18, ease: 'power3.out' });
  k.hold(0.8);

  k.scene('Unreal · AirSim · FastAPI · React.');
  tl.to(stack, { opacity: 1, duration: 0.3 });
  tl.from(chips, { opacity: 0, y: 30, duration: 0.35, stagger: 0.08, ease: 'back.out(2)' }, '<');
  k.hold(1.4);
}
