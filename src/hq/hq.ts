import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';
import { isPreview } from '../preview';
import { buildRoom, type Hotspot, type View, type Zone } from './room';
import { openReport } from '../os/report';
import { mountDemo } from '../signs/demos';
import type { Experience } from '../signs/content';
import '../pages'; // side-effect import: declares the pageenter/pageleave event types used below

/**
 * The HQ (see room.ts): seen from high in a corner, with a label on each zone.
 * Click a zone and the camera walks to it. In the computers zone, hovering a
 * screen moves in on it and leaving it moves back; clicking it opens the
 * experience (live demo, details, the report in a browser window). In the
 * Xandvar corner, the TV moves in the same way and opens the brand's page.
 * Esc, or the back button, goes up a level.
 */

interface Shot extends View {
  fov: number;
}

// From high in the corner by the door, looking down into the room (like the reference shot).
const OVERVIEW: Shot = { position: new THREE.Vector3(1.75, 2.42, 2.3), target: new THREE.Vector3(-0.35, 0.35, -1.0), fov: 66 };
const ZONE_FOV = 46;
const PEEK_FOV = 36;
const WALK = { duration: 1.8, ease: 'power2.inOut' };
const PEEK = { duration: 1.05, ease: 'power3.inOut' };
const UNPEEK_AFTER = 220; // ms off a screen before the camera moves back (no flicker at its edges)

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const { class: className, ...rest } = props;
  const el = Object.assign(document.createElement(tag), rest);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

function buildPanel(e: Experience) {
  const meta = [e.where, e.when].filter(Boolean).join(' · ');
  const report = e.report
    ? h('button', { class: 'hq__report', type: 'button', onclick: () => openReport(e) }, ['Read the report', h('span', {}, ['↗'])])
    : h('p', { class: 'signs__panel-note' }, ['No written report for this project.']);
  return [
    h('p', { class: 'signs__panel-kicker' }, [e.role]),
    h('h3', { class: 'signs__panel-title' }, [e.title]),
    h('p', { class: 'signs__panel-meta' }, [meta]),
    ...(e.team ? [h('p', { class: 'signs__panel-team' }, [e.team])] : []),
    report,
    h('div', { class: 'signs__panel-demo' }),
    h('p', { class: 'signs__panel-summary' }, [e.summary]),
    h('ul', { class: 'signs__panel-list' }, e.highlights.map((x) => h('li', {}, [x]))),
    h('ul', { class: 'signs__panel-stack' }, e.stack.map((x) => h('li', {}, [x]))),
    ...(e.note ? [h('p', { class: 'signs__panel-note' }, [e.note])] : []),
  ];
}

/** Solid things cast and receive shadows; glass, glows and screens don't. */
function castShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.Material | THREE.Material[];
    const solid = !(Array.isArray(m) ? m : [m]).some((x) => x.transparent || (x as THREE.MeshBasicMaterial).isMeshBasicMaterial);
    mesh.castShadow = solid && !mesh.userData.noShadow;
    mesh.receiveShadow = true;
  });
}

export function initHq(): void {
  const found = document.querySelector<HTMLElement>('#hq');
  if (!found) return;
  const section: HTMLElement = found;
  const stage = section.querySelector<HTMLElement>('.hq__stage')!;
  const loading = section.querySelector<HTMLElement>('.hq__loading')!;
  const crumb = section.querySelector<HTMLElement>('.hq__crumb')!;
  const backBtn = section.querySelector<HTMLButtonElement>('.hq__back')!;
  const nav = section.querySelector<HTMLElement>('.hq__zones')!;
  const labels = section.querySelector<HTMLElement>('.hq__labels')!;
  const tip = section.querySelector<HTMLElement>('.hq__tip')!;
  const panel = section.querySelector<HTMLElement>('.hq__panel')!;
  const panelBody = panel.querySelector<HTMLElement>('.signs__panel-body')!;
  const closeBtn = panel.querySelector<HTMLButtonElement>('.signs__panel-close')!;

  // ---- three.js ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.append(renderer.domElement);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, done, total) => (loading.dataset.progress = `${Math.round((done / total) * 100)}%`);
  manager.onLoad = () => {
    if (loft) castShadows(loft.group);
    section.classList.add('is-loaded');
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0b09');
    const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(OVERVIEW.fov, 1, 0.05, 300);
  camera.position.copy(OVERVIEW.position);
  const lookAt = OVERVIEW.target.clone();

  scene.add(new THREE.HemisphereLight('#ffd7a8', '#2a2018', 0.16));
  RectAreaLightUniformsLib.init(); // (the LED coves, the window, the screens: see room.ts)

  // The room (textures and props from public/hq) loads the first time the page is
  // about to be shown, not with the rest of the site.
  let loft: ReturnType<typeof buildRoom> | null = null;
  let zones: Zone[] = [];
  function ensureLoft() {
    if (loft) return;
    new HDRLoader(manager).load('/hq/env/office_night_1k.hdr', (hdr) => {
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
    });
    loft = buildRoom(manager);
    scene.add(loft.group);
    zones = loft.zones;
    buildZoneUi();
  }
  document.addEventListener('page:prepare', (e) => e.detail.id === 'hq' && ensureLoft());

  // Rendered into a multisampled target: post-processing would otherwise lose
  // the antialiasing (jagged, "pixelated" edges).
  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.25, distanceExponent: 1.5, thickness: 0.5, scale: 1.2 });
  composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.6, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  if (isPreview) {
    // a small card on the home page: lighter
    ao.enabled = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }

  function resize() {
    const w = stage.clientWidth;
    const hgt = stage.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    composer.setSize(w, hgt);
    bloom.setSize(w, hgt);
    ao.setSize(w, hgt);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  /** Portrait screens see less across: widen the angle a little. */
  const fovFor = (fov: number) => (camera.aspect < 1 ? fov * 1.35 : fov);

  // ---- state ----
  let zone: Zone | null = null; // the zone we're in (null: the overview)
  let peeked: Hotspot | null = null; // the screen the camera moved in on (hover)
  let focused: Hotspot | null = null; // the experience open in the panel
  let hoveredZone: Zone | null = null;
  let flying: gsap.core.Timeline | null = null;
  let busy = false; // while the camera moves, the pointer waits
  let unpeekTimer: ReturnType<typeof setTimeout> | undefined;
  let stopDemo: (() => void) | null = null;
  const pointer = new THREE.Vector2(); // ndc, for the parallax

  const shot = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, fov: OVERVIEW.fov };
  function setShot(s: Shot) {
    Object.assign(shot, { x: s.position.x, y: s.position.y, z: s.position.z, tx: s.target.x, ty: s.target.y, tz: s.target.z, fov: s.fov });
  }
  setShot(OVERVIEW);
  function fly(to: Shot, how: { duration: number; ease: string }, then?: () => void) {
    busy = true;
    flying?.kill();
    flying = gsap.timeline({ onComplete: () => ((busy = false), then?.()) }).to(shot, {
      x: to.position.x,
      y: to.position.y,
      z: to.position.z,
      tx: to.target.x,
      ty: to.target.y,
      tz: to.target.z,
      fov: to.fov,
      duration: t(how.duration),
      ease: how.ease,
    });
  }

  const zoneShot = (z: Zone): Shot => ({ ...z.view, fov: ZONE_FOV });
  function spotShot(s: Hotspot, framing: 'peek' | 'focus'): Shot {
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, s.normal).normalize();
    const target = s.center.clone();
    const dist = s.size * (framing === 'peek' ? 1.45 : 2.4);
    if (framing === 'focus') {
      // leave room for the panel: on the right (wide) or at the bottom (narrow)
      if (camera.aspect < 1) target.y -= s.size * 0.42;
      else target.addScaledVector(right, s.size * 0.5);
    }
    const position = target.clone().addScaledVector(s.normal, dist).add(new THREE.Vector3(0, s.size * 0.06, 0));
    return { position, target, fov: PEEK_FOV };
  }

  // ---- labels on the zones (overview) ----
  const zoneLabels = new Map<Zone, HTMLElement>();
  const project = new THREE.Vector3();
  function placeLabels() {
    const show = !zone;
    for (const [z, label] of zoneLabels) {
      project.copy(z.anchor).project(camera);
      label.style.transform = `translate(${((project.x + 1) / 2) * stage.clientWidth}px, ${((1 - project.y) / 2) * stage.clientHeight}px) translate(-50%, -50%)`;
      label.classList.toggle('is-on', show && project.z < 1);
      label.classList.toggle('is-hot', hoveredZone === z);
    }
  }

  // ---- zones ----
  function setCrumb() {
    crumb.textContent = zone ? `${zone.label} · ${zone.hint}` : 'Click a zone';
    backBtn.hidden = !zone;
    for (const btn of nav.querySelectorAll<HTMLButtonElement>('button')) btn.classList.toggle('is-current', (btn.dataset.zone ?? '') === (zone?.id ?? ''));
  }
  function enter(z: Zone | null) {
    if (focused) closePanel(false);
    clearTimeout(unpeekTimer);
    setSpotHover(null);
    peeked = null;
    zone = z;
    hoveredZone = null;
    stage.style.cursor = '';
    setCrumb();
    fly(z ? zoneShot(z) : OVERVIEW, WALK);
  }
  function up() {
    if (focused) closePanel();
    else if (zone) enter(null);
  }

  /** The zones' labels and buttons, once the room is built. */
  function buildZoneUi() {
    for (const z of zones) {
      const label = h('button', { class: 'hq__label', type: 'button', onclick: () => enter(z) }, [h('span', { class: 'hq__label-dot' }), z.label]);
      labels.append(label);
      zoneLabels.set(z, label);
    }
    nav.append(
      h('button', { type: 'button', onclick: () => enter(null) }, ['Overview']),
      ...zones.map((z) => {
        const b = h('button', { type: 'button', onclick: () => enter(z) }, [z.label]);
        b.dataset.zone = z.id;
        return b;
      }),
    );
    (nav.firstElementChild as HTMLElement).dataset.zone = '';
    setCrumb();
  }
  backBtn.addEventListener('click', up);
  closeBtn.addEventListener('click', () => closePanel());

  // ---- screens: hover moves in, leaving moves back, click opens ----
  let hoveredSpot: Hotspot | null = null;
  function setSpotHover(s: Hotspot | null) {
    if (s === hoveredSpot) return;
    if (hoveredSpot && hoveredSpot !== focused) hoveredSpot.highlight(false);
    hoveredSpot = s;
    if (s) s.highlight(true);
    stage.style.cursor = s ? 'pointer' : '';
    tip.textContent = s ? s.label : '';
    tip.classList.toggle('is-on', !!s && !focused);
    if (!zone || focused) return;
    clearTimeout(unpeekTimer);
    if (s) peek(s);
    else unpeekTimer = setTimeout(unpeek, UNPEEK_AFTER);
  }
  function peek(s: Hotspot) {
    if (peeked === s) return;
    peeked = s;
    fly(spotShot(s, 'peek'), PEEK);
  }
  function unpeek() {
    if (!peeked || focused || !zone) return;
    peeked = null;
    fly(zoneShot(zone), PEEK);
  }

  function openSpot(s: Hotspot) {
    if (s.kind === 'section') {
      document.dispatchEvent(new CustomEvent('page:goto', { detail: { id: s.section! } }));
      return;
    }
    const e = s.experience!;
    focused = s;
    peeked = s;
    clearTimeout(unpeekTimer);
    tip.classList.remove('is-on');
    fly(spotShot(s, 'focus'), PEEK);
    stopDemo?.();
    panelBody.replaceChildren(...buildPanel(e));
    panelBody.scrollTop = 0;
    stopDemo = mountDemo(e.kind, panelBody.querySelector('.signs__panel-demo')!);
    section.classList.add('is-panel');
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
  }
  function closePanel(moveBack = true) {
    if (!focused) return;
    stopDemo?.();
    stopDemo = null;
    focused.highlight(false);
    focused = null;
    peeked = null;
    hoveredSpot = null;
    section.classList.remove('is-panel');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    if (moveBack && zone) fly(zoneShot(zone), PEEK);
  }

  // ---- picking ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function ray(clientX: number, clientY: number) {
    const r = stage.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  function pickZone(clientX: number, clientY: number) {
    ray(clientX, clientY);
    const hit = raycaster.intersectObjects(zones.map((z) => z.hit), false)[0];
    return hit ? (zones.find((z) => z.hit === hit.object) ?? null) : null;
  }
  function pickSpot(clientX: number, clientY: number) {
    if (!zone) return null;
    ray(clientX, clientY);
    const hit = raycaster.intersectObjects(zone.spots.flatMap((s) => s.hits), false)[0];
    const id = hit?.object.userData.spot as string | undefined;
    return id ? (zone.spots.find((s) => s.id === id) ?? null) : null;
  }
  /** Is the pointer within the on-screen outline of the screen the camera moved in on? */
  const bounds = new THREE.Box3();
  function withinOutline(s: Hotspot, clientX: number, clientY: number) {
    bounds.makeEmpty();
    for (const o of s.hits) bounds.expandByObject(o);
    const r = stage.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Vector3(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z).project(camera);
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    }
    const x = ((clientX - r.left) / r.width) * 2 - 1;
    const y = -((clientY - r.top) / r.height) * 2 + 1;
    return x >= minX - 0.05 && x <= maxX + 0.05 && y >= minY - 0.05 && y <= maxY + 0.05;
  }

  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (e.pointerType === 'touch' || busy || focused) return;
    if (!zone) {
      hoveredZone = pickZone(e.clientX, e.clientY);
      stage.style.cursor = hoveredZone ? 'pointer' : '';
      return;
    }
    let s = pickSpot(e.clientX, e.clientY);
    if (!s && peeked && withinOutline(peeked, e.clientX, e.clientY)) s = peeked;
    setSpotHover(s);
    if (s) tip.style.transform = `translate(${e.clientX - r.left + 16}px, ${e.clientY - r.top + 12}px)`;
  });
  stage.addEventListener('pointerleave', () => {
    hoveredZone = null;
    if (!focused) setSpotHover(null);
  });
  stage.addEventListener('click', (e) => {
    if (busy) return;
    if (!zone) {
      const z = pickZone(e.clientX, e.clientY);
      if (z) enter(z);
      return;
    }
    const s = pickSpot(e.clientX, e.clientY);
    if (s && s !== focused) openSpot(s);
    else if (!s && focused) closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !section.inert && document.querySelector('.os-window') === null) up();
  });

  // ---- adaptive quality (as in the Experiences scene) ----
  const maxRatio = Math.min(window.devicePixelRatio, 2);
  let quality = 0;
  let sampleTime = 0;
  let sampleFrames = 0;
  function degrade() {
    quality += 1;
    if (quality === 1) ao.enabled = false;
    if (quality === 2) {
      // never below 1.5× on sharp screens: a soft image reads as pixelated
      renderer.setPixelRatio(Math.min(maxRatio, 1.5));
      composer.setPixelRatio(Math.min(maxRatio, 1.5));
      resize();
    }
    if (quality === 3) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) m.needsUpdate = true;
      });
    }
  }
  function watchFrameRate(dt: number) {
    if (quality >= 3 || !dt || !section.classList.contains('is-loaded')) return;
    sampleTime += dt;
    sampleFrames += 1;
    if (sampleTime < 2) return;
    const average = sampleTime / sampleFrames;
    sampleTime = 0;
    sampleFrames = 0;
    if (average > 1 / 42) degrade();
  }

  // ---- render loop (only while the page is shown) ----
  let running = false;
  let last = 0;
  const sway = new THREE.Vector3();
  const parallax = new THREE.Vector2();
  function frame(now: number) {
    if (!running) return;
    requestAnimationFrame(frame);
    const time = now / 1000;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    watchFrameRate(dt);
    const still = isReducedMotion();
    if (!still) loft?.tick(time);
    // a hand-held camera: a slow sway, and a little parallax with the pointer
    const loose = !peeked && !focused && !still;
    parallax.lerp(loose ? pointer : new THREE.Vector2(), Math.min(1, dt * 3));
    sway.set(Math.sin(time * 0.31) * 0.025, Math.sin(time * 0.23) * 0.018, 0).multiplyScalar(loose ? 1 : 0.15);
    camera.position.set(shot.x + sway.x + parallax.x * 0.12, shot.y + sway.y + parallax.y * 0.06, shot.z);
    lookAt.set(shot.tx + parallax.x * 0.05, shot.ty + parallax.y * 0.03, shot.tz);
    const fov = fovFor(shot.fov);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(lookAt);
    placeLabels();
    composer.render();
  }

  // ---- page visits ----
  section.addEventListener('pageenter', (e) => {
    ensureLoft();
    running = true;
    last = 0;
    requestAnimationFrame(frame);
    if (zone || focused) enter(null);
    // walk in through the door
    flying?.kill();
    setShot({ position: new THREE.Vector3(1.4, 1.9, 2.0), target: new THREE.Vector3(-0.2, 0.9, -1.5), fov: OVERVIEW.fov - 6 });
    fly(OVERVIEW, { duration: 2.4, ease: 'power2.out' });
    if (e.detail.instant) flying?.progress(1);
    setCrumb();
  });
  section.addEventListener('pageleave', () => {
    if (focused) closePanel(false);
    if (isPreview) running = false;
    else setTimeout(() => section.inert && (running = false), 1000);
  });
  setCrumb();

  // dev only: where a zone's screens are on the page (for the screenshot tests)
  if (import.meta.env.DEV) {
    (window as Window & { __hqDebug?: unknown }).__hqDebug = {
      spot(i: number) {
        const s = zone?.spots[i];
        if (!s) return null;
        const p = s.center.clone().project(camera);
        const r = stage.getBoundingClientRect();
        return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
      },
    };
  }
}
