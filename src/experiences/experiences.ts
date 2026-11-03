import { gsap } from 'gsap';
import { t, isReducedMotion } from '../motion';
import { DOMAINS, SKILLS, projects, type Domain, type Project } from './content';
import { mountDeck, type Deck } from './deck';
import '../pages'; // side-effect import: declares the pageenter/pageleave event types used below

/**
 * Experiences, as a glass folder: each experience is a small page tucked in
 * it, peeking out at the top. Hovering the folder fans them out; picking one
 * zooms its small page up into the whole window: a portfolio deck of the
 * experience (deck.ts). Play the tour walks
 * through them all. Back zooms it down into the folder again. A Skills tab
 * sits next to it.
 */

type View = 'experiences' | 'skills';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

const ICONS = {
  prev: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  play: 'M8 5.5v13l11-6.5z',
};

function icon(path: string, filled = false) {
  const span = h('span', 'xp-icon');
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}/></svg>`;
  return span;
}

function button(className: string, children: (Node | string)[], onClick: () => void, label?: string) {
  const b = h('button', className, children);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (ym: string) => `${MONTHS[Number(ym.split('-')[1]) - 1]} ${ym.split('-')[0]}`;
const place = (p: Project) => p.where.split(/[—,]/)[0].trim();
const num = (i: number) => String(i + 1).padStart(2, '0');

function picture(p: Project, className: string) {
  const img = h('img', className);
  img.src = p.image;
  img.style.objectPosition = p.focus;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  return img;
}

export function initExperiences(): void {
  const found = document.querySelector<HTMLElement>('#experiences');
  if (!found) return;
  const section: HTMLElement = found;
  const app = section.querySelector<HTMLElement>('.xp__app')!;
  const touch = window.matchMedia('(hover: none)').matches;

  let view: View = 'experiences';
  let current: Project | null = null; // the experience open in the page, if any
  let sheet: Deck | null = null;

  // ---- the window: title and tabs on top, the view below ----
  const tabs: { id: View; label: string }[] = [
    { id: 'experiences', label: 'Experiences' },
    { id: 'skills', label: 'Skills' },
  ];
  const tabButtons = tabs.map((tab) => {
    const b = button('xp__tab', [tab.label], () => show(tab.id));
    b.dataset.view = tab.id;
    return b;
  });
  const top = h('header', 'xp__top', [
    h('div', 'xp__tabs', tabButtons),
  ]);
  const body = h('div', 'xp__body');
  const windowEl = h('div', 'xp__window', [top, body]);
  app.append(windowEl);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || section.inert || !current) return;
    closePage();
  });

  // ---- the folder: a back, the small pages, a glass front ----
  const n = projects.length;
  const cards = projects.map((p, i) => {
    const card = button(
      'xp__card',
      [
        picture(p, 'xp__card-img'),
        h('span', 'xp__card-body', [
          h('span', 'xp__card-num', [num(i)]),
          h('strong', 'xp__card-title', [p.title]),
          h('span', 'xp__card-meta', [`${place(p)} · ${fmt(p.start)}`]),
          h('span', 'xp__card-btns', [h('i', 'is-solid'), h('i')]),
          h('span', 'xp__card-lines', [h('i'), h('i'), h('i')]),
        ]),
      ],
      () => openPage(p, card),
      `Open ${p.title}`,
    );
    const d = i - (n - 1) / 2; // place in the fan: negative left, positive right
    card.style.setProperty('--d', String(d));
    card.style.setProperty('--ad', String(Math.abs(d)));
    card.style.zIndex = String(10 - Math.round(Math.abs(d) * 2));
    return card;
  });
  const folder = h('div', 'xp__folder', [
    h('div', 'xp__folder-back'),
    h('div', 'xp__folder-cards', cards),
    h('div', 'xp__folder-front', [
      h('span', 'xp__folder-name', [h('span', 'xp__folder-mark', [icon(ICONS.next)]), 'Experiences']),
      button('xp__folder-play', [icon(ICONS.play, true), `Play the tour · ${n} projects`], () => openPage(projects[0], cards[0], true)),
    ]),
  ]);
  if (touch) folder.classList.add('is-open');
  const stage = h('div', 'xp__stage', [folder]);

  // ---- the page an experience zooms up into ----
  const pageHead = h('div', 'xp__page-head');
  const pageBody = h('div', 'xp__page-body');
  pageBody.dataset.ownScroll = '';
  const page = h('article', 'xp__page', [pageHead, pageBody]);
  page.hidden = true;
  const experiencesView = h('div', 'xp__experiences', [stage, page]);

  function renderPage(p: Project, autoplay: boolean) {
    sheet?.stop();
    const i = projects.indexOf(p);
    const prev = projects[(i - 1 + n) % n];
    const next = projects[(i + 1) % n];
    pageHead.replaceChildren(
      button('xp__back', [icon(ICONS.back), h('span', '', ['All experiences'])], closePage),
      h('span', 'xp__page-nav', [
        button('xp__round', [icon(ICONS.prev)], () => swap(prev), `Previous: ${prev.title}`),
        h('span', 'xp__count', [`${num(i)} / ${num(n - 1)}`]),
        button('xp__round', [icon(ICONS.next)], () => swap(next), `Next: ${next.title}`),
      ]),
    );
    sheet = mountDeck(p, i, { root: pageBody, next: i < n - 1 ? next : null, onNext: () => swap(next, true) }, autoplay);
  }

  /** Where `card` sits, as the page's transform: the page scaled down until
   *  its top middle covers the card, and clipped to the card's outline. */
  function cardFrame(card: HTMLElement) {
    const k = body.getBoundingClientRect().width / body.offsetWidth || 1; // the site may scale the section (its monitor)
    const b = body.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const W = body.offsetWidth;
    const H = body.offsetHeight;
    const cw = c.width / k;
    const ch = c.height / k;
    const s = Math.max(cw / W, ch / H);
    const side = (W - cw / s) / 2; // cropped off each side, in the page's own pixels
    return {
      x: (c.left - b.left) / k - side * s,
      y: (c.top - b.top) / k,
      scale: s,
      clipPath: `inset(0px ${side}px ${H - ch / s}px ${side}px round ${14 / s}px)`,
    };
  }
  const FULL = { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px round 0px)' };
  // (the four insets are always written out, so the tween goes value to value)

  function openPage(p: Project, card?: HTMLElement, autoplay = false) {
    if (current) return;
    current = p;
    windowEl.classList.add('is-page'); // the page takes the whole window
    page.hidden = false;
    renderPage(p, autoplay);
    folder.classList.add('is-away');
    gsap.killTweensOf(page);
    gsap.set(page, { opacity: 1 }); // (the last close may have left it faded out)
    if (isReducedMotion()) return;
    if (card) {
      card.classList.add('is-zooming');
      gsap.fromTo(page, { ...cardFrame(card), transformOrigin: '0 0' }, { ...FULL, duration: t(0.75), ease: 'expo.inOut', clearProps: 'transform,clipPath' });
    } else {
      gsap.fromTo(page, { opacity: 0, scale: 0.96, transformOrigin: '50% 40%' }, { opacity: 1, scale: 1, duration: t(0.45), ease: 'power3.out', clearProps: 'transform,opacity' });
    }
    gsap.fromTo(pageHead, { opacity: 0 }, { opacity: 1, duration: t(0.3), delay: card ? t(0.55) : 0 });
  }

  function closePage() {
    if (!current) return;
    const card = cards[projects.indexOf(current)];
    current = null;
    sheet?.stop();
    sheet = null;
    windowEl.classList.remove('is-page');
    const done = () => {
      page.hidden = true;
      gsap.set(page, { clearProps: 'all' });
      for (const c of cards) c.classList.remove('is-zooming');
    };
    folder.classList.remove('is-away');
    if (isReducedMotion()) return done();
    gsap.killTweensOf(page);
    gsap.to(pageHead, { opacity: 0, duration: t(0.15) });
    gsap.fromTo(page, { ...FULL, transformOrigin: '0 0' }, { ...cardFrame(card), duration: t(0.65), ease: 'expo.inOut', onComplete: done });
    gsap.to(page, { opacity: 0, duration: t(0.15), delay: t(0.45) }); // done before `done` clears it
  }

  /** Previous / next, from inside the page (`autoplay` when the tour moves on by itself). */
  function swap(p: Project, autoplay = false) {
    current = p;
    for (const c of cards) c.classList.remove('is-zooming');
    cards[projects.indexOf(p)].classList.add('is-zooming');
    sheet?.stop();
    if (isReducedMotion()) return renderPage(p, autoplay);
    gsap.to(pageBody, {
      opacity: 0,
      x: -12,
      duration: t(0.18),
      ease: 'power2.in',
      onComplete: () => {
        renderPage(p, autoplay);
        gsap.fromTo(pageBody, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: t(0.35), ease: 'power3.out', clearProps: 'transform,opacity' });
      },
    });
  }

  // ---- Skills ----
  function renderSkills() {
    const cols = (Object.keys(DOMAINS) as Domain[]).map((d) => {
      const col = h('section', 'xp-card xp__skill-col', [
        h('div', 'xp__skill-head', [h('span', 'xp__skill-dot'), h('p', 'xp-title', [DOMAINS[d].label])]),
        h('p', 'xp__skill-blurb', [DOMAINS[d].blurb]),
        ...SKILLS[d].map((g) =>
          h('div', 'xp__skill-group', [
            h('p', 'xp-label', [g.group]),
            ...g.skills.map((s) =>
              h('div', 'xp__skill', [
                h('span', 'xp__skill-name', [s.name]),
                h(
                  'span',
                  'xp__skill-proof',
                  s.usedIn.length
                    ? s.usedIn.map((slug) => {
                        const p = projects.find((x) => x.slug === slug)!;
                        return button('xp-chip xp-chip--proof', [p.title], () => {
                          show('experiences');
                          openPage(p);
                        });
                      })
                    : [h('span', 'xp__skill-known', ['Also known'])],
                ),
              ]),
            ),
          ]),
        ),
      ]);
      col.style.setProperty('--c', DOMAINS[d].colour);
      return col;
    });
    const wrap = h('div', 'xp__skills', cols);
    wrap.dataset.ownScroll = '';
    return wrap;
  }

  // ---- views ----
  function show(v: View) {
    view = v;
    for (const b of tabButtons) {
      const on = b.dataset.view === view;
      b.classList.toggle('is-current', on);
      b.setAttribute('aria-pressed', String(on));
    }
    // leaving the folder's page: back in the folder, without the animation
    if (current) {
      current = null;
      sheet?.stop();
      sheet = null;
      windowEl.classList.remove('is-page');
      page.hidden = true;
      folder.classList.remove('is-away');
      for (const c of cards) c.classList.remove('is-zooming');
    }
    body.replaceChildren(view === 'experiences' ? experiencesView : renderSkills());
    if (!isReducedMotion()) gsap.fromTo(body.firstElementChild, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: t(0.4), ease: 'power3.out', clearProps: 'transform,opacity' });
  }

  show('experiences');

  section.addEventListener('pageenter', (e) => {
    if (e.detail.instant || isReducedMotion()) return;
    gsap.fromTo(windowEl, { opacity: 0, scale: 0.97, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: t(0.7), ease: 'power3.out' });
    // the small pages rise out of the folder for a moment, then settle back
    if (view === 'experiences' && !current && !touch) {
      folder.classList.add('is-open');
      window.setTimeout(() => folder.classList.remove('is-open'), 1400);
    }
  });
  section.addEventListener('pageleave', () => sheet?.pause());
}
