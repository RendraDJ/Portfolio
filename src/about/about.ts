import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';
import { BIO, CV, EXPERIENCE, FOCUS, HELLO, LANGUAGES, LINKS, POLAROIDS, PORTRAIT, ROLE, STICKER, STUDIES, TOOLS, type Entry } from './content';
import { openPdf } from '../os/report';
import '../pages'; // side-effect import: declares the pageenter/pageleave event types used below

/**
 * About me, as a scrapbook page on squared paper: the portrait taped on the
 * left, a hello and a few polaroids in the middle, the CV at a glance on the
 * right. Arriving on the page, its pieces drop into place one after the
 * other, as if pinned on by hand.
 */

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

function picture(src: string, className: string) {
  const img = h('img', className);
  img.src = src;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  return img;
}

/** A paragraph, with its **double-starred** words in bold. */
function rich(text: string) {
  return h('p', 'about__bio', text.split('**').map((part, i) => (i % 2 ? h('strong', '', [part]) : part)));
}

function entries(list: Entry[]) {
  return h(
    'ul',
    'about__entries',
    list.map((e) => h('li', 'about__entry', [h('span', 'about__when', [e.when]), h('span', 'about__what', [h('strong', '', [e.title]), h('span', '', [e.where])])])),
  );
}

function block(title: string, children: (Node | string)[]) {
  return h('div', 'about__block', [h('h3', 'about__label', [title]), ...children]);
}

function link(label: string, href: string, className = 'about__link') {
  const a = h('a', className, [label]);
  a.href = href;
  if (!href.startsWith('mailto:')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

export function initAbout(): void {
  const section = document.getElementById('about');
  const sheet = section?.querySelector<HTMLElement>('.about__sheet');
  if (!section || !sheet) return;

  const portrait = h('figure', 'about__portrait', [
    picture(PORTRAIT, 'about__portrait-img'),
    h('span', 'about__sticker', [picture(STICKER, '')]),
    h('span', 'about__note', ['← me, mid-debug']),
  ]);

  // the CV opens in a window on the page, like the reports (a plain link stays as the fallback)
  const cv = link('View my CV', CV, 'about__cv');
  cv.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    openPdf(CV, 'Rendra Djunaedi · CV');
  });

  const middle = h('div', 'about__middle', [
    h('div', 'about__heading', [
      h('h2', 'about__hello', [HELLO.before, h('mark', '', [HELLO.name]), HELLO.after]),
      h('p', 'about__role', ROLE.flatMap((r, i) => (i ? [h('span', 'about__dot', ['·']), r] : [r]))),
    ]),
    ...BIO.map(rich),
    h(
      'div',
      'about__polaroids',
      POLAROIDS.map((p) => h('figure', 'about__polaroid', [picture(p.image, ''), h('figcaption', '', [p.caption])])),
    ),
  ]);

  const side = h('div', 'about__side', [
    block('Experience', [entries(EXPERIENCE)]),
    block('Studies', [entries(STUDIES)]),
    h('div', 'about__pair', [
      block('Focus', [h('ul', 'about__focus', FOCUS.map((f) => h('li', '', [f])))]),
      block('Languages', [h('p', 'about__small', [LANGUAGES])]),
    ]),
    block('Toolbox', [h('ul', 'about__tools', TOOLS.map((tool) => h('li', '', [tool])))]),
    h('div', 'about__contact', [cv, ...LINKS.map((l) => link(l.label, l.href))]),
  ]);

  sheet.append(portrait, middle, side);

  // ---- entrance: each piece drops in, as if pinned on by hand ----
  const pieces = [
    portrait,
    middle.querySelector('.about__heading')!,
    ...middle.querySelectorAll('.about__bio'),
    ...middle.querySelectorAll('.about__polaroid'),
    ...side.children,
  ];

  section.addEventListener('pageenter', (e) => {
    sheet.scrollTop = 0;
    gsap.killTweensOf(pieces);
    if (e.detail.instant || isReducedMotion()) {
      gsap.set(pieces, { clearProps: 'opacity,y,scale' });
      return;
    }
    gsap.fromTo(
      pieces,
      { opacity: 0, y: 18, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: t(0.55), ease: 'back.out(1.6)', stagger: t(0.06), delay: t(0.25), clearProps: 'opacity,y,scale' },
    );
  });
}
