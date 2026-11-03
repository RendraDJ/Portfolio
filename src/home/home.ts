import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';
import { previewUrl } from '../preview';
import { cards, LOGO, type HomeCard } from './content';
import type { PageGotoDetail } from '../pages';

/**
 * Home: a full-screen light page. Every time it's entered:
 *
 *   1. the header fades in and the logo rolls into place on its drum
 *   2. one card per section rises from the bottom, stacked like a deck —
 *      each one showing its section live (see preview.ts)
 *   3. the logo keeps slowly turning; hovering a card opens it up like an
 *      accordion — the others fold away above and below it
 *
 * Clicking a card grows it to fill the screen, then hands over to the real
 * section with no transition: the live view was already showing exactly it.
 * Coming back is the same move in reverse: the section fades out over its
 * card, filling the screen, and the card shrinks back into the deck.
 *
 * Smoothness: cards move by `transform` only (yPercent), which the GPU
 * handles without repainting; their clip-path (side inset, corner radius)
 * only changes while one grows to fill the screen. The live views are loaded
 * once, then paused and resumed rather than reloaded on every visit.
 */

// Card tops at rest, in % of the screen, back card first.
// Spread evenly from FIRST_TOP (back card) to LAST_TOP (front card), whatever
// the number of cards.
const FIRST_TOP = 36;
const LAST_TOP = 68;
// While one card is hovered: the cards behind it fold up from OPEN_FROM, the
// ones in front fold down to the bottom, each showing just FOLDED of itself.
const OPEN_FROM = 22;
const FOLDED = 7.5;

const SPIN_PERIOD = 16; // seconds for the drum to turn by one copy of the logo
const MOVE = { duration: 0.75, ease: 'expo.out' }; // the deck re-arranging on hover
const OPEN = { duration: 1, ease: 'power3.inOut' }; // a card growing to fill the screen
const HANDOVER_FADE = 0.3; // seconds for the real section to fade in over the grown card
const CLOSE = { duration: 1, ease: 'power3.inOut', delay: 0.2 }; // coming back: the card shrinking into the deck
const WAKE_AFTER = 350; // ms after the deck settles before the other live views wake up

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

const top = (i: number) => (cards.length < 2 ? LAST_TOP : FIRST_TOP + (i * (LAST_TOP - FIRST_TOP)) / (cards.length - 1));

interface PreviewControl {
  pause(): void;
  /** `instant`: pick up with its entrance already done (see main.ts). */
  resume(instant?: boolean): void;
}

interface Card {
  data: HomeCard;
  el: HTMLButtonElement;
  live: HTMLIFrameElement;
  /** The shadow this card casts on the one behind it: a sibling just above
   *  its top edge, moved together with it. */
  shadow: HTMLElement;
  /** Title band and shadow: hidden while the card grows. */
  labels: HTMLElement[];
}

function buildCard(data: HomeCard): Card {
  const live = h('iframe', { class: 'card__live', title: `${data.title} (live preview)`, tabIndex: -1 });
  live.setAttribute('aria-hidden', 'true');
  live.addEventListener('load', () => live.classList.add('is-loaded'), { once: true });
  const band = h('span', { class: 'card__band' }, [
    h('span', { class: 'card__title' }, [data.title]),
    h('span', { class: 'card__go' }, ['Enter →']),
  ]);
  const shadow = h('div', { class: 'card-shadow', ariaHidden: 'true' });
  const el = h('button', { class: 'card', type: 'button', ariaLabel: `Open ${data.title.replace(/\.$/, '')}` }, [live, band]);
  el.style.setProperty('--peek', `${data.peek}%`);
  return { data, el, live, shadow, labels: [band, shadow] };
}

/** The live view's own pause/resume handle (see main.ts), once it has loaded. */
const control = (card: Card) => (card.live.contentWindow as (Window & { __preview?: PreviewControl }) | null)?.__preview;

/**
 * The logo, three times around a drum (with a dot after each copy), so the
 * drum looks the same every 1/3 turn: spinning it by that much loops seamlessly.
 * Returns the ring's rotation at which the first copy faces the viewer.
 */
function buildDrum(drum: HTMLElement): { ring: HTMLElement; front: number } {
  const copy = `${LOGO}·`;
  const letters = copy.repeat(3);
  const step = 360 / letters.length;

  const ring = h('span', { class: 'drum__ring', ariaHidden: 'true' });
  ring.style.setProperty('--rad', `calc(var(--slot) * ${letters.length} / ${2 * Math.PI})`);
  [...letters].forEach((char, i) => {
    const span = h('span', { class: 'drum__char' }, [char]);
    span.style.setProperty('--a', `${i * step}deg`);
    ring.append(span);
  });
  drum.append(ring);

  return { ring, front: (-(LOGO.length - 1) / 2) * step };
}

export function initHome(): void {
  const section = must<HTMLElement>(document, '#home');
  const header = must<HTMLElement>(section, '.site');
  const stack = must<HTMLElement>(section, '.stack');
  const drumEl = must<HTMLElement>(section, '.drum');

  const deck = cards.map(buildCard);
  // Back to front; each card's shadow goes right before it, so it falls on the card behind.
  deck.forEach((card, i) => stack.append(...(i ? [card.shadow, card.el] : [card.el])));
  // A card and its shadow always move together.
  const movers = (card: Card) => [card.el, card.shadow];

  const { ring, front } = buildDrum(drumEl);
  const turn = 360 / 3;

  let opening = false;
  let intro: gsap.core.Timeline | null = null;
  let spin: gsap.core.Tween | null = null;

  // ---- Live views ----
  // Each one is a whole running section, and booting one takes the main thread
  // for a moment — so they're loaded one after another, only once the intro
  // has finished, and never reloaded: leaving the page pauses them, coming
  // back resumes them.
  let loading = false;
  function loadLive() {
    if (loading) return;
    loading = true;
    const queue = [...deck].reverse(); // front card (the most visible) first
    const next = () => {
      const card = queue.shift();
      if (!card) return;
      card.live.addEventListener('load', () => setTimeout(next, 150), { once: true });
      card.live.src = previewUrl(card.data.section);
    };
    next();
  }

  // ---- Hover: the hovered card opens up, the others fold away ----
  // Only a pointer that actually *moves* over a card opens it. Browsers also
  // fire enter/leave events when a card slides under a resting cursor (after
  // the intro, or coming back from a section with the mouse where you clicked)
  // — reacting to those would open the deck on its own. So the card under
  // the pointer is worked out from real pointermoves and the cards' current
  // positions, and the deck folds back to rest as soon as the pointer leaves
  // the cards, the page or the window.
  // Requests are applied once per frame, so moving straight from one card to
  // the next never bounces back to rest; a hovered card only ever grows over
  // the strip it was hovered on, so the pointer stays on it while the deck moves.
  let hovered: Card | null = null;
  let requested: Card | null = null;
  let frame = 0;

  function tops(open: Card | null): number[] {
    const n = deck.length;
    if (!open) return deck.map((_, i) => top(i));
    const k = deck.indexOf(open);
    return deck.map((_, i) => (i <= k ? OPEN_FROM + i * FOLDED : 100 - (n - i) * FOLDED));
  }

  function layout(open: Card | null) {
    const next = tops(open);
    deck.forEach((card, i) => {
      card.el.classList.toggle('is-hovered', card === open);
      gsap.to(movers(card), { yPercent: next[i], duration: t(MOVE.duration), ease: MOVE.ease, overwrite: 'auto' });
    });
  }

  function request(card: Card | null) {
    requested = card;
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (requested === hovered || opening || intro?.isActive()) return;
        hovered = requested;
        layout(hovered);
      });
    }
  }

  /** The card under a point, from where the cards are right now (front card wins). */
  function cardAt(clientX: number, clientY: number): Card | null {
    const x = (clientX / section.clientWidth) * 100;
    const y = (clientY / section.clientHeight) * 100;
    if (x < 4 || x > 96) return null; // the cards' side insets (--side in home.css)
    for (let i = deck.length - 1; i >= 0; i--) {
      if (y >= Number(gsap.getProperty(deck[i].el, 'yPercent'))) return deck[i];
    }
    return null;
  }

  let lastX = -1;
  let lastY = -1;
  section.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (e.clientX === lastX && e.clientY === lastY) return; // a synthetic move: the mouse didn't go anywhere
    lastX = e.clientX;
    lastY = e.clientY;
    // Over the mini player or anything else that isn't a card: fold back.
    request((e.target as Element).closest('.card') ? cardAt(e.clientX, e.clientY) : null);
  });
  section.addEventListener('pointerleave', () => request(null));
  document.documentElement.addEventListener('pointerleave', () => request(null)); // out of the window
  window.addEventListener('blur', () => request(null));

  for (const card of deck) {
    card.el.addEventListener('focus', () => card.el.matches(':focus-visible') && request(card));
    card.el.addEventListener('blur', () => requested === card && request(null));
    card.el.addEventListener('click', () => open(card));
  }

  // ---- Open: the card grows to fill the screen, then the real section takes over ----
  function open(card: Card) {
    if (opening) return;
    opening = true;
    intro?.progress(1);
    spin?.kill();
    // Let the real section paint (invisibly) while the card grows, so the
    // hand-over at the end has nothing left to draw.
    document.dispatchEvent(new CustomEvent<PageGotoDetail>('page:prepare', { detail: { id: card.data.section } }));

    gsap
      .timeline({
        onComplete: () => {
          document.dispatchEvent(
            new CustomEvent<PageGotoDetail>('page:goto', { detail: { id: card.data.section, fade: HANDOVER_FADE } }),
          );
        },
      })
      .set(card.el, { zIndex: 1 }) // over the cards in front of it
      .to([header, ...card.labels], { opacity: 0, duration: t(0.3), ease: 'power2.out' }, 0)
      .to(card.el, { yPercent: 0, '--side': '0%', '--round': 0, duration: t(OPEN.duration), ease: OPEN.ease, overwrite: 'auto' }, 0);
  }

  // ---- Live views asleep (the page was left) and waking them ----
  const asleep = new Set<Card>();
  function wake(card: Card, instant = false) {
    if (!asleep.delete(card)) return;
    control(card)?.resume(instant);
  }

  // ---- Every visit ----
  /** Once the deck is in place: previews, a pending hover, the turning logo. */
  function settled() {
    loadLive(); // first visit only — after that they're already there
    // Just after the last frame of the move, not on it.
    setTimeout(() => {
      if (!section.inert) for (const card of deck) wake(card);
    }, WAKE_AFTER);
    // The pointer may already be resting on a card: open it now.
    if (requested) {
      hovered = requested;
      layout(hovered);
    }
    if (isReducedMotion()) return;
    spin = gsap.fromTo(ring, { '--spin': `${front}deg` }, { '--spin': `${front - turn}deg`, duration: SPIN_PERIOD, ease: 'none', repeat: -1 });
  }

  /** The deck at rest, every card closed and labelled. */
  function rest() {
    gsap.set(deck.map((c) => c.el), { '--side': '4%', '--round': 1, zIndex: 0 });
    gsap.set(deck.flatMap((c) => c.labels), { opacity: 1 });
    deck.forEach((card, i) => gsap.set(movers(card), { yPercent: top(i) }));
  }

  section.addEventListener('pageenter', (e) => {
    opening = false;
    hovered = requested = null;
    deck.forEach((card) => card.el.classList.remove('is-hovered'));
    intro?.kill();
    spin?.kill();

    const back = e.detail.instant ? deck.find((c) => c.data.section === e.detail.from) : undefined;
    // Coming back, only the returning card's view wakes now (it's on screen,
    // already "in"); the others wait until the card is back in the deck, so
    // they don't all start up during the animation.
    if (back) wake(back, true);
    else for (const card of deck) wake(card);

    if (back) {
      // Coming back from a section: its card starts out filling the screen,
      // exactly where the section was, and shrinks back into the deck.
      rest();
      gsap.set(header, { opacity: 0 });
      gsap.set(drumEl, { opacity: 1 });
      gsap.set(ring, { '--spin': `${front}deg` });
      gsap.set(back.el, { zIndex: 1, yPercent: 0, '--side': '0%', '--round': 0 });
      gsap.set(back.shadow, { yPercent: 0 });
      gsap.set(back.labels, { opacity: 0 });
      const k = deck.indexOf(back);
      intro = gsap
        .timeline({ onComplete: () => (gsap.set(back.el, { zIndex: 0 }), settled()) })
        .to(back.el, { yPercent: top(k), '--side': '4%', '--round': 1, ...CLOSE, duration: t(CLOSE.duration) }, 0)
        .to(back.shadow, { yPercent: top(k), ...CLOSE, duration: t(CLOSE.duration) }, 0)
        .to(back.labels, { opacity: 1, duration: t(0.4), ease: 'power2.out' }, t(CLOSE.delay + CLOSE.duration - 0.35))
        .to(header, { opacity: 1, duration: t(0.6), ease: 'power2.out' }, t(CLOSE.delay + 0.3));
      return;
    }

    // Reset to the "before" state (the page is still hidden mid-crossfade here).
    gsap.set(header, { opacity: 1 });
    gsap.set(drumEl, { opacity: 0 });
    gsap.set(ring, { '--spin': `${front + 150}deg` });
    gsap.set(deck.flatMap(movers), { yPercent: 100 });
    gsap.set(deck.map((c) => c.el), { '--side': '4%', '--round': 1, zIndex: 0 });
    gsap.set(deck.flatMap((c) => c.labels), { opacity: 1 });

    intro = gsap
      .timeline({ defaults: { ease: 'power3.out' }, onComplete: settled })
      .to(drumEl, { opacity: 1, duration: t(0.4) }, t(0.15))
      .to(ring, { '--spin': `${front}deg`, duration: t(1.4), ease: 'power4.out' }, t(0.15));
    deck.forEach((card, i) => {
      intro?.to(movers(card), { yPercent: top(i), duration: t(1.1), ease: 'expo.out' }, t(0.5 + i * 0.12));
    });
  });

  section.addEventListener('pageleave', () => {
    spin?.kill();
    // Once the page has faded out, freeze the live views until the next visit.
    setTimeout(() => {
      if (!section.inert) return;
      for (const card of deck) {
        const view = control(card);
        if (!view || asleep.has(card)) continue;
        view.pause();
        asleep.add(card);
      }
    }, 1000);
  });
}
