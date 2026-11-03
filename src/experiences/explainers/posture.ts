import { C, type Kit } from './kit';

/** The posture digital twin, in eight scenes. */

const HIP = { x: 190, y: 292 };
const TWIN = { x: 660, y: 292 };

export function postureExplainer(k: Kit) {
  const { tl, add, text, group } = k;

  // ---- the desk, the chair, the person (seen from the side) ----
  const scene = add('g');
  add('rect', { x: 268, y: 232, width: 110, height: 8, rx: 3, fill: '#4a4a4a' }, scene);
  add('rect', { x: 368, y: 240, width: 6, height: 120, fill: '#4a4a4a' }, scene);
  add('rect', { x: 330, y: 168, width: 8, height: 64, fill: '#2b2b2b' }, scene);
  add('rect', { x: 120, y: 302, width: 110, height: 8, rx: 3, fill: '#4a4a4a' }, scene);
  add('rect', { x: 120, y: 214, width: 8, height: 96, fill: '#4a4a4a' }, scene);
  add('path', { d: `M${HIP.x} ${HIP.y}L280 296L284 360`, fill: 'none', stroke: '#5a5a5a', 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, scene);

  /** A seated upper body: a torso that leans from the hip, a head that bends from the neck. */
  const body = (hip: { x: number; y: number }, colour: string, bones: boolean, parent: SVGElement) => {
    const torso = add('g', {}, parent);
    const spine = add('line', { x1: hip.x, y1: hip.y, x2: hip.x, y2: hip.y - 112, stroke: colour, 'stroke-width': bones ? 10 : 22, 'stroke-linecap': 'round' }, torso);
    add('path', { d: `M${hip.x} ${hip.y - 98}L${hip.x + 62} ${hip.y - 70}L${hip.x + 96} ${hip.y - 62}`, fill: 'none', stroke: colour, 'stroke-width': bones ? 7 : 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, torso);
    const head = add('g', {}, torso);
    add('circle', { cx: hip.x + 4, cy: hip.y - 138, r: bones ? 16 : 22, fill: bones ? 'none' : '#bdbdbd', stroke: bones ? colour : 'none', 'stroke-width': 6 }, head);
    if (bones) for (const [x, y] of [[0, 0], [0, -112], [62, -70]]) add('circle', { cx: hip.x + x, cy: hip.y + y, r: 7, fill: '#d8d8d8' }, torso);
    return { torso, head, spine };
  };
  const me = body(HIP, '#7a7a7a', false, scene);
  const lean = (b: ReturnType<typeof body>, hip: { x: number; y: number }, torso: number, head: number, at: number | string, d = 0.9) => {
    tl.to(b.torso, { rotation: torso, svgOrigin: `${hip.x} ${hip.y}`, duration: d, ease: 'power2.inOut' }, at);
    tl.to(b.head, { rotation: head, svgOrigin: `${hip.x} ${hip.y - 112}`, duration: d, ease: 'power2.inOut' }, '<');
  };

  // the alarm on the spine
  const bang = text(HIP.x - 46, HIP.y - 120, '!', { 'font-size': 46, 'font-weight': 900, fill: C.red, opacity: 0 });

  // the IMU, and the angle it reads
  const imu = add('rect', { x: HIP.x - 9, y: HIP.y - 70, width: 18, height: 24, rx: 3, fill: C.orange, opacity: 0 }, me.torso);
  const ref = add('line', { x1: HIP.x, y1: HIP.y, x2: HIP.x, y2: HIP.y - 150, stroke: C.dim, 'stroke-dasharray': '5 6', 'stroke-width': 2, opacity: 0 });
  const angle = text(HIP.x - 58, HIP.y - 40, '0°', { 'font-size': 26, 'font-weight': 800, fill: C.orange, opacity: 0 });

  // the webcam and its landmarks
  const cam = group();
  add('rect', { x: 40, y: 92, width: 40, height: 26, rx: 5, fill: C.ink }, cam);
  add('circle', { cx: 60, cy: 105, r: 7, fill: C.bg }, cam);
  add('polygon', { points: `80,100 ${HIP.x + 40},120 ${HIP.x + 40},250 80,112`, fill: 'rgba(90,180,255,0.08)', stroke: 'rgba(90,180,255,0.4)', 'stroke-dasharray': '4 6' }, cam);
  const marks = group({}, me.torso);
  add('path', { d: `M${HIP.x} ${HIP.y}V${HIP.y - 112}L${HIP.x + 4} ${HIP.y - 138}M${HIP.x} ${HIP.y - 98}L${HIP.x + 62} ${HIP.y - 70}`, fill: 'none', stroke: '#fff', 'stroke-width': 2.5 }, marks);
  const dots = [[0, 0], [0, -112], [4, -138], [0, -98], [62, -70]].map(([x, y]) => add('circle', { cx: HIP.x + x, cy: HIP.y + y, r: 6, fill: C.red }, marks));

  // the data path: MQTT, then the database
  const pipes = group();
  const node = (y: number, label: string, colour: string) => {
    add('rect', { x: 414, y: y - 20, width: 104, height: 40, rx: 20, fill: '#151515', stroke: colour, 'stroke-width': 2 }, pipes);
    text(466, y + 6, label, { 'font-size': 15, 'font-weight': 700, fill: colour }, pipes);
  };
  node(150, 'MQTT', C.blue);
  node(250, 'InfluxDB', C.violet);
  add('path', { d: 'M466 170V230', stroke: C.line, 'stroke-width': 2 }, pipes);
  const packets = [0, 1, 2].map(() => add('circle', { cx: 240, cy: 200, r: 6, fill: C.blue, opacity: 0 }));

  // the twin, in bones
  const twinG = group();
  add('rect', { x: TWIN.x - 70, y: TWIN.y + 10, width: 110, height: 6, rx: 3, fill: '#3a3a3a' }, twinG);
  const twin = body(TWIN, '#b8b8b8', true, twinG);
  text(TWIN.x + 10, 70, 'DIGITAL TWIN · BLENDER', { 'font-size': 12, fill: C.dim, 'letter-spacing': 1.5 }, twinG);

  // the alert
  const alert = group();
  add('rect', { x: 560, y: 92, width: 200, height: 42, rx: 21, fill: C.red }, alert);
  text(660, 119, 'ALERT · torso 27°', { 'font-size': 17, 'font-weight': 800 }, alert);

  // the replay bar
  const replay = group();
  add('rect', { x: 560, y: 340, width: 200, height: 6, rx: 3, fill: C.line }, replay);
  const head = add('circle', { cx: 760, cy: 343, r: 9, fill: C.violet }, replay);
  text(660, 330, '⟲ REPLAY · from InfluxDB', { 'font-size': 12, fill: C.violet, 'letter-spacing': 1.2 }, replay);

  // ---- the video ----
  k.scene('Hours at a desk…');
  tl.from(scene, { opacity: 0, duration: 0.4 });
  lean(me, HIP, 24, 18, '>', 1.2);

  k.scene('…and the back pays for it.');
  tl.to(me.spine, { attr: { stroke: C.red }, duration: 0.25 });
  tl.fromTo(bang, { opacity: 0, scale: 0.4, svgOrigin: `${HIP.x - 46} ${HIP.y - 136}` }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, '<');
  k.hold(0.7);
  tl.to(bang, { opacity: 0, duration: 0.2 });
  tl.to(me.spine, { attr: { stroke: '#7a7a7a' }, duration: 0.2 }, '<');
  lean(me, HIP, 0, 0, '<', 0.6);

  k.scene('An IMU on the back measures the lean.');
  tl.fromTo(imu, { opacity: 0, scale: 0.3, svgOrigin: `${HIP.x} ${HIP.y - 58}` }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' });
  tl.to([ref, angle], { opacity: 1, duration: 0.25 });
  const deg = { v: 0 };
  lean(me, HIP, 27, 16, '>', 1.1);
  tl.to(deg, { v: 27, duration: 1.1, ease: 'power2.inOut', onUpdate: () => (angle.textContent = `${Math.round(deg.v)}°`) }, '<');
  k.hold(0.3);

  k.scene('A webcam adds head and shoulders.');
  lean(me, HIP, 0, 0, '>', 0.6);
  tl.to(deg, { v: 0, duration: 0.6, onUpdate: () => (angle.textContent = `${Math.round(deg.v)}°`) }, '<');
  tl.to(cam, { opacity: 1, duration: 0.3 });
  tl.to(marks, { opacity: 1, duration: 0.1 });
  tl.from(dots, { scale: 0, svgOrigin: `${HIP.x} ${HIP.y - 60}`, duration: 0.3, stagger: 0.08, ease: 'back.out(3)' }, '<');
  k.hold(0.6);

  k.scene('Every angle streams over MQTT.');
  tl.to(pipes, { opacity: 1, duration: 0.3 });
  packets.forEach((p, i) => {
    const at = tl.duration() - 0.1 + i * 0.35;
    tl.fromTo(p, { attr: { cx: 240, cy: 200 }, opacity: 1 }, { attr: { cx: 466, cy: 150 }, duration: 0.45, ease: 'power1.in' }, at);
    tl.to(p, { attr: { cy: 250 }, duration: 0.35, ease: 'none' }, at + 0.45);
    tl.to(p, { opacity: 0, duration: 0.1 }, at + 0.8);
  });
  k.hold(0.2);

  k.scene('A 3D twin mirrors each move.');
  tl.to(twinG, { opacity: 1, duration: 0.35 });
  lean(me, HIP, 20, 12, '>', 0.8);
  lean(twin, TWIN, 20, 12, '<', 0.8);
  lean(me, HIP, -6, -4, '>', 0.6);
  lean(twin, TWIN, -6, -4, '<', 0.6);
  lean(me, HIP, 0, 0, '>', 0.4);
  lean(twin, TWIN, 0, 0, '<', 0.4);

  k.scene('Past the limit? Instant alert.');
  lean(me, HIP, 27, 16, '>', 0.9);
  lean(twin, TWIN, 27, 16, '<', 0.9);
  tl.to(deg, { v: 27, duration: 0.9, onUpdate: () => (angle.textContent = `${Math.round(deg.v)}°`) }, '<');
  tl.to(angle, { attr: { fill: C.red }, duration: 0.1 }, '-=0.3');
  tl.to(twin.spine, { attr: { stroke: C.orange }, duration: 0.1 }, '<');
  tl.fromTo(alert, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }, '<');
  k.hold(0.8);

  k.scene('Replay any session, any time.');
  tl.to(alert, { opacity: 0, duration: 0.2 });
  tl.to(replay, { opacity: 1, duration: 0.25 }, '<');
  tl.to(head, { attr: { cx: 560 }, duration: 0.6, ease: 'power2.in' });
  lean(twin, TWIN, 0, 0, '<', 0.6);
  tl.to(head, { attr: { cx: 760 }, duration: 1.6, ease: 'none' });
  const t0 = tl.duration() - 1.6;
  lean(twin, TWIN, 22, 14, t0, 0.5);
  lean(twin, TWIN, 4, 2, t0 + 0.6, 0.4);
  lean(twin, TWIN, 26, 16, t0 + 1.1, 0.5);
  k.hold(0.6);
}
