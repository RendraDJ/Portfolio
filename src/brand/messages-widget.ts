import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';

export interface IncomingMessageDetail {
  name: string;
  text: string;
}

declare global {
  interface HTMLElementEventMap {
    /** Fired on the widget for every bubble the other person "sends" — the phone turns it into a notification. */
    'messages:incoming': CustomEvent<IncomingMessageDetail>;
  }
}

interface Bubble {
  from: 'them' | 'me';
  text: string;
}

interface Thread {
  id: string;
  name: string;
  color: string;
  time: string;
  messages: readonly Bubble[];
}

// The main thread's handle is randomised once per page load (not per replay
// — see below) so it's never the same fixed name twice in a row, while still
// reading like a real handle (e.g. "ShadowViper42").
const HANDLE_ADJ = ['Black', 'Shadow', 'Night', 'Frost', 'Crimson', 'Ghost', 'Neon', 'Silent', 'Toxic', 'Rogue'];
const HANDLE_NOUN = ['Fire', 'Wolf', 'Ronin', 'Byte', 'Viper', 'Ghost', 'Storm', 'Glitch', 'Venom', 'Phantom'];
function randomHandle(): string {
  const adj = HANDLE_ADJ[Math.floor(Math.random() * HANDLE_ADJ.length)];
  const noun = HANDLE_NOUN[Math.floor(Math.random() * HANDLE_NOUN.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adj}${noun}${num}`;
}

const THREADS: readonly Thread[] = [
  {
    id: 'main',
    name: randomHandle(),
    color: '#48484a',
    time: 'now',
    messages: [
      { from: 'them', text: "yo when's the next drop \u{1F440}" },
      { from: 'me', text: 'soon...' },
      { from: 'them', text: 'bro stop teasing' },
      { from: 'me', text: "the zip hoodie's different this time" },
      { from: 'them', text: 'SHUT UP \u{1F62D}' },
    ],
  },
  {
    id: 'vibecheck',
    name: 'vibecheck22',
    color: '#5e5ce6',
    time: '2m',
    messages: [
      { from: 'them', text: 'bro the drop sold out in 2 min \u{1F62D}' },
      { from: 'me', text: 'told you to set an alarm' },
      { from: 'them', text: 'any restock?' },
      { from: 'me', text: 'no clue, soon' },
    ],
  },
  {
    id: 'reaper',
    name: 'xX_Reaper_Xx',
    color: '#ff375f',
    time: '14m',
    messages: [
      { from: 'them', text: 'link me the hoodie' },
      { from: 'me', text: 'not out yet \u{1F440}' },
      { from: 'them', text: 'stoppp' },
    ],
  },
];

const MAIN = THREADS[0];
const OTHERS = THREADS.slice(1);

const TYPING_MS = 1100;
const AFTER_BUBBLE_MS = 650;
const CURSOR_MOVE_S = 0.55;
const PAUSE_AFTER_THREAD_MS = 1800;
const PAUSE_IN_LIST_MS = 900;

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

function initials(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase() || '?';
}

/**
 * A tiny self-playing "Messages app" demo: types out one real conversation
 * once (it's never re-typed or cleared — see `mainDone`), then a fake cursor
 * clicks back to an inbox list, opens another thread, reads it, goes back,
 * and repeats with a different thread — so the widget stays alive without
 * ever replaying the same conversation from scratch.
 */
export function initMessagesWidget(section: HTMLElement): void {
  const root = must<HTMLElement>(section, '.brand__messages');
  const backBtn = must<HTMLButtonElement>(root, '.brand__messages-back');
  const avatarEl = must<HTMLElement>(root, '.brand__messages-avatar');
  const nameEl = must<HTMLElement>(root, '.brand__messages-name');
  const threadEl = must<HTMLElement>(root, '.brand__messages-thread');
  const listEl = must<HTMLElement>(root, '.brand__messages-list');
  const cursorEl = must<HTMLElement>(root, '.brand__messages-cursor');

  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let mainDone = false;
  let lastOtherId = '';

  // Safe default so there's never a flash of an empty header before the
  // first `pageenter` fires and the typing sequence actually starts.
  showThreadHeader(MAIN);

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      timeoutId = setTimeout(resolve, t(ms / 1000) * 1000 || 0);
    });
  }

  // ---- Rendering ------------------------------------------------------------

  function showThreadHeader(thread: Thread) {
    root.classList.remove('is-list');
    avatarEl.textContent = initials(thread.name);
    avatarEl.style.background = thread.color;
    nameEl.textContent = thread.name;
  }

  function renderList() {
    root.classList.add('is-list');
    listEl.replaceChildren(
      ...THREADS.map((thread) => {
        const last = thread.messages[thread.messages.length - 1];
        const row = h('div', { class: 'brand__messages-row' }, [
          h('span', { class: 'brand__messages-row-avatar' }, [initials(thread.name)]),
          h('div', { class: 'brand__messages-row-body' }, [
            h('div', { class: 'brand__messages-row-top' }, [
              h('span', { class: 'brand__messages-row-name' }, [thread.name]),
              h('span', { class: 'brand__messages-row-time' }, [thread.time]),
            ]),
            h('p', { class: 'brand__messages-row-snippet' }, [last.text]),
          ]),
        ]);
        row.dataset.id = thread.id;
        row.querySelector<HTMLElement>('.brand__messages-row-avatar')!.style.background = thread.color;
        row.addEventListener('click', () => openThread(thread));
        return row;
      }),
    );
  }

  // Just switches the view — the caller (the demo sequence below) is solely
  // responsible for actually typing the thread's messages in. Letting this
  // also kick off typeThread() would race the sequence's own explicit call
  // and double up every bubble.
  function openThread(thread: Thread) {
    showThreadHeader(thread);
    threadEl.replaceChildren();
  }

  backBtn.addEventListener('click', renderList);

  async function typeThread(thread: Thread): Promise<void> {
    threadEl.replaceChildren();
    let lastFrom: Bubble['from'] | null = null;
    for (const bubble of thread.messages) {
      if (!running) return;
      const typing = h('div', { class: `brand__messages-typing brand__messages-typing--${bubble.from}` }, [
        h('span', {}, []),
        h('span', {}, []),
        h('span', {}, []),
      ]);
      threadEl.append(typing);
      threadEl.scrollTop = threadEl.scrollHeight;
      await sleep(TYPING_MS);
      if (!running) return;
      typing.remove();
      // Consecutive bubbles from the same sender sit closer together, with
      // the "tail" corner only on the very last one of the group — the same
      // grouping iMessage itself uses.
      const grouped = bubble.from === lastFrom;
      const el = h('p', { class: `brand__messages-bubble brand__messages-bubble--${bubble.from}${grouped ? ' is-grouped' : ''}` }, [bubble.text]);
      lastFrom = bubble.from;
      gsap.set(el, { opacity: 0, scale: 0.85 });
      threadEl.append(el);
      threadEl.scrollTop = threadEl.scrollHeight;
      gsap.to(el, { opacity: 1, scale: 1, duration: t(0.25), ease: 'back.out(2)' });
      if (bubble.from === 'them') {
        root.dispatchEvent(
          new CustomEvent<IncomingMessageDetail>('messages:incoming', { detail: { name: thread.name, text: bubble.text }, bubbles: true }),
        );
      }
      await sleep(AFTER_BUBBLE_MS);
    }
  }

  function renderStatic() {
    showThreadHeader(MAIN);
    let lastFrom: Bubble['from'] | null = null;
    threadEl.replaceChildren(
      ...MAIN.messages.map((bubble) => {
        const grouped = bubble.from === lastFrom;
        lastFrom = bubble.from;
        return h('p', { class: `brand__messages-bubble brand__messages-bubble--${bubble.from}${grouped ? ' is-grouped' : ''}` }, [bubble.text]);
      }),
    );
  }

  // ---- Fake cursor ------------------------------------------------------------

  // Layout offsets, not getBoundingClientRect: the widget lives inside the
  // phone, which is scaled and rotated in 3D — screen-space rects would put
  // the cursor in the wrong spot once mapped back into the widget's own space.
  function widgetPoint(target: HTMLElement): { x: number; y: number } {
    let x = target.offsetWidth / 2;
    let y = target.offsetHeight / 2;
    let el: HTMLElement | null = target;
    while (el && el !== root) {
      x += el.offsetLeft;
      y += el.offsetTop;
      const parent: HTMLElement | null = el.offsetParent as HTMLElement | null;
      for (let p: HTMLElement | null = el.parentElement; p && p !== parent; p = p.parentElement) {
        x -= p.scrollLeft;
        y -= p.scrollTop;
      }
      el = parent;
    }
    return { x, y };
  }

  async function moveCursorTo(target: HTMLElement): Promise<void> {
    const { x, y } = widgetPoint(target);
    await new Promise<void>((resolve) => {
      gsap.to(cursorEl, {
        left: x,
        top: y,
        opacity: 1,
        duration: t(CURSOR_MOVE_S),
        ease: 'power2.inOut',
        onComplete: resolve,
      });
    });
  }

  async function clickAt(target: HTMLElement): Promise<void> {
    await new Promise<void>((resolve) => {
      gsap
        .timeline({ onComplete: resolve })
        .to(cursorEl, { scale: 0.7, duration: t(0.08) })
        .to(cursorEl, { scale: 1, duration: t(0.12) });
    });
    target.click();
    await sleep(150);
  }

  async function hideCursor(): Promise<void> {
    await new Promise<void>((resolve) => {
      gsap.to(cursorEl, { opacity: 0, duration: t(0.2), onComplete: resolve });
    });
  }

  function pickNextOther(): Thread {
    const candidates = OTHERS.filter((o) => o.id !== lastOtherId);
    const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? OTHERS[0];
    lastOtherId = pick.id;
    return pick;
  }

  // ---- Main sequence ------------------------------------------------------------

  async function play(): Promise<void> {
    if (!mainDone) {
      showThreadHeader(MAIN);
      await typeThread(MAIN);
      if (!running) return;
      mainDone = true;
    }
    await sleep(PAUSE_AFTER_THREAD_MS);

    // Loops forever from here on — but only ever replaying the *other*
    // threads, never the main one, so nothing the visitor already read gets
    // retyped from scratch.
    while (running) {
      await moveCursorTo(backBtn);
      if (!running) return;
      await clickAt(backBtn); // -> renderList()
      if (!running) return;
      await sleep(PAUSE_IN_LIST_MS);

      const next = pickNextOther();
      const row = listEl.querySelector<HTMLElement>(`[data-id="${next.id}"]`);
      if (!row) return;
      row.scrollIntoView({ block: 'nearest' });
      await moveCursorTo(row);
      if (!running) return;
      await clickAt(row); // -> openThread(next)
      if (!running) return;
      await hideCursor();
      await typeThread(next);
      if (!running) return;
      await sleep(PAUSE_AFTER_THREAD_MS);
    }
  }

  section.addEventListener('pageenter', () => {
    if (running) return;
    if (isReducedMotion()) {
      renderStatic();
      return;
    }
    running = true;
    void play();
  });

  section.addEventListener('pageleave', () => {
    running = false;
    clearTimeout(timeoutId);
    gsap.killTweensOf(cursorEl);
  });
}
