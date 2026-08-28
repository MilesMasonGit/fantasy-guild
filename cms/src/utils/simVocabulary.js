/**
 * The simulator's authoring vocabulary that the **game does not declare**
 * (economic simulator rework P2).
 *
 * ⚠️ Tempo lives game-side, in `src/config/registries/tempoBands.js`, and is
 * re-exported from `constants.js` under CMS-5's game→CMS rule. Purpose does
 * not, and that is deliberate rather than an oversight: nothing in the game
 * will ever read a purpose. It is an input to the balancing engine, and the
 * engine lives here in `cms/`. P3 will import this list; if the engine ever
 * moves game-side, this moves with it.
 *
 * Nothing reads either field yet. P2 only makes content taggable.
 */

/**
 * What a producer is *for*, in the three shapes the plan recognises.
 *
 * The captions are the plan's meanings written as sentences a designer reads.
 * The purpose **factors** (1.0 / 0.35 / 0.10) are deliberately not shown: they
 * are the engine's dial, and printing them here invites authoring against the
 * number instead of against the intent.
 */
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

/** Is `value` one of the three purposes? */
export function isSimPurpose(value) {
  return SIM_PURPOSES.some((p) => p.id === value);
}

/** The heading both editors give the Simulator panel, so they cannot drift. */
export const SIM_SECTION_TITLE = 'Simulator';
