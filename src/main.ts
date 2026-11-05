import { gsap } from 'gsap';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import './styles/base.css';
import './styles/home.css';
import './styles/scene.css';
import './styles/brand.css';
import './styles/phone.css';
import './styles/os-window.css';
import './styles/music.css';
import './styles/studio.css';
import './styles/signs.css';
import './styles/hq.css';
import './styles/experiences.css';
import './styles/deck.css';
import './styles/explainer.css';
import './styles/app-guide.css';
import './styles/drone-app.css';
import './styles/posture-app.css';
import './styles/about.css';
import { initHome } from './home/home';
import { initScene } from './scene/scene';
import { initSigns } from './signs/signs';
import { initHq } from './hq/hq';
import { initExperiences } from './experiences/experiences';
import { initBrand } from './brand/brand';
import { initAbout } from './about/about';
import { initPages, type PageChangeDetail } from './pages';
import { previewId } from './preview';
import { initMusic } from './music/player';
import { initStudio } from './os/studio';

// The site's sections, in deck order after the home page.
const SECTIONS: Record<string, () => void> = {
  about: initAbout,
  experiences: initExperiences,
  brand: initBrand,
};

// Drafts: kept out of the site (see .page--draft), but viewable at /?preview=<id>.
const DRAFTS: Record<string, () => void> = {
  hero: initScene, // the previous About me
  signs: initSigns, // the previous Experiences (the street pole)
  hq: initHq, // the 3D room (taken off the site)
};

if (previewId) {
  // A single section, live, inside one of the home page's cards.
  const section = document.getElementById(previewId);
  const init = SECTIONS[previewId] ?? DRAFTS[previewId];
  if (section && init) {
    document.documentElement.classList.add('is-preview');
    section.classList.add('is-previewed');
    init();
    const page = (type: 'pageenter' | 'pageleave', instant = false) =>
      section.dispatchEvent(new CustomEvent<PageChangeDetail>(type, { detail: { index: 0, instant }, bubbles: true }));
    page('pageenter');

    // The home page freezes its live views while it's out of sight, and wakes
    // them when it comes back — instead of reloading them every time.
    const videos = () => section.querySelectorAll('video');
    (window as Window & { __preview?: unknown }).__preview = {
      pause() {
        page('pageleave'); // stops the section's own loops (drifts, particles, messages)
        gsap.globalTimeline.pause();
        gsap.ticker.sleep();
        for (const v of videos()) v.pause();
      },
      /** `instant`: the section was just on screen for real (coming back to the
       *  home page), so its preview picks up already "in", without its entrance. */
      resume(instant = false) {
        gsap.ticker.wake();
        gsap.globalTimeline.resume();
        for (const v of videos()) void v.play().catch(() => undefined);
        page('pageenter', instant);
      },
    };
  }
} else {
  initHome();
  for (const init of Object.values(SECTIONS)) init();
  // every page sits on the same monitor as Xandvar (which does it itself, first)
  for (const id of ['about', 'experiences']) {
    const section = document.getElementById(id);
    if (section) initStudio(section);
  }
  initPages();
  initMusic();
}

// The site is built: show it (index.html hides the raw page until now).
requestAnimationFrame(() => document.documentElement.classList.add('is-ready'));
