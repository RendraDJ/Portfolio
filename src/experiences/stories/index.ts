import type { Story } from '../story';
import type { Project } from '../content';

// every ./<slug>.ts next to this file exports `story`
const modules = import.meta.glob<{ story: Story }>(['./*.ts', '!./index.ts'], { eager: true });
const STORIES = new Map(Object.values(modules).map((m) => [m.story.slug, m.story]));

/** The experience's tour — or, when it has none yet, one made from its summary. */
export function storyOf(p: Project): Story {
  return (
    STORIES.get(p.slug) ?? {
      slug: p.slug,
      hook: p.summary,
      chapters: [
        { tag: 'context', title: 'The project', text: p.summary, points: p.highlights.slice(0, 3) },
        { tag: 'demo', title: 'See it run', text: 'A small simulation rebuilt from the project, running by itself.', visual: { type: 'demo' } },
        ...(p.highlights.length > 3 ? [{ tag: 'software' as const, title: 'What I built', text: p.highlights[3], points: p.highlights.slice(4) }] : []),
        { tag: 'results', title: 'Results', text: p.note ?? 'Where the project landed.', visual: { type: 'stats', items: p.metrics } },
      ],
    }
  );
}
