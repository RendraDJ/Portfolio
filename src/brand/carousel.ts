import c1 from '../assets/brand/carrousel/carrousel-1.webp';
import c2 from '../assets/brand/carrousel/carrousel-2.webp';
import c3 from '../assets/brand/carrousel/carrousel-3.webp';
import c4 from '../assets/brand/carrousel/carrousel-4.webp';
import c5 from '../assets/brand/carrousel/carrousel-5.webp';
import c6 from '../assets/brand/carrousel/carrousel-6.webp';
import c7 from '../assets/brand/carrousel/carrousel-7.webp';
import c8 from '../assets/brand/carrousel/carrousel-8.webp';
import c9 from '../assets/brand/carrousel/carrousel-9.mp4';
import c10 from '../assets/brand/carrousel/carrousel-10.webp';
import c11 from '../assets/brand/carrousel/carrousel-11.webp';
import c12 from '../assets/brand/carrousel/carrousel-12.webp';
import c13 from '../assets/brand/carrousel/carrousel-13.mp4';
import c14 from '../assets/brand/carrousel/carrousel-14.webp';
import c15 from '../assets/brand/carrousel/carrousel-15.mp4';

export interface CarouselItem {
  type: 'image' | 'video';
  src: string;
}

// The shelf's ambient loop — behind-the-scenes photos and clips, in no
// particular order. Videos autoplay muted + looped (see brand.ts) and keep
// playing through the drift regardless of which item is currently in view.
export const carousel: readonly CarouselItem[] = [
  { type: 'image', src: c1 },
  { type: 'image', src: c2 },
  { type: 'image', src: c3 },
  { type: 'image', src: c4 },
  { type: 'image', src: c5 },
  { type: 'image', src: c6 },
  { type: 'image', src: c7 },
  { type: 'image', src: c8 },
  { type: 'video', src: c9 },
  { type: 'image', src: c10 },
  { type: 'image', src: c11 },
  { type: 'image', src: c12 },
  { type: 'video', src: c13 },
  { type: 'image', src: c14 },
  { type: 'video', src: c15 },
];
