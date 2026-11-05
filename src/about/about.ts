import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';
import { BIO, CV, EXPERIENCE, HELLO, LANGUAGES, LINKS, POLAROIDS, PORTRAIT, ROLE, STICKER, STUDIES, TOOLS, type Entry } from './content';
import { openPdf } from '../os/report';
import { isPreview } from '../preview';
import '../pages'; // side-effect import: declares the pageenter/pageleave event types used below

/**
 * About me, as a photo editor: an options bar on top (with the CV and the
 * links), a tool palette floating on the left, the document in the middle,
 * the Layers panel on the right and a few panels floating over the edges
 * (experience, studies, toolbox).
 *
 * Everything on the canvas is a layer. Picking one, in the Layers panel or on
 * the canvas itself (Auto-Select: Layer), puts the transform box around it;
 * its eye hides it. Hiding the Background shows the transparency grid.
 */

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

const ICONS = {
  home: 'M3 11l9-7 9 7M5 9v11h14V9',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  marquee: 'M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4M4 7V4',
  lasso: 'M5 9c0-3 3-5 7-5s7 2 7 5-3 5-7 5c-1.5 0-3-.3-4.2-.8M7.8 13.2C6.5 14 6 15 6.5 16s2 1.2 2.5 2.5S8 21 7 21',
  wand: 'M4 20L15 9M17 3v3M20 6h-3M20 11l-1.5-1.5M11 4l1.5 1.5',
  crop: 'M6 2v16h16M2 6h16v16',
  frame: 'M4 4h16v16H4zM4 4l16 16M20 4L4 20',
  dropper: 'M14 4l6 6M17 7l-9 9-4 1 1-4 9-9',
  brush: 'M18 3l3 3-9 9-3-3zM9 12c-3 0-4 2-4 4s-1 3-2 3c3 1 7 0 7-3',
  eraser: 'M4 16l8-8 6 6-6 6H8zM12 20h8',
  text: 'M5 5h14M12 5v14M9 19h6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  folder: 'M3 6h6l2 2h10v11H3z',
  chevron: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  collapse: 'M11 7l-5 5 5 5M18 7l-5 5 5 5',
  mask: 'M4 5h16v14H4zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  plus: 'M5 5h14v14H5zM12 9v6M9 12h6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
};

function icon(name: keyof typeof ICONS, className = 'ps-icon') {
  const span = h('span', className);
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return span;
}

function picture(src: string, className = '') {
  const img = h('img', className);
  img.src = src;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  return img;
}

/** A paragraph, with its **double-starred** words in bold. */
function rich(text: string) {
  return h('p', 'ps-doc__bio', text.split('**').map((part, i) => (i % 2 ? h('strong', '', [part]) : part)));
}

function link(label: string, href: string, className: string) {
  const a = h('a', className, [label]);
  a.href = href;
  if (!href.startsWith('mailto:')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

/** A floating panel, with the title bar of the editor's own. */
function panel(title: string, className: string, children: (Node | string)[]) {
  return h('div', `ps-float ps-panel ${className}`, [
    h('div', 'ps-panel__head', [h('span', '', [title]), h('span', 'ps-panel__tools', [icon('collapse'), icon('close')])]),
    h('div', 'ps-panel__body', children),
  ]);
}

function entries(title: string, list: Entry[]) {
  return h('div', 'ps-entries', [
    h('h3', 'ps-entries__title', [title]),
    h(
      'ul',
      '',
      list.map((e) => h('li', '', [h('span', 'ps-entries__when', [e.when]), h('span', 'ps-entries__what', [h('strong', '', [e.title]), h('span', '', [e.where])])])),
    ),
  ]);
}

interface Layer {
  name: string;
  /** What the layer's thumbnail shows. */
  thumb: { image: string } | 'text' | 'group' | 'fill';
  el: HTMLElement;
}

export function initAbout(): void {
  const section = document.getElementById('about');
  const sheet = section?.querySelector<HTMLElement>('.about__sheet');
  if (!section || !sheet) return;

  // ---- the document: every piece of it is a layer ----
  // the portrait in black and white, its colour on top (the cursor paints it back in)
  const ink = picture(PORTRAIT, 'ps-doc__ink');
  const portrait = h('figure', 'ps-doc__portrait', [picture(PORTRAIT), ink]);
  const sticker = h('span', 'ps-doc__sticker', [picture(STICKER)]);
  const hello = h('h2', 'ps-doc__hello', [HELLO.before, h('mark', '', [HELLO.name]), HELLO.after]);
  const role = h('p', 'ps-doc__role', ROLE.flatMap((r, i) => (i ? [h('span', 'ps-doc__dot', ['·']), r] : [r])));
  const bio = h('div', 'ps-doc__about', BIO.map(rich));
  const polaroids = h(
    'div',
    'ps-doc__polaroids',
    POLAROIDS.map((p) => h('figure', 'ps-doc__polaroid', [picture(p.image), h('figcaption', '', [p.caption])])),
  );
  const selection = h('div', 'ps-select', ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map((d) => h('span', `ps-select__handle ps-select__handle--${d}`)));
  selection.setAttribute('aria-hidden', 'true');

  const artboard = h('div', 'ps-doc', [
    h('div', 'ps-doc__left', [portrait, sticker]),
    h('div', 'ps-doc__right', [hello, role, bio, polaroids]),
    selection,
  ]);

  const layers: Layer[] = [
    { name: `${HELLO.before}${HELLO.name}${HELLO.after}`, thumb: 'text', el: hello },
    { name: ROLE.join(' · '), thumb: 'text', el: role },
    { name: 'About me', thumb: 'text', el: bio },
    { name: 'Polaroids', thumb: 'group', el: polaroids },
    { name: 'me, mid-debug.png', thumb: { image: STICKER }, el: sticker },
    { name: 'Rendra.png', thumb: { image: PORTRAIT }, el: portrait },
    { name: 'Background', thumb: 'fill', el: artboard },
  ];

  const docName = h('span', 'ps-tab__layer', ['']);
  const tab = h('div', 'ps-tab', [h('span', '', ['Rendra.psd @ 100% (']), docName, h('span', '', [', RGB/8)']), icon('close')]);

  // ---- the Layers panel ----
  const rows = layers.map((layer) => {
    const eye = h('button', 'ps-layer__eye', [icon('eye')]);
    eye.type = 'button';
    eye.setAttribute('aria-label', `Hide ${layer.name}`);
    const thumb = h('span', `ps-layer__thumb ps-layer__thumb--${typeof layer.thumb === 'string' ? layer.thumb : 'image'}`);
    if (typeof layer.thumb === 'object') thumb.append(picture(layer.thumb.image));
    else if (layer.thumb === 'text') thumb.append(icon('text'));
    else if (layer.thumb === 'group') thumb.append(icon('folder'));
    const row = h('li', 'ps-layer', [eye, thumb, h('span', 'ps-layer__name', [layer.name])]);
    row.addEventListener('click', () => select(layer));
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = !row.classList.contains('is-hidden');
      row.classList.toggle('is-hidden', hidden);
      eye.setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} ${layer.name}`);
      layer.el.classList.toggle(layer.el === artboard ? 'is-transparent' : 'is-hidden', hidden);
      place();
    });
    return row;
  });

  const layersPanel = h('aside', 'ps-layers', [
    h('div', 'ps-layers__tabs', [h('span', 'is-on', ['Layers']), h('span', '', ['Channels'])]),
    h('div', 'ps-layers__filters', [
      h('span', 'ps-field', [icon('search'), 'Kind', icon('chevron')]),
      h('span', 'ps-field', ['Normal', icon('chevron')]),
      h('span', 'ps-layers__opacity', ['Opacity: ', h('span', 'ps-field', ['100%'])]),
    ]),
    h('ul', 'ps-layers__list', rows),
    h('div', 'ps-layers__foot', [icon('mask'), icon('folder'), icon('plus'), icon('trash')]),
  ]);

  // ---- the options bar: the CV and the links live here ----
  const cv = link('View my CV', CV, 'ps-bar__cv');
  cv.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    openPdf(CV, 'Rendra Djunaedi · CV');
  });
  const bar = h('div', 'ps-bar', [
    icon('home'),
    icon('move'),
    h('span', 'ps-bar__check', ['✓']),
    h('span', 'ps-bar__label', ['Auto-Select:']),
    h('span', 'ps-field', ['Layer', icon('chevron')]),
    h('span', 'ps-bar__space'),
    ...LINKS.map((l) => link(l.label, l.href, 'ps-bar__link')),
    cv,
    icon('search'),
  ]);

  const window_ = h('div', 'ps', [
    bar,
    h('div', 'ps__body', [
      h('div', 'ps__work', [h('div', 'ps-ruler ps-ruler--top'), h('div', 'ps-ruler ps-ruler--left'), tab, h('div', 'ps__stage', [artboard])]),
      layersPanel,
    ]),
  ]);

  // ---- what floats around it ----
  const toolIcons = (['move', 'marquee', 'lasso', 'wand', 'crop', 'frame', 'dropper'] as const).map((n, i) => icon(n, i ? 'ps-icon' : 'ps-icon is-on'));
  const tools = h('div', 'ps-float ps-tools', [h('span', 'ps-grip'), ...toolIcons]);
  const brush = icon('brush');
  const brushes = h('div', 'ps-float ps-tile ps-tile--brushes', [h('span', 'ps-grip'), brush, icon('eraser')]);
  const type = h('div', 'ps-float ps-tile ps-tile--type', [icon('text'), h('span', 'ps-caret')]);
  const badge = h('div', 'ps-float ps-badge', [h('span', '', ['Rd'])]);
  const experience = panel('Timeline', 'ps-panel--xp', [entries('Experience', EXPERIENCE), entries('Studies', STUDIES)]);
  const toolbox = panel('Toolbox', 'ps-panel--tools', [
    h('ul', 'ps-chips', TOOLS.map((tool) => h('li', '', [tool]))),
    h('p', 'ps-small', [LANGUAGES]),
  ]);

  const desk = h('div', 'ps-desk', [window_, tools, brushes, type, badge, experience, toolbox]);
  sheet.append(desk);


  // ---- picking a layer: the transform box goes around it ----
  let current = layers[5];

  /** Where `el` sits inside `frame`, in the frame's own pixels (the studio shows the page scaled down). */
  function rect(el: HTMLElement, frame: HTMLElement = artboard) {
    const box = frame.getBoundingClientRect();
    const scale = box.width / frame.offsetWidth || 1;
    const r = el.getBoundingClientRect();
    return { x: (r.left - box.left) / scale, y: (r.top - box.top) / scale, w: r.width / scale, h: r.height / scale };
  }
  const at = (el: HTMLElement) => rect(el, desk);

  function place() {
    const hidden = current.el.classList.contains('is-hidden');
    selection.classList.toggle('is-off', hidden);
    if (hidden) return;
    const r = rect(current.el);
    const inset = current.el === artboard ? 0 : 6;
    gsap.set(selection, { left: r.x - inset, top: r.y - inset, width: r.w + inset * 2, height: r.h + inset * 2 });
  }

  function select(layer: Layer) {
    current = layer;
    rows.forEach((row, i) => row.classList.toggle('is-on', layers[i] === layer));
    docName.textContent = layer.name;
    place();
  }

  // Auto-Select: Layer — clicking a piece of the canvas picks its layer
  artboard.addEventListener('click', (e) => {
    const hit = layers.find((l) => l.el !== artboard && l.el.contains(e.target as Node));
    select(hit ?? layers[layers.length - 1]);
  });
  new ResizeObserver(place).observe(artboard);
  select(current);

  // ---- typing: a piece of text shown one character at a time ----

  function typist(el: HTMLElement) {
    const nodes: Text[] = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) nodes.push(walk.currentNode as Text);
    const full = nodes.map((n) => n.data);
    const total = full.reduce((sum, s) => sum + s.length, 0);
    const show = (count: number) => {
      let left = count;
      nodes.forEach((n, i) => {
        const take = Math.max(0, Math.min(full[i].length, left));
        if (n.data.length !== take) n.data = full[i].slice(0, take);
        // an inline box with nothing typed in it yet (the highlighted name, a dot) stays out of sight
        if (n.parentElement && n.parentElement !== el) n.parentElement.hidden = take === 0;
        left -= take;
      });
    };
    return { el, total, show };
  }

  const paragraphs = Array.from(bio.children) as HTMLElement[];
  const texts = [hello, role, ...paragraphs].map(typist);
  const typed = (el: HTMLElement) => texts.find((x) => x.el === el)!;

  // ---- the cursor: an arrow, or an I-beam while it types ----
  const cursor = h('div', 'ps-cursor');
  cursor.innerHTML =
    '<svg class="ps-cursor__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2.5v17l4.4-4.1 2.9 6.5 2.7-1.2-2.9-6.4H18z" fill="#0b0b0b" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>' +
    '<svg class="ps-cursor__beam" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M12 3v18M9 21h6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M9 3h6M12 3v18M9 21h6" fill="none" stroke="#0b0b0b" stroke-width="1.6" stroke-linecap="round"/></svg>';
  desk.append(cursor);

  const byEl = (el: HTMLElement) => layers.find((l) => l.el === el)!;
  const frames = Array.from(polaroids.children) as HTMLElement[];
  const panels = [experience, toolbox];
  const tidied = [hello, polaroids, bio, sticker, role, portrait]; // the order it visits them in, once the page is laid out
  const SMALL = 0.45; // how small a picture is when the cursor picks it up

  let pending: gsap.core.Tween | undefined;
  let intro: gsap.core.Timeline | undefined;
  let idle: gsap.core.Timeline | undefined;
  let loops: gsap.core.Animation[] = [];
  let userHere = false; // a real pointer on the page: the fake one steps aside

  /** The page with nothing placed yet: an empty canvas, no panels. */
  function empty() {
    gsap.set([portrait, sticker, ...frames, ...panels, selection], { opacity: 0 });
    gsap.set(ink, { clipPath: 'inset(0% 100% 0% 0%)' });
    texts.forEach((x) => x.show(0));
  }

  /** The page fully laid out. */
  function full() {
    gsap.killTweensOf([cursor, ink, portrait, sticker, polaroids, ...frames, ...panels, ...tidied]);
    texts.forEach((x) => {
      x.show(x.total);
      x.el.classList.remove('is-typing');
    });
    gsap.set([portrait, sticker, polaroids, ...frames, ...panels, ink, ...tidied], { clearProps: 'opacity,scale,rotate,y,transformOrigin,clipPath' });
    [brush, type].forEach((el) => el.classList.remove('is-on'));
    cursor.classList.remove('is-text');
  }

  /** Empties the page now, and lays it out after `delay` (once the window has settled, so it can be measured). */
  function playIntro(delay: number) {
    empty();
    gsap.set(cursor, { opacity: 0 });
    pending = gsap.delayedCall(delay, layOut);
  }

  function layOut() {
    // measured with all the words in place (put back and taken out again before the next paint)
    texts.forEach((x) => x.show(x.total));
    const spot = new Map([portrait, sticker, hello, role, ...paragraphs, ...frames, ...panels, brush, type].map((el) => [el, at(el)]));
    texts.forEach((x) => x.show(0));
    const r = (el: HTMLElement) => spot.get(el)!;
    gsap.set(cursor, { x: desk.offsetWidth * 0.82, y: desk.offsetHeight + 20, scale: 1, opacity: 0 });

    const tl = (intro = gsap.timeline({
      onComplete: () => {
        full();
        select(byEl(portrait));
        startIdle();
      },
    }));
    const move = (x: number, y: number, duration = 0.5) => tl.to(cursor, { x, y, duration, ease: 'power2.inOut' });
    const press = () => tl.to(cursor, { scale: 0.8, duration: 0.07, yoyo: true, repeat: 1 });
    const pick = (el: HTMLElement) => tl.call(() => select(byEl(el))).set(selection, { opacity: 1 });

    /** A picture: dropped in small, then dragged out by its corner handle to its full size. */
    const scaleIn = (el: HTMLElement) => {
      const f = r(el);
      move(f.x + f.w * SMALL * 0.5, f.y + f.h * SMALL * 0.5).set(el, { opacity: 1, scale: SMALL, transformOrigin: '0% 0%' });
      pick(el);
      press();
      tl.to(cursor, { x: f.x + f.w * SMALL, y: f.y + f.h * SMALL, duration: 0.18, ease: 'power1.out' })
        .to(el, { scale: 1, duration: 0.55, ease: 'power2.inOut', onUpdate: place })
        .to(cursor, { x: f.x + f.w, y: f.y + f.h, duration: 0.55, ease: 'power2.inOut' }, '<');
    };

    /** Picks a tool on one of the floating tiles. */
    const tool = (el: HTMLElement) => {
      const f = r(el);
      move(f.x + f.w * 0.5, f.y + f.h * 0.5, 0.55);
      press();
      tl.call(() => el.classList.add('is-on'));
    };

    /** Clicks at the start of a line of text and types it in. */
    const typeIn = (el: HTMLElement, perChar: number, layer: HTMLElement = el) => {
      const f = r(el);
      const x = typed(el);
      move(f.x, f.y + Math.min(f.h, 40) * 0.5, 0.4).call(() => cursor.classList.add('is-text'));
      press();
      pick(layer);
      const count = { n: 0 };
      tl.call(() => el.classList.add('is-typing'))
        .to(count, {
          n: x.total,
          duration: x.total * perChar,
          ease: 'none',
          onUpdate: () => {
            x.show(Math.round(count.n));
            place();
          },
        })
        .call(() => el.classList.remove('is-typing'));
    };

    tl.to(cursor, { opacity: 1, duration: 0.2 });

    // 1. the portrait, scaled in…
    scaleIn(portrait);
    // …then painted back into colour with the brush
    tool(brush);
    const p = r(portrait);
    move(p.x + p.w * 0.12, p.y + p.h * 0.2, 0.45);
    tl.to(cursor, {
      keyframes: [
        { x: p.x + p.w * 0.88, y: p.y + p.h * 0.3 },
        { x: p.x + p.w * 0.15, y: p.y + p.h * 0.5 },
        { x: p.x + p.w * 0.9, y: p.y + p.h * 0.65 },
        { x: p.x + p.w * 0.2, y: p.y + p.h * 0.85 },
      ],
      duration: 1.3,
      ease: 'none',
    })
      .to(ink, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power1.inOut' }, '<')
      .call(() => brush.classList.remove('is-on'));

    // 2. the sticker: scaled in, then given a twist
    scaleIn(sticker);
    tl.fromTo(sticker, { rotate: -24 }, { rotate: 0, duration: 0.4, ease: 'back.out(2)', onUpdate: place }, '<0.15');

    // 3. the words, typed in with the type tool
    tool(type);
    typeIn(hello, 0.06);
    typeIn(role, 0.03);
    paragraphs.forEach((para) => typeIn(para, 0.006, bio));
    tl.call(() => {
      type.classList.remove('is-on');
      cursor.classList.remove('is-text');
    });

    // 4. the polaroids, dropped in one by one
    frames.forEach((frame, i) => {
      const f = r(frame);
      move(f.x + f.w * 0.5, f.y + f.h * 0.45, i ? 0.3 : 0.5);
      if (!i) pick(polaroids);
      press();
      tl.fromTo(frame, { opacity: 0, scale: 1.3, y: -24 }, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(2)' }, '<');
    });

    // 5. the panels, pulled up into place by their title bars
    panels.forEach((panel) => {
      const f = r(panel);
      const grab = { x: f.x + f.w * 0.3, y: f.y + 14 };
      const below = desk.offsetHeight - f.y + 10; // how far down the panel starts: just off the page
      move(grab.x, desk.offsetHeight - 6, 0.5).set(panel, { opacity: 1, y: below });
      press();
      tl.to(panel, { y: 0, duration: 0.6, ease: 'power3.out' }).to(cursor, { y: grab.y, duration: 0.6, ease: 'power3.out' }, '<');
    });
  }

  /** Afterwards, on a loop: the cursor wanders from piece to piece, picks it and gives it a nudge. */
  function startIdle() {
    idle?.kill();
    idle = gsap.timeline({ repeat: -1, repeatRefresh: true, paused: userHere });
    for (const el of tidied) {
      idle
        .to(cursor, { x: () => at(el).x + at(el).w * 0.55, y: () => at(el).y + at(el).h * 0.45, duration: 1, ease: 'power2.inOut' })
        .call(() => select(byEl(el)))
        .to(cursor, { scale: 0.8, duration: 0.07, yoyo: true, repeat: 1 })
        .to(el, { y: -5, duration: 0.16, ease: 'power1.out', yoyo: true, repeat: 1 })
        .to({}, { duration: 1.6 });
    }
    gsap.to(cursor, { opacity: userHere ? 0 : 1, duration: 0.3 });
  }

  /** Around the window, on a loop: the panels drift, the tools take turns, the brush paints. */
  function startLoops() {
    stopLoops();
    const floats = [tools, brushes, type, badge];
    loops = floats.map((el, i) => gsap.to(el, { y: i % 2 ? 7 : -7, duration: 2.4 + i * 0.35, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    loops.push(gsap.to(badge, { rotate: 6, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    loops.push(gsap.to(brush, { rotate: -16, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '20% 80%' }));
    let pick = 0;
    loops.push(
      gsap.to({}, {
        duration: 1.4,
        repeat: -1,
        onRepeat: () => {
          toolIcons[pick].classList.remove('is-on');
          pick = (pick + 1) % toolIcons.length;
          toolIcons[pick].classList.add('is-on');
        },
      }),
    );
  }

  function stopLoops() {
    loops.forEach((l) => l.kill());
    loops = [];
    gsap.set([tools, brushes, type, badge, brush], { clearProps: 'y,rotate' });
  }

  function stopAll() {
    pending?.kill();
    intro?.kill();
    idle?.kill();
    pending = intro = idle = undefined;
    stopLoops();
    full();
    gsap.set(cursor, { opacity: 0 });
  }

  // a real pointer over the page: the fake cursor steps aside until it leaves
  if (window.matchMedia('(hover: hover)').matches) {
    sheet.addEventListener('pointerenter', () => {
      userHere = true;
      if (!idle) return; // still laying the page out: let it finish
      idle.pause();
      gsap.to(cursor, { opacity: 0, duration: 0.2 });
    });
    sheet.addEventListener('pointerleave', () => {
      userHere = false;
      if (!idle) return;
      idle.resume();
      gsap.to(cursor, { opacity: 1, duration: 0.3 });
    });
  }

  // ---- entrance ----
  // The home page's card shows the editor still empty; opening it, the cursor
  // lays the whole page out. Portrait screens (one scrolling column) skip it.
  const chrome = [window_, tools, brushes, type, badge];
  const stacked = window.matchMedia('(orientation: portrait)');

  section.addEventListener('pageenter', (e) => {
    sheet.scrollTop = 0;
    stopAll();
    gsap.killTweensOf(chrome);
    const instant = e.detail.instant || isReducedMotion();
    if (instant) gsap.set(chrome, { clearProps: 'opacity,y,scale' });
    else
      gsap.fromTo(
        chrome,
        { opacity: 0, y: 16, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: t(0.5), ease: 'back.out(1.5)', stagger: t(0.07), delay: t(0.2), clearProps: 'opacity,y,scale' },
      );

    if (isReducedMotion() || stacked.matches) {
      requestAnimationFrame(() => select(byEl(portrait)));
      gsap.set(selection, { opacity: 1 });
      return;
    }
    startLoops();
    if (isPreview) {
      empty(); // the card: an empty canvas, waiting
      return;
    }
    playIntro(instant ? 0.35 : 1.1);
  });

  section.addEventListener('pageleave', stopAll);
}
