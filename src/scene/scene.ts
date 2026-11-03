import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';

export type PersonId = 1 | 2 | 3 | 4 | 5;

export interface PersonSelectDetail {
  person: PersonId;
}

declare global {
  interface HTMLElementEventMap {
    'person:select': CustomEvent<PersonSelectDetail>;
  }
}

const PEOPLE_IDS: readonly PersonId[] = [1, 2, 3, 4, 5];

const HIGHLIGHT_SCALE = 1.045;

interface Person {
  id: PersonId;
  layer: HTMLImageElement;
  idle: HTMLImageElement;
  label: HTMLElement;
  hotspot: HTMLButtonElement;
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

export function initScene(): void {
  const wrap = must<HTMLElement>(document, '#hero');
  const stage = must<HTMLElement>(document, '#stage');
  const base = must<HTMLImageElement>(stage, '.layer--base');
  const dim = must<HTMLImageElement>(stage, '.layer--dim');

  const people: Person[] = PEOPLE_IDS.map((id) => ({
    id,
    layer: must<HTMLImageElement>(stage, `.layer--person[data-person="${id}"]`),
    idle: must<HTMLImageElement>(stage, `.layer--idle[data-person="${id}"]`),
    label: must<HTMLElement>(stage, `.role[data-person="${id}"]`),
    hotspot: must<HTMLButtonElement>(stage, `.hotspot[data-person="${id}"]`),
  }));

  // -- Highlight state ---------------------------------------------------
  // Hover events only *request* a person; the change is applied once per
  // frame. Moving straight from one person to the next therefore never
  // flickers the dimmed background off and back on.
  let current: Person | null = null;
  let requested: Person | null = null;
  let frame = 0;

  const request = (person: Person | null) => {
    requested = person;
    if (!frame) frame = requestAnimationFrame(commit);
  };

  const release = (person: Person) => {
    if (requested === person) request(null);
  };

  function commit() {
    frame = 0;
    if (requested === current) return;

    const previous = current;
    current = requested;

    if (previous) hide(previous);
    if (current) show(current);
    if (!previous || !current) tweenDim(current !== null);
  }

  function tweenDim(on: boolean) {
    gsap.to(dim, {
      opacity: on ? 1 : 0,
      duration: t(0.5),
      ease: on ? 'power2.out' : 'power2.inOut',
      overwrite: 'auto',
    });
  }

  function show({ layer, label }: Person) {
    gsap.to(layer, {
      opacity: 1,
      scale: HIGHLIGHT_SCALE,
      duration: t(0.6),
      ease: 'back.out(1.4)', // a touch of overshoot — the highlight "pops" in rather than just fading
      overwrite: 'auto',
    });
    gsap.fromTo(
      label,
      { opacity: 0, y: 14, scale: 0.88 },
      { opacity: 1, y: 0, scale: 1, duration: t(0.45), delay: t(0.05), ease: 'back.out(2.2)', overwrite: 'auto' },
    );
  }

  function hide({ layer, label }: Person) {
    gsap.to(layer, {
      opacity: 0,
      scale: 1,
      duration: t(0.4),
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
    gsap.to(label, { opacity: 0, y: 10, duration: t(0.2), ease: 'power2.in', overwrite: 'auto' });
  }

  // -- Input ---------------------------------------------------------------
  for (const person of people) {
    const { hotspot, id } = person;

    hotspot.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') request(person);
    });
    hotspot.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') release(person);
    });

    // Touch has no hover: a tap highlights the person until you tap elsewhere.
    hotspot.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') request(person);
    });

    // Keyboard only (a mouse click also focuses the button; hover already covers it).
    hotspot.addEventListener('focus', () => {
      if (hotspot.matches(':focus-visible')) request(person);
    });
    hotspot.addEventListener('blur', () => release(person));

    hotspot.addEventListener('click', () => {
      stage.dispatchEvent(
        new CustomEvent<PersonSelectDetail>('person:select', { detail: { person: id }, bubbles: true }),
      );
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !(e.target as Element).closest('.hotspot')) request(null);
  });

  // -- Boot ------------------------------------------------------------------
  void reveal();

  async function reveal() {
    const idleLayers = people.map((p) => p.idle);
    const layers = [base, dim, ...idleLayers, ...people.map((p) => p.layer)];

    await Promise.all([
      ...layers.map((img) => img.decode().catch(() => undefined)),
      document.fonts.load('600 1em Montserrat').catch(() => undefined),
    ]);

    // Browsers skip painting (hence uploading to the GPU) fully transparent
    // layers, which would make the very first hover stutter. Paint each one
    // invisibly (≈1% opacity) for a couple of frames before the reveal. Not
    // the idle layers: they join the reveal tween below immediately, so they
    // never sit invisible for long enough to need pre-warming.
    const idleSet = new Set<HTMLImageElement>(idleLayers);
    const warm = layers.filter((l) => l !== base && !idleSet.has(l as HTMLImageElement));
    gsap.set(warm, { opacity: 0.01 });
    await nextFrames(2);
    gsap.set(warm, { opacity: 0 });

    // Same "coming into focus" language as the whoosh between sections. The
    // idle layers ride along (same pixels as the base at rest — see
    // bake-layers.mjs) so they fade in together, seamlessly. The breathing
    // loop only starts once this settles at scale 1 — starting it in
    // parallel would fight this tween for the same `scale` property.
    gsap.fromTo(
      [base, ...idleLayers],
      { opacity: 0, scale: 1.045, filter: 'blur(16px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: t(1.15), ease: 'power3.out', onComplete: breathe },
    );
  }

  /** A light, endless "alive" loop — each person grows very slightly and settles
   *  back, never shrinking below their rest size (so it never reveals a gap
   *  against the static photo underneath), each on its own unsynced rhythm. */
  function breathe() {
    if (isReducedMotion()) return;
    for (const { idle, id } of people) {
      gsap.to(idle, {
        scale: 1.01 + (id % 3) * 0.003,
        duration: 3.4 + id * 0.35,
        delay: id * 0.18,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // -- Subtle mouse-parallax tilt (pointer devices only) ---------------------
  if (!isReducedMotion() && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const TILT_MAX = 2.2; // degrees — kept small so it reads as depth, not a gimmick

    // quickTo reuses one tween per property and just retargets it on every
    // move, instead of spinning up a new gsap.to() on every pointermove —
    // the difference that matters once this fires 60+ times a second.
    const tiltX = gsap.quickTo(stage, 'rotateX', { duration: 0.7, ease: 'power2.out' });
    const tiltY = gsap.quickTo(stage, 'rotateY', { duration: 0.7, ease: 'power2.out' });

    wrap.addEventListener('pointermove', (e) => {
      const r = wrap.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tiltX(-py * TILT_MAX);
      tiltY(px * TILT_MAX * 2);
    });
    wrap.addEventListener('pointerleave', () => {
      tiltX(0);
      tiltY(0);
    });
  }
}

function nextFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(count);
  });
}
