import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';
import { initMessagesWidget } from './messages-widget';
import { buildInstagramApp } from './instagram';
import { BLUEPRINTS, openPdf } from './blueprints';
import '../pages'; // side-effect import: declares the pageenter/pageleave event types used below

/**
 * The Xandvar phone: a CSS-3D iPhone standing on the right of the scene that
 * holds everything about the brand — Instagram, the music, the blueprints,
 * the DMs and the brand story (Notes).
 *
 * The screen is built at a real iPhone's logical size (390×844) and the whole
 * device is scaled to fit the viewport, so the UI inside keeps true phone
 * proportions at any window size. Views (lock, home, each app) are stacked
 * layers inside the screen; only one is visible at a time — see `show()`.
 */

const DEVICE_W = 414; // screen (390) + 2 × 12px bezel
const DEVICE_H = 868; // screen (844) + 2 × 12px bezel

// Resting pose: turned slightly toward the hero in the middle of the scene.
const REST_Y = -16;
const REST_X = 4;
const TILT_Y = 7; // extra degrees of follow toward the pointer
const TILT_X = 5;

const BANNER_MS = 3600;
const MAX_LOCK_NOTIFS = 3;

type View = 'lock' | 'home' | 'music' | 'messages' | 'instagram' | 'files' | 'notes';

const STACKED = '(max-aspect-ratio: 1 / 1), (max-height: 480px)'; // must match brand.css

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

export function initPhone(section: HTMLElement): HTMLElement {
  const phone = must<HTMLElement>(section, '.phone');
  const body = must<HTMLElement>(phone, '.phone__body');
  const glare = must<HTMLElement>(phone, '.phone__glare');
  const statusTime = must<HTMLElement>(phone, '.phone__status-time');
  const lockTime = must<HTMLElement>(phone, '.phone__lock-time');
  const lockDate = must<HTMLElement>(phone, '.phone__lock-date');
  const notifs = must<HTMLElement>(phone, '.phone__notifs');
  const banner = must<HTMLButtonElement>(phone, '.phone__banner');
  const bannerName = must<HTMLElement>(banner, '.phone__banner-name');
  const bannerText = must<HTMLElement>(banner, '.phone__banner-text');
  const badge = must<HTMLElement>(phone, '.phone__badge');
  const views = new Map<View, HTMLElement>(
    Array.from(phone.querySelectorAll<HTMLElement>('.phone__view')).map((el) => [el.dataset.view as View, el]),
  );

  // ---- App content that's built in code ---------------------------------------
  must<HTMLElement>(phone, '.phone-app--instagram').append(buildInstagramApp());

  must<HTMLElement>(phone, '.files__list').append(
    ...BLUEPRINTS.map((file) => {
      const row = h('button', { class: 'files__row', type: 'button' }, [
        h('img', { class: 'files__icon', src: file.icon, alt: '', draggable: false }),
        h('span', { class: 'files__meta' }, [
          h('span', { class: 'files__name' }, [file.name]),
          h('span', { class: 'files__detail' }, [file.detail]),
        ]),
        h('span', { class: 'files__chevron', ariaHidden: 'true' }, ['›']),
      ]);
      row.addEventListener('click', () => openPdf(file));
      return h('li', {}, [row]);
    }),
  );

  initMessagesWidget(section);

  // ---- Size: scale the fixed-size device to the viewport ----------------------
  const stacked = window.matchMedia(STACKED);
  function fit() {
    const scale = stacked.matches
      ? Math.min((window.innerWidth - 40) / DEVICE_W, (window.innerHeight * 0.82) / DEVICE_H)
      : Math.min((window.innerHeight * 0.8) / DEVICE_H, (window.innerWidth * 0.25) / DEVICE_W, 0.95);
    phone.style.setProperty('--phone-scale', scale.toFixed(4));
  }
  fit();
  window.addEventListener('resize', fit);
  stacked.addEventListener('change', fit);

  // ---- Clock --------------------------------------------------------------------
  function tickClock() {
    const now = new Date();
    // 12-hour, no AM/PM — how an iPhone shows it, and in step with the Mac menu bar's clock.
    const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
    statusTime.textContent = time;
    lockTime.textContent = time;
    lockDate.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  tickClock();
  setInterval(tickClock, 15000);

  // ---- Views ------------------------------------------------------------------------
  let current: View = 'lock';

  function isApp(view: View) {
    return view !== 'lock' && view !== 'home';
  }

  function show(next: View, immediate = false) {
    if (next === current && !immediate) return;
    const leaving = views.get(current)!;
    const entering = views.get(next)!;
    const from = current;
    current = next;
    phone.dataset.view = next;
    if (next === 'messages') clearUnread();

    for (const [view, el] of views) el.inert = view !== next;

    if (immediate) {
      for (const [view, el] of views) gsap.set(el, { autoAlpha: view === next ? 1 : 0, scale: 1, y: 0 });
      return;
    }

    // iOS-ish motion: an app zooms up out of the home screen and shrinks back
    // into it; unlocking slides the lock screen up and away.
    gsap.killTweensOf([leaving, entering]);
    if (from === 'lock') {
      gsap.to(leaving, { autoAlpha: 0, y: -60, duration: t(0.4), ease: 'power2.in' });
      gsap.fromTo(entering, { autoAlpha: 0, scale: 1.08, y: 0 }, { autoAlpha: 1, scale: 1, duration: t(0.5), delay: t(0.1), ease: 'power3.out' });
    } else if (isApp(next)) {
      gsap.to(leaving, { autoAlpha: 0, scale: 0.94, duration: t(0.3), ease: 'power2.in' });
      gsap.fromTo(entering, { autoAlpha: 0, scale: 0.84, y: 0 }, { autoAlpha: 1, scale: 1, duration: t(0.42), ease: 'power3.out' });
    } else {
      gsap.to(leaving, { autoAlpha: 0, scale: 0.84, duration: t(0.3), ease: 'power2.in' });
      gsap.fromTo(entering, { autoAlpha: 0, scale: 0.94, y: 0 }, { autoAlpha: 1, scale: 1, duration: t(0.4), delay: t(0.08), ease: 'power3.out' });
    }
  }

  show('lock', true);

  phone.addEventListener('click', (e) => {
    const opener = (e.target as Element).closest<HTMLElement>('[data-open]');
    if (opener && phone.contains(opener)) {
      hideBanner();
      show(opener.dataset.open as View);
    }
  });
  must<HTMLElement>(phone, '.phone__lock').addEventListener('click', (e) => {
    // The now-playing widget's own controls stop propagation (playlist.ts), so
    // anything else on the lock screen unlocks it — including a notification.
    const notif = (e.target as Element).closest('.phone__notif');
    show(notif ? 'messages' : 'home');
  });
  must<HTMLElement>(phone, '.phone__homebar').addEventListener('click', () => show(current === 'home' ? 'lock' : 'home'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isApp(current) && !section.inert) show('home');
  });

  // ---- Notifications (from the self-playing Messages demo) ----------------------
  let unread = 0;
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;

  function clearUnread() {
    unread = 0;
    badge.hidden = true;
  }

  function hideBanner() {
    clearTimeout(bannerTimer);
    gsap.to(banner, { y: -130, autoAlpha: 0, duration: t(0.3), ease: 'power2.in' });
  }

  gsap.set(banner, { y: -130, autoAlpha: 0 });

  phone.addEventListener('messages:incoming', ({ detail }) => {
    if (current === 'messages') return;
    unread += 1;
    badge.textContent = String(unread);
    badge.hidden = false;

    if (current === 'lock') {
      const notif = h('div', { class: 'phone__notif' }, [
        h('span', { class: 'phone__banner-icon', ariaHidden: 'true' }),
        h('span', { class: 'phone__banner-body' }, [
          h('span', { class: 'phone__banner-top' }, [h('strong', {}, [detail.name]), h('span', {}, ['now'])]),
          h('span', { class: 'phone__banner-text' }, [detail.text]),
        ]),
      ]);
      notifs.prepend(notif);
      while (notifs.children.length > MAX_LOCK_NOTIFS) notifs.lastElementChild!.remove();
      gsap.from(notif, { y: -24, autoAlpha: 0, scale: 0.96, duration: t(0.45), ease: 'back.out(1.6)' });
      return;
    }

    bannerName.textContent = detail.name;
    bannerText.textContent = detail.text;
    gsap.to(banner, { y: 0, autoAlpha: 1, duration: t(0.45), ease: 'back.out(1.4)' });
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, BANNER_MS);
  });

  // ---- 3D tilt + glare (pointer devices only) --------------------------------------
  // Stacked (narrow/portrait) layout: the phone is shown alone, full-width, so
  // it faces the viewer head-on instead of turning toward the hero.
  const rest = () => (stacked.matches ? { rotateY: 0, rotateX: 0 } : { rotateY: REST_Y, rotateX: REST_X });
  gsap.set(body, rest());
  stacked.addEventListener('change', () => gsap.set(body, rest()));
  const canTilt = () => !isReducedMotion() && !stacked.matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const tiltY = gsap.quickTo(body, 'rotateY', { duration: 0.8, ease: 'power2.out' });
  const tiltX = gsap.quickTo(body, 'rotateX', { duration: 0.8, ease: 'power2.out' });
  const glareX = gsap.quickTo(glare, 'xPercent', { duration: 0.8, ease: 'power2.out' });
  let overPhone = false;

  phone.addEventListener('pointerenter', () => { overPhone = true; });
  phone.addEventListener('pointerleave', () => { overPhone = false; });

  section.addEventListener('pointermove', (e) => {
    if (!canTilt()) return;
    const r = section.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    // Hovering the phone turns it to face you, ready to be used; elsewhere
    // it just leans a little toward the pointer.
    const y = overPhone ? -3 + px * 4 : REST_Y + px * TILT_Y;
    const x = overPhone ? 1 - py * 2 : REST_X - py * TILT_X;
    tiltY(y);
    tiltX(x);
    glareX(-y * 4);
  });
  section.addEventListener('pointerleave', () => {
    tiltY(REST_Y);
    tiltX(REST_X);
    glareX(-REST_Y * 4);
  });
  gsap.set(glare, { xPercent: -REST_Y * 4 });

  // ---- Page visits: always pick the phone up from its lock screen ------------------
  section.addEventListener('pageenter', () => {
    notifs.replaceChildren();
    clearUnread();
    hideBanner();
    show('lock', true);
  });

  return phone;
}
