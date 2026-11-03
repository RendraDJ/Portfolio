import { gsap } from 'gsap';
import { isReducedMotion, t } from './motion';

/**
 * The site as a controlled deck of full-screen pages — not a scrollable
 * document. An arrow key (never the wheel or a swipe) moves exactly one page;
 * input is locked out for the duration of the move, so you can never land
 * half-way between two pages (no page ever partially, simultaneously shows
 * next to another — they cross-fade through a blur at the same position,
 * which is also what keeps the transition from showing a hard seam between
 * differently-scrolled content).
 *
 * Going back to the home page (page 0) from a section is the opening played
 * backwards: the section first runs its own exit, if it registered one (see
 * registerExit), then fades out over the home page, whose card for it shrinks
 * back into the deck (home.ts).
 */

const TRANSITION = 0.85; // seconds for the cross-fade
const SETTLE = 150; // ms of extra grace after it finishes before input is accepted again
const OUT_BLUR = 16; // px — how blurred the page leaving gets
const IN_BLUR = 14; // px — how blurred the page arriving starts
// A little scale added to the blur crossfade — the entering page grows into
// place and the leaving one recedes, instead of a flat dissolve. Scale (not a
// directional slide) so it never risks the misaligned-edge "seam" the plain
// scroll-linked whoosh used to show — both pages stay perfectly overlapped,
// just zooming from/to their own centre.
const OUT_SCALE = 0.96;
const IN_SCALE = 1.05;
const REVEAL = 0.3; // seconds for a section to fade out over the home page, going back

export interface PageChangeDetail {
  index: number;
  /** True when the page was swapped in with no transition (see `page:goto`):
   *  it should show its final state right away instead of playing its entrance. */
  instant?: boolean;
  /** Section id of the page on the other side of the change. */
  from?: string;
}

export interface PageGotoDetail {
  /** Section id of the page to show. */
  id: string;
  /** Swap with no cross-fade — for when the new page is already on screen
   *  some other way (the home page's cards grow into a live view of it). */
  instant?: boolean;
  /** Like `instant`, but the new page fades in over this many seconds on top
   *  of the old one (no blur, no zoom) — smooths over any small difference
   *  between what was on screen and the real page. */
  fade?: number;
}

// ---- Exits: a section's own animation before going back to the home page ----
const exits = new Map<string, () => Promise<void>>();

/** Run `exit` (and wait for it) before leaving section `id` for the home page. */
export function registerExit(id: string, exit: () => Promise<void>): void {
  exits.set(id, exit);
}

declare global {
  interface HTMLElementEventMap {
    pageenter: CustomEvent<PageChangeDetail>;
    pageleave: CustomEvent<PageChangeDetail>;
  }
  interface DocumentEventMap {
    'page:goto': CustomEvent<PageGotoDetail>;
    /** Get a page ready to be shown — painted, but invisible — ahead of a `page:goto`. */
    'page:prepare': CustomEvent<PageGotoDetail>;
  }
}

export function initPages(): void {
  const viewport = document.querySelector<HTMLElement>('#viewport');
  const pages = document.querySelector<HTMLElement>('#pages');
  if (!viewport || !pages) return;

  // Draft pages (.page--draft) are kept in the markup but left out of the deck.
  const sections = Array.from(pages.querySelectorAll<HTMLElement>(':scope > .page:not(.page--draft)'));
  if (sections.length === 0) return;

  let index = 0;
  let locked = false;

  function setInert(section: HTMLElement, hidden: boolean) {
    section.inert = hidden;
    section.setAttribute('aria-hidden', String(hidden));
  }

  function dispatch(section: HTMLElement, type: 'pageenter' | 'pageleave', i: number, instant = false, from?: string) {
    section.dispatchEvent(new CustomEvent<PageChangeDetail>(type, { detail: { index: i, instant, from }, bubbles: true }));
  }

  // Initial state: page 0 is the only one visible and interactive.
  gsap.set(sections, { opacity: 0, filter: 'none' });
  gsap.set(sections[0], { opacity: 1 });
  sections.forEach((section, i) => setInert(section, i !== 0));
  document.body.dataset.page = sections[0].id; // styles hook, e.g. the "Home" button only shows off the home page
  dispatch(sections[0], 'pageenter', 0);

  function goTo(next: number, instant = false, fade = 0, reveal = 0): void {
    next = Math.max(0, Math.min(sections.length - 1, next));
    if (next === index || locked) return;

    // Back to the home page: the opening, backwards.
    if (next === 0 && !instant && !fade && !reveal && !isReducedMotion()) {
      locked = true;
      const exit = exits.get(sections[index].id);
      void (exit ? exit() : Promise.resolve()).then(() => {
        locked = false;
        goTo(0, false, 0, REVEAL);
      });
      return;
    }

    const leaving = sections[index];
    const entering = sections[next];
    index = next;
    locked = true;
    document.body.dataset.page = entering.id;

    setInert(entering, false);
    entering.style.visibility = ''; // in case it was prepared (see page:prepare)
    const swap = instant || fade > 0 || reveal > 0;
    dispatch(entering, 'pageenter', next, swap, leaving.id);
    dispatch(leaving, 'pageleave', next, swap, entering.id);

    const finish = () => {
      setInert(leaving, true);
      gsap.set(leaving, { filter: 'none', scale: 1 }); // reset — so revisiting it later doesn't start pre-blurred/shrunk
      locked = false;
    };

    if (reveal) {
      // The old page fades out on top, uncovering the new one already in place.
      gsap.set(entering, { opacity: 1, scale: 1 });
      gsap.set(leaving, { zIndex: 2 });
      gsap.to(leaving, {
        opacity: 0,
        duration: reveal,
        ease: 'power1.in',
        onComplete: () => {
          gsap.set(leaving, { clearProps: 'zIndex' });
          finish();
        },
      });
      return;
    }

    if (fade && !isReducedMotion()) {
      // Over the old page (whatever their order in the deck), then out of the way.
      gsap.set(entering, { zIndex: 2, scale: 1 });
      gsap.to(entering, {
        opacity: 1,
        duration: fade,
        ease: 'power1.out',
        onComplete: () => {
          gsap.set(leaving, { opacity: 0 });
          gsap.set(entering, { clearProps: 'zIndex' });
          finish();
        },
      });
      return;
    }

    if (instant || isReducedMotion()) {
      gsap.set(leaving, { opacity: 0 });
      gsap.set(entering, { opacity: 1, scale: 1 });
      finish();
      return;
    }

    gsap
      .timeline({
        defaults: { duration: t(TRANSITION), ease: 'power2.inOut' },
        onComplete: () => setTimeout(finish, SETTLE),
      })
      .set(entering, { filter: `blur(${IN_BLUR}px)`, scale: IN_SCALE })
      .to(leaving, { opacity: 0, filter: `blur(${OUT_BLUR}px)`, scale: OUT_SCALE }, 0)
      .to(entering, { opacity: 1, filter: 'blur(0px)', scale: 1 }, 0);
  }

  function step(delta: 1 | -1): void {
    goTo(index + delta);
  }

  // No wheel or swipe navigation: scrolling never changes the page (only the
  // home page's cards, the Home button, links and the keyboard do).

  // ---- Keyboard ------------------------------------------------------------------
  // Ignored while focus is on something that already owns Up/Down/PageUp/PageDown
  // itself (the tapes shelf uses Left/Right, but form-like controls get the same courtesy).
  document.addEventListener('keydown', (e) => {
    const target = e.target as Element | null;
    if (target?.closest('input, textarea, select, [contenteditable]')) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'PageDown':
        e.preventDefault();
        step(1);
        break;
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        step(-1);
        break;
      case 'Home':
        e.preventDefault();
        goTo(0);
        break;
      case 'End':
        e.preventDefault();
        goTo(sections.length - 1);
        break;
    }
  });

  // ---- "Scroll for more" hints ----------------------------------------------------
  for (const hint of pages.querySelectorAll<HTMLAnchorElement>('.hero__hint')) {
    hint.addEventListener('click', (e) => {
      e.preventDefault();
      step(1);
    });
  }

  // ---- In-page links: any element with data-goto="<section id>" jumps to that page ----
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest?.<HTMLElement>('[data-goto]');
    if (!link) return;
    const target = sections.findIndex((section) => section.id === link.dataset.goto);
    if (target < 0) return;
    e.preventDefault();
    goTo(target);
  });

  // ---- Programmatic: document.dispatchEvent(new CustomEvent('page:goto', { detail: { id, instant } })) ----
  document.addEventListener('page:prepare', (e) => {
    const section = sections.find((s) => s.id === e.detail.id);
    if (!section || section === sections[index]) return;
    // Rendered at 1% opacity: enough for the browser to paint it (a fully
    // transparent layer is skipped), too faint to see. Still inert.
    section.style.visibility = 'visible';
    gsap.set(section, { opacity: 0.01 });
  });

  document.addEventListener('page:goto', (e) => {
    const target = sections.findIndex((section) => section.id === e.detail.id);
    if (target >= 0) goTo(target, e.detail.instant, e.detail.fade);
  });
}
