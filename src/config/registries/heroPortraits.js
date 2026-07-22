// Fantasy Guild — Hero portrait catalogue (Hero Dock rework, Phase 7)

/**
 * Every portrait a hero can wear, as sprite ids.
 *
 * `resolveSpritePath` already maps any `hf_`/`hm_`/`hn_` prefixed id straight
 * to `assets/heroes/<id>.png`, so these need no manifest entry — the id IS the
 * filename stem.
 *
 * Free choice across the whole set (owner decision 2026-07-22): classes are
 * cosmetic in this game, so restricting portraits by class would protect no
 * rule and would leave several classes with one or two options.
 *
 * Prefixes are the art's own naming, not a game concept: `hf_` and `hm_` are
 * the two figure styles the artist drew, `hn_` a third. They are deliberately
 * NOT surfaced as a label in the picker.
 */
export const HERO_PORTRAITS = [
    'hf_alchemist', 'hf_art', 'hf_bard', 'hf_cook', 'hf_druid', 'hf_jester',
    'hf_mage1', 'hf_mage2', 'hf_sail', 'hf_sail1', 'hf_social', 'hf_warrior',
    'hm_alchemy', 'hm_bard', 'hm_blacksmith', 'hm_cleric', 'hm_cook',
    'hm_crime', 'hm_druid', 'hm_fighter', 'hm_sail', 'hm_wizard',
    'hn_adventure1', 'hn_adventure2', 'hn_bard', 'hn_cook', 'hn_crime',
    'hn_range', 'hn_sneak'
];

/** Longest name a hero may be given, so the dock tab never has to truncate. */
export const HERO_NAME_MAX = 18;

export default HERO_PORTRAITS;
