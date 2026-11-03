import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';
import { prints, type Print } from './content';
import '../pages'; // side-effect import: declares the pageenter/pageleave event types used below

/**
 * Home: a portfolio "case-study shot" — a Safari window floating on a blue
 * card over a night-drive backdrop. Inside the window, the page itself: a
 * scrapbook collage on white paper — prints with torn edges, paper clips
 * and pen doodles in ink.
 *
 * The collage is a real 3D scene: every piece sits at its own depth (`--z`)
 * inside `.collage__tilt`, which leans toward the pointer, so the pieces
 * slide over one another like loose paper. A print lifts when hovered and
 * flips over when clicked, showing what's written on its back.
 */

export interface PrintSelectDetail {
  slug: string;
}

declare global {
  interface HTMLElementEventMap {
    'print:select': CustomEvent<PrintSelectDetail>;
  }
}

const TILT_MAX_Y = 9; // degrees
const TILT_MAX_X = 6;

interface Decor {
  kind: 'clip' | 'doodle';
  /** Position/size in % of the collage; `r` = rotation (deg), `z` = depth (px). */
  x: number;
  y: number;
  w: number;
  r: number;
  z: number;
  viewBox: string;
  /** SVG body. Strokes with pathLength="1" are drawn on by the entrance. */
  svg: string;
  color?: string;
}

const pen = (d: string) => `<path pathLength="1" d="${d}" />`;

/** A closed circle as a single pen stroke. */
const ring = (cx: number, cy: number, r: number) => pen(`M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`);

// The four trades, doodled: robotics, code, design, video editing.
const ROBOT =
  pen('M30 14 L30 6') + ring(30, 4, 2.5) +
  pen('M10 14 L50 14 L52 46 L8 46 Z') + ring(21, 27, 4.5) + ring(39, 27, 4.5) +
  pen('M19 38 L41 38 M24 35 L24 41 M30 35 L30 41 M36 35 L36 41') +
  pen('M9 24 L3 24 L3 34 L8 34') + pen('M51 24 L57 24 L57 34 L52 34') +
  pen('M24 46 L24 53 M36 46 L36 53') + pen('M11 64 C11 51 49 51 49 64');
const CODE = pen('M20 6 L5 20 L20 34') + pen('M36 3 L24 37') + pen('M40 6 L55 20 L40 34');
const BEZIER =
  pen('M8 40 C22 2 46 50 62 12') + pen('M8 40 L24 12') + pen('M62 12 L46 40') +
  pen('M5 37 L11 37 L11 43 L5 43 Z') + pen('M59 9 L65 9 L65 15 L59 15 Z') + ring(24, 12, 2.6) + ring(46, 40, 2.6);
const CLAPPER =
  pen('M8 28 L56 28 L56 56 L8 56 Z') + pen('M7 24 L53 9 L55 16 L9 31 Z') +
  pen('M18 21 L24 26 M29 17 L35 22 M40 13 L46 19') + pen('M27 35 L27 50 L41 42 Z');
const STAR = pen('M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z') + pen('M4 4 L20 20 M20 4 L4 20');
const ARROW = pen('M22 2 C19 20 13 38 8 54') + pen('M1 41 L8 55 L19 47');
const CLIP = pen('M10 7 L46 7 A8 8 0 0 1 46 23 L15 23 A5 5 0 0 1 15 13 L42 13');

// Positions measured off the reference, like the prints. Depths interleave
// with the prints' (10–46); clips and the robot (drawn over a print) sit above them.
const DECOR: readonly Decor[] = [
  { kind: 'doodle', x: 94, y: 45, w: 13, r: 4, z: 16, viewBox: '0 0 70 50', svg: BEZIER },
  { kind: 'doodle', x: 77, y: 78, w: 13, r: 5, z: 60, viewBox: '0 0 60 66', svg: ROBOT },
  { kind: 'doodle', x: 95, y: 89, w: 10, r: 8, z: 12, viewBox: '0 0 60 40', svg: CODE },
  { kind: 'doodle', x: 83, y: 101, w: 11, r: -7, z: 24, viewBox: '0 0 64 60', svg: CLAPPER },
  { kind: 'doodle', x: 13, y: 80.5, w: 5, r: 10, z: 20, viewBox: '0 0 24 24', svg: STAR },
  { kind: 'doodle', x: 31, y: 1, w: 4.5, r: 0, z: 32, viewBox: '0 0 26 58', svg: ARROW },
  { kind: 'clip', x: -1, y: 25, w: 21.6, r: 16, z: 54, viewBox: '0 0 58 30', svg: CLIP, color: '#b3261e' },
  { kind: 'clip', x: 65, y: 41, w: 16.5, r: -18, z: 56, viewBox: '0 0 58 30', svg: CLIP, color: '#b8892d' },
  { kind: 'clip', x: 67.5, y: 80, w: 10, r: 72, z: 58, viewBox: '0 0 58 30', svg: CLIP, color: '#8d9098' },
];

function must<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

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

function place(el: HTMLElement, { x, y, w, h: height, r, z }: { x: number; y: number; w: number; h?: number; r: number; z: number }) {
  el.style.setProperty('--x', `${x}%`);
  el.style.setProperty('--y', `${y}%`);
  el.style.setProperty('--w', `${w}%`);
  if (height !== undefined) el.style.setProperty('--h', `${height}%`);
  el.style.setProperty('--r', `${r}deg`);
  el.style.setProperty('--z', `${z}px`);
}

interface Snap {
  print: Print;
  el: HTMLElement;
  card: HTMLElement;
  front: HTMLButtonElement;
  back: HTMLElement;
}

export function initHome(): void {
  const section = must<HTMLElement>(document, '#home');
  const collage = must<HTMLElement>(section, '.collage');
  const tilt = must<HTMLElement>(section, '.collage__tilt');

  // ---- Build ------------------------------------------------------------------
  function buildSnap(print: Print, i: number): Snap {
    // Each face is a plain wrapper carrying the drop shadow, around the torn
    // "paper" (a clip-path would cut the shadow off if both sat on one element).
    const front = h('button', { class: 'snap__face snap__front', type: 'button', ariaLabel: `${print.title} — flip the photo` }, [
      h('span', { class: 'snap__paper' }, [
        print.src
          ? h('img', { src: print.src, alt: print.alt ?? '', decoding: 'async', draggable: false })
          : h('span', { class: 'snap__blank' }),
      ]),
    ]);
    const paper = h('div', { class: 'snap__paper' }, [
      h('p', { class: 'snap__title' }, [print.title]),
      h('p', { class: 'snap__note' }, [print.note]),
    ]);
    if (print.target) {
      const go = h('a', { class: 'snap__go', href: `#${print.target}` }, ['see more →']);
      go.dataset.goto = print.target;
      paper.append(go);
    }
    const back = h('div', { class: 'snap__face snap__back' }, [paper]);
    back.inert = true;
    const card = h('div', { class: 'snap__card' }, [front, back]);
    const el = h('div', { class: `snap snap--torn-${(i % 4) + 1}` }, [card]);
    el.dataset.slug = print.slug;
    place(el, print);
    // Flipped prints all grow to about the same size, whatever their own: enough to read the note.
    el.style.setProperty('--flip', Math.min(34 / print.w, 62 / print.h).toFixed(2));
    return { print, el, card, front, back };
  }

  function buildDecor(decor: Decor): HTMLElement {
    const el = h('div', { class: `decor decor--${decor.kind}`, ariaHidden: 'true' });
    el.innerHTML = `<svg class="${decor.kind === 'clip' ? '' : 'ink'}" viewBox="${decor.viewBox}">${decor.svg}</svg>`;
    if (decor.color) el.style.color = decor.color;
    place(el, decor);
    return el;
  }

  const snaps = prints.map(buildSnap);
  const decors = DECOR.map(buildDecor);
  tilt.append(...decors.filter((_, i) => DECOR[i].kind !== 'clip'), ...snaps.map((s) => s.el), ...decors.filter((_, i) => DECOR[i].kind === 'clip'));

  // ---- Flip (click) -----------------------------------------------------------------
  let flipped: Snap | null = null;

  function setFlipped(snap: Snap, on: boolean) {
    snap.el.classList.toggle('is-flipped', on);
    snap.front.inert = on;
    snap.back.inert = !on;
    gsap.to(snap.card, { rotateY: on ? 180 : 0, duration: t(0.7), ease: 'back.out(1.3)', overwrite: 'auto' });
  }

  function flip(snap: Snap | null) {
    if (flipped && flipped !== snap) setFlipped(flipped, false);
    if (snap) setFlipped(snap, flipped !== snap || !snap.el.classList.contains('is-flipped'));
    flipped = snap && snap.el.classList.contains('is-flipped') ? snap : null;
  }

  for (const snap of snaps) {
    snap.front.addEventListener('click', () => {
      flip(snap);
      section.dispatchEvent(new CustomEvent<PrintSelectDetail>('print:select', { detail: { slug: snap.print.slug }, bubbles: true }));
    });
    // A click on the back (anywhere but its link) turns the print face-up again.
    snap.back.addEventListener('click', (e) => {
      if (!(e.target as Element).closest('.snap__go')) flip(null);
    });
  }
  document.addEventListener('click', (e) => {
    if (flipped && !(e.target as Element).closest('.snap')) flip(null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && flipped) flip(null);
  });

  // ---- 3D tilt toward the pointer (pointer devices only) --------------------------------
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const tiltX = gsap.quickTo(tilt, 'rotateX', { duration: 0.9, ease: 'power2.out' });
    const tiltY = gsap.quickTo(tilt, 'rotateY', { duration: 0.9, ease: 'power2.out' });

    section.addEventListener('pointermove', (e) => {
      if (isReducedMotion()) return;
      const r = collage.getBoundingClientRect();
      const px = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      const py = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      tiltY(px * TILT_MAX_Y);
      tiltX(-py * TILT_MAX_X);
    });
    section.addEventListener('pointerleave', () => {
      tiltX(0);
      tiltY(0);
    });
  }

  // ---- Entrance (replays every visit) ---------------------------------------------------
  // The page gets "made" in front of you: the prints are dealt onto the
  // paper one by one, clipped, then doodled on.
  const strokes = Array.from(section.querySelectorAll<SVGPathElement>('.ink path[pathLength]'));
  // On the card, not the positioned .snap: that one's transform belongs to CSS (resting tilt, depth, hover lift).
  const cards = snaps.map((s) => s.card);
  const clips = decors.filter((_, i) => DECOR[i].kind === 'clip');
  const frame = must(section, '.home__frame');
  const credits = section.querySelectorAll('.home__credit');
  const nav = must(section, '.home__nav');
  let entranceTl: gsap.core.Timeline | null = null;

  section.addEventListener('pageenter', () => {
    entranceTl?.kill();
    flip(null);


    gsap.set(credits, { opacity: 0, y: -12 });
    gsap.set(frame, { opacity: 0, y: 50 });
    gsap.set(nav, { opacity: 0, y: 10 });
    gsap.set(cards, { opacity: 0, y: -90, z: 260, rotate: (i) => (i % 2 ? 14 : -14), scale: 1.15, rotateY: 0 });
    gsap.set(clips, { opacity: 0, y: -30 });
    gsap.set(strokes, { strokeDasharray: 1, strokeDashoffset: 1 });

    entranceTl = gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .to(credits, { opacity: 1, y: 0, duration: t(0.7), stagger: t(0.08) }, 0)
      .to(frame, { opacity: 1, y: 0, duration: t(0.9) }, 0)
      .to(nav, { opacity: 1, y: 0, duration: t(0.6) }, t(0.15))
      .to(cards, { opacity: 1, y: 0, z: 0, rotate: 0, scale: 1, duration: t(0.8), stagger: t(0.09), ease: 'back.out(1.1)' }, t(0.5))
      .to(clips, { opacity: 1, y: 0, duration: t(0.45), stagger: t(0.12), ease: 'back.out(2)' }, t(1.35))
      .to(strokes, { strokeDashoffset: 0, duration: t(0.7), stagger: t(0.045), ease: 'power1.inOut' }, t(1.4))
      // Drop the dash once drawn: with non-scaling strokes the dash is measured in
      // screen pixels, so on a large screen a "full-length" dash stops short of the path's end.
      .set(strokes, { clearProps: 'strokeDasharray,strokeDashoffset' });
  });
}
