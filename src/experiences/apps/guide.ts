import { isReducedMotion } from '../../motion';

/** What a guide's script can do; each call resolves false once the guide was stopped. */
export interface GuideRun {
  say(text: string): void;
  sleep(ms: number): Promise<boolean>;
  /** Moves the cursor to `el`, clicks it, then waits `wait` ms. */
  click(el: HTMLElement, wait?: number): Promise<boolean>;
}

export interface GuideOptions {
  /** The app's frame: the cursor lives in it, a press in it stops the guide. */
  root: HTMLElement;
  /** Where the narration is written. */
  caption: HTMLElement;
  /** Shown while the guide is stopped, to start it again. */
  button: HTMLButtonElement;
  /** Puts the app back to its first state before each pass. */
  reset(): void;
  /** One pass of the demo; resolves false when it was cut short. */
  script(run: GuideRun): Promise<boolean>;
  /** Said at the end of a pass, before it starts again. */
  outro: string;
}

/**
 * The guided demo of an app replica (drone-app.ts, posture-app.ts): a cursor
 * moves to the controls and clicks them while a line says what happens
 * behind each click; then it starts over. The visitor's first press in the
 * app stops it and hands the app over.
 */
export function createGuide(o: GuideOptions) {
  const cursor = document.createElement('div');
  cursor.className = 'app-cursor';
  cursor.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  o.root.append(cursor);

  let pass = 0; // a new pass, or the visitor, cancels the one running
  const timers: number[] = [];

  function point(el: HTMLElement) {
    const r = o.root.getBoundingClientRect();
    const k = r.width / o.root.offsetWidth || 1; // the site may scale the page
    const b = el.getBoundingClientRect();
    cursor.style.transform = `translate(${(b.left - r.left + b.width / 2) / k}px, ${(b.top - r.top + b.height / 2) / k}px)`;
  }

  async function start() {
    const id = ++pass;
    o.root.classList.add('is-guided');
    o.button.hidden = true;
    o.reset();
    const sleep = (ms: number) =>
      new Promise<boolean>((resolve) => timers.push(window.setTimeout(() => resolve(id === pass), isReducedMotion() ? Math.min(ms, 400) : ms)));
    const run: GuideRun = {
      say: (text) => (o.caption.textContent = text),
      sleep,
      async click(el, wait = 700) {
        point(el);
        if (!(await sleep(450))) return false;
        cursor.classList.remove('is-click');
        void cursor.offsetWidth; // restart the ripple
        cursor.classList.add('is-click');
        el.click();
        return sleep(wait);
      },
    };
    if (!(await o.script(run))) return;
    run.say(o.outro);
    if (await sleep(4000)) start();
  }

  function stop() {
    pass += 1;
    o.root.classList.remove('is-guided');
    o.button.hidden = false;
  }

  o.button.addEventListener('click', () => void start());
  o.root.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.isTrusted || e.target === o.button || !o.root.classList.contains('is-guided')) return;
      stop();
      o.caption.textContent = 'Your turn — the app is live. Click around, or replay the guided demo.';
    },
    true,
  );

  return {
    start: () => void start(),
    /** For good: the app is going away. */
    dispose() {
      stop();
      timers.forEach(clearTimeout);
    },
  };
}
