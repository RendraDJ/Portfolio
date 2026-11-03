/**
 * The toolkit of the explainer videos (one file per experience next to this
 * one): an 800 × 450 SVG stage, one GSAP timeline cut into scenes, and a
 * one-line caption per scene. Scenes are short (2–3 s) and the video loops.
 * Keep everything that must look the same at each loop inside the timeline.
 */

export const W = 800;
export const H = 450;
/** Drawing room above the caption. */
export const FLOOR = 372;

const NS = 'http://www.w3.org/2000/svg';

/** Black and white, with one accent: a grey. The names say what each colour is used for. */
export const C = {
  bg: '#0b0b0b',
  ink: '#f2f0ec',
  dim: 'rgba(242, 240, 236, 0.45)',
  line: 'rgba(242, 240, 236, 0.16)',
  orange: '#b5b4ae',
  blue: '#d6d6d6',
  violet: '#8f8f8f',
  green: '#ffffff',
  yellow: '#b5b4ae',
  red: '#b5b4ae',
};

type Attrs = Record<string, string | number>;

export interface Kit {
  svg: SVGSVGElement;
  tl: gsap.core.Timeline;
  /** Starts a scene, at the end of the timeline: its caption shows from here. */
  scene(say: string): void;
  /** Lets the scene breathe for `s` seconds. */
  hold(s: number): void;
  /** An SVG element, appended to `parent` (the stage by default). */
  add<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs, parent?: SVGElement): SVGElementTagNameMap[K];
  /** A text, centred on x unless `anchor` says otherwise. */
  text(x: number, y: number, s: string, attrs?: Attrs, parent?: SVGElement): SVGTextElement;
  /** A group, hidden until a tween shows it. */
  group(attrs?: Attrs, parent?: SVGElement): SVGGElement;
  /** A tween outside the timeline that runs for as long as the video (a hover, a blink). */
  forever(t: gsap.core.Tween | gsap.core.Timeline): void;
  /** Redraws what tweened numbers drive (a robot arm), on every frame and after a jump. */
  onFrame(fn: () => void): void;
}

export function makeKit(
  svg: SVGSVGElement,
  tl: gsap.core.Timeline,
  scenes: { at: number; say: string }[],
  loops: (gsap.core.Tween | gsap.core.Timeline)[],
  frames: (() => void)[],
): Kit {
  const add = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent: SVGElement = svg) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    parent.append(el);
    return el;
  };
  return {
    svg,
    tl,
    scene: (say) => scenes.push({ at: tl.duration(), say }),
    hold: (s) => void tl.to({}, { duration: s }),
    add,
    text(x, y, s, attrs = {}, parent = svg) {
      const t = add('text', { x, y, fill: C.ink, 'font-size': 16, 'font-family': 'Helvetica Neue, Helvetica, Arial, sans-serif', 'text-anchor': 'middle', ...attrs }, parent);
      t.textContent = s;
      return t;
    },
    group: (attrs = {}, parent = svg) => add('g', { opacity: 0, ...attrs }, parent),
    forever: (t) => void loops.push(t),
    onFrame: (fn) => void frames.push(fn),
  };
}

/** Points of a polyline, as its `points` attribute. */
export const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** A shape's outline length, worked out from its attributes (the stage may not be in the page yet). */
function lengthOf(el: SVGGeometryElement) {
  const n = (a: string) => Number(el.getAttribute(a) ?? 0);
  if (el instanceof SVGRectElement) return 2 * (n('width') + n('height'));
  if (el instanceof SVGPolylineElement) {
    const p = (el.getAttribute('points') ?? '').trim().split(/\s+/).map((s) => s.split(',').map(Number));
    return p.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - p[i][0], y - p[i][1]), 0);
  }
  try {
    return el.getTotalLength();
  } catch {
    return 3000;
  }
}

/** Makes a stroke drawable: `strokeDashoffset` from its length to 0 draws it. */
export function drawable(el: SVGGeometryElement) {
  const len = Math.ceil(lengthOf(el)) + 2 || 1000;
  el.setAttribute('stroke-dasharray', String(len));
  el.setAttribute('stroke-dashoffset', String(len));
  return len;
}
