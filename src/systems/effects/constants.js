/**
 * Effect & Modifier Engine Constants
 */

export const EFFECT_TYPES = {
    SPEED: 'SPEED',           // Task tick speed, combat attack speed
    DAMAGE: 'DAMAGE',         // Melee, Ranged, Magic damage
    DEFENSE: 'DEFENSE',       // Damage reduction
    XP_BONUS: 'XP_BONUS',     // Bonus XP gain
    LOOT_MULT: 'LOOT_MULT',   // Chance for double loot
    FAIL_CHANCE: 'FAIL_CHANCE', // Chance for failure/debuff
    HP_REGEN: 'HP_REGEN',     // Health regeneration
    THORNS_REFLECT: 'THORNS_REFLECT', // Reflect damage to attacker
    STAT_BONUS: 'STAT_BONUS', // Generic stat bonus (for skills/combat)
    LOGIC_OVERRIDE: 'LOGIC_OVERRIDE', // Complex logic triggers (e.g., ignore_defense)

    // --- Card Mutator axes (§15.8, Phase 3 plumbing) --------------------
    // The three v1 Token effect axes. Stamped Tokens register against these;
    // the CONSUMERS land in Phase 5 (yield → loot generation, work time →
    // currentTickTime, input cost → consumeInputs). Nothing reads them yet.
    //
    // WORK_TIME is deliberately separate from SPEED. SPEED is a work *rate*,
    // so a Token adding Work Time expressed as SPEED would be read with its
    // sign inverted and would make the card faster instead of slower.
    YIELD: 'YIELD',           // units of output a Card produces
    WORK_TIME: 'WORK_TIME',   // milliseconds of Work Time a Card takes
    INPUT_COST: 'INPUT_COST', // units of input a Card consumes

    /**
     * A chance to yield an extra, **different** item on top of a Token's normal
     * output (CMS-27).
     *
     * ⚠️ Distinct from `LOOT_MULT`, which multiplies the Token's *own* output.
     * BONUS_DROP adds something unrelated — the Masonry Wheelbarrow yielding
     * Stone beside an Ore Vein.
     *
     * ⚠️ It carries an **item payload**, not a number:
     * `{ type, itemId, chance, quantity }`. It therefore does NOT go through the
     * three-bucket aggregator, which resolves scalars — see
     * `TileModifiers.collectItemGrants`.
     */
    BONUS_DROP: 'BONUS_DROP',

    /**
     * Consumes item(s) from the Bank and produces item(s) onto the board
     * (CMS-72) — the Stoneshaper Sigil turning Stone into something else.
     *
     * ⚠️ **Only meaningful inside a triggered block.** Without a trigger to
     * fire it, "consume these, produce those" is exactly what a production
     * recipe already is, which is why this waited for Phase 6 rather than
     * shipping alongside `BONUS_DROP` (CMS-99).
     *
     * Payload shape: `{ type, consumes: [{itemId, quantity}],
     * produces: [{itemId, quantity}], chance }`.
     */
    CONVERT: 'CONVERT'
};

export const TARGET_CATEGORIES = {
    ALL: 'ALL',
    // Parent Categories / Skills (15-skill system)
    LABOR: 'labor',
    FORGE: 'forge',
    AQUATIC: 'aquatic',
    NATURE: 'nature',
    COOKING: 'cooking',
    ALCHEMY: 'alchemy',
    SCIENCE: 'science',
    OCCULT: 'occult',
    CRIME: 'crime',
    EXPLORE: 'explore',
    SOCIAL: 'social',
    COMBAT: 'combat',

    // Legacy parent ids (pre-15-skill content may still reference these)
    INDUSTRY: 'industry',
    NAUTICAL: 'nautical',
    CRAFTING: 'crafting',
    CULINARY: 'culinary',

    // Combat Specifics
    MELEE: 'melee',
    RANGED: 'ranged',
    MAGIC: 'magic',
    DEFENSE: 'defense',

    // Gathering Specifics
    MINING: 'mining',
    SMELTING: 'smelting',
    SMITHING: 'smithing',
    LOGGING: 'logging',
    FORAGING: 'foraging',
    HERBALISM: 'herbalism',
    HARVESTING: 'harvesting',
    HUNTING: 'hunting',
    FISHING: 'fishing',

    // special specifics
    INTRIGUE: 'intrigue'
};

export const SCOPES = {
    SELF: 'SELF',
    ADJACENT: 'ADJACENT',
    GLOBAL: 'GLOBAL'
};

export const MODIFIER_SOURCE_TYPES = {
    TRAIT: 'TRAIT',
    CLASS: 'CLASS',
    EQUIPMENT: 'EQUIPMENT',
    TILE: 'TILE',
    AURA: 'AURA',
    CONSUMABLE: 'CONSUMABLE'
};
