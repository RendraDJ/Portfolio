import { createGuide } from './guide';

/**
 * A working replica of the posture project's Streamlit control center
 * (report §6–7): a sidebar to start the services (Mosquitto in Docker,
 * Telegraf → InfluxDB, Grafana, the Blender twin, the ESP32 + MPU6050 and
 * the webcam + MediaPipe) and to pick the mode, status indicators, then four
 * tabs — Live monitoring (MediaPipe landmarks, angles against the reference
 * posture, alerts, live chart), Digital twin (the Blender armature and the
 * MQTT feed), Grafana (the embedded one-hour panels) and History (Simulation
 * mode: a session read back from InfluxDB and republished to MQTT). A guided
 * cursor drives it with a narration; a press hands it to the visitor.
 * The person, the sessions and the alert limits are made up for the demo.
 */

type Tab = 'live' | 'twin' | 'grafana' | 'history';
type Mode = 'monitoring' | 'simulation';

/** The upper body's angles, in degrees. */
interface Pose {
  tp: number; // torso pitch (forward), MPU6050
  tr: number; // torso roll (sideways), MPU6050
  hp: number; // head pitch, MediaPipe
  hr: number; // head roll, MediaPipe
  hy: number; // head yaw, MediaPipe
  sh: number; // shoulder asymmetry, MediaPipe
  al: number; // left arm abduction
  ar: number; // right arm abduction
}

const POSES: Record<'upright' | 'slouch' | 'lean' | 'arms', Pose> = {
  upright: { tp: 3, tr: 0, hp: 4, hr: 0, hy: 0, sh: 1, al: 8, ar: 8 },
  slouch: { tp: 27, tr: 2, hp: 24, hr: 2, hy: 0, sh: 3, al: 10, ar: 10 },
  lean: { tp: 6, tr: 15, hp: 6, hr: 9, hy: 4, sh: 12, al: 8, ar: 12 },
  arms: { tp: 4, tr: 0, hp: 2, hr: 0, hy: -10, sh: 4, al: 75, ar: 40 },
};
type PoseName = keyof typeof POSES;
const KEYS = Object.keys(POSES.upright) as (keyof Pose)[];

/** A movement the person repeats: [pose, seconds held]. */
const ROUTINE: [PoseName, number][] = [
  ['upright', 3],
  ['slouch', 4],
  ['upright', 3],
  ['lean', 4],
  ['upright', 2],
  ['arms', 3],
];

const SERVICES = [
  { name: 'Mosquitto broker', sub: 'Docker · MQTT :1883' },
  { name: 'Telegraf → InfluxDB', sub: 'MQTT topics → time series' },
  { name: 'Grafana', sub: 'dashboards on InfluxDB' },
  { name: 'Blender twin', sub: 'subscribes to MQTT' },
  { name: 'ESP32 + MPU6050', sub: 'Wi-Fi · torso inclination' },
  { name: 'Webcam + MediaPipe', sub: 'OpenCV · head & shoulders' },
];
const STATUS = [
  { label: 'MQTT', service: 0 },
  { label: 'InfluxDB', service: 1 },
  { label: 'Grafana', service: 2 },
  { label: 'Blender', service: 3 },
];
const SESSIONS = [
  { id: 'session_03', label: 'Session 03', length: '60 min', note: 'continuous test, Monitoring mode' },
  { id: 'session_02', label: 'Session 02', length: '12 min', note: 'upright · slouching · leaning' },
  { id: 'session_01', label: 'Session 01', length: '5 min', note: 'first calibration run' },
];
const LATERAL_LIMIT = 12; // °, for the demo
const ST = { blue: '#0068c9', light: '#83c9ff', red: '#ff2b2b', ink: '#31333f', dim: 'rgba(49, 51, 63, 0.6)' };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

function btn(className: string, label: (Node | string)[], onClick: () => void) {
  const b = h('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function canvas(w: number, hgt: number, className: string) {
  const cv = h('canvas', className);
  cv.width = w;
  cv.height = hgt;
  return { cv, ctx: cv.getContext('2d')! };
}

const rad = (d: number) => (d * Math.PI) / 180;
const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

export function mountPostureApp(host: HTMLElement): () => void {
  // ---- state ----
  let tab: Tab = 'live';
  let mode: Mode = 'monitoring';
  let up = 0; // services up, in order
  let starting = false;
  let limit = 20; // ° of torso pitch before an alert (demo value)
  const pose: Pose = { ...POSES.upright };
  let target: PoseName = 'upright';
  let reference: Pose | null = null; // the first frame, as in the report
  let routineAt = 0;
  let routineT = 0;
  let session = SESSIONS[1];
  let speed = 2;
  let replay: { t: number; length: number } | null = null;
  const history: Pose[] = []; // last 10 s, 20 samples/s
  let mqttT = 0;
  let sampleT = 0;
  const live = () => up >= SERVICES.length && mode === 'monitoring';
  const streaming = () => up >= SERVICES.length && (mode === 'monitoring' || !!replay);

  // ---- the frame ----
  const root = h('div', 'papp');
  const caption = h('p', 'papp__caption');
  const guideBtn = btn('papp__guide', ['▶ Guided demo'], () => undefined);

  // sidebar
  const startBtn = btn('st-btn st-btn--primary', ['Start services'], () => startServices());
  const stopBtn = btn('st-btn', ['Stop'], () => {
    up = 0;
    starting = false;
    replay = null;
    reference = null;
  });
  const serviceRows = SERVICES.map((s) => h('li', '', [h('i'), h('span', '', [h('b', '', [s.name]), h('small', '', [s.sub])])]));
  const modeBtns = (['monitoring', 'simulation'] as Mode[]).map((m) => {
    const b = btn('st-radio', [h('i'), m === 'monitoring' ? 'Monitoring' : 'Simulation (replay)'], () => {
      mode = m;
      if (m === 'monitoring') replay = null;
    });
    b.dataset.mode = m;
    return b;
  });
  const limitVal = h('b');
  const limitInput = h('input');
  Object.assign(limitInput, { type: 'range', min: '10', max: '35', value: String(limit) });
  limitInput.addEventListener('input', () => (limit = Number(limitInput.value)));
  const sidebar = h('aside', 'papp__side', [
    h('p', 'papp__side-title', ['System configuration']),
    h('ul', 'papp__services', serviceRows),
    h('div', 'papp__side-btns', [startBtn, stopBtn]),
    h('p', 'papp__side-title', ['Mode']),
    h('div', 'papp__radios', modeBtns),
    h('p', 'papp__side-title', ['Alert limit · torso pitch']),
    h('label', 'st-slider', [limitInput, limitVal]),
    h('p', 'papp__side-note', [`Lateral limit ${LATERAL_LIMIT}°. Limits are demo values.`]),
  ]);

  // header: title, status, tabs
  const statusEls = STATUS.map((s) => h('span', 'papp__status', [h('i'), s.label]));
  const tabItems: { id: Tab; label: string }[] = [
    { id: 'live', label: 'Live monitoring' },
    { id: 'twin', label: 'Digital twin' },
    { id: 'grafana', label: 'Grafana' },
    { id: 'history', label: 'History' },
  ];
  const tabBtns = tabItems.map((t) => {
    const b = btn('papp__tab', [t.label], () => go(t.id));
    b.dataset.tab = t.id;
    return b;
  });
  const body = h('div', 'papp__body');

  // ---- Live monitoring ----
  const alert = h('div', 'st-alert');
  const cam = canvas(320, 240, 'papp__cam');
  const metricDefs: { key: keyof Pose; label: string; src: string }[] = [
    { key: 'tp', label: 'Torso pitch', src: 'MPU6050' },
    { key: 'tr', label: 'Torso roll', src: 'MPU6050' },
    { key: 'hp', label: 'Head pitch', src: 'MediaPipe' },
    { key: 'hr', label: 'Head roll', src: 'MediaPipe' },
    { key: 'sh', label: 'Shoulder asym.', src: 'MediaPipe' },
    { key: 'al', label: 'L arm abduction', src: 'MediaPipe' },
  ];
  const metrics = metricDefs.map((m) => {
    const value = h('b');
    const delta = h('em');
    return { ...m, value, delta, el: h('div', 'st-metric', [h('span', '', [m.label, h('small', '', [m.src])]), value, delta]) };
  });
  const chart = canvas(560, 150, 'papp__chart');
  const livePage = h('section', 'papp__page', [
    alert,
    h('div', 'papp__cols', [
      h('figure', 'papp__figure', [cam.cv, h('figcaption', '', ['Webcam · MediaPipe Pose landmarks → bone vectors → angles'])]),
      h('div', 'papp__metrics', metrics.map((m) => m.el)),
    ]),
    h('p', 'papp__h', ['Real-time signals (last 10 s)']),
    chart.cv,
  ]);

  // ---- Digital twin ----
  const twin = canvas(560, 250, 'papp__twin');
  const feed = h('ol', 'papp__feed');
  const twinPage = h('section', 'papp__page', [
    h('div', 'papp__cols papp__cols--twin', [
      h('figure', 'papp__figure', [twin.cv, h('figcaption', '', ['Blender · armature driven over MQTT · front and side views'])]),
      h('div', '', [
        h('p', 'papp__h', ['Denavit–Hartenberg model']),
        h('table', 'st-table', [
          h('tbody', '', [
            ['Head', '3 DOF', 'yaw · pitch · roll'],
            ['Spine', '2 DOF', 'pitch · roll (MPU6050)'],
            ['Each arm', '1 DOF', 'abduction'],
          ].map((r) => h('tr', '', r.map((c) => h('td', '', [c]))))),
        ]),
        h('p', 'papp__h', ['MQTT messages (Mosquitto, QoS 0/1)']),
        feed,
      ]),
    ]),
  ]);

  // ---- Grafana ----
  const graf = canvas(640, 300, 'papp__grafana');
  let grafT = 0;
  const grafanaPage = h('section', 'papp__page', [
    h('div', 'papp__graf-bar', [h('b', '', ['Grafana']), h('span', '', ['Posture digital twin · one-hour session']), h('span', 'papp__graf-range', ['Last 1 hour'])]),
    graf.cv,
    h('p', 'papp__note', ['Embedded panels: InfluxDB, fed by Telegraf from the MQTT topics.']),
  ]);

  // ---- History (Simulation mode) ----
  const sessionRows = SESSIONS.map((s) => {
    const tr = h('tr', '', [h('td', '', [h('b', '', [s.label])]), h('td', '', [s.length]), h('td', '', [s.note])]);
    tr.addEventListener('click', () => {
      if (!replay) session = s;
    });
    tr.dataset.id = s.id;
    return tr;
  });
  const speedBtns = [1, 2, 4].map((v) => {
    const b = btn('st-pill', [`${v}×`], () => (speed = v));
    b.dataset.speed = String(v);
    return b;
  });
  const replayBtn = btn('st-btn st-btn--primary', ['Replay session'], () => startReplay());
  const replaySteps = ['Query InfluxDB', 'Sort by timestamp', 'Republish to MQTT', 'Twin animates'].map((s) => h('li', '', [s]));
  const replayFill = h('i');
  const replayText = h('span');
  const mini = canvas(400, 190, 'papp__mini');
  const historyPage = h('section', 'papp__page', [
    h('table', 'st-table st-table--rows', [h('thead', '', [h('tr', '', ['Session', 'Length', 'Notes'].map((x) => h('th', '', [x])))]), h('tbody', '', sessionRows)]),
    h('div', 'papp__replay-bar', [h('span', 'papp__h', ['Speed']), ...speedBtns, replayBtn]),
    h('div', 'papp__cols', [
      h('div', '', [h('ol', 'papp__steps', replaySteps), h('div', 'papp__progress', [h('span', 'st-bar', [replayFill]), replayText])]),
      h('figure', 'papp__figure', [mini.cv, h('figcaption', '', ['The twin replays the recorded angles'])]),
    ]),
  ]);

  const pages: Record<Tab, HTMLElement> = { live: livePage, twin: twinPage, grafana: grafanaPage, history: historyPage };

  root.append(
    h('div', 'papp__chrome', [h('i'), h('i'), h('i'), h('span', 'papp__url', ['localhost:8501 · Posture digital twin — control center'])]),
    h('div', 'papp__frame', [
      sidebar,
      h('div', 'papp__main', [
        h('div', 'papp__head', [h('h5', '', ['Posture Digital Twin']), h('div', 'papp__statuses', statusEls)]),
        h('nav', 'papp__tabs', tabBtns),
        body,
      ]),
    ]),
    h('div', 'papp__foot', [caption, guideBtn]),
  );
  host.append(root);

  // ---- actions ----
  const timers: number[] = [];
  const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

  function go(t: Tab) {
    tab = t;
    body.replaceChildren(pages[t]);
    for (const b of tabBtns) b.classList.toggle('is-current', b.dataset.tab === t);
    if (t === 'grafana') grafT = 0;
  }

  function startServices() {
    if (starting || up) return;
    starting = true;
    SERVICES.forEach((_, i) =>
      later(300 * (i + 1), () => {
        up = i + 1;
        if (up === SERVICES.length) {
          starting = false;
          reference = { ...pose }; // the first frame is the reference posture
        }
      }),
    );
  }

  function startReplay() {
    if (up < SERVICES.length || replay) return;
    mode = 'simulation';
    replay = { t: 0, length: ROUTINE.reduce((s, [, d]) => s + d, 0) };
  }

  function setPose(p: PoseName) {
    target = p;
  }

  // ---- the simulation ----
  function routinePose(t: number): PoseName {
    let acc = 0;
    for (const [name, d] of ROUTINE) {
      acc += d;
      if (t < acc) return name;
    }
    return 'upright';
  }

  function step(dt: number) {
    const guided = root.classList.contains('is-guided');
    if (replay) {
      replay.t += dt * speed;
      target = routinePose(replay.t);
      if (replay.t >= replay.length) {
        replay = null;
        target = 'upright';
      }
    } else if (live() && !guided) {
      // the person moves by themself when nobody is scripting them
      routineT += dt;
      if (routineT > ROUTINE[routineAt][1]) {
        routineT = 0;
        routineAt = (routineAt + 1) % ROUTINE.length;
      }
      target = ROUTINE[routineAt][0];
    }
    const goal = POSES[target];
    const k = Math.min(1, dt * 3.2 * (replay ? speed : 1));
    for (const key of KEYS) pose[key] += (goal[key] - pose[key]) * k + (Math.random() - 0.5) * 0.25;
    if (!streaming()) return;
    sampleT += dt;
    while (sampleT > 0.05) {
      sampleT -= 0.05;
      history.push({ ...pose });
      if (history.length > 200) history.shift();
    }
    mqttT += dt;
    if (mqttT > 0.35) {
      mqttT = 0;
      const imu = Math.random() < 0.5;
      const payload = imu
        ? `{"pitch": ${pose.tp.toFixed(1)}, "roll": ${pose.tr.toFixed(1)}}`
        : `{"head": [${pose.hy.toFixed(0)}, ${pose.hp.toFixed(0)}, ${pose.hr.toFixed(0)}], "shoulders": ${pose.sh.toFixed(1)}}`;
      feed.prepend(h('li', '', [h('span', '', [clock()]), h('b', '', [imu ? 'posture/imu' : 'posture/camera']), payload]));
      while (feed.children.length > 7) feed.lastElementChild!.remove();
    }
  }

  // ---- drawing ----
  /** The front view's joints, in px, from the angles. */
  function frontJoints(p: Pose, cx: number, base: number, s: number) {
    const lean = rad(p.tr);
    const torso = 92 * s * Math.cos(rad(p.tp) * 0.9); // slouching shortens the torso seen from the front
    const neck = { x: cx + Math.sin(lean) * torso, y: base - Math.cos(lean) * torso };
    const half = 34 * s;
    const tilt = lean + rad(p.sh) * 0.6;
    const ls = { x: neck.x - Math.cos(tilt) * half, y: neck.y + 8 * s - Math.sin(tilt) * half };
    const rs = { x: neck.x + Math.cos(tilt) * half, y: neck.y + 8 * s + Math.sin(tilt) * half };
    const hl = lean + rad(p.hr);
    const headLen = 30 * s * Math.cos(rad(p.hp) * 0.8);
    const head = { x: neck.x + Math.sin(hl) * headLen + p.hy * 0.4 * s, y: neck.y - Math.cos(hl) * headLen };
    const arm = (sh: { x: number; y: number }, abd: number, side: number) => {
      const a = rad(abd) * side + lean;
      const el = { x: sh.x + Math.sin(a) * 40 * s, y: sh.y + Math.cos(a) * 40 * s };
      const wr = { x: el.x + Math.sin(a * 1.1) * 36 * s, y: el.y + Math.cos(a * 1.1) * 36 * s };
      return { el, wr };
    };
    return { hips: { x: cx, y: base }, neck, ls, rs, head, l: arm(ls, p.al, -1), r: arm(rs, p.ar, 1) };
  }

  function drawWebcam() {
    const { ctx } = cam;
    const W = 320, H = 240;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#d9d4cc');
    g.addColorStop(1, '#b9b2a7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#a49c90';
    ctx.fillRect(0, 190, W, 50);
    if (!streaming()) return offline(ctx, W, H, 'Webcam off — start the services');
    const j = frontJoints(pose, W / 2, 215, 1);
    // the person
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.moveTo(j.ls.x - 6, j.ls.y);
    ctx.lineTo(j.rs.x + 6, j.rs.y);
    ctx.lineTo(j.hips.x + 30, j.hips.y + 20);
    ctx.lineTo(j.hips.x - 30, j.hips.y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0b899';
    ctx.beginPath();
    ctx.ellipse(j.head.x, j.head.y - 4, 17, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    // MediaPipe landmarks and bones
    const bones: [{ x: number; y: number }, { x: number; y: number }][] = [
      [j.ls, j.rs], [j.neck, j.head], [j.neck, j.hips], [j.ls, j.l.el], [j.l.el, j.l.wr], [j.rs, j.r.el], [j.r.el, j.r.wr],
    ];
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    for (const [a, b] of bones) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff3b30';
    for (const p of [j.head, j.neck, j.ls, j.rs, j.l.el, j.l.wr, j.r.el, j.r.wr, j.hips]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = '600 11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(6, 6, 118, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(replay ? '● REPLAY · MediaPipe' : '● LIVE · MediaPipe Pose', 12, 19);
    label(ctx, j.head.x + 22, j.head.y - 10, `head ${pose.hp.toFixed(0)}°`);
    label(ctx, j.rs.x + 10, j.rs.y + 4, `Δ shoulders ${pose.sh.toFixed(0)}°`);
  }

  function label(ctx: CanvasRenderingContext2D, x: number, y: number, s: string) {
    ctx.font = '600 10px Helvetica, Arial, sans-serif';
    const w = ctx.measureText(s).width + 8;
    ctx.fillStyle = 'rgba(0, 104, 201, 0.9)';
    ctx.fillRect(x, y - 11, w, 15);
    ctx.fillStyle = '#fff';
    ctx.fillText(s, x + 4, y);
  }

  function offline(ctx: CanvasRenderingContext2D, W: number, H: number, text: string) {
    ctx.fillStyle = 'rgba(20, 20, 24, 0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = '600 12px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, H / 2);
    ctx.textAlign = 'left';
  }

  /** Blender: front and side views of the armature, side by side. */
  function drawTwinViews(ctx: CanvasRenderingContext2D, W: number, H: number) {
    ctx.fillStyle = '#393939';
    ctx.fillRect(0, 0, W, H);
    const half = W / 2;
    const s = H / 250;
    for (let v = 0; v < 2; v++) {
      const x0 = v * half;
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(x0 + (i / 10) * half, 0);
        ctx.lineTo(x0 + (i / 10) * half, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0, (i / 10) * H);
        ctx.lineTo(x0 + half, (i / 10) * H);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `${11 * s}px Helvetica, Arial, sans-serif`;
      ctx.fillText(v ? 'Right Orthographic' : 'Front Orthographic', x0 + 8, 16 * s);
    }
    ctx.strokeStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(half, H);
    ctx.stroke();
    if (!streaming()) return offline(ctx, W, H, 'Waiting for MQTT data');
    const warnTorso = pose.tp > limit || Math.abs(pose.tr) > LATERAL_LIMIT;
    // front
    const j = frontJoints(pose, half / 2, H - 30 * s, s);
    bone(ctx, j.hips, j.neck, warnTorso, s);
    bone(ctx, j.neck, j.head, false, s);
    bone(ctx, j.neck, j.ls, false, s * 0.7);
    bone(ctx, j.neck, j.rs, false, s * 0.7);
    bone(ctx, j.ls, j.l.el, false, s * 0.8);
    bone(ctx, j.l.el, j.l.wr, false, s * 0.7);
    bone(ctx, j.rs, j.r.el, false, s * 0.8);
    bone(ctx, j.r.el, j.r.wr, false, s * 0.7);
    // side: forward pitch is seen here
    const hips = { x: half + half / 2, y: H - 30 * s };
    const tp = rad(pose.tp);
    const neck = { x: hips.x + Math.sin(tp) * 92 * s, y: hips.y - Math.cos(tp) * 92 * s };
    const hp = tp + rad(pose.hp) * 0.8;
    const head = { x: neck.x + Math.sin(hp) * 30 * s, y: neck.y - Math.cos(hp) * 30 * s };
    const arm = rad(Math.max(pose.al, pose.ar) * 0.3);
    const wrist = { x: neck.x + Math.sin(arm + tp * 0.3) * 70 * s, y: neck.y + 8 * s + Math.cos(arm) * 70 * s };
    bone(ctx, hips, neck, warnTorso, s);
    bone(ctx, neck, head, false, s);
    bone(ctx, { x: neck.x, y: neck.y + 8 * s }, wrist, false, s * 0.8);
    // the axis gizmo
    const gx = 22 * s, gy = H - 18 * s;
    for (const [dx, dy, c] of [[16, 0, '#ff3352'], [0, -16, '#2f83e4'], [10, -8, '#8bdc00']] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + dx * s, gy + dy * s);
      ctx.stroke();
    }
  }

  /** A Blender octahedral bone from a to b. */
  function bone(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, warn: boolean, s: number) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const w = Math.min(9 * s, len * 0.18);
    const m = { x: a.x + dx * 0.2, y: a.y + dy * 0.2 };
    ctx.fillStyle = warn ? '#ff8a3a' : '#b8b8b8';
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(m.x + nx * w, m.y + ny * w);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(m.x - nx * w, m.y - ny * w);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d8d8d8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChart() {
    const { ctx } = chart;
    const W = 560, H = 150, L = 34, B = 18;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    const y = (v: number) => H - B - ((v + 5) / 45) * (H - B - 8);
    ctx.strokeStyle = '#eceef2';
    ctx.fillStyle = ST.dim;
    ctx.font = '10px Helvetica, Arial, sans-serif';
    for (const v of [0, 10, 20, 30, 40]) {
      ctx.beginPath();
      ctx.moveTo(L, y(v));
      ctx.lineTo(W - 6, y(v));
      ctx.stroke();
      ctx.fillText(`${v}°`, 6, y(v) + 3);
    }
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = ST.red;
    ctx.beginPath();
    ctx.moveTo(L, y(limit));
    ctx.lineTo(W - 6, y(limit));
    ctx.stroke();
    ctx.setLineDash([]);
    const series: [keyof Pose, string, string][] = [['tp', ST.blue, 'torso pitch'], ['hp', ST.light, 'head pitch'], ['sh', '#29b09d', 'shoulder asym.']];
    series.forEach(([key, c, name], i) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      history.forEach((p, k) => {
        const x = L + (k / 199) * (W - L - 6);
        if (k) ctx.lineTo(x, y(p[key]));
        else ctx.moveTo(x, y(p[key]));
      });
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(L + 6 + i * 110, 4, 10, 3);
      ctx.fillStyle = ST.ink;
      ctx.fillText(name, L + 20 + i * 110, 9);
    });
    ctx.fillStyle = ST.red;
    ctx.fillText(`alert ${limit}°`, W - 56, y(limit) - 4);
  }

  // the one-hour session, made up once: a few slouches and corrections
  const HOUR = Array.from({ length: 240 }, (_, i) => {
    const t = i / 240;
    const slouch = Math.max(0, Math.sin(t * 9.5) - 0.55) * 40 + Math.max(0, Math.sin(t * 23 + 1) - 0.8) * 30;
    const n = (k: number) => Math.sin(i * 0.9 + k) * 1.2 + Math.sin(i * 0.23 + k * 2) * 1.5;
    return {
      hp: 4 + slouch * 0.8 + n(1),
      hr: Math.sin(t * 14) * 4 + n(2),
      ht: Math.sin(t * 7 + 2) * 3 + n(3),
      sh: 2 + Math.max(0, Math.sin(t * 6 + 3) - 0.6) * 25 + n(4) * 0.6,
      al: 8 + Math.max(0, Math.sin(t * 17) - 0.85) * 300 + n(5) * 0.5,
      ar: 8 + Math.max(0, Math.sin(t * 13 + 2) - 0.88) * 260 + n(6) * 0.5,
      tp: 4 + slouch + n(7) * 0.7,
    };
  });

  function drawGrafana(dt: number) {
    const { ctx } = graf;
    const W = 640, H = 300;
    grafT = Math.min(1, grafT + dt / 1.6);
    ctx.fillStyle = '#111217';
    ctx.fillRect(0, 0, W, H);
    const panels: { title: string; keys: [keyof (typeof HOUR)[0], string, string][]; max: number }[] = [
      { title: 'Head — pitch · roll · tilt', keys: [['hp', '#73bf69', 'pitch'], ['hr', '#f2cc0c', 'roll'], ['ht', '#5794f2', 'tilt']], max: 45 },
      { title: 'Torso inclination (MPU6050)', keys: [['tp', '#ff9830', 'pitch']], max: 50 },
      { title: 'Shoulder asymmetry', keys: [['sh', '#b877d9', 'asym.']], max: 25 },
      { title: 'Arm abduction', keys: [['al', '#8ab8ff', 'left'], ['ar', '#ff7383', 'right']], max: 90 },
    ];
    panels.forEach((p, i) => {
      const x0 = 6 + (i % 2) * (W / 2), y0 = 6 + Math.floor(i / 2) * (H / 2);
      const pw = W / 2 - 12, ph = H / 2 - 12;
      ctx.fillStyle = '#181b1f';
      ctx.fillRect(x0, y0, pw, ph);
      ctx.strokeStyle = '#25282d';
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);
      ctx.fillStyle = '#ccccdc';
      ctx.font = '600 11px Helvetica, Arial, sans-serif';
      ctx.fillText(p.title, x0 + 8, y0 + 16);
      const cx = x0 + 28, cy = y0 + 26, cw = pw - 36, chh = ph - 48;
      ctx.strokeStyle = '#22252b';
      ctx.fillStyle = '#8e8e9e';
      ctx.font = '9px Helvetica, Arial, sans-serif';
      for (let g = 0; g <= 2; g++) {
        const gy = cy + chh - (g / 2) * chh;
        ctx.beginPath();
        ctx.moveTo(cx, gy);
        ctx.lineTo(cx + cw, gy);
        ctx.stroke();
        ctx.fillText(`${Math.round((g / 2) * p.max)}°`, x0 + 4, gy + 3);
      }
      ['−60m', '−30m', 'now'].forEach((s, k) => ctx.fillText(s, cx + (k / 2) * cw - (k ? 12 : 0), cy + chh + 12));
      const n = Math.floor(HOUR.length * grafT);
      p.keys.forEach(([key, c, name], k) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let q = 0; q < n; q++) {
          const px = cx + (q / (HOUR.length - 1)) * cw;
          const py = cy + chh - Math.max(0, Math.min(1, HOUR[q][key] / p.max)) * chh;
          if (q) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.fillRect(cx + k * 64, y0 + ph - 10, 8, 3);
        ctx.fillStyle = '#ccccdc';
        ctx.fillText(name, cx + 12 + k * 64, y0 + ph - 6);
      });
    });
  }

  // ---- render ----
  function render(dt: number) {
    statusEls.forEach((el, i) => el.classList.toggle('is-ok', up > STATUS[i].service));
    serviceRows.forEach((li, i) => {
      li.classList.toggle('is-up', up > i);
      li.classList.toggle('is-starting', starting && up === i);
    });
    startBtn.disabled = starting || up > 0;
    startBtn.textContent = up >= SERVICES.length ? 'Running' : starting ? 'Starting…' : 'Start services';
    stopBtn.disabled = !up;
    for (const b of modeBtns) b.classList.toggle('is-on', b.dataset.mode === mode);
    limitVal.textContent = `${limit}°`;
    if (document.activeElement !== limitInput) limitInput.value = String(limit);

    if (tab === 'live') {
      drawWebcam();
      drawChart();
      if (!streaming()) {
        alert.className = 'st-alert is-info';
        alert.textContent = up >= SERVICES.length ? 'Simulation mode — replay a session from the History tab.' : 'Start the services from the sidebar to receive sensor data.';
      } else if (pose.tp > limit) {
        alert.className = 'st-alert is-warn';
        alert.textContent = `Forward slouching — torso pitch ${pose.tp.toFixed(0)}° is over the ${limit}° limit.`;
      } else if (Math.abs(pose.tr) > LATERAL_LIMIT) {
        alert.className = 'st-alert is-warn';
        alert.textContent = `Lateral leaning — torso roll ${pose.tr.toFixed(0)}° is over the ${LATERAL_LIMIT}° limit.`;
      } else {
        alert.className = 'st-alert is-ok';
        alert.textContent = replay ? `Replaying ${session.label} at ${speed}× — posture within limits.` : 'Posture within limits.';
      }
      for (const m of metrics) {
        const on = streaming();
        m.value.textContent = on ? `${pose[m.key].toFixed(1)}°` : '—';
        const d = on && reference ? pose[m.key] - reference[m.key] : 0;
        m.delta.textContent = on && reference ? `${d >= 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}° vs reference` : '';
        m.delta.className = Math.abs(d) > 8 ? 'is-bad' : 'is-good';
      }
    }
    if (tab === 'twin') drawTwinViews(twin.ctx, 560, 250);
    if (tab === 'grafana') drawGrafana(dt);
    if (tab === 'history') {
      for (const tr of sessionRows) tr.classList.toggle('is-current', tr.dataset.id === session.id);
      for (const b of speedBtns) b.classList.toggle('is-on', Number(b.dataset.speed) === speed);
      replayBtn.disabled = up < SERVICES.length || !!replay;
      replayBtn.textContent = up < SERVICES.length ? 'Start the services first' : replay ? 'Replaying…' : 'Replay session';
      const prog = replay ? replay.t / replay.length : 0;
      replayFill.style.transform = `scaleX(${prog})`;
      replayText.textContent = replay ? `${session.label} · ${Math.round(prog * 100)}% · ${speed}×` : 'Idle';
      replaySteps.forEach((li, i) => li.classList.toggle('is-on', !!replay && (i < 3 || prog > 0.02)));
      drawTwinViews(mini.ctx, 400, 190);
    }
  }

  // ---- the loop ----
  let raf = 0;
  let last = 0;
  let alive = true;
  function frame(t: number) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    step(dt);
    render(dt);
  }
  raf = requestAnimationFrame(frame);

  // ---- the guided demo ----
  const guide = createGuide({
    root,
    caption,
    button: guideBtn,
    outro: 'Services → live alerts → twin → Grafana → replay. Again in a moment.',
    reset() {
      up = 0;
      starting = false;
      replay = null;
      reference = null;
      mode = 'monitoring';
      limit = 20;
      speed = 2;
      session = SESSIONS[1];
      Object.assign(pose, POSES.upright);
      target = 'upright';
      history.length = 0;
      feed.replaceChildren();
      go('live');
    },
    async script({ say, sleep, click }) {
      const toTab = (t: Tab) => click(tabBtns[tabItems.findIndex((x) => x.id === t)]);
      say('Start every service from one dashboard.');
      if (!(await click(startBtn, 2300))) return false;
      say('Webcam + IMU give angles, compared with your reference posture.');
      if (!(await sleep(2600))) return false;
      setPose('slouch');
      say('Slouching? The alert fires at once.');
      if (!(await sleep(2800))) return false;
      setPose('lean');
      say('Leaning sideways: roll and shoulders are tracked too.');
      if (!(await sleep(2500))) return false;
      setPose('arms');
      say('The Blender twin mirrors every move, over MQTT.');
      if (!(await toTab('twin'))) return false;
      if (!(await sleep(1500))) return false;
      setPose('slouch');
      if (!(await sleep(1500))) return false;
      setPose('upright');
      say('Grafana: a whole hour at a glance.');
      if (!((await toTab('grafana')) && (await sleep(2800)))) return false;
      say('Replay a recorded session through MQTT, at 4×.');
      if (!(await click(modeBtns[1], 300))) return false;
      if (!(await toTab('history'))) return false;
      if (!(await click(sessionRows[1], 300))) return false;
      if (!(await click(speedBtns[2], 300))) return false;
      if (!(await click(replayBtn, 600))) return false;
      while (replay) if (!(await sleep(300))) return false;
      return sleep(600);
    },
  });

  go('live');
  guide.start();

  return () => {
    alive = false;
    guide.dispose();
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    root.remove();
  };
}
