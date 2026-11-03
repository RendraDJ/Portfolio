import { gsap } from 'gsap';
import { t } from '../motion';

/**
 * A tiny fake-OS window system — draggable by its title bar, resizable from
 * its bottom-right corner, maximizable (green dot) and closable (red dot).
 * By default every window lives in one shared, viewport-fixed layer
 * (`#os-desktop`) appended to `<body>` on first use, so it's never affected
 * by the page-deck's own transforms/inert (see pages.ts). With `within`, it
 * opens in a desktop layer inside that element instead — and moves, resizes
 * and maximizes within it, at its scale.
 */

export interface OsWindowOptions {
  title: string;
  content: HTMLElement;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  /** Explicit starting position — omit to centre the window instead. */
  x?: number;
  y?: number;
  /** Open inside this element instead of over the whole page (e.g. a screen
   *  drawn in the scene). Position and size are then in its own px, and
   *  dragging/resizing follow it even when it is scaled by a transform. */
  within?: HTMLElement;
  /** Extra class on the window, for its own look (e.g. a browser). */
  className?: string;
}

export interface OsWindowHandle {
  el: HTMLElement;
  focus: () => void;
  close: () => void;
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

let desktop: HTMLElement | null = null;
let zCounter = 1;
let cascade = 0;

function getDesktop(within?: HTMLElement): HTMLElement {
  if (within) {
    let local = within.querySelector<HTMLElement>(':scope > .os-desktop--local');
    if (!local) {
      local = h('div', { class: 'os-desktop--local' });
      within.append(local);
    }
    return local;
  }
  if (desktop) return desktop;
  desktop = h('div', { id: 'os-desktop' });
  document.body.append(desktop);
  return desktop;
}

// A transparent full-viewport layer, shown only while dragging/resizing a
// window. Without it, a pointer that happens to be over an <iframe> (the PDF
// viewer, the invisible YouTube player) stops delivering move events to the
// window being dragged — iframes are a separate browsing context and don't
// forward mouse input the way plain elements do, even with pointer capture
// set. Sitting above everything during the gesture keeps the pointer "over"
// the desktop layer the whole time, so the resize/drag never stalls.
let dragOverlay: HTMLElement | null = null;

// Also disables pointer-events on any <iframe> inside the window being
// manipulated — belt and suspenders alongside the overlay above, and it
// stops the PDF/YouTube iframe from processing hover/scroll input (which
// reads as jank) for the duration of the drag.
function beginPointerOverlay(win: HTMLElement, cursor: string) {
  if (!dragOverlay) {
    dragOverlay = h('div', { id: 'os-drag-overlay' });
    document.body.append(dragOverlay);
  }
  dragOverlay.style.cursor = cursor;
  dragOverlay.style.display = 'block';
  win.classList.add('is-interacting');
}

function endPointerOverlay(win: HTMLElement) {
  if (dragOverlay) dragOverlay.style.display = 'none';
  win.classList.remove('is-interacting');
}

export function createOsWindow(opts: OsWindowOptions): OsWindowHandle {
  const desktopEl = getDesktop(opts.within);
  /** Screen px per desktop px (≠ 1 when the desktop is scaled by a transform). */
  const scale = () => desktopEl.getBoundingClientRect().width / (desktopEl.offsetWidth || 1) || 1;
  const deskW = () => desktopEl.clientWidth || window.innerWidth;
  const deskH = () => desktopEl.clientHeight || window.innerHeight;
  const width = opts.width ?? 480;
  const height = opts.height ?? 360;
  const minWidth = opts.minWidth ?? 240;
  const minHeight = opts.minHeight ?? 160;

  const closeDot = h('button', { class: 'os-window__dot os-window__dot--close', type: 'button', ariaLabel: 'Close' });
  const minDot = h('span', { class: 'os-window__dot os-window__dot--min' });
  const zoomDot = h('button', { class: 'os-window__dot os-window__dot--zoom', type: 'button', ariaLabel: 'Maximize' });
  const titlebar = h('div', { class: 'os-window__titlebar' }, [
    h('div', { class: 'os-window__traffic' }, [closeDot, minDot, zoomDot]),
    h('span', { class: 'os-window__title' }, [opts.title]),
    h('span', { class: 'os-window__spacer' }),
  ]);
  const body = h('div', { class: 'os-window__body' }, [opts.content]);
  const resizeHandle = h('div', { class: 'os-window__resize', ariaHidden: 'true' });

  const win = h('div', { class: `os-window ${opts.className ?? ''}`.trim() }, [titlebar, body, resizeHandle]);
  win.style.width = `${width}px`;
  win.style.height = `${height}px`;

  // An explicit position is used exactly, with no cascade offset — callers
  // that pass x/y want a specific spot (e.g. matching a reference layout).
  // Only the auto-centred fallback cascades, so repeat centred windows don't
  // stack perfectly on top of one another.
  let left: number;
  let top: number;
  if (opts.x !== undefined && opts.y !== undefined) {
    left = opts.x;
    top = opts.y;
  } else {
    const baseX = Math.max(16, (deskW() - width) / 2);
    const baseY = Math.max(16, (deskH() - height) / 2 - 20);
    cascade = (cascade + 26) % 130;
    left = Math.min(deskW() - width - 16, baseX + cascade);
    top = Math.min(deskH() - height - 16, baseY + cascade);
  }
  win.style.left = `${left}px`;
  win.style.top = `${top}px`;

  desktopEl.append(win);

  function focus() {
    zCounter += 1;
    win.style.zIndex = String(zCounter);
    desktopEl.querySelectorAll('.os-window.is-focused').forEach((w) => w.classList.remove('is-focused'));
    win.classList.add('is-focused');
  }
  focus();

  gsap.set(win, { opacity: 0, scale: 0.92 });
  gsap.to(win, { opacity: 1, scale: 1, duration: t(0.3), ease: 'power3.out' });

  win.addEventListener('pointerdown', focus);

  // ---- Drag (title bar, excluding the traffic lights) ----------------------
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let winStartLeft = 0;
  let winStartTop = 0;

  titlebar.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.os-window__dot')) return;
    if (maximized) return; // dragging a maximized window has nowhere sensible to go
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    winStartLeft = win.offsetLeft;
    winStartTop = win.offsetTop;
    titlebar.setPointerCapture(e.pointerId);
    beginPointerOverlay(win, 'grabbing');
  });
  titlebar.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStartX) / scale();
    const dy = (e.clientY - dragStartY) / scale();
    win.style.left = `${Math.max(0, winStartLeft + dx)}px`;
    win.style.top = `${Math.max(0, winStartTop + dy)}px`;
  });
  const stopDrag = () => {
    dragging = false;
    endPointerOverlay(win);
  };
  titlebar.addEventListener('pointerup', stopDrag);
  titlebar.addEventListener('pointercancel', stopDrag);

  // ---- Resize (bottom-right handle) ----------------------------------------
  let resizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let winStartWidth = 0;
  let winStartHeight = 0;

  resizeHandle.addEventListener('pointerdown', (e) => {
    if (maximized) return;
    resizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    winStartWidth = win.offsetWidth;
    winStartHeight = win.offsetHeight;
    resizeHandle.setPointerCapture(e.pointerId);
    beginPointerOverlay(win, 'nwse-resize');
    e.stopPropagation();
  });
  resizeHandle.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    win.style.width = `${Math.max(minWidth, winStartWidth + (e.clientX - resizeStartX) / scale())}px`;
    win.style.height = `${Math.max(minHeight, winStartHeight + (e.clientY - resizeStartY) / scale())}px`;
  });
  const stopResize = () => {
    resizing = false;
    endPointerOverlay(win);
  };
  resizeHandle.addEventListener('pointerup', stopResize);
  resizeHandle.addEventListener('pointercancel', stopResize);

  // ---- Maximize / restore ----------------------------------------------------
  let maximized = false;
  let savedRect: { left: number; top: number; width: number; height: number } | null = null;

  function toggleMaximize() {
    if (!maximized) {
      savedRect = { left: win.offsetLeft, top: win.offsetTop, width: win.offsetWidth, height: win.offsetHeight };
      maximized = true;
      gsap.to(win, { left: 12, top: 12, width: deskW() - 24, height: deskH() - 24, duration: t(0.3), ease: 'power2.out' });
    } else if (savedRect) {
      maximized = false;
      gsap.to(win, { ...savedRect, duration: t(0.3), ease: 'power2.out' });
    }
  }
  zoomDot.addEventListener('click', toggleMaximize);
  titlebar.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement).closest('.os-window__dot')) return;
    toggleMaximize();
  });

  // ---- Close ------------------------------------------------------------------
  function close() {
    gsap.to(win, {
      opacity: 0,
      scale: 0.92,
      duration: t(0.18),
      ease: 'power2.in',
      onComplete: () => {
        win.remove();
      },
    });
  }
  closeDot.addEventListener('click', close);

  document.addEventListener('keydown', function onEscape(e) {
    if (e.key !== 'Escape' || !win.classList.contains('is-focused')) return;
    document.removeEventListener('keydown', onEscape);
    close();
  });

  return { el: win, focus, close };
}
