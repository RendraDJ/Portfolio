# Rendra's Mind

Vite + TypeScript + GSAP.

```bash
npm install        # once
npm run dev        # http://localhost:5173
npm run build      # type-check + production build in dist/
npm run preview    # serve dist/
```

## Structure

```
index.html              markup (hero scene + "Selected Projects" section)
src/main.ts             entry point
src/motion.ts           reduced-motion handling (add ?motion=on to force animations)
src/scene/scene.ts      hero: hover / focus / tap highlight of the five people
src/tapes/projects.ts   ★ the projects shown on the shelf (edit this to add / reorder)
src/tapes/tapes.ts      endless spine carousel + cassette reveal
src/styles/*.css        base, hero scene, tapes section
src/assets/             optimised WebP used by the site
assets-src/             hero source layers (input of `npm run assets`)
scripts/                asset pipelines
legacy/                 the original single-file index.html (safe to delete)
```

## Assets

Only `opacity` and `transform` are animated, so the dimmed background and the
glow around each person are pre-rendered instead of using CSS filters:

```bash
npm run assets         # hero: everyone-dim.webp + person layers with glow
npm run assets:tapes   # tapes: spines + cassettes, from ../Images/select (or pass a path)
```

## Adding a project

1. Put `{Name}_spine.png` and `{Name}_cassette.png` in `../Images/select`.
2. Add `{ slug: 'name', dir prefix }` to `TAPES` in `scripts/bake-tapes.mjs`, run `npm run assets:tapes`.
3. Add an entry (import + object) in `src/tapes/projects.ts`.

Clicking a spine dispatches a `tape:select` event (`detail.slug`) on the section, and clicking a
person dispatches `person:select` on the stage: hook your project pages / modals there.
