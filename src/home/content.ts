export interface HomeCard {
  /** Title on the card's band. */
  title: string;
  /** Id of the section the card shows live, and opens when clicked. */
  section: string;
  /** How far down its section the card's window starts, in % of the screen
   *  height: 0 shows the very top of the section. */
  peek: number;
}

// ★ Edit this list to change the cards on the home page — listed back to front:
// the last card is in front, so it shows the most of its section.
export const cards: readonly HomeCard[] = [
  { title: 'Experiences.', section: 'experiences', peek: 0 },
  { title: 'Xandvar.', section: 'brand', peek: 3.5 },
];

/** The logo, written on a spinning drum (see home.ts). */
export const LOGO = 'RENDRA';
