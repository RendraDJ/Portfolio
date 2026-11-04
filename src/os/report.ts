import { createOsWindow } from './window-manager';
import type { Experience } from '../signs/content';

/**
 * Opens a PDF from /public (an experience's report, the CV) in a Safari-style
 * window: traffic lights, a toolbar with the address bar, then the PDF in
 * the browser's own viewer. Draggable, resizable, closable (see os/).
 */

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

const icon = (path: string) => {
  const span = h('span', 'browser__icon');
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return span;
};

export function openReport(e: Experience): void {
  if (e.report) openPdf(e.report, `${e.title} — Report`);
}

/** `url`: the PDF's address, as given by publicUrl(). */
export function openPdf(url: string, title: string): void {
  const file = url.split('/').pop()!;
  const path = url.slice(import.meta.env.BASE_URL.length); // shown without the site's base path
  const address = h('div', 'browser__address', [icon('M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z'), h('span', '', [`rendra.dev/${path}`])]);
  const open = h('a', 'browser__action');
  open.href = url;
  open.target = '_blank';
  open.rel = 'noopener';
  open.title = 'Open in a new tab';
  open.append(icon('M14 4h6v6M20 4l-9 9M18 14v6H4V6h6'));
  const download = h('a', 'browser__action');
  download.href = url;
  download.download = file;
  download.title = 'Download';
  download.append(icon('M12 4v11M7 10l5 5 5-5M5 20h14'));
  const toolbar = h('div', 'browser__toolbar', [
    h('div', 'browser__nav', [icon('M15 6l-6 6 6 6'), icon('M9 6l6 6-6 6')]),
    address,
    h('div', 'browser__actions', [open, download]),
  ]);
  const frame = h('iframe', 'browser__page');
  frame.src = `${url}#view=FitH`;
  frame.title = title;
  const content = h('div', 'browser', [toolbar, frame]);

  const width = Math.min(1040, window.innerWidth - 32);
  const height = Math.min(760, window.innerHeight - 48);
  createOsWindow({ title, content, width, height, minWidth: 360, minHeight: 280, className: 'os-window--browser' });
}
