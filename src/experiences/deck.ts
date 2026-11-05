import { gsap } from 'gsap';
import { t, isReducedMotion } from '../motion';
import { openReport } from '../os/report';
import { DOMAINS, type Domain, type Project } from './content';
import { storyOf } from './stories';
import type { Chapter, ChapterTag, Visual } from './story';
import { hasApp } from './apps';
import { button, countUp, h, interactiveDemo, live, type Live } from './visuals';

/**
 * An experience as a printed portfolio deck: paper, grey-black and greys.
 * The same slides for every experience: a cover (its word, huge, behind a
 * folder holding its picture), the context, the demo, the pipeline, a few
 * deep dives, the results and the file. Folder tabs at the bottom jump
 * between them; a grey folder sweeps up over the page to change slides.
 * The deck plays by itself until the visitor takes over.
 */

export interface DeckHost {
  root: HTMLElement;
  next: Project | null;
  onNext(): void;
}

export interface Deck {
  stop(): void;
  pause(): void;
}

/** The cover's word, huge. */
const WORD: Record<string, string> = {
  palletlens: 'Inspect',
  'phantom-posture': 'Posture',
  'the-classifier': 'Inbox',
  'first-contact': 'Touch',
  convergence: 'Converge',
};

const TAG: Record<ChapterTag, string> = {
  context: 'Context',
  architecture: 'Architecture',
  ai: 'AI',
  software: 'Software',
  robotics: 'Robotics',
  algorithm: 'Algorithm',
  results: 'Results',
  demo: 'Demo',
  app: 'App',
};

const ICON = {
  hardware: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  data: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  ai: 'M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2-2.2 6.3-2.2-6.3L3.5 11l6.3-2.2z',
  software: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  ui: 'M3 5h18v14H3zM3 9h18',
  robotics: 'M4 21h9M8 21v-5l5-5 5 2M13 11l-1-5 4-2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  cursor: 'M5 3l14 7-6 2-2 6z',
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M8 5v14M16 5v14',
};

const DOMAIN_ICON: Record<Domain, string> = { ai: ICON.ai, software: ICON.software, robotics: ICON.robotics };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (ym: string) => `${MONTHS[Number(ym.split('-')[1]) - 1]} ${ym.split('-')[0]}`;
const two = (n: number) => String(n).padStart(2, '0');
const animated = () => !isReducedMotion();

function svg(path: string, className = 'xd-ico', filled = false) {
  const span = h('span', className);
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="${path}" ${
    filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
  }/></svg>`;
  return span;
}

/** Draws the paths in `els` in, as with a pen. */
function draw(tl: gsap.core.Timeline, els: Element | Element[], at: gsap.Position, duration = 0.6) {
  const paths = [els].flat().flatMap((e) => [...e.querySelectorAll('path')]);
  tl.fromTo(paths, { attr: { 'stroke-dasharray': 1, 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: t(duration), stagger: 0.05, ease: 'power2.inOut' }, at);
}

/** Words whose letters rise one by one out of a slot. */
function letters(text: string, className: string) {
  const el = h('span', className, [...text].map((c) => h('span', 'xd-l', [h('span', '', [c === ' ' ? ' ' : c])])));
  el.setAttribute('aria-label', text);
  el.style.setProperty('--n', String(Math.max(text.length, 4)));
  return el;
}

const rise = (tl: gsap.core.Timeline, el: Element, at: gsap.Position, stagger = 0.045) =>
  tl.from(el.querySelectorAll('.xd-l > span'), { yPercent: 115, rotate: 6, duration: t(0.9), stagger, ease: 'expo.out', clearProps: 'transform' }, at);

/** A card thrown on the desk: it flies in turning, and lands. */
const toss = (tl: gsap.core.Timeline, el: Element, at: gsap.Position, from: 'left' | 'right' | 'top' = 'right') =>
  tl.from(
    el,
    {
      x: from === 'left' ? -420 : from === 'right' ? 420 : 40,
      y: from === 'top' ? -320 : -120,
      rotation: from === 'left' ? -38 : 34,
      opacity: 0,
      duration: t(0.95),
      ease: 'back.out(1.25)',
    },
    at,
  );

/** A browser-like window, as in the deck's screenshots. */
function windowCard(className: string, children: (Node | string)[]) {
  return h('div', `xd-win ${className}`, [h('div', 'xd-win__bar', [h('i'), h('i'), h('i')]), h('div', 'xd-win__body', children)]);
}

/** A black card with a title and a tick. */
function darkCard(className: string, title: string, rows: (Node | string)[]) {
  return h('div', `xd-dark ${className}`, [h('div', 'xd-dark__head', [h('strong', '', [title]), svg(ICON.check, 'xd-ico xd-tick')]), h('div', 'xd-dark__rows', rows)]);
}

/** A title whose last word gets a grey marker swept behind it. */
function marked(text: string, className: string) {
  const words = text.replace(/-/g, '‑').split(' ');
  const last = words.pop()!;
  return h('h3', className, [words.length ? `${words.join(' ')} ` : '', h('span', 'xd-mark', [h('i'), last])]);
}

function picture(p: Project) {
  const img = h('img', 'xd-img');
  img.src = p.image;
  img.alt = p.caption;
  img.style.objectPosition = p.focus;
  img.draggable = false;
  return img;
}

interface Built {
  el: HTMLElement;
  enter(tl: gsap.core.Timeline): void;
  stop?(): void;
}

interface Slide {
  id: string;
  label: string;
  /** s before the deck turns the page by itself */
  time: number;
  build(): Built;
}

export function mountDeck(p: Project, index: number, host: DeckHost, tour: boolean): Deck {
  const { root } = host;
  const story = storyOf(p);
  const ch = story.chapters;
  const context: Chapter = ch.find((c) => c.tag === 'context') ?? { tag: 'context', title: 'The project', text: p.summary, points: p.highlights.slice(0, 3) };
  const demo = ch.find((c) => c.tag === 'demo');
  const appCh = ch.find((c) => c.tag === 'app');
  const pipe = ch.find((c) => c.visual?.type === 'pipeline') ?? ch.find((c) => c.visual?.type === 'steps');
  const results = ch.find((c) => c.tag === 'results');
  const tech = ch.filter((c) => c !== pipe && ['ai', 'robotics', 'algorithm', 'software', 'architecture'].includes(c.tag));
  const dives = tech.slice(0, 3);
  const code = tech.find((c) => c.visual?.type === 'code');
  if (code && !dives.includes(code)) dives[dives.length - 1] = code; // always show some code
  const withApp = hasApp(p.slug);

  let goTo: (id: string) => void = () => undefined;

  // ---- the band: grey, with folder tabs on its top edge that lead on ----
  function band(className: string, tabs: { label: string; to?: string; on?: boolean; click?: () => void }[], content: (Node | string)[]) {
    const tabEls = tabs.map((tab, i) => {
      const b = button(`xd-band__tab${tab.on ?? i === 0 ? ' is-front' : ''}`, [tab.label, svg(ICON.arrow)], () => (tab.click ? tab.click() : tab.to && goTo(tab.to)));
      b.style.setProperty('--i', String(i));
      return b;
    });
    return { el: h('div', `xd-band ${className}`, [h('div', 'xd-band__tabs', tabEls), h('div', 'xd-band__body', content)]), tabs: tabEls };
  }
  const enterBand = (tl: gsap.core.Timeline, b: { el: HTMLElement; tabs: HTMLElement[] }, at: gsap.Position = 0) => {
    tl.from(b.el.querySelector('.xd-band__body'), { yPercent: 100, duration: t(0.7), ease: 'expo.out' }, at);
    tl.from(b.tabs, { y: 60, opacity: 0, duration: t(0.5), stagger: 0.08, ease: 'back.out(1.6)' }, `>-0.35`);
  };

  // ---- the slides ----
  const cover = (): Built => {
    const word = letters(WORD[p.slug] ?? p.title.split(' ')[0], 'xd-giant');
    const paper = h('div', 'xd-folder__paper', [picture(p)]);
    const front = h('div', 'xd-folder__front', [h('span', 'xd-folder__label', [`Experience ${two(index + 1)}`]), h('span', 'xd-folder__where', [p.where.split(' — ')[0]])]);
    const folder = h('div', 'xd-folder', [h('div', 'xd-folder__back'), paper, front]);
    folder.dataset.depth = '8';
    const ticket = h('div', 'xd-ticket', [
      h('span', 'xd-ticket__when', [`${fmt(p.start)} — ${fmt(p.end)}`]),
      h('span', 'xd-ticket__icons', [svg(ICON.pin), svg(ICON.cal), svg(ICON.user)]),
      button('xd-ticket__go', [svg(ICON.arrow)], () => goTo('context'), 'Start'),
    ]);
    ticket.dataset.depth = '18';
    const name = h('div', 'xd-cover__name', [h('h3', '', [p.title]), h('p', '', [p.role])]);
    const list = darkCard(
      'xd-cover__list',
      'Fields',
      p.domains.map((d) => h('span', 'xd-row', [svg(DOMAIN_ICON[d]), DOMAINS[d].label])),
    );
    list.dataset.depth = '14';
    const tagline = h('div', 'xd-cover__tag', [h('strong', '', [p.tagline]), h('p', '', [story.hook])]);
    const el = h('section', 'xd-slide xd-cover', [word, folder, ticket, name, list, tagline]);
    return {
      el,
      enter(tl) {
        rise(tl, word, 0.05, 0.06);
        tl.from(folder, { yPercent: 70, duration: t(0.9), ease: 'expo.out' }, 0.35);
        tl.from(paper, { yPercent: 60, rotate: -6, duration: t(0.8), ease: 'back.out(1.5)' }, 0.75);
        toss(tl, ticket, 0.7, 'left');
        toss(tl, list, 0.85, 'right');
        draw(tl, list.querySelector('.xd-tick')!, 1.5);
        tl.from(name.children, { x: 40, opacity: 0, duration: t(0.6), stagger: 0.08, ease: 'power3.out' }, 0.6);
        tl.from(tagline.children, { y: 24, opacity: 0, duration: t(0.6), stagger: 0.1, ease: 'power3.out' }, 0.9);
      },
    };
  };

  const intro = (): Built => {
    const points = (context.points ?? []).slice(0, 4).map((pt) => h('li', '', [svg(ICON.arrow), pt]));
    const b = band(
      'xd-intro__band',
      [
        { label: 'Introduction' },
        { label: 'The demo', to: 'demo' },
        { label: pipe ? 'The pipeline' : 'Results', to: pipe ? 'pipeline' : 'results' },
      ],
      [
        windowCard('xd-intro__win', [picture(p), h('span', 'xd-rec', [h('i')])]),
        h('div', 'xd-intro__text', [
          h('div', 'xd-intro__top', [h('span', 'xd-pill', [context.title]), h('strong', 'xd-intro__label', ['The context'])]),
          h('p', 'xd-intro__p', [context.text]),
          ...(points.length ? [h('ul', 'xd-list', points)] : []),
          ...(context.plain ? [h('p', 'xd-intro__plain', [context.plain])] : []),
        ]),
      ],
    );
    const head = h('div', 'xd-head', [
      h('p', 'xd-kicker', [`${two(index + 1)} — ${p.domains.map((d) => DOMAINS[d].label).join(' / ')}`]),
      h('p', 'xd-head__meta', [p.team ?? p.where]),
    ]);
    const el = h('section', 'xd-slide xd-intro', [head, b.el]);
    return {
      el,
      enter(tl) {
        tl.from(head.children, { y: -16, opacity: 0, duration: t(0.5), stagger: 0.08 }, 0);
        enterBand(tl, b);
        toss(tl, b.el.querySelector('.xd-intro__win')!, 0.45, 'left');
        const pill = b.el.querySelector('.xd-pill')!;
        tl.from(pill, { scaleX: 0, transformOrigin: 'left', duration: t(0.5), ease: 'expo.out' }, 0.6);
        tl.from(b.el.querySelectorAll('.xd-intro__label, .xd-intro__p, .xd-list li, .xd-intro__plain'), { y: 18, opacity: 0, duration: t(0.5), stagger: 0.07, ease: 'power3.out' }, 0.75);
      },
    };
  };

  const watch = (): Built => {
    let mode: 'watch' | 'try' = 'watch';
    let shown: Live | null = null;
    const screen = h('div', 'xd-watch__screen');
    const win = windowCard('xd-watch__win', [screen]);
    const show = (m: typeof mode) => {
      mode = m;
      shown?.stop();
      shown = m === 'watch' ? live({ type: 'demo' }, p) : withApp ? live({ type: 'app' }, p) : interactiveDemo(p);
      screen.replaceChildren(...(shown ? [shown.el] : []));
      b.tabs.forEach((tab, i) => tab.classList.toggle('is-front', (i === 0) === (m === 'watch')));
      if (animated()) gsap.fromTo(screen, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: t(0.6), ease: 'expo.out', clearProps: 'clipPath' });
    };
    const b = band(
      'xd-watch__band',
      [
        { label: 'Explainer', click: () => show('watch') },
        { label: withApp ? 'Try the app' : 'Try the demo', on: false, click: () => show('try') },
      ],
      [
        win,
        h('div', 'xd-watch__side', [
          h('h3', 'xd-watch__title', [demo?.title ?? 'See it run']),
          h('p', 'xd-watch__p', [demo?.text ?? p.summary]),
          ...(appCh?.points ? [h('ul', 'xd-list', appCh.points.slice(0, 4).map((pt) => h('li', '', [svg(ICON.arrow), pt])))] : []),
        ]),
      ],
    );
    const head = h('div', 'xd-head', [h('p', 'xd-kicker', [`${two(index + 1)} — Demo`]), h('p', 'xd-head__meta', [p.stack.slice(0, 4).join(' · ')])]);
    const el = h('section', 'xd-slide xd-watch', [head, b.el]);
    show('watch');
    return {
      el,
      enter(tl) {
        enterBand(tl, b);
        tl.from(win, { y: 80, rotate: -4, opacity: 0, duration: t(0.8), ease: 'back.out(1.3)' }, 0.35);
        tl.from(b.el.querySelectorAll('.xd-watch__side > *'), { x: 30, opacity: 0, duration: t(0.5), stagger: 0.07 }, 0.6);
      },
      stop: () => shown?.stop(),
    };
  };

  const pipeline = (c: Chapter): Built => {
    const v = c.visual as Extract<Visual, { type: 'pipeline' | 'steps' }>;
    const items = (v.type === 'pipeline' ? v.steps.map((s) => ({ title: s.label, text: s.detail, kind: s.kind as string })) : v.items.map((s) => ({ ...s, kind: '' }))).slice(0, 6);
    const line = h('div', 'xd-flow__line', [h('i'), h('b')]);
    const nodes = items.map((it, i) => {
      const ico = it.kind ? svg(ICON[it.kind as keyof typeof ICON] ?? ICON.layers) : h('span', 'xd-flow__n', [two(i + 1)]);
      return h('div', 'xd-flow__node', [h('div', 'xd-flow__circle', [ico, h('strong', '', [it.title])]), h('p', '', [it.text])]);
    });
    const b = band('xd-flow__band', [{ label: TAG[c.tag] }, { label: 'Work process' }, { label: 'Deep dive', to: dives.length ? 'dive-0' : 'results' }], [
      h('div', 'xd-flow', [line, ...nodes]),
    ]);
    const head = h('div', 'xd-flow__head', [marked(c.title, 'xd-statement xd-statement--ink'), h('p', 'xd-flow__p', [c.text])]);
    const el = h('section', 'xd-slide xd-pipeline', [head, b.el]);
    let pulse: gsap.core.Tween | null = null;
    return {
      el,
      enter(tl) {
        tl.from(head.children, { y: 30, opacity: 0, duration: t(0.6), stagger: 0.1, ease: 'power3.out' }, 0);
        tl.from(head.querySelector('.xd-mark i'), { scaleX: 0, duration: t(0.6), ease: 'expo.inOut' }, 0.5);
        enterBand(tl, b, 0.15);
        tl.from(line.querySelector('i'), { scaleX: 0, transformOrigin: 'left', duration: t(1.2), ease: 'power2.inOut' }, 0.7);
        tl.from(nodes.map((n) => n.firstElementChild), { scale: 0, rotate: -120, duration: t(0.7), stagger: 0.16, ease: 'back.out(1.7)' }, 0.75);
        draw(tl, nodes, 1.1, 0.7);
        tl.from(nodes.map((n) => n.lastElementChild), { y: 12, opacity: 0, duration: t(0.4), stagger: 0.12 }, 1.2);
        // then a packet of data travels the chain, lighting each stage in turn
        tl.add(() => {
          const dot = line.querySelector('b')!;
          pulse = gsap.fromTo(dot, { left: '0%', opacity: 1 }, {
            left: '100%',
            duration: Math.max(2.4, items.length * 0.7),
            ease: 'none',
            repeat: -1,
            onUpdate() {
              const k = Math.floor(this.progress() * items.length);
              nodes.forEach((n, i) => n.classList.toggle('is-lit', i === k));
            },
          });
        });
      },
      stop: () => pulse?.kill(),
    };
  };

  /** The visual of a deep dive, as a card. */
  function diveCard(c: Chapter): HTMLElement {
    const v = c.visual;
    if (v?.type === 'code') {
      const lines = v.code.split('\n').map((l) => h('div', 'xd-code__l', [l || ' ']));
      return h('div', 'xd-dive__card xd-code', [h('div', 'xd-win__bar', [h('i'), h('i'), h('i'), h('span', '', [`${v.lang} · ${v.caption ?? ''}`])]), h('pre', '', lines)]);
    }
    if (v?.type === 'compare') {
      return h('div', 'xd-dive__card xd-grey', [
        h('table', 'xd-table', [
          h('thead', '', [h('tr', '', [h('th'), ...v.columns.map((c) => h('th', '', [c]))])]),
          h('tbody', '', v.rows.map((r) => h('tr', r.best ? 'is-best' : '', [h('th', '', [r.label]), ...r.values.map((x) => h('td', '', [x]))]))),
        ]),
        ...(v.caption ? [h('p', 'xd-grey__cap', [v.caption])] : []),
      ]);
    }
    const rows =
      v?.type === 'steps'
        ? v.items.map((s) => ({ a: s.title, b: s.text }))
        : v?.type === 'pipeline'
          ? v.steps.map((s) => ({ a: s.label, b: s.detail }))
          : v?.type === 'stats'
            ? v.items.map((s) => ({ a: s.value, b: s.label }))
            : (c.points ?? []).map((pt) => ({ a: '', b: pt }));
    return h(
      'div',
      'xd-dive__card xd-grey',
      rows.slice(0, 6).map((r) => h('div', 'xd-grey__row', [svg(ICON.plus, 'xd-ico xd-plus'), h('p', '', [...(r.a ? [h('strong', '', [r.a])] : []), r.b])])),
    );
  }

  const dive = (c: Chapter, i: number): Built => {
    const card = diveCard(c);
    const showPoints = c.points && c.visual && c.visual.type !== 'stats';
    const left = h('div', 'xd-dive__left', [
      h('p', 'xd-kicker', [`${TAG[c.tag]} — ${two(i + 1)} / ${two(dives.length)}`]),
      marked(c.title, 'xd-statement'),
      h('p', 'xd-dive__p', [c.text]),
      ...(c.plain ? [h('p', 'xd-dive__plain', [h('strong', '', ['In plain words — ']), c.plain])] : []),
    ]);
    const right = h('div', 'xd-dive__right', [
      card,
      ...(showPoints ? [h('ul', 'xd-list xd-list--ink', c.points!.slice(0, 3).map((pt) => h('li', '', [svg(ICON.arrow), pt])))] : []),
      h('strong', 'xd-dive__label', [`My ${TAG[c.tag] === 'AI' ? 'AI work' : TAG[c.tag].toLowerCase()}`]),
    ]);
    const el = h('section', `xd-slide xd-dive${c.visual?.type === 'code' ? ' has-code' : ''}`, [left, right]);
    return {
      el,
      enter(tl) {
        tl.from(left.querySelector('.xd-kicker'), { x: -20, opacity: 0, duration: t(0.4) }, 0);
        tl.from(left.querySelector('.xd-statement'), { yPercent: 40, opacity: 0, duration: t(0.8), ease: 'expo.out' }, 0.05);
        tl.from(left.querySelector('.xd-mark i'), { scaleX: 0, duration: t(0.6), ease: 'expo.inOut' }, 0.55);
        tl.from(left.querySelectorAll('.xd-dive__p, .xd-dive__plain'), { y: 16, opacity: 0, duration: t(0.5), stagger: 0.1 }, 0.4);
        toss(tl, card, 0.3, 'right');
        const rows = card.querySelectorAll('.xd-grey__row, tbody tr, .xd-code__l');
        tl.from(rows, { x: -14, opacity: 0, duration: t(0.35), stagger: card.classList.contains('xd-code') ? 0.035 : 0.09 }, 0.9);
        tl.from(card.querySelectorAll('.xd-plus'), { rotate: -180, scale: 0, duration: t(0.5), stagger: 0.09, ease: 'back.out(2)' }, 0.95);
        tl.from(right.querySelectorAll('.xd-list li, .xd-dive__label'), { y: 14, opacity: 0, duration: t(0.4), stagger: 0.08 }, 1.2);
      },
    };
  };

  const resultsSlide = (): Built => {
    const stats = results?.visual?.type === 'stats' ? results.visual.items : p.metrics;
    const circles = stats.slice(0, 3).map((s, i) => {
      const strong = h('strong', '', [s.value]);
      const c = h('div', `xd-circle xd-circle--${i}`, [h('span', 'xd-circle__n', [two(i + 1)]), strong, h('span', 'xd-circle__l', [s.label])]);
      c.dataset.depth = String(6 + i * 6);
      return { c, strong, value: s.value };
    });
    const keyRows = (results?.points ?? p.metrics.map((m) => `${m.value} — ${m.label}`)).slice(0, 4).map((pt) => h('span', 'xd-row', [svg(ICON.plus), pt]));
    const key = darkCard('xd-results__key', 'Key points', keyRows);
    key.dataset.depth = '20';
    const title = h('h3', 'xd-results__title', [h('span', '', ['Results']), h('span', '', ['& limits'])]);
    const text = h('p', 'xd-results__p', [results?.text ?? p.summary]);
    const note = p.note ? h('p', 'xd-results__note', [p.note]) : null;
    const el = h('section', 'xd-slide xd-results', [title, ...circles.map((x) => x.c), key, text, ...(note ? [note] : [])]);
    return {
      el,
      enter(tl) {
        tl.from(title.children, { yPercent: 100, opacity: 0, duration: t(0.8), stagger: 0.1, ease: 'expo.out' }, 0);
        tl.from(
          circles.map((x) => x.c),
          { scale: 0, duration: t(1.1), stagger: 0.15, ease: 'elastic.out(1, 0.55)', onStart: () => circles.forEach((x, i) => countUp(x.strong, x.value, 0.15 + i * 0.15)) },
          0.25,
        );
        toss(tl, key, 0.6, 'right');
        draw(tl, key.querySelector('.xd-tick')!, 1.3);
        tl.from([text, note].filter(Boolean) as Element[], { y: 20, opacity: 0, duration: t(0.5), stagger: 0.1 }, 0.8);
      },
    };
  };

  /** The project's poster, whole, as tall as the slide. */
  const posterSlide = (src: string): Built => {
    const img = h('img', 'xd-poster__img');
    img.src = src;
    img.alt = `${p.title}: poster`;
    img.decoding = 'async';
    img.draggable = false;
    const title = h('h3', 'xd-poster__title', [h('span', '', ['The']), h('span', '', ['poster.'])]);
    const el = h('section', 'xd-slide xd-poster', [title, img]);
    return {
      el,
      enter(tl) {
        tl.from(title.children, { yPercent: 100, opacity: 0, duration: t(0.8), stagger: 0.1, ease: 'expo.out' }, 0);
        tl.from(img, { y: 120, rotate: 3, opacity: 0, duration: t(0.9), ease: 'back.out(1.3)' }, 0.2);
      },
    };
  };

  const file = (): Built => {
    const big = h('div', 'xd-outro__big', (p.report ? 'Read the report.' : 'That’s the file.').split(' ').map((w) => letters(w, 'xd-outro__w')));
    const rows: [string, string][] = [
      [ICON.user, p.role],
      [ICON.pin, p.where],
      [ICON.cal, `${fmt(p.start)} — ${fmt(p.end)}`],
      ...(p.team ? [[ICON.layers, p.team] as [string, string]] : []),
    ];
    const card = darkCard('xd-outro__card', 'The file', [
      ...rows.map(([ico, txt]) => h('span', 'xd-row', [svg(ico), txt])),
      h('span', 'xd-outro__stack', p.stack.map((s) => h('i', '', [s]))),
      h('span', 'xd-outro__btns', [
        ...(p.report ? [button('xd-btn xd-btn--tone', ['Open the report ↗'], () => openReport(p))] : []),
        ...(host.next ? [button('xd-btn', [`Next: ${host.next.title} →`], () => host.onNext())] : []),
      ]),
    ]);
    const side = h('p', 'xd-outro__side', [p.highlights[0] ?? p.summary]);
    const more = h('ol', 'xd-outro__more', p.highlights.slice(1, 4).map((x, i) => h('li', '', [h('b', '', [two(i + 1)]), x])));
    const el = h('section', 'xd-slide xd-outro', [big, side, more, card]);
    return {
      el,
      enter(tl) {
        rise(tl, big, 0, 0.03);
        tl.from(side, { opacity: 0, x: 30, duration: t(0.6) }, 0.4);
        tl.from(more.children, { opacity: 0, y: 16, duration: t(0.5), stagger: 0.1 }, 0.7);
        tl.from(card, { y: 160, rotate: 8, opacity: 0, duration: t(0.9), ease: 'back.out(1.3)' }, 0.5);
        draw(tl, card.querySelector('.xd-tick')!, 1.2);
      },
    };
  };

  const slides: Slide[] = [
    { id: 'cover', label: 'Cover', time: 7, build: cover },
    { id: 'context', label: 'Context', time: 11, build: intro },
    { id: 'demo', label: 'Demo', time: 30, build: watch },
    ...(pipe ? [{ id: 'pipeline', label: 'Pipeline', time: 11, build: () => pipeline(pipe) }] : []),
    ...dives.map((c, i) => ({ id: `dive-${i}`, label: TAG[c.tag], time: 12, build: () => dive(c, i) })),
    { id: 'results', label: 'Results', time: 11, build: resultsSlide },
    ...(p.poster ? [{ id: 'poster', label: 'Poster', time: 18, build: () => posterSlide(p.poster!) }] : []),
    { id: 'file', label: 'The file', time: 9, build: file },
  ];

  // ---- the deck: the stage, the wipe, the tabs at the bottom ----
  const stage = h('div', 'xd-stage');
  const wipeNum = h('strong', 'xd-wipe__num');
  const wipeLabel = h('span', 'xd-wipe__label');
  const wipe = h('div', 'xd-wipe', [h('span', 'xd-wipe__tab', [`Experience ${two(index + 1)}`]), wipeNum, wipeLabel]);
  const fills: HTMLElement[] = [];
  const navTabs = slides.map((s, i) => {
    const fill = h('i', 'xd-nav__fill');
    fills.push(fill);
    const b = button('xd-nav__tab', [h('b', '', [two(i + 1)]), h('span', '', [s.label]), fill], () => go(i, true), s.label);
    return b;
  });
  const autoBtn = button('xd-nav__auto', [], () => (auto ? pauseAuto() : resumeAuto()), 'Play / pause');
  const nav = h('nav', 'xd-nav', [h('div', 'xd-nav__tabs', navTabs), autoBtn]);
  const deck = h('div', 'xd', [h('div', 'xd-screen', [stage, wipe]), nav]);
  root.replaceChildren(deck);

  let cur = -1;
  let built: Built | null = null;
  let enterTl: gsap.core.Timeline | null = null;
  let busy = false;
  let auto = true;
  let timer: gsap.core.Tween | null = null;
  let alive = true;

  goTo = (id) => {
    const i = slides.findIndex((s) => s.id === id);
    if (i >= 0) go(i, true);
  };

  function setAutoIcon() {
    autoBtn.replaceChildren(svg(auto ? ICON.pause : ICON.play, 'xd-ico', !auto), h('span', '', [auto ? 'Auto' : 'Play']));
    autoBtn.classList.toggle('is-on', auto);
  }

  function place(i: number) {
    built?.stop?.();
    enterTl?.kill();
    cur = i;
    built = slides[i].build();
    stage.replaceChildren(built.el);
    navTabs.forEach((b, k) => b.classList.toggle('is-on', k === i));
    navTabs[i].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (animated()) {
      enterTl = gsap.timeline();
      built.enter(enterTl);
    }
    arm();
  }

  function go(i: number, user = false) {
    if (!alive || busy || i === cur || i < 0 || i >= slides.length) return;
    if (user) pauseAuto();
    if (!animated() || cur < 0) return place(i);
    busy = true;
    wipeNum.textContent = two(i + 1);
    wipeLabel.textContent = slides[i].label;
    gsap
      .timeline({ onComplete: () => void (busy = false) })
      .set(wipe, { visibility: 'visible' })
      .fromTo(wipe, { yPercent: 112 }, { yPercent: 0, duration: t(0.42), ease: 'power3.in' })
      .from([wipeNum, wipeLabel], { yPercent: 60, opacity: 0, duration: t(0.3), stagger: 0.05 }, '-=0.15')
      .add(() => place(i))
      .to(wipe, { yPercent: -112, duration: t(0.5), ease: 'power3.inOut' }, '+=0.12')
      .set(wipe, { visibility: 'hidden' });
  }

  /** The bottom tab of the current slide fills up; then the page turns. */
  function arm() {
    timer?.kill();
    fills.forEach((f) => gsap.set(f, { scaleX: 0 }));
    if (!auto || !animated()) return;
    const last = cur === slides.length - 1;
    if (last && !(tour && host.next)) return;
    timer = gsap.fromTo(fills[cur], { scaleX: 0 }, { scaleX: 1, duration: slides[cur].time, ease: 'none', onComplete: () => (last ? host.onNext() : go(cur + 1)) });
  }

  function pauseAuto() {
    auto = false;
    timer?.kill();
    timer = null;
    fills.forEach((f) => gsap.set(f, { scaleX: 0 }));
    setAutoIcon();
  }

  function resumeAuto() {
    auto = true;
    setAutoIcon();
    arm();
  }

  // the visitor takes over: a click in the slide, the arrow keys, the wheel
  const takeOver = (e: Event) => e.isTrusted && !(e.target as Element).closest('.xd-nav') && auto && pauseAuto();
  stage.addEventListener('pointerdown', takeOver);
  const onKey = (e: KeyboardEvent) => {
    if (!deck.isConnected || !deck.offsetParent) return;
    if (e.key === 'ArrowRight') go(cur + 1, true);
    else if (e.key === 'ArrowLeft') go(cur - 1, true);
  };
  document.addEventListener('keydown', onKey);
  let wheelAt = 0;
  const onWheel = (e: WheelEvent) => {
    if (deck.clientWidth < 760 || Math.abs(e.deltaY) < 30) return;
    const scroller = (e.target as Element).closest<HTMLElement>('.xd-code pre, .xp-fit');
    if (scroller) return;
    const now = performance.now();
    if (now - wheelAt < 900) return;
    wheelAt = now;
    go(cur + (e.deltaY > 0 ? 1 : -1), true);
  };
  stage.addEventListener('wheel', onWheel, { passive: true });

  // depth: the cards drift a little with the pointer
  const onMove = (e: PointerEvent) => {
    if (!animated() || e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    for (const el of stage.querySelectorAll<HTMLElement>('[data-depth]')) {
      const d = Number(el.dataset.depth);
      el.style.setProperty('--px', `${(-dx * d).toFixed(1)}px`);
      el.style.setProperty('--py', `${(-dy * d).toFixed(1)}px`);
    }
  };
  stage.addEventListener('pointermove', onMove);

  setAutoIcon();
  place(0);

  return {
    pause: pauseAuto,
    stop() {
      alive = false;
      pauseAuto();
      enterTl?.kill();
      built?.stop?.();
      gsap.killTweensOf(wipe);
      document.removeEventListener('keydown', onKey);
    },
  };
}
