import { C, type Kit } from './kit';

/** Automatic e-mail classification, in seven scenes. */

const FOLDERS = [
  { label: 'RFQ', colour: C.orange, p: 0.92 },
  { label: 'Tech inquiry', colour: C.blue, p: 0.05 },
  { label: 'Job application', colour: C.green, p: 0.02 },
  { label: 'Spam', colour: C.dim, p: 0.01 },
];

export function mailExplainer(k: Kit) {
  const { tl, add, text, group } = k;

  /** An envelope, centred on 0,0 (move it with x/y). */
  const envelope = (parent?: SVGElement) => {
    const g = add('g', {}, parent);
    add('rect', { x: -38, y: -25, width: 76, height: 50, rx: 5, fill: C.ink }, g);
    add('path', { d: 'M-38 -22L0 6L38 -22', fill: 'none', stroke: '#9a9a9a', 'stroke-width': 3 }, g);
    return g;
  };

  // ---- the inbox: a pile of mail ----
  const pile = Array.from({ length: 7 }, (_, i) => {
    const e = envelope();
    e.setAttribute('transform', `translate(${110 + (i % 2) * 8} ${330 - i * 30}) rotate(${(i % 3) - 1} 0 0)`);
    return e;
  });
  const count = text(110, 60, '0 today', { 'font-size': 20, 'font-weight': 800, fill: C.yellow, opacity: 0 });

  // ---- the one we follow ----
  const mail = envelope();
  mail.setAttribute('opacity', '0');
  const card = group();
  add('rect', { x: 250, y: 110, width: 230, height: 150, rx: 10, fill: C.ink }, card);
  const lines = [0, 1, 2, 3].map((i) => add('rect', { x: 268, y: 132 + i * 22, width: [180, 150, 170, 120][i], height: 9, rx: 4, fill: '#9a9a9a' }, card));
  const sig = add('rect', { x: 268, y: 228, width: 110, height: 9, rx: 4, fill: '#c4c4c4' }, card);
  const strike = add('line', { x1: 262, y1: 232, x2: 384, y2: 232, stroke: C.red, 'stroke-width': 3, opacity: 0 }, card);
  const html = text(424, 240, '<div>', { 'font-size': 14, fill: C.red, 'font-family': 'ui-monospace, Menlo, monospace' }, card);
  const lang = group();
  add('rect', { x: 300, y: 70, width: 130, height: 32, rx: 16, fill: C.blue }, lang);
  text(365, 92, 'FR → EN', { 'font-size': 15, 'font-weight': 800, fill: '#07131f' }, lang);

  // ---- the vector ----
  const vec = group();
  const bars = Array.from({ length: 22 }, (_, i) => {
    const h = 16 + ((i * 37) % 70);
    return add('rect', { x: 262 + i * 10, y: 230 - h, width: 6, height: h, rx: 2, fill: i % 4 ? C.violet : C.blue }, vec);
  });
  text(365, 262, 'MiniLM sentence embedding', { 'font-size': 13, fill: C.dim, 'letter-spacing': 1 }, vec);

  // ---- the folders, with the model's confidence ----
  const folders = FOLDERS.map((f, i) => {
    const y = 90 + i * 66;
    const g = group();
    add('path', { d: `M560 ${y}h40l8 8h112v40h-160z`, fill: '#151515', stroke: f.colour, 'stroke-width': 2 }, g);
    text(574, y + 33, f.label, { 'text-anchor': 'start', 'font-size': 15, 'font-weight': 700 }, g);
    const bar = add('rect', { x: 560, y: y + 52, width: 0, height: 5, rx: 2, fill: f.colour }, g);
    const pct = text(745, y + 33, '0 %', { 'text-anchor': 'end', 'font-size': 14, fill: C.dim }, g);
    return { g, bar, pct, y, f };
  });
  const subs = ['Lab', 'Healthcare', 'Medical'].map((s, i) => {
    const g = group();
    add('rect', { x: 560 + i * 74, y: 58, width: 68, height: 26, rx: 13, fill: 'none', stroke: C.orange, 'stroke-width': 1.5 }, g);
    text(594 + i * 74, 76, s, { 'font-size': 12, 'font-weight': 700, fill: C.orange }, g);
    return g;
  });

  // ---- the correction ----
  const cursor = add('path', { d: 'M0 0L18 10L10 12L6 20Z', fill: '#fff', stroke: '#111', 'stroke-width': 1.2, opacity: 0 });
  const retrain = group();
  add('rect', { x: 270, y: 300, width: 190, height: 42, rx: 21, fill: C.green }, retrain);
  const retrainText = text(365, 327, 'Retraining…', { 'font-size': 16, 'font-weight': 800, fill: '#06210f' }, retrain);

  const stack = group();
  ['Microsoft Graph', 'BERT · MiniLM', 'FastAPI', 'React'].forEach((s, i) => {
    const g = add('g', { transform: `translate(${135 + i * 176} 196)` }, stack);
    add('rect', { x: -78, y: -24, width: 156, height: 48, rx: 24, fill: C.bg, stroke: [C.blue, C.violet, C.green, C.blue][i], 'stroke-width': 2 }, g);
    text(0, 6, s, { 'font-size': 15, 'font-weight': 700 }, g);
  });
  const veil = add('rect', { width: 800, height: 450, fill: 'rgba(10,12,16,0.85)', opacity: 0 });
  stack.parentNode!.append(stack); // over the veil

  const tally = { v: 0 };
  const folderOf = (i: number) => ({ x: 640, y: folders[i].y + 22 });

  // ---- the video ----
  k.scene('Hundreds of e-mails, every day.');
  tl.from(pile, { y: -400, duration: 0.5, stagger: 0.08, ease: 'bounce.out' });
  tl.to(count, { opacity: 1, duration: 0.2 }, '<');
  tl.to(tally, { v: 124, duration: 1, ease: 'power2.out', onUpdate: () => (count.textContent = `${Math.round(tally.v)} today`) }, '<');
  k.hold(0.4);

  k.scene('First: clean it, translate it.');
  tl.fromTo(mail, { x: 110, y: 150, opacity: 1 }, { x: 365, y: 185, scale: 1.4, duration: 0.5, ease: 'power3.inOut' });
  tl.to(mail, { opacity: 0, duration: 0.15 });
  tl.to(card, { opacity: 1, duration: 0.2 }, '<');
  tl.to(strike, { opacity: 1, duration: 0.2 });
  tl.to([sig, strike, html], { opacity: 0, duration: 0.3, delay: 0.2 });
  tl.fromTo(lang, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }, '<');
  k.hold(0.5);

  k.scene('Then the text becomes numbers.');
  tl.to(lines, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.3, stagger: 0.05 });
  tl.to([card, lang], { opacity: 0, duration: 0.2 });
  tl.to(vec, { opacity: 1, duration: 0.1 }, '<');
  tl.from(bars, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.35, stagger: 0.02, ease: 'back.out(2)' }, '<');
  k.hold(0.5);

  k.scene('A classifier picks the folder.');
  tl.to(folders.map((f) => f.g), { opacity: 1, duration: 0.3, stagger: 0.06 });
  folders.forEach((f) => {
    const o = { v: 0 };
    tl.to(f.bar, { attr: { width: 160 * f.f.p }, duration: 0.6, ease: 'power2.out' }, '<0.05');
    tl.to(o, { v: f.f.p * 100, duration: 0.6, onUpdate: () => (f.pct.textContent = `${Math.round(o.v)} %`) }, '<');
  });
  tl.fromTo(mail, { x: 365, y: 185, scale: 1, opacity: 1 }, { x: folderOf(0).x, y: folderOf(0).y, scale: 0.5, duration: 0.5, ease: 'power3.in' });
  tl.to(mail, { opacity: 0, duration: 0.15 });
  tl.to(folders[0].g, { scale: 1.06, svgOrigin: '640 110', duration: 0.15, yoyo: true, repeat: 1 }, '<');
  k.hold(0.3);

  k.scene('Then the exact sub-folder.');
  tl.to(subs, { opacity: 1, duration: 0.25, stagger: 0.1 });
  tl.to(subs[0].querySelector('rect')!, { attr: { fill: C.orange }, duration: 0.2 });
  tl.to(subs[0].querySelector('text')!, { attr: { fill: '#1a0d02' }, duration: 0.2 }, '<');
  k.hold(0.6);

  k.scene('Wrong? Fix it in one click, retrain.');
  tl.fromTo(cursor, { x: 380, y: 360, opacity: 1 }, { x: 650, y: folders[1].y + 26, duration: 0.6, ease: 'power2.inOut' });
  tl.to(folders[1].g, { scale: 1.06, svgOrigin: `640 ${folders[1].y + 20}`, duration: 0.12, yoyo: true, repeat: 1 });
  tl.call(() => (retrainText.textContent = 'Retraining…'));
  tl.fromTo(retrain, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3 });
  tl.call(() => (retrainText.textContent = 'Model v2 ✓'), [], '+=0.8');
  k.hold(0.6);

  k.scene('Outlook in, a sorted inbox out.');
  tl.to(cursor, { opacity: 0, duration: 0.2 });
  tl.to(veil, { opacity: 1, duration: 0.3 }, '<');
  tl.to(stack, { opacity: 1, duration: 0.3 }, '<');
  k.hold(1.4);
}
