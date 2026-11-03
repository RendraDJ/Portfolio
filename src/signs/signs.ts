import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';
import { isPreview } from '../preview';
import { buildPole, type SignPart } from './build';
import { buildRoom } from './room';
import { experiences, type Experience } from './content';
import { mountDemo } from './demos';
import '../pages'; // side-effect import: declares the pageenter/pageleave event types used below

/**
 * Experiences: a street pole in 3D, with one object per experience on it (a
 * drone, a robot arm, a mailbox, someone at a desk, a little robot — see
 * build.ts). Drag to turn the pole. Hover an object and the camera moves in
 * on it (nothing else opens); move off it and the camera pulls back. Click
 * it and the camera frames it while a panel opens with the details; close
 * the panel (×, Esc, a click on empty space) to pull back.
 *
 * Built on three.js; the object is generated in build.ts. Rendering only runs
 * while the page is on screen.
 */

// Seen from high up and in front, like a security camera in the corner of the room.
const OVERVIEW = { position: new THREE.Vector3(0, 5.2, 13.5), target: new THREE.Vector3(0, -0.9, 0) };
const AUTO_SPIN = 0.12; // rad/s while idle
const DRAG_SPEED = 0.008; // rad per px
const FLY = { duration: 1.3, ease: 'power3.inOut' };
const HOVER_GLOW = 1.6; // × a sign's resting glow when hovered or open
const PEEK = { duration: 1, ease: 'power3.inOut' }; // turning to, and moving in on, a hovered object
const UNPEEK_AFTER = 220; // ms off an object before the camera pulls back (no flicker at its edges)
const ROOM_DIM = 0.2; // × the light the room's surfaces send back, against the pole's

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

/** The nearest angle to `from` that is equivalent to `to` (mod 2π). */
function nearestAngle(from: number, to: number) {
  const turn = Math.PI * 2;
  return to + Math.round((from - to) / turn) * turn;
}

function buildPanel(e: Experience) {
  const meta = [e.where, e.when].filter(Boolean).join(' · ');
  return [
    h('p', { class: 'signs__panel-kicker' }, [e.role]),
    h('h3', { class: 'signs__panel-title' }, [e.title]),
    h('p', { class: 'signs__panel-meta' }, [meta]),
    ...(e.team ? [h('p', { class: 'signs__panel-team' }, [e.team])] : []),
    h('div', { class: 'signs__panel-demo' }),
    h('p', { class: 'signs__panel-summary' }, [e.summary]),
    h('ul', { class: 'signs__panel-list' }, e.highlights.map((x) => h('li', {}, [x]))),
    h('ul', { class: 'signs__panel-stack' }, e.stack.map((x) => h('li', {}, [x]))),
    ...(e.note ? [h('p', { class: 'signs__panel-note' }, [e.note])] : []),
  ];
}

/** Solid things cast and receive shadows; glass, glows and see-through bits don't. */
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

export function initSigns(): void {
  const found = document.querySelector<HTMLElement>('#signs');
  if (!found) return;
  const section: HTMLElement = found;
  const stage = section.querySelector<HTMLElement>('.signs__stage')!;
  const panel = section.querySelector<HTMLElement>('.signs__panel')!;
  const panelBody = section.querySelector<HTMLElement>('.signs__panel-body')!;
  const closeBtn = section.querySelector<HTMLButtonElement>('.signs__panel-close')!;
  const tip = section.querySelector<HTMLElement>('.signs__tip')!;
  const nav = section.querySelector<HTMLElement>('.signs__nav')!;

  // ---- three.js setup ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.AgXToneMapping; // filmic, keeps bright screens and LEDs from going flat
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // (soft edges come from shadow.radius)
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050505');
  scene.fog = new THREE.FogExp2('#050505', 0.04);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.copy(OVERVIEW.position);
  const lookAt = OVERVIEW.target.clone();

  scene.add(new THREE.AmbientLight('#ffffff', 0.12));
  scene.add(new THREE.HemisphereLight('#6d7ea8', '#2a2018', 0.14)); // just enough for the room to read in the dark
  const key = new THREE.SpotLight('#fff2e0', 20, 40, 0.5, 0.7, 1.6);
  key.position.set(3, 6, 8);
  scene.add(key);
  // a work lamp hanging over the pole: the one light that casts shadows
  const overhead = new THREE.SpotLight('#ffe9cc', 42, 20, 0.62, 0.85, 1.4);
  overhead.position.set(0.6, 7.5, 1.8);
  overhead.target.position.set(0, -3.5, 0);
  overhead.castShadow = true;
  overhead.shadow.mapSize.set(1536, 1536);
  overhead.shadow.bias = -0.0004;
  overhead.shadow.normalBias = 0.02;
  overhead.shadow.radius = 4;
  scene.add(overhead, overhead.target);
  const rim = new THREE.PointLight('#ff2a10', 40, 18, 1.8);
  rim.position.set(-2.5, 1, -3.5);
  const rim2 = new THREE.PointLight('#ff5a00', 25, 16, 1.8);
  rim2.position.set(3, -2, -2.5);
  scene.add(rim, rim2);
  // the hideout around it (still; only the pole turns)
  const room = buildRoom();
  scene.add(room.group);
  castShadows(room.group);
  // the room sits a step darker than the pole, so the pole reads first: its
  // lit surfaces (diffuse and reflections) are scaled down in the shader,
  // while screens and LEDs keep their glow
  const dimmed = new Set<THREE.Material>();
  room.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const x of m ? (Array.isArray(m) ? m : [m]) : []) {
      if (dimmed.has(x) || !(x as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
      dimmed.add(x);
      x.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `outgoingLight = (outgoingLight - totalEmissiveRadiance) * ${ROOM_DIM.toFixed(2)} + totalEmissiveRadiance;\n#include <opaque_fragment>`,
        );
      };
      x.customProgramCacheKey = () => 'room-dim';
    }
  });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // ambient occlusion: the soft darkening where things meet (feet on the floor, cables, corners)
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1, scale: 1.2 });
  ao.blendIntensity = 1;
  composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.5, 0.88);
  composer.addPass(bloom);
  composer.addPass(new FilmPass(0.5)); // film grain, like the reference shots
  composer.addPass(new OutputPass());

  // ---- the object (after the fonts, so the signs' lettering is right) ----
  let parts: SignPart[] = [];
  let hitTargets: THREE.Object3D[] = [];
  const spinner = new THREE.Group();
  scene.add(spinner);
  void document.fonts.load('800 64px Montserrat').finally(() => {
    const { root, parts: built } = buildPole(experiences);
    spinner.add(root);
    castShadows(root);
    parts = built;
    hitTargets = parts.flatMap((p) => p.hits);
  });

  // ---- size ----
  function resize() {
    const w = stage.clientWidth;
    const hgt = stage.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    composer.setSize(w, hgt);
    bloom.setSize(w, hgt);
    ao.setSize(w, hgt);
    camera.aspect = w / hgt;
    // narrow screens: step back so the whole pole stays in view
    camera.fov = w < hgt ? 44 : 32;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---- state ----
  let rotation = 0; // the pole's rotation (radians)
  let velocity = 0; // from dragging, decays
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let hovered: SignPart | null = null;
  let focused: SignPart | null = null;
  let flying: gsap.core.Timeline | null = null;
  let peeked: SignPart | null = null; // the object the camera has moved in on (hover)
  let unpeekTimer: ReturnType<typeof setTimeout> | undefined;
  let stopDemo: (() => void) | null = null; // the panel's live demo

  function setGlow(part: SignPart, boost: number) {
    for (const { material, rest } of part.glow) {
      gsap.to(material, { emissiveIntensity: rest * boost, duration: t(0.3), overwrite: 'auto' });
    }
  }

  // ---- picking ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX: number, clientY: number): SignPart | null {
    const r = stage.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitTargets, false)[0];
    const slug = hit?.object.userData.slug as string | undefined;
    if (hit) hitPoint.copy(hit.point);
    return slug ? (parts.find((p) => p.experience.slug === slug) ?? null) : null;
  }
  const hitPoint = new THREE.Vector3(); // where the last pick touched the object (world)

  /** Is the pointer within the on-screen outline of `part` (gaps included)? */
  const bounds = new THREE.Box3();
  function withinOutline(part: SignPart, clientX: number, clientY: number) {
    bounds.setFromObject(part.group);
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
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  function setHovered(part: SignPart | null, clientX = 0, clientY = 0) {
    if (part !== hovered) {
      if (hovered && hovered !== focused) setGlow(hovered, 1);
      hovered = part;
      if (hovered) setGlow(hovered, HOVER_GLOW);
      stage.style.cursor = hovered ? 'pointer' : dragging ? 'grabbing' : 'grab';
      tip.textContent = hovered ? hovered.experience.title : '';
      tip.classList.toggle('is-on', !!hovered && !focused);
      // move in on it — or, a moment after leaving it, pull back
      if (!focused) {
        clearTimeout(unpeekTimer);
        if (hovered) peek(hovered, clientX, clientY);
        else unpeekTimer = setTimeout(unpeek, UNPEEK_AFTER);
      }
    }
    if (hovered) {
      const r = section.getBoundingClientRect();
      tip.style.transform = `translate(${clientX - r.left + 16}px, ${clientY - r.top + 12}px)`;
    }
  }

  // ---- hover: turn the object to face us and move in on it ----
  // The pole turns so the object faces the camera, and the camera moves in —
  // framed so the object ends up right under the pointer, which therefore
  // stays on it (no flicker). Leaving it turns the pole back to where it was
  // before the hover and pulls the camera back. While either move runs, the
  // pointer is ignored, so the moving scene can't trigger the next hover.
  let restRotation = 0; // the pole's rotation before the hover, to go back to
  let peekBusy = false;
  const ndcClamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

  function peek(part: SignPart, clientX: number, clientY: number) {
    if (peeked === part || dragging) return;
    if (!peeked) restRotation = rotation;
    peeked = part;
    velocity = 0;

    const targetRotation = nearestAngle(rotation, -part.angle);
    const turned = new THREE.Object3D();
    turned.rotation.y = targetRotation;
    turned.updateMatrixWorld();
    // the point the pointer is on, carried along by the turn
    part.group.updateWorldMatrix(true, false);
    const local = hitPoint.clone().applyMatrix4(part.group.matrixWorld.clone().invert());
    const centre = local.applyMatrix4(part.group.matrix).applyMatrix4(turned.matrixWorld);

    // straight-on view from in front; offset so that point lands under the pointer
    const r = stage.getBoundingClientRect();
    const nx = ndcClamp(((clientX - r.left) / r.width) * 2 - 1, 0.9);
    const ny = ndcClamp(-(((clientY - r.top) / r.height) * 2 - 1), 0.9);
    const dist = part.size * 2.2 + 1;
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const offset = new THREE.Vector3(nx * dist * tanY * camera.aspect, ny * dist * tanY, 0);
    const target = centre.clone().sub(offset);
    const position = target.clone().add(new THREE.Vector3(0, 0, dist));
    move(targetRotation, position, target, PEEK);
  }

  function unpeek() {
    if (!peeked || focused) return;
    peeked = null;
    move(restRotation, OVERVIEW.position, OVERVIEW.target, PEEK);
  }

  /** Turn the pole and move the camera together; the pointer waits until it's done. */
  function move(toRotation: number, position: THREE.Vector3, target: THREE.Vector3, how: { duration: number; ease: string }) {
    const state = { rotation, x: camera.position.x, y: camera.position.y, z: camera.position.z, tx: lookAt.x, ty: lookAt.y, tz: lookAt.z };
    peekBusy = true;
    flying?.kill();
    flying = gsap.timeline({ onUpdate: () => apply(state), onComplete: () => (peekBusy = false) }).to(state, {
      rotation: toRotation,
      x: position.x,
      y: position.y,
      z: position.z,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      duration: t(how.duration),
      ease: how.ease,
    });
  }

  // ---- focus a sign / back to the overview ----
  const worldFocus = new THREE.Vector3();
  function focus(part: SignPart) {
    focused = part;
    peeked = null;
    peekBusy = false;
    clearTimeout(unpeekTimer);
    setHovered(null);
    setGlow(part, HOVER_GLOW);
    velocity = 0;
    for (const btn of nav.querySelectorAll('button')) btn.classList.toggle('is-current', btn.dataset.slug === part.experience.slug);

    // turn the pole so the sign faces the camera, then frame it
    const targetRotation = nearestAngle(rotation, -part.angle);
    const tmp = new THREE.Object3D();
    tmp.rotation.y = targetRotation;
    tmp.updateMatrixWorld();
    worldFocus.copy(part.focus).applyMatrix4(part.group.matrix).applyMatrix4(tmp.matrixWorld);
    const narrow = stage.clientWidth < stage.clientHeight;
    const dist = part.size * (narrow ? 2.6 : 2.6) + 1.4;
    // leave room for the panel: on the right (wide) or at the bottom (narrow)
    const target = worldFocus.clone().add(narrow ? new THREE.Vector3(0, -part.size * 0.55, 0) : new THREE.Vector3(part.size * 0.75, 0, 0));
    const position = target.clone().add(new THREE.Vector3(-0.35, 0.25, dist));

    const state = { rotation, x: camera.position.x, y: camera.position.y, z: camera.position.z, tx: lookAt.x, ty: lookAt.y, tz: lookAt.z };
    flying?.kill();
    flying = gsap
      .timeline({ onUpdate: () => apply(state) })
      .to(state, { rotation: targetRotation, x: position.x, y: position.y, z: position.z, tx: target.x, ty: target.y, tz: target.z, duration: t(FLY.duration), ease: FLY.ease });

    panelBody.replaceChildren(...buildPanel(part.experience));
    panelBody.scrollTop = 0;
    // what it does, live (see demos.ts)
    stopDemo?.();
    stopDemo = mountDemo(part.experience.kind, panelBody.querySelector('.signs__panel-demo')!);
    section.classList.add('is-focused');
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
  }

  function back() {
    if (!focused) return;
    stopDemo?.();
    stopDemo = null;
    setGlow(focused, 1);
    focused = null;
    for (const btn of nav.querySelectorAll('button')) btn.classList.remove('is-current');
    const state = { rotation, x: camera.position.x, y: camera.position.y, z: camera.position.z, tx: lookAt.x, ty: lookAt.y, tz: lookAt.z };
    const p = OVERVIEW.position;
    const tg = OVERVIEW.target;
    flying?.kill();
    flying = gsap.timeline({ onUpdate: () => apply(state) }).to(state, { x: p.x, y: p.y, z: p.z, tx: tg.x, ty: tg.y, tz: tg.z, duration: t(FLY.duration), ease: FLY.ease });
    section.classList.remove('is-focused');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
  }

  function apply(s: { rotation: number; x: number; y: number; z: number; tx: number; ty: number; tz: number }) {
    rotation = s.rotation;
    camera.position.set(s.x, s.y, s.z);
    lookAt.set(s.tx, s.ty, s.tz);
  }

  // ---- input ----
  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    stage.setPointerCapture(e.pointerId);
    stage.style.cursor = 'grabbing';
  });
  stage.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      if (!focused && moved > 4) {
        if (peekBusy) return; // the pole is still turning back from a hover
        if (peeked) {
          // turning the pole: let go of the object we moved in on
          setHovered(null);
          clearTimeout(unpeekTimer);
          unpeek();
          return;
        }
        rotation += dx * DRAG_SPEED;
        velocity = dx * DRAG_SPEED * 60;
      }
      return;
    }
    if (e.pointerType === 'touch' || peekBusy) return; // (see peek: the scene is moving)
    let part = focused ? null : pick(e.clientX, e.clientY);
    // moved in on an object: anywhere within its outline still counts as on it
    if (!part && peeked && !focused && withinOutline(peeked, e.clientX, e.clientY)) part = peeked;
    setHovered(part, e.clientX, e.clientY);
  });
  const release = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    stage.style.cursor = hovered ? 'pointer' : 'grab';
    if (moved > 6) return; // that was a drag, not a click
    const part = pick(e.clientX, e.clientY);
    if (part && part !== focused) focus(part);
    else if (!part && focused) back();
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', () => (dragging = false));
  stage.addEventListener('pointerleave', () => setHovered(null));
  closeBtn.addEventListener('click', back);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && focused && !section.inert) back();
  });

  // a row of names under the pole: the same experiences, for keyboards and for discoverability
  nav.append(
    ...experiences.map((e) => {
      const btn = h('button', { type: 'button' }, [e.title]);
      btn.dataset.slug = e.slug;
      btn.addEventListener('click', () => {
        const part = parts.find((p) => p.experience.slug === e.slug);
        if (part) (focused === part ? back() : focus(part));
      });
      return btn;
    }),
  );

  // ---- adaptive quality ----
  // Starts at full quality; if frames come in too slowly for a while, it gives
  // up the costliest effects one at a time — ambient occlusion, then
  // resolution, then shadows — and never climbs back (no back-and-forth).
  const maxRatio = Math.min(window.devicePixelRatio, 2);
  let quality = 0;
  let sampleTime = 0;
  let sampleFrames = 0;
  function degrade() {
    quality += 1;
    if (quality === 1) ao.enabled = false;
    if (quality === 2) {
      renderer.setPixelRatio(Math.min(maxRatio, 1));
      composer.setPixelRatio(Math.min(maxRatio, 1));
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
    if (quality >= 3 || !dt) return;
    sampleTime += dt;
    sampleFrames += 1;
    if (sampleTime < 2) return;
    const average = sampleTime / sampleFrames;
    sampleTime = 0;
    sampleFrames = 0;
    if (average > 1 / 42) degrade(); // slower than ~42 fps on average over 2 s
  }

  // ---- render loop (only while the page is shown) ----
  let running = false;
  let last = 0;
  function frame(now: number) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    watchFrameRate(dt);
    if (!isReducedMotion()) {
      for (const part of parts) part.tick(now / 1000, dt);
      room.tick(now / 1000);
    }
    if (!focused && !peeked && !dragging && !flying?.isActive()) {
      if (Math.abs(velocity) > 0.01) {
        rotation += velocity * dt;
        velocity *= Math.pow(0.04, dt); // ease out
      } else if (!hovered && !isReducedMotion()) {
        rotation += AUTO_SPIN * dt;
      }
    }
    spinner.rotation.y = rotation;
    camera.lookAt(lookAt);
    composer.render();
  }

  // ---- page visits ----
  let entrance: gsap.core.Timeline | null = null;
  section.addEventListener('pageenter', (e) => {
    running = true;
    last = 0;
    requestAnimationFrame(frame);
    if (focused) back();
    flying?.kill();
    entrance?.kill();
    // swoop in from close above, like the camera of the reference
    const settled = rotation;
    const state = { rotation: settled - 1.6, x: 1.6, y: 3.2, z: 4.2, tx: 0, ty: 1.2, tz: 0 };
    apply(state);
    const p = OVERVIEW.position;
    const tg = OVERVIEW.target;
    entrance = gsap
      .timeline({ onUpdate: () => apply(state) })
      .to(state, { rotation: settled, x: p.x, y: p.y, z: p.z, tx: tg.x, ty: tg.y, tz: tg.z, duration: t(2.2), ease: 'power3.inOut' });
    if (e.detail.instant) entrance.progress(1);
  });
  section.addEventListener('pageleave', () => {
    if (focused) back();
    // in a home-page card, the home page pauses it once it is out of sight;
    // on the site, wait for the page to have faded out
    if (isPreview) running = false;
    else setTimeout(() => section.inert && (running = false), 1000);
  });
}
