/**
 * The simulator's authoring vocabulary that the game does not declare.
 * ⚠️ Tempo has its own file (`cms/src/engine/ledger/tempoBands.js`) and is re-exported from `constants.js`; Purpose stays here, deliberately: nothing in the game reads a purpose, it is an input to the balancing engine. The passes import this list.
 */

/** What a producer is for, in three shapes. The captions are the meanings written as sentences a designer reads. The purpose factors are deliberately not shown: they are the engine's dial, and printing them invites authoring against the number instead of the intent. */
export const SIM_PURPOSES = [
  {
    id: 'gph',
    label: 'Gold',
    caption: 'Earning is the point. This should hit the gold-per-hour curve for its level.',
  },
  {
    id: 'iph',
    label: 'Items',
    caption:
      'It feeds chains. Its gold rate sits well under the curve and its items come out '
      + 'cheap, because the same target is spread across many units.',
  },
  {
    id: 'xph',
    label: 'XP',
    caption: 'It pays in XP, and barely in gold.',
  },
];

export function isSimPurpose(value) {
  return SIM_PURPOSES.some((p) => p.id === value);
}
