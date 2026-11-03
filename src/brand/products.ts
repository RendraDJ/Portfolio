import tshirtOutofshell from '../assets/brand/tshirt-outofshell.webp';
import tshirtVariables from '../assets/brand/tshirt-variables.webp';
import tshirtBex from '../assets/brand/tshirt-bex.webp';
import tshirtVariableByNature from '../assets/brand/tshirt-variablebynature.webp';
import hoodieOutoftime from '../assets/brand/hoodie-outoftime.webp';
import hoodieDontfollow from '../assets/brand/hoodie-dontfollow.webp';
import hoodieModel from '../assets/brand/hoodie-model.webp';
import hoodieZip2 from '../assets/brand/hoodie-zip2.webp';

export interface Piece {
  slug: string;
  /** Printed on the piece itself — see scripts/bake-brand.mjs for the source files. */
  name: string;
  src: string;
}

// Edit this list to change the lineup — the viewer builds from it.
export const pieces: readonly Piece[] = [
  { slug: 'tshirt-outofshell', name: 'Out Of Shell', src: tshirtOutofshell },
  { slug: 'tshirt-variables', name: 'X Marks The Variables', src: tshirtVariables },
  { slug: 'tshirt-bex', name: 'Be X', src: tshirtBex },
  { slug: 'tshirt-variablebynature', name: 'Variable By Nature', src: tshirtVariableByNature },
  { slug: 'hoodie-outoftime', name: 'Out Of Time', src: hoodieOutoftime },
  { slug: 'hoodie-dontfollow', name: "Don't Follow Me", src: hoodieDontfollow },
  { slug: 'hoodie-model', name: 'Xploring Variables', src: hoodieModel },
  { slug: 'hoodie-zip2', name: 'Xandvar Zip', src: hoodieZip2 },
];
