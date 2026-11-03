import { createGuide } from './guide';

/**
 * A working replica of the drone project's React supervision app (report
 * §2.2.5–2.2.7): Control (session start-up, live camera views, flight
 * commands), Mission (rack choice, serpentine inspection, PID alignment),
 * Inventory (every read, traced), Results (the tag analysis of each capture)
 * and Archives (past flights, CSV export). A guided cursor drives it by
 * itself with a narration of what happens behind each click; touching the
 * app hands it over to the visitor. Tags and numbers are made up, as in the
 * project (fictitious tags).
 */

type Page = 'control' | 'mission' | 'inventory' | 'results' | 'archives';
type Phase = 'fly' | 'align' | 'capture' | 'read';

interface Row {
  slot: string;
  sku: string;
  lot: string;
  ean: string;
  conf: number;
  status: 'read' | 'check' | 'empty';
  time: string;
  camera: string;
}

const ORDER = ['A1', 'A2', 'A3', 'A4', 'B4', 'B3', 'B2', 'B1', 'C1', 'C2', 'C3', 'C4'];
const EMPTY: Record<string, Set<string>> = { R1: new Set(['B2', 'C4']), R2: new Set(['A3']), R3: new Set(['B1', 'B2', 'C3']) };
const RACKS = ['R1', 'R2', 'R3'];
const INIT = ['AirSim connection', 'Camera parameters', 'Flight controller', 'Ready'];
const PHASE_TIME: Record<Phase, number> = { fly: 0.35, align: 0.3, capture: 0.12, read: 0.18 };
const TOLERANCE = 0.08; // m, as in the report

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

/** The fictitious tag printed on a slot's pallet. */
function tagOf(rack: string, i: number) {
  const k = RACKS.indexOf(rack) * 12 + i;
  const n = (30417 + k * 7331) % 90000;
  return {
    sku: `PL-${String(n).padStart(5, '0')}`,
    lot: `LOT 26-${String(31 + k * 17).padStart(3, '0')}`,
    ean: `3760${String(1234567 + k * 98731).slice(0, 7)}${(k * 7) % 10}${(k * 3) % 10}`,
    conf: 0.86 + ((k * 37) % 13) / 100,
  };
}

const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

export function mountDroneApp(host: HTMLElement): () => void {
  // ---- state ----
  let page: Page = 'control';
  let session: 'off' | 'starting' | 'ready' = 'off';
  let initStep = -1;
  let flying = false;
  let alt = 0; // m above the floor
  let rack = 'R1';
  let running = false;
  let slotIndex = -1;
  let phase: Phase = 'fly';
  let phaseT = 0;
  let err = 0; // m, the PID alignment error
  let rows: Row[] = [];
  let picked: Row | null = null;
  const archives = [
    { id: 'FL-0412', rack: 'R3', when: 'Yesterday 16:42', read: '8 / 9', time: '0:21' },
    { id: 'FL-0411', rack: 'R1', when: 'Yesterday 11:05', read: '10 / 10', time: '0:23' },
    { id: 'FL-0410', rack: 'R2', when: '2 days ago', read: '11 / 11', time: '0:24' },
  ];
  let flightNo = 413;
  let missionStart = 0;

  // ---- the frame: a browser window with the app inside ----
  const root = h('div', 'dapp');
  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: 'control', label: 'Control', icon: '◎' },
    { id: 'mission', label: 'Mission', icon: '▦' },
    { id: 'inventory', label: 'Inventory', icon: '☰' },
    { id: 'results', label: 'Results', icon: '◫' },
    { id: 'archives', label: 'Archives', icon: '⧉' },
  ];
  const navButtons = navItems.map((n) => {
    const b = btn('dapp__nav-btn', [h('span', '', [n.icon]), n.label], () => go(n.id));
    b.dataset.page = n.id;
    return b;
  });
  const sessionBadge = h('span', 'dapp__badge');
  const statusPills = INIT.slice(0, 3).map((s) => h('span', 'dapp__pill', [h('i'), s]));
  const main = h('div', 'dapp__main');
  const caption = h('p', 'dapp__caption');
  const guideBtn = btn('dapp__guide', ['▶ Guided demo'], () => undefined);
  const toast = h('div', 'dapp__toast');

  root.append(
    h('div', 'dapp__chrome', [h('i'), h('i'), h('i'), h('span', 'dapp__url', ['localhost:3000 · Drone inspection — supervision']), h('span', 'dapp__mock', ['Mock mode available'])]),
    h('div', 'dapp__body', [
      h('nav', 'dapp__nav', [h('p', 'dapp__brand', ['DRONE', h('b', '', ['SUP'])]), ...navButtons, h('div', 'dapp__nav-foot', [sessionBadge])]),
      h('div', 'dapp__work', [h('header', 'dapp__top', statusPills), main]),
    ]),
    h('div', 'dapp__foot', [caption, guideBtn]),
    toast,
  );
  host.append(root);

  // ---- Control ----
  const startBtn = btn('dapp-btn dapp-btn--primary', ['Start session'], () => startSession());
  const initList = h('ol', 'dapp__init', INIT.map((s) => h('li', '', [h('i'), s])));
  const tele = { x: h('b'), y: h('b'), z: h('b'), v: h('b'), st: h('b') };
  const takeoffBtn = btn('dapp-btn', ['Take off'], () => {
    if (session === 'ready') flying = true;
  });
  const landBtn = btn('dapp-btn', ['Land'], () => {
    if (!running) flying = false;
  });
  const pad = h('div', 'dapp__pad', ['↑', '←', '↓', '→'].map((a) => btn('dapp__key', [a], () => undefined)));
  const cams = [
    { title: 'Global view', sub: 'Pixel Streaming', draw: drawGlobal },
    { title: 'Pallet camera', sub: 'UDP → MJPEG · 1920×1080 · FOV 90°', draw: drawPallet },
    { title: 'Tag camera', sub: 'UDP → MJPEG · 1920×1080 · FOV 20°', draw: drawTag },
  ].map((c) => {
    const cv = h('canvas');
    cv.width = 320;
    cv.height = 180;
    const fps = h('span', 'dapp__fps');
    const tile = h('figure', 'dapp__cam', [cv, h('figcaption', '', [h('strong', '', [c.title]), h('span', '', [c.sub])]), h('span', 'dapp__live', ['● LIVE']), fps]);
    return { ...c, cv, ctx: cv.getContext('2d')!, tile, fps };
  });
  const controlPage = h('section', 'dapp__page dapp__page--control', [
    h('div', 'dapp__cams', cams.map((c) => c.tile)),
    h('div', 'dapp__row', [
      h('div', 'dapp-card', [h('p', 'dapp-card__title', ['Session']), initList, startBtn]),
      h('div', 'dapp-card', [
        h('p', 'dapp-card__title', ['Drone state · NED']),
        h('dl', 'dapp__tele', [h('dt', '', ['x']), tele.x, h('dt', '', ['y']), tele.y, h('dt', '', ['z']), tele.z, h('dt', '', ['|v|']), tele.v, h('dt', '', ['state']), tele.st]),
      ]),
      h('div', 'dapp-card', [h('p', 'dapp-card__title', ['Flight commands']), h('div', 'dapp__cmds', [takeoffBtn, landBtn]), pad]),
    ]),
  ]);

  // ---- Mission ----
  const rackBtns = RACKS.map((r) => {
    const b = btn('dapp__chip', [`Rack ${r}`], () => {
      if (!running) rack = r;
    });
    b.dataset.rack = r;
    return b;
  });
  const launchBtn = btn('dapp-btn dapp-btn--primary', ['Launch inspection'], () => launch());
  const progressFill = h('i');
  const progressText = h('span');
  const grid = h('div', 'dapp__grid');
  const cells = new Map<string, HTMLElement>();
  for (const level of ['C', 'B', 'A']) for (let c = 1; c <= 4; c++) {
    const id = `${level}${c}`;
    const cell = h('span', 'dapp__cell', [h('b', '', [id]), h('em')]);
    cells.set(id, cell);
    grid.append(cell);
  }
  const pidVal = h('strong');
  const pidBar = h('i');
  const phaseText = h('span', 'dapp__phase');
  const log = h('ol', 'dapp__log');
  const missionPage = h('section', 'dapp__page', [
    h('div', 'dapp__row dapp__row--top', [h('div', 'dapp__chips', rackBtns), launchBtn, h('div', 'dapp__progress', [h('span', 'dapp__bar', [progressFill]), progressText])]),
    h('div', 'dapp__row', [
      h('div', 'dapp-card dapp-card--grow', [h('p', 'dapp-card__title', ['Rack map · serpentine order']), grid]),
      h('div', 'dapp-card', [
        h('p', 'dapp-card__title', ['PID alignment']),
        h('div', 'dapp__pid', [pidVal, h('span', '', [`tolerance ${TOLERANCE} m`])]),
        h('span', 'dapp__bar dapp__bar--pid', [pidBar]),
        phaseText,
        h('p', 'dapp-card__title', ['Mission log']),
        log,
      ]),
    ]),
  ]);

  // ---- Inventory ----
  const tbody = h('tbody');
  const invStats = h('div', 'dapp__stats');
  const exportBtn = btn('dapp-btn', ['Export CSV'], () => {
    if (!rows.length) return;
    showToast(`inspection_${rack}_${new Date().toISOString().slice(0, 10)}.csv exported · ${rows.length} rows`);
  });
  const inventoryPage = h('section', 'dapp__page', [
    h('div', 'dapp__row dapp__row--top', [invStats, exportBtn]),
    h('div', 'dapp-card dapp__table-wrap', [
      h('table', 'dapp__table', [
        h('thead', '', [h('tr', '', ['Rack', 'Slot', 'SKU', 'Lot', 'EAN', 'OCR conf.', 'Status', 'Camera', 'Time'].map((x) => h('th', '', [x])))]),
        tbody,
      ]),
    ]),
  ]);

  // ---- Results ----
  const shot = h('canvas', 'dapp__shot');
  shot.width = 520;
  shot.height = 300;
  const shotCtx = shot.getContext('2d')!;
  const shotMeta = h('dl', 'dapp__meta');
  const thumbs = h('div', 'dapp__thumbs');
  const resultsPage = h('section', 'dapp__page', [
    h('div', 'dapp__row', [h('div', 'dapp-card dapp-card--grow', [h('p', 'dapp-card__title', ['Tag analysis · detection → OCR → barcode']), shot]), h('div', 'dapp-card', [h('p', 'dapp-card__title', ['Capture context']), shotMeta])]),
    h('div', 'dapp-card', [h('p', 'dapp-card__title', ['Captures']), thumbs]),
  ]);

  // ---- Archives ----
  const archList = h('tbody');
  const archivesPage = h('section', 'dapp__page', [
    h('div', 'dapp__row dapp__row--top', [h('p', 'dapp__note', ['Finished missions, kept by the flights router; logistics outputs come from the csv router.']), btn('dapp-btn', ['Export CSV'], () => exportBtn.click())]),
    h('div', 'dapp-card dapp__table-wrap', [h('table', 'dapp__table', [h('thead', '', [h('tr', '', ['Flight', 'Rack', 'When', 'Tags read', 'Duration'].map((x) => h('th', '', [x])))]), archList])]),
  ]);

  const pages: Record<Page, HTMLElement> = { control: controlPage, mission: missionPage, inventory: inventoryPage, results: resultsPage, archives: archivesPage };

  // ---- actions ----
  function go(p: Page) {
    page = p;
    drawnKey = '';
    main.replaceChildren(pages[p]);
    for (const b of navButtons) b.classList.toggle('is-current', b.dataset.page === p);
    if (p === 'results' && !picked && rows.length) picked = rows.find((r) => r.status !== 'empty') ?? null;
    render();
  }

  const timers: number[] = [];
  const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

  function startSession() {
    if (session !== 'off') return;
    session = 'starting';
    INIT.forEach((_, i) => later(500 * (i + 1), () => {
      initStep = i;
      if (i === INIT.length - 1) session = 'ready';
      render();
    }));
    render();
  }

  function launch() {
    if (session !== 'ready' || running) return;
    flying = true;
    running = true;
    rows = [];
    picked = null;
    slotIndex = -1;
    missionStart = performance.now();
    log.replaceChildren();
    addLog(`POST /mission/start · rack ${rack} · ${ORDER.length} slots`);
    nextSlot();
  }

  function nextSlot() {
    slotIndex += 1;
    while (slotIndex < ORDER.length && EMPTY[rack].has(ORDER[slotIndex])) {
      const slot = ORDER[slotIndex];
      rows.push({ slot, sku: '—', lot: '—', ean: '—', conf: 0, status: 'empty', time: clock(), camera: 'cam_tag_20' });
      addLog(`${slot} · no tag · skipped`);
      slotIndex += 1;
    }
    if (slotIndex >= ORDER.length) return finish();
    phase = 'fly';
    phaseT = 0;
    err = 0.55 + Math.random() * 0.2;
  }

  function finish() {
    running = false;
    const read = rows.filter((r) => r.status !== 'empty').length;
    const secs = Math.round((performance.now() - missionStart) / 1000);
    archives.unshift({ id: `FL-0${flightNo++}`, rack, when: `Today ${clock().slice(0, 5)}`, read: `${read} / ${read}`, time: `0:${String(secs).padStart(2, '0')}` });
    addLog(`Mission complete · ${read} tags read · archived`);
    render();
  }

  function addLog(s: string) {
    log.prepend(h('li', '', [h('span', '', [clock()]), s]));
    while (log.children.length > 6) log.lastElementChild!.remove();
  }

  function showToast(s: string) {
    toast.textContent = s;
    toast.classList.add('is-on');
    later(2600, () => toast.classList.remove('is-on'));
  }

  // ---- the simulation ----
  function step(dt: number) {
    const targetAlt = flying ? 3 : 0;
    alt += (targetAlt - alt) * Math.min(1, dt * 1.8);
    if (!running) return;
    phaseT += dt;
    if (phase === 'align') err = Math.max(0.02, err * Math.exp(-dt * 6));
    if (phaseT < PHASE_TIME[phase]) return;
    phaseT = 0;
    const slot = ORDER[slotIndex];
    if (phase === 'fly') phase = 'align';
    else if (phase === 'align') {
      if (err > TOLERANCE) return; // keep aligning
      phase = 'capture';
    } else if (phase === 'capture') phase = 'read';
    else {
      const t = tagOf(rack, slotIndex);
      const row: Row = { slot, ...t, status: t.conf >= 0.9 ? 'read' : 'check', time: clock(), camera: 'cam_tag_20' };
      rows.push(row);
      if (page !== 'results' || !picked) picked = row;
      addLog(`${slot} · ${row.sku} · OCR ${Math.round(row.conf * 100)}%`);
      nextSlot();
    }
  }

  // ---- drawing ----
  function slotPos(slot: string) {
    return { col: Number(slot[1]) - 1, level: 'ABC'.indexOf(slot[0]) };
  }

  function noise(ctx: CanvasRenderingContext2D, w: number, hgt: number) {
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * w, Math.random() * hgt, 2, 1);
  }

  function drawGlobal(ctx: CanvasRenderingContext2D, now: number) {
    const W = 320, H = 180;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d2430');
    g.addColorStop(1, '#0e1117');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(0, 150, W, 30);
    // three racks, the one under inspection in front
    for (let r = 0; r < 3; r++) {
      const x0 = 30 + r * 100, w = 80;
      ctx.strokeStyle = RACKS[r] === rack ? '#ff8a3a' : '#4a5260';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, 50, w, 100);
      for (let l = 1; l < 3; l++) {
        ctx.beginPath();
        ctx.moveTo(x0, 50 + l * 33);
        ctx.lineTo(x0 + w, 50 + l * 33);
        ctx.stroke();
      }
      for (let l = 0; l < 3; l++) for (let c = 0; c < 4; c++) {
        const slot = `${'ABC'[l]}${c + 1}`;
        if (EMPTY[RACKS[r]].has(slot)) continue;
        ctx.fillStyle = '#8a6a44';
        ctx.fillRect(x0 + 3 + c * 19.5, 150 - (l + 1) * 33 + 14, 15, 17);
      }
    }
    // the drone
    const x0 = 30 + RACKS.indexOf(rack) * 100;
    let dx = x0 + 40, dy = 160 - alt * 30;
    if (running && slotIndex >= 0 && slotIndex < ORDER.length) {
      const p = slotPos(ORDER[slotIndex]);
      dx = x0 + 10 + p.col * 19.5;
      dy = 150 - (p.level + 1) * 33 + 8 + err * 20;
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx - 9, dy - 3 + Math.sin(now * 40) * 0.5);
    ctx.lineTo(dx + 9, dy - 3 - Math.sin(now * 40) * 0.5);
    ctx.stroke();
    noise(ctx, W, H);
  }

  function drawPallet(ctx: CanvasRenderingContext2D, now: number) {
    const W = 320, H = 180;
    ctx.fillStyle = '#15181d';
    ctx.fillRect(0, 0, W, H);
    const live = session === 'ready';
    const sway = (running ? err : 0.05) * 40 * Math.sin(now * 2);
    ctx.save();
    ctx.translate(sway, 0);
    ctx.fillStyle = '#3a4250';
    ctx.fillRect(10, 140, 300, 8);
    ctx.fillStyle = '#5b4632';
    ctx.fillRect(70, 128, 180, 12);
    const slot = running && slotIndex >= 0 ? ORDER[Math.min(slotIndex, ORDER.length - 1)] : null;
    if (!slot || !EMPTY[rack].has(slot)) {
      ctx.fillStyle = '#9b7a52';
      ctx.fillRect(85, 50, 150, 78);
      ctx.strokeStyle = '#7b5d3c';
      ctx.strokeRect(85, 50, 150, 78);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(140, 70, 44, 30);
      ctx.fillStyle = '#222';
      for (let i = 0; i < 9; i++) ctx.fillRect(144 + i * 4, 88, i % 3 ? 1.5 : 2.5, 9);
    }
    ctx.restore();
    if (!live) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
    }
    noise(ctx, W, H);
  }

  function drawTagImage(ctx: CanvasRenderingContext2D, W: number, H: number, row: { sku: string; lot: string; ean: string; conf: number } | null, offset: number, overlay: boolean) {
    ctx.fillStyle = '#9b7a52';
    ctx.fillRect(0, 0, W, H);
    if (!row) return;
    const tw = W * 0.62, th = H * 0.66;
    const tx = (W - tw) / 2 + offset * W * 0.6, ty = (H - th) / 2 + offset * H * 0.3;
    ctx.fillStyle = '#f5f5f2';
    ctx.fillRect(tx, ty, tw, th);
    const fs = H * 0.075;
    ctx.fillStyle = '#111';
    ctx.font = `700 ${fs}px Helvetica, Arial, sans-serif`;
    ctx.fillText(row.sku, tx + tw * 0.06, ty + th * 0.2);
    ctx.font = `${fs * 0.75}px Helvetica, Arial, sans-serif`;
    ctx.fillText(row.lot, tx + tw * 0.06, ty + th * 0.34);
    const bx = tx + tw * 0.06, by = ty + th * 0.48, bw = tw * 0.88, bh = th * 0.3;
    for (let i = 0; i < 60; i++) if ((i * 7 + row.ean.charCodeAt(i % row.ean.length)) % 3) ctx.fillRect(bx + (i / 60) * bw, by, (bw / 60) * ((i % 4) + 1) * 0.45, bh);
    ctx.font = `${fs * 0.7}px ui-monospace, Menlo, monospace`;
    ctx.fillText(row.ean, bx, by + bh + fs * 0.9);
    if (!overlay) return;
    const label = (x: number, y: number, s: string, c: string) => {
      ctx.font = `600 ${fs * 0.62}px Helvetica, Arial, sans-serif`;
      const w = ctx.measureText(s).width + 8;
      ctx.fillStyle = c;
      ctx.fillRect(x, y - fs * 0.85, w, fs * 0.85);
      ctx.fillStyle = '#111';
      ctx.fillText(s, x + 4, y - fs * 0.22);
    };
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd166';
    ctx.strokeRect(tx - 4, ty - 4, tw + 8, th + 8);
    label(tx - 4, ty - 6, `tag ${Math.min(0.99, row.conf + 0.08).toFixed(2)}`, '#ffd166');
    ctx.strokeStyle = '#5ab4ff';
    ctx.strokeRect(tx + tw * 0.04, ty + th * 0.07, tw * 0.5, th * 0.32);
    label(tx + tw * 0.56, ty + th * 0.2, `${row.sku} · ${row.conf.toFixed(2)}`, '#5ab4ff');
    ctx.strokeStyle = '#4ade80';
    ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + fs * 1.2);
    label(bx, by + bh + fs * 2.1, `EAN-13 ${row.ean}`, '#4ade80');
  }

  function drawTag(ctx: CanvasRenderingContext2D) {
    const slot = running && slotIndex >= 0 && slotIndex < ORDER.length ? ORDER[slotIndex] : null;
    const row = slot ? tagOf(rack, slotIndex) : session === 'ready' ? tagOf(rack, 0) : null;
    drawTagImage(ctx, 320, 180, row, running ? err * (phase === 'fly' ? 1.2 : 1) : 0, running && (phase === 'read' || phase === 'capture'));
    if (running && phase === 'capture') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(0, 0, 320, 180);
    }
    if (session !== 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, 320, 180);
    }
    noise(ctx, 320, 180);
  }

  // ---- render: the parts of the page on show ----
  let drawnKey = '';
  function render() {
    sessionBadge.textContent = session === 'ready' ? '● Session ready' : session === 'starting' ? '◌ Starting…' : '○ No session';
    sessionBadge.dataset.state = session;
    statusPills.forEach((p, i) => p.classList.toggle('is-ok', initStep >= i));
    for (const b of rackBtns) b.classList.toggle('is-current', b.dataset.rack === rack);

    if (page === 'control') {
      startBtn.disabled = session !== 'off';
      startBtn.textContent = session === 'ready' ? 'Session ready' : session === 'starting' ? 'Starting…' : 'Start session';
      [...initList.children].forEach((li, i) => {
        li.classList.toggle('is-done', initStep >= i);
        li.classList.toggle('is-doing', session === 'starting' && initStep === i - 1);
      });
      const p = running && slotIndex >= 0 && slotIndex < ORDER.length ? slotPos(ORDER[slotIndex]) : { col: 1.5, level: -1 };
      tele.x.textContent = `${(2.4 + p.col * 1.1 + (running ? err * 0.5 : 0)).toFixed(2)} m`;
      tele.y.textContent = `${(-1.6 + (running ? err * 0.3 : 0)).toFixed(2)} m`;
      tele.z.textContent = `${(-alt - Math.max(0, p.level) * 0.9 * (running ? 1 : 0)).toFixed(2)} m`;
      tele.v.textContent = `${(running ? (phase === 'fly' ? 1.5 : err * 2) : flying && alt < 2.9 ? 0.9 : 0).toFixed(2)} m/s`;
      tele.st.textContent = !flying && alt < 0.05 ? 'landed' : running ? phase : alt < 2.9 && flying ? 'taking off' : flying ? 'hovering' : 'landing';
      takeoffBtn.disabled = session !== 'ready' || flying;
      landBtn.disabled = !flying || running;
      for (const c of cams) c.tile.classList.toggle('is-live', session === 'ready');
    }

    if (page === 'mission') {
      launchBtn.disabled = session !== 'ready' || running;
      launchBtn.textContent = running ? 'Inspection running…' : session !== 'ready' ? 'Start a session first' : 'Launch inspection';
      const done = rows.length;
      progressFill.style.transform = `scaleX(${done / ORDER.length})`;
      progressText.textContent = running ? `${done} / ${ORDER.length} slots · ${ORDER[slotIndex] ?? ''}` : done ? `Done · ${done} / ${ORDER.length}` : 'Idle';
      for (const [id, cell] of cells) {
        const row = rows.find((r) => r.slot === id);
        const cur = running && ORDER[slotIndex] === id;
        cell.className = `dapp__cell${cur ? ' is-current' : ''}${row ? ` is-${row.status}` : ''}`;
        cell.querySelector('em')!.textContent = cur ? phase : row ? (row.status === 'empty' ? 'empty' : row.sku) : String(ORDER.indexOf(id) + 1);
      }
      pidVal.textContent = running && phase !== 'fly' ? `${err.toFixed(3)} m` : '— m';
      pidBar.style.transform = `scaleX(${running ? Math.min(1, err / 0.75) : 0})`;
      pidBar.classList.toggle('is-ok', err <= TOLERANCE);
      phaseText.textContent = running ? { fly: 'Flying to the slot', align: 'Aligning on the tag (PID)', capture: 'Capturing · tag camera 20°', read: 'Detecting tag · OCR · barcode' }[phase] : '';
    }

    // the lists only change when a slot is done, or another capture is picked
    const key = `${page}|${rows.length}|${picked?.slot}|${rack}`;
    if (key === drawnKey) return;
    drawnKey = key;

    if (page === 'inventory') {
      const read = rows.filter((r) => r.status === 'read').length;
      const check = rows.filter((r) => r.status === 'check').length;
      const empty = rows.filter((r) => r.status === 'empty').length;
      invStats.replaceChildren(
        ...[
          [String(rows.length), 'slots inspected'],
          [String(read), 'tags read'],
          [String(check), 'to check (OCR < 90%)'],
          [String(empty), 'empty slots'],
        ].map(([v, l]) => h('span', '', [h('b', '', [v]), l])),
      );
      {
        tbody.replaceChildren(
          ...[...rows].reverse().map((r, i) =>
            h('tr', i === 0 && running ? 'is-new' : '', [
              h('td', '', [rack]),
              h('td', '', [r.slot]),
              h('td', '', [r.sku]),
              h('td', '', [r.lot]),
              h('td', 'dapp__mono', [r.ean]),
              h('td', '', [r.status === 'empty' ? '—' : `${Math.round(r.conf * 100)}%`]),
              h('td', '', [h('span', `dapp__status is-${r.status}`, [r.status === 'read' ? 'Read' : r.status === 'check' ? 'Check' : 'Empty'])]),
              h('td', 'dapp__mono', [r.camera]),
              h('td', 'dapp__mono', [r.time]),
            ]),
          ),
        );
        if (!rows.length) tbody.append(h('tr', '', [h('td', 'dapp__empty', ['No inspection yet — launch one from Mission.'])]));
      }
    }

    if (page === 'results') {
      const caps = rows.filter((r) => r.status !== 'empty');
      if (thumbs.querySelectorAll('.dapp__thumb').length !== caps.length || !caps.length) {
        thumbs.replaceChildren(
          ...caps.map((r) => {
            const b = btn('dapp__thumb', [h('b', '', [r.slot]), h('span', '', [r.sku])], () => {
              picked = r;
              render();
            });
            b.dataset.slot = r.slot;
            return b;
          }),
        );
        if (!caps.length) thumbs.append(h('p', 'dapp__note', ['Captures appear here during an inspection.']));
      }
      for (const b of thumbs.querySelectorAll<HTMLElement>('.dapp__thumb')) b.classList.toggle('is-current', b.dataset.slot === picked?.slot);
      drawTagImage(shotCtx, 520, 300, picked, 0, !!picked);
      shotMeta.replaceChildren(
        ...(picked
          ? [
              ['Rack', rack],
              ['Slot', picked.slot],
              ['Camera', `${picked.camera} · 1920×1080`],
              ['Captured', picked.time],
              ['SKU', `${picked.sku} (${picked.conf.toFixed(2)})`],
              ['Lot', picked.lot],
              ['Barcode', picked.ean],
              ['Status', picked.status === 'read' ? 'Read' : 'Check — low OCR confidence'],
            ]
          : [['', 'No capture selected']]
        ).flatMap(([k, v]) => [h('dt', '', [k]), h('dd', '', [v])]),
      );
    }

    if (page === 'archives') {
      archList.replaceChildren(...archives.map((a) => h('tr', '', [h('td', 'dapp__mono', [a.id]), h('td', '', [a.rack]), h('td', '', [a.when]), h('td', '', [a.read]), h('td', '', [a.time])])));
    }
  }

  // ---- the loop ----
  let raf = 0;
  let last = 0;
  let acc = 0;
  let alive = true;
  function frame(now: number) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    step(dt);
    if (page === 'control') {
      for (const c of cams) c.draw(c.ctx, now / 1000);
      acc += dt;
      if (acc > 0.5) {
        acc = 0;
        for (const c of cams) c.fps.textContent = session === 'ready' ? `${28 + Math.round(Math.random() * 2)} fps` : 'no signal';
      }
    }
    render();
  }
  raf = requestAnimationFrame(frame);

  // ---- the guided demo: a cursor drives the app and says what happens ----
  const guide = createGuide({
    root,
    caption,
    button: guideBtn,
    outro: 'Session → mission → inventory → results → archives. Again in a moment.',
    reset() {
      running = false;
      rows = [];
      picked = null;
      session = 'off';
      initStep = -1;
      flying = false;
      rack = 'R1';
      go('control');
    },
    async script({ say, sleep, click }) {
      const nav = (p: Page) => click(navButtons[navItems.findIndex((n) => n.id === p)]);
      say('Start a session: AirSim, cameras and flight controller checked.');
      if (!(await click(startBtn, 2700))) return false;
      say('Three live camera feeds, streamed over UDP.');
      if (!(await sleep(2000))) return false;
      say('Take off: the drone state updates live.');
      if (!(await click(takeoffBtn, 1500))) return false;
      say('Pick a rack, launch the inspection.');
      if (!((await nav('mission')) && (await click(rackBtns[0], 300)) && (await click(launchBtn, 600)))) return false;
      say('Serpentine path; a PID loop aligns on every tag.');
      if (!(await sleep(3800))) return false;
      say('Each read lands in the inventory.');
      if (!((await nav('inventory')) && (await sleep(3000)))) return false;
      say('Every capture keeps its analysis: tag, text, barcode.');
      if (!(await nav('results'))) return false;
      const t = thumbs.querySelectorAll<HTMLElement>('.dapp__thumb');
      if (t[0] && !(await click(t[0], 1600))) return false;
      if (!(t[2] ? await click(t[2], 1500) : await sleep(1500))) return false;
      while (running) if (!(await sleep(300))) return false;
      say('Flights archived, inventory exported as CSV.');
      if (!(await nav('archives'))) return false;
      return click(archivesPage.querySelector<HTMLElement>('.dapp-btn')!, 2200);
    },
  });

  go('control');
  guide.start();

  return () => {
    alive = false;
    guide.dispose();
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    root.remove();
  };
}
