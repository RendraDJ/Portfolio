import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { isReducedMotion, t } from '../motion';
import { pieces } from './products';
import { carousel } from './carousel';
import { initParticles } from './particles';
import { initMenubar } from './menubar';
import { initPhone } from './phone';
import { initStudio } from '../os/studio';
import '../pages'; // side-effect import: declares the pageenter/pageleave event types used below

gsap.registerPlugin(SplitText);

const DRIFT_SPEED = 120; // px/s
const RESUME_AFTER_LEAVE = 500; // ms after the pointer leaves the shelf
const RESUME_AFTER_TOUCH = 1600; // ms — touch has no hover, so give a tap longer before the shelf moves again

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

export function initBrand(): void {
  const section = must<HTMLElement>(document, '#brand');
  const shelf = must<HTMLElement>(section, '.brand__shelf');
  const track = must<HTMLElement>(section, '.brand__shelf-track');
  const viewerFrame = must<HTMLElement>(section, '.brand__viewer-frame');
  const viewerName = must<HTMLElement>(section, '.brand__viewer-name');
  const prevBtn = must<HTMLButtonElement>(section, '.brand__viewer-nav--prev');
  const nextBtn = must<HTMLButtonElement>(section, '.brand__viewer-nav--next');
  const particles = must<HTMLElement>(section, '.brand__particles');

  initStudio(section); // first: puts the whole section on the studio monitor
  initParticles(section, particles);
  initMenubar(section);
  const phone = initPhone(section);

  // ---- Shelf: purely a decorative, always-moving backdrop — behind-the-scenes
  // photos and clips, in no particular order. Plain <div>s, not buttons: there's
  // nothing to click and no per-item name to give them as an accessible label
  // (see tapes.ts for the richer expand-on-select pattern, which does have both).
  //
  // Two identical copies of the 15 items, drifting one-way and wrapping by
  // exactly one copy's width — invisibly, since both halves are pixel-identical
  // (the same trick as the old tapes shelf). Unlike that shelf's 5 tapes, 15
  // items is plenty to rule out ever seeing the same one twice on screen at
  // once (at most ~2 are visible at a time here), so there's no need for the
  // slower back-and-forth bounce that fix required — a real loop reads better
  // and is what was actually asked for. --
  function buildPiece(item: (typeof carousel)[number]): HTMLDivElement {
    const media =
      item.type === 'video'
        ? h('video', { src: item.src, muted: true, autoplay: true, loop: true, playsInline: true, disablePictureInPicture: true })
        : h('img', { src: item.src, alt: '', decoding: 'async', draggable: false });
    return h('div', { class: 'brand__piece' }, [media]);
  }
  for (const item of [...carousel, ...carousel]) track.append(buildPiece(item));
  // Scale, not a y-slide — matches the tapes shelf's reasoning: the track's
  // own overflow-x: hidden would clip a vertical entrance offset. Set to its
  // hidden "from" state on each pageenter below, not here — see the entrance section.
  const pieceEls = Array.from(track.children) as HTMLElement[];

  // ---- Auto-drift: endless, one direction — see the note above. ----
  let auto = true;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  let lastTick = 0;
  let rafId = 0;
  let driftPos = 0;

  function pause() {
    auto = false;
    clearTimeout(resumeTimer);
  }

  function scheduleResume(delay: number) {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      driftPos = shelf.scrollLeft; // resync: a manual scroll happened while paused
      auto = true;
    }, delay);
  }

  function tick(now: number) {
    rafId = requestAnimationFrame(tick);
    const dt = lastTick ? Math.min(now - lastTick, 100) / 1000 : 0;
    lastTick = now;
    if (!auto || isReducedMotion()) return;
    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;
    driftPos += DRIFT_SPEED * dt;
    if (driftPos >= halfWidth) driftPos -= halfWidth;
    shelf.scrollTo({ left: driftPos, behavior: 'auto' });
  }

  function startDrift() {
    if (rafId) return;
    lastTick = 0;
    driftPos = shelf.scrollLeft;
    rafId = requestAnimationFrame(tick);
  }
  function stopDrift() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  section.addEventListener('pageenter', startDrift);
  section.addEventListener('pageleave', stopDrift);

  shelf.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'touch') pause();
  });
  shelf.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') scheduleResume(RESUME_AFTER_LEAVE);
  });
  shelf.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      pause();
      scheduleResume(RESUME_AFTER_TOUCH);
    },
    { passive: true },
  );

  // ---- Viewer: independent of the shelf — arrows page through the clothing
  // pieces on their own index, exactly like the reference poster shows a
  // different piece featured than whichever the shelf happens to be showing. --
  let index = 0;
  let nameSplit: SplitText | null = null;

  function renderViewer(immediate = false) {
    const piece = pieces[index];
    const img = h('img', { src: piece.src, alt: piece.name, decoding: 'async', draggable: false });

    if (immediate) {
      viewerFrame.replaceChildren(img);
      viewerName.textContent = piece.name;
      return;
    }

    const outgoing = viewerFrame.querySelector('img');
    gsap.set(img, { opacity: 0, scale: 0.92 });
    viewerFrame.appendChild(img);

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
    if (outgoing) {
      tl.to(outgoing, { opacity: 0, scale: 0.92, duration: t(0.25), ease: 'power2.in', onComplete: () => outgoing.remove() }, 0);
    }
    tl.to(img, { opacity: 1, scale: 1, duration: t(0.4), ease: 'power3.out' }, outgoing ? t(0.08) : 0);

    nameSplit?.revert();
    viewerName.textContent = piece.name;
    nameSplit = new SplitText(viewerName, { type: 'chars' });
    tl.from(nameSplit.chars, { yPercent: 100, opacity: 0, duration: t(0.45), stagger: t(0.012), ease: 'power3.out' }, t(0.1));
  }

  function step(delta: 1 | -1) {
    index = (index + delta + pieces.length) % pieces.length;
    renderViewer();
  }

  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  renderViewer(true);

  // ---- Entrance (replays every visit) -----------------------------------------
  // A different move per group instead of one uniform fade, so the section
  // reads as several things converging rather than a single dissolve:
  //  - phone: rises into place; "Brand Identity" tag: slides up
  //  - logo + wordmark: zoom IN (scale up from small) — scale is a different
  //    CSS property from `translate`, so it's safe even on the wordmark/side,
  //    which centre themselves with a CSS `translate` (animating GSAP's own
  //    `x`/`y` on those would fight it — GSAP silently resets `translate` to
  //    none the first time it touches the element).
  //  - background scene + right-side panel: zoom OUT (scale down from big)
  //  - shelf: slides up *and* zooms out, then its own pieces zoom in on top
  // Replays every time this page is (re-)entered, not just the first visit —
  // `pageenter` fires while the page is still hidden mid-crossfade (see
  // pages.ts), so resetting to the "from" state here is never visible.
  const menubar = section.querySelector('.brand__menubar');
  const tag = section.querySelector('.brand__collection-tag');
  const logo = section.querySelector('.brand__logo');
  const wordmark = section.querySelector('.brand__wordmark');
  const side = section.querySelector('.brand__side');
  const sceneLayers = section.querySelectorAll('.brand__layer');

  let entranceTl: gsap.core.Timeline | null = null;
  section.addEventListener('pageenter', (e) => {
    entranceTl?.kill();

    gsap.set(tag, { opacity: 0, y: 26, filter: 'blur(6px)' });
    gsap.set(phone, { opacity: 0, y: 70 });
    gsap.set(menubar, { opacity: 0, y: -14 });
    gsap.set(shelf, { opacity: 0, y: 26, scale: 1.1, filter: 'blur(8px)' });
    gsap.set([logo, wordmark], { opacity: 0, scale: 0.7, filter: 'blur(6px)' });
    gsap.set(side, { opacity: 0, scale: 1.12, filter: 'blur(8px)' });
    gsap.set(sceneLayers, { scale: 1.08 });
    gsap.set(pieceEls, { opacity: 0, scale: 0.85 });

    entranceTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    entranceTl.to(sceneLayers, { scale: 1, duration: t(1.5), ease: 'power2.out' }, 0);
    entranceTl.to(menubar, { opacity: 1, y: 0, duration: t(0.6) }, 0);
    entranceTl.to(tag, { opacity: 1, y: 0, filter: 'blur(0px)', duration: t(0.8) }, t(0.1));
    entranceTl.to(phone, { opacity: 1, y: 0, duration: t(1.1), ease: 'power3.out' }, t(0.2));
    entranceTl.to(shelf, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: t(0.9) }, t(0.15));
    entranceTl.to(pieceEls, { opacity: 1, scale: 1, duration: t(0.5), stagger: t(0.02), ease: 'power2.out' }, t(0.4));
    entranceTl.to([logo, wordmark], { opacity: 1, scale: 1, filter: 'blur(0px)', duration: t(0.8), stagger: t(0.12), ease: 'back.out(1.6)' }, t(0.3));
    entranceTl.to(side, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: t(0.9) }, t(0.35));
    // Arrived straight from its live preview on the home page: already "in".
    if (e.detail.instant) entranceTl.progress(1);
  });
}
