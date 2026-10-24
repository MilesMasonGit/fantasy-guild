export const EFFECT_TYPES = {
    DAMAGE: 'DAMAGE',         // Melee, Ranged, Magic damage
    DEFENSE: 'DEFENSE',       // Damage reduction

    // Combat axes read as flat sums by `ModifierAggregator.query` (percentage and
    // multiplier buckets are skipped), so the palette offers only the flat bucket.
    ARMOR: 'ARMOR',           // flat damage subtracted from every hit taken — CombatFormulas
    ACCURACY: 'ACCURACY',     // points off the bearer's miss chance — CombatFormulas
    RESIST_FLAT: 'RESIST_FLAT', // flat damage subtracted after armour — CombatFormulas.enemyHitDamage
    DODGE: 'DODGE',           // points on the miss chance of whoever attacks the bearer
    PIERCE: 'PIERCE',         // armour points the bearer's hits ignore
    CRIT_CHANCE: 'CRIT_CHANCE', // points on the bearer's crit chance
    XP_BONUS: 'XP_BONUS',     // Bonus XP gain
    LOOT_MULT: 'LOOT_MULT',   // Chance for double loot
    // A chance to double ONE item a cycle or kill drops; the item is the rule's category (`OutputRules`).
    DOUBLE_DROP: 'DOUBLE_DROP',
    // Moves how many stacks of one status (the category, a status effect's id) can build up on the bearer — LiveEffects.
    STATUS_MAX_STACKS: 'STATUS_MAX_STACKS',
    // How long the bearer's swing takes, as a percentage: negative is faster — CombatFormulas.
    SWING_TIME: 'SWING_TIME',
    // How much eating and drinking heal the bearer, as a percentage (Burn: -50%) — ConsumptionSystem.
    FOOD_HEALING: 'FOOD_HEALING',
    FAIL_CHANCE: 'FAIL_CHANCE', // Chance for failure/debuff
    HP_REGEN: 'HP_REGEN',
    THORNS_REFLECT: 'THORNS_REFLECT',

    // Blocks NEW applications of the named status (its id is the aggregator category);
    // never strips stacks already carried.
    STATUS_IMMUNITY: 'STATUS_IMMUNITY',
    STAT_BONUS: 'STAT_BONUS',
    LOGIC_OVERRIDE: 'LOGIC_OVERRIDE', // Complex logic triggers (e.g., ignore_defense)

    // WORK_TIME is an amount of time, not a rate: more is slower.
    YIELD: 'YIELD',           // units of output a Token produces
    WORK_TIME: 'WORK_TIME',   // milliseconds of Work Time a Token takes
    INPUT_COST: 'INPUT_COST', // units of input a Token consumes

    /**
     * A chance to yield an extra, **different** item on top of a Token's normal output.
     *
     * ⚠️ Carries an item payload `{ type, itemId, chance, quantity }`, not a number, so it
     * does NOT go through the three-bucket aggregator; see `TileModifiers.collectItemGrants`.
     */
    BONUS_DROP: 'BONUS_DROP',

    /**
     * Consumes item(s) from the Bank and produces item(s) onto the board.
     *
     * ⚠️ Only meaningful inside a triggered block; without a trigger it is just a recipe.
     * Payload: `{ type, consumes: [{itemId, quantity}], produces: [{itemId, quantity}], chance }`.
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
    FORESTRY: 'forestry',
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
    NEARBY: 'NEARBY',
    GLOBAL: 'GLOBAL'
};

