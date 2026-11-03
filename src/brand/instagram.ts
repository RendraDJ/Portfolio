import { carousel } from './carousel';
import logo from '../assets/brand/logo.webp';

const PROFILE_URL = 'https://instagram.com/xandvar';

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

function svg(paths: string, viewBox = '0 0 24 24'): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = paths;
  return el;
}

const stat = (value: string, label: string) =>
  h('span', { class: 'ig__stat' }, [h('strong', {}, [value]), h('span', {}, [label])]);

/**
 * The phone's Instagram app: a mock of the xandvar profile in Instagram's own
 * mobile dark mode. Instagram blocks real embedding, so this is a styled
 * stand-in — the "Open" button is a real link to the account.
 */
export function buildInstagramApp(): HTMLElement {
  const grid = h('div', { class: 'ig__grid' });
  // A still grid, like the profile tab (images only — autoplaying video tiles
  // would just be noise). 9 tiles fill three full rows.
  for (const item of carousel.filter((c) => c.type === 'image').slice(0, 9)) {
    grid.append(h('img', { src: item.src, alt: '', loading: 'lazy', decoding: 'async', draggable: false }));
  }

  return h('div', { class: 'ig' }, [
    h('header', { class: 'ig__topbar' }, [
      svg('<path d="M6 10V8a6 6 0 1112 0v2" fill="none" stroke="currentColor" stroke-width="1.8" /><rect x="4" y="10" width="16" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />'),
      h('span', { class: 'ig__handle' }, ['xandvar']),
      svg('<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />'),
    ]),
    h('div', { class: 'phone-app__scroll' }, [
      h('div', { class: 'ig__head' }, [
        h('img', { class: 'ig__avatar', src: logo, alt: '', draggable: false }),
        h('div', { class: 'ig__stats' }, [stat('8', 'posts'), stat('52', 'followers'), stat('2', 'following')]),
      ]),
      h('p', { class: 'ig__name' }, ['XAV.']),
      h('p', { class: 'ig__bio' }, ['X MARKS THE VARIABLES']),
      h('p', { class: 'ig__mutual' }, ['Followed by 24 people you follow']),
      h('div', { class: 'ig__actions' }, [
        h('span', { class: 'ig__btn' }, ['Following']),
        h('span', { class: 'ig__btn' }, ['Message']),
        h('a', { class: 'ig__btn ig__btn--open', href: PROFILE_URL, target: '_blank', rel: 'noopener noreferrer' }, [
          'Open',
          svg('<path d="M7 17L17 7M17 7H9M17 7v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />'),
        ]),
      ]),
      h('div', { class: 'ig__tabs', ariaHidden: 'true' }, [
        h('span', { class: 'ig__tab is-active' }, [
          svg('<rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6" />'),
        ]),
        h('span', { class: 'ig__tab' }, [
          svg('<path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" fill="none" stroke="currentColor" stroke-width="1.6" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6" />'),
        ]),
      ]),
      grid,
    ]),
  ]);
}
