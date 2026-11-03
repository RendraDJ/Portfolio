import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';
import { isPreview } from '../preview';
import { registerExit } from '../pages';

/**
 * A section of the site, shown on a monitor in a dark studio: a wall of
 * hexagonal acoustic panels, a light bar clipped over the screen, the
 * monitor on its stand and a desk. Every page of the portfolio uses it, so
 * they all sit on the same screen.
 *
 * The section itself is untouched: everything it had is moved into
 * `.studio__screen`, which keeps the full size of the page (and the
 * section's own layout and background) and is simply scaled down into the
 * monitor — so it stays fully interactive. The room is drawn behind it
 * (`.studio__room`) and in front of it (`.studio__room-front`).
 *
 * Arriving on the page, the camera pulls back: the section starts filling
 * the screen (exactly as it looked a moment before, e.g. in the home page's
 * card) and the room grows around it until it sits in the monitor. The
 * section and the room are scaled separately, with the same timing, so the
 * section is never blown up (and blurred) along the way. Going back to the
 * home page plays it in reverse: the camera pushes in until the screen fills
 * the page again, and the home page takes over from there.
 *
 * Only on landscape screens; portrait screens show the section full-screen.
 */

// The monitor's screen, in % of the page: left, top, and scale (it keeps
// the page's own proportions, so width = S × 100vw and height = S × 100vh).
const SCREEN = { x: 15, y: 9, s: 0.7 };
const PULL_BACK = { duration: 1.6, ease: 'power3.inOut', delay: 0.1 };
const PUSH_IN = { duration: 1.1, ease: 'power3.inOut' }; // leaving for the home page

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

export function initStudio(section: HTMLElement): void {
  if (isPreview) return; // the home page's card shows the section on its own, full-screen

  // the screen takes the section's own look (its background stays on the
  // screen when the section around it turns into the dark room)
  const look = getComputedStyle(section);
  const screen = h('div', { class: 'studio__screen' });
  screen.style.background = look.background;
  if (section.hasAttribute('data-own-scroll')) screen.dataset.ownScroll = '';
  screen.append(...Array.from(section.childNodes));
  section.classList.add('in-studio');

  const back = h('div', { class: 'studio__room', ariaHidden: 'true' }, [
    h('div', { class: 'room__wall' }),
    h('div', { class: 'room__desk' }),
    h('div', { class: 'room__stand' }, [h('span', { class: 'room__foot' })]),
    h('div', { class: 'room__monitor' }),
  ]);
  const front = h('div', { class: 'studio__room-front', ariaHidden: 'true' }, [
    h('div', { class: 'room__glare' }),
    h('div', { class: 'room__lamp' }, [h('span', { class: 'room__lamp-clip' })]),
  ]);
  section.append(back, screen, front);
  section.style.setProperty('--sx', `${SCREEN.x}vw`);
  section.style.setProperty('--sy', `${SCREEN.y}vh`);
  section.style.setProperty('--ss', String(SCREEN.s));

  const room = [back, front];
  const landscape = window.matchMedia('(min-aspect-ratio: 11 / 10)');

  // Where things sit once the camera has pulled back (in px, for the current window).
  const inMonitor = () => ({ x: (SCREEN.x / 100) * window.innerWidth, y: (SCREEN.y / 100) * window.innerHeight, scale: SCREEN.s });
  // The room zoomed in so that the monitor's screen fills the page.
  const zoomedIn = () => {
    const { x, y, scale } = inMonitor();
    return { x: -x / scale, y: -y / scale, scale: 1 / scale };
  };

  function settle() {
    const on = landscape.matches;
    section.classList.toggle('has-room', on);
    gsap.set(screen, on ? inMonitor() : { x: 0, y: 0, scale: 1 });
    gsap.set(room, { x: 0, y: 0, scale: 1 });
  }

  gsap.set([screen, ...room], { transformOrigin: '0 0' });
  settle();
  landscape.addEventListener('change', settle);
  window.addEventListener('resize', () => {
    if (!gsap.isTweening(screen)) settle();
  });

  section.addEventListener('pageenter', () => {
    if (!landscape.matches || isReducedMotion()) {
      settle();
      return;
    }
    section.classList.add('has-room');
    gsap.fromTo(screen, { x: 0, y: 0, scale: 1 }, { ...inMonitor(), ...PULL_BACK, duration: t(PULL_BACK.duration), overwrite: 'auto' });
    gsap.fromTo(room, zoomedIn(), { x: 0, y: 0, scale: 1, ...PULL_BACK, duration: t(PULL_BACK.duration), overwrite: 'auto' });
  });

  registerExit(
    section.id,
    () =>
      new Promise<void>((done) => {
        if (!section.classList.contains('has-room') || isReducedMotion()) return done();
        gsap.to(room, { ...zoomedIn(), ...PUSH_IN, overwrite: 'auto' });
        gsap.to(screen, { x: 0, y: 0, scale: 1, ...PUSH_IN, overwrite: 'auto', onComplete: done });
      }),
  );
}
