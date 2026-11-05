import mirror from '../assets/about/mirror.webp';
import face from '../assets/about/face.webp';
import forest from '../assets/about/forest.webp';
import kayak from '../assets/about/kayak.webp';
import pond from '../assets/about/pond.webp';
import singapore from '../assets/about/singapore.webp';
import { publicUrl } from '../url';

/**
 * ★ About me, as a photo editor: the portrait, a hello and a few polaroids on
 * the canvas, each one a layer, and the CV at a glance in floating panels.
 * Written from the CVs (2027). Edit freely; about.ts builds the page from
 * these fields.
 *
 * In the bio, **double stars** mark the words set in bold.
 */

export const PORTRAIT = mirror;
export const STICKER = face;

export const HELLO = { before: 'Hi! I’m ', name: 'Ren', after: 'dra.' };

/** Under the hello: what I do, in order. */
export const ROLE = ['Software developer', 'AI', 'Robotics'];

export const BIO = [
  'I’m a **software developer** at heart, with a real soft spot for **AI**. What I enjoy most is building an app from start to finish: a clean interface, a solid back end and a smart model running behind it.',
  'Lately my code has started moving real things too. Over three internships I built an **AI that sorts a company’s inbox**, a **3D twin that keeps an eye on your posture** and a **drone that inspects a warehouse on its own**. Want to talk code, AI or robots? Say hi!',
];

export interface Polaroid {
  image: string;
  caption: string;
}

export const POLAROIDS: Polaroid[] = [
  { image: singapore, caption: 'Singapore, 2025 :)' },
  { image: forest, caption: 'offline, on purpose' },
  { image: kayak, caption: 'paddling' },
  { image: pond, caption: 'slow mornings' },
];

export interface Entry {
  when: string;
  title: string;
  where: string;
}

export const EXPERIENCE: Entry[] = [
  { when: '2026', title: 'Software & Robotics Engineer', where: 'Audensiel · R&D Innovation Lab, Paris' },
  { when: '2025', title: 'Robotics & IoT Engineer', where: 'LIRMM, Montpellier' },
  { when: '2025', title: 'AI / NLP Software Engineer', where: 'ESCO Lifesciences, Singapore' },
];

export const STUDIES: Entry[] = [
  { when: '2024-26', title: 'Master’s, CS & Robotics', where: 'Université de Montpellier' },
  { when: '2020-24', title: 'Bachelor’s, Computer Science', where: 'Université de Montpellier' },
];

export const FOCUS = ['Full-stack apps (Python, React)', 'AI, LLMs & computer vision', 'Robotics & ROS2', 'Real-time & embedded'];

export const TOOLS = ['Python', 'JavaScript', 'React', 'FastAPI', 'WebSockets', 'LLM APIs (Claude, GPT, Mistral)', 'RAG', 'AI agents', 'LangChain', 'NLP · BERT', 'PostgreSQL', 'Docker'];

export const LANGUAGES = 'French (native) · English (C1)';

export const LINKS = [
  { label: 'Email', href: 'mailto:rendra.djunaedi@outlook.com' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/rendra-djunaedi' },
  { label: 'GitHub', href: 'https://github.com/RendraDJ' },
];

export const CV = publicUrl('/cv/Rendra_Djunaedi_Robotics_Software_Engineer.pdf');
