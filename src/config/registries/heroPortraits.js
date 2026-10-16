// Fantasy Guild — Hero portrait catalogue

/**
 * Every portrait a hero can wear, as sprite ids.
 *
 * `resolveSpritePath` maps any `hf_`/`hm_`/`hn_` prefixed id straight to
 * `assets/heroes/<id>.png`: the id IS the file name.
 *
 * Free choice across the whole set: classes are
 * cosmetic in this game, so restricting portraits by class would protect no
 * rule and would leave several classes with one or two options.
 *
 * Prefixes are the art's own naming (female, male, neutral;
 * `docs/reference/ASSET_NAMING.md`), not a game concept. They are deliberately
 * NOT surfaced as a label in the picker.
 */
export const HERO_PORTRAITS = [
    'hf_alchemist_por', 'hf_art_por', 'hf_bard_por', 'hf_cook_por', 'hf_druid_por', 'hf_jester_por',
    'hf_mage_por_1', 'hf_mage_por_2', 'hf_sail_por', 'hf_sail_pirate_por', 'hf_social_por', 'hf_warrior_por',
    'hm_alchemy_por', 'hm_bard_por', 'hm_blacksmith_por', 'hm_cleric_por', 'hm_cook_por',
    'hm_crime_por', 'hm_druid_por', 'hm_fighter_por', 'hm_sail_por', 'hm_wizard_por',
    'hn_adventure_por', 'hn_bard_por', 'hn_cook_por', 'hn_crime_por',
    'hn_range_por', 'hn_sneak_por'
];

/** Longest name a hero may be given, so the dock tab never has to truncate. */
export const HERO_NAME_MAX = 18;

export default HERO_PORTRAITS;
