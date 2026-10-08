export const EFFECT_TYPES = {
    SPEED: 'SPEED',           // Task tick speed, combat attack speed
    DAMAGE: 'DAMAGE',         // Melee, Ranged, Magic damage
    DEFENSE: 'DEFENSE',       // Damage reduction

    // Combat axes read as flat sums by `ModifierAggregator.query` (percentage and
    // multiplier buckets are skipped), so the palette offers only the flat bucket.
    ARMOR: 'ARMOR',           // flat damage subtracted — CombatFormulas.computeEnemyDamage
    ACCURACY: 'ACCURACY',     // hit chance — CombatFormulas.calculateHitChance
    BLOCK: 'BLOCK',           // block chance — CombatFormulas.getHeroBlockChance
    RESIST_FLAT: 'RESIST_FLAT', // flat damage subtracted after armour — computeEnemyDamage
    XP_BONUS: 'XP_BONUS',     // Bonus XP gain
    LOOT_MULT: 'LOOT_MULT',   // Chance for double loot
    FAIL_CHANCE: 'FAIL_CHANCE', // Chance for failure/debuff
    HP_REGEN: 'HP_REGEN',
    THORNS_REFLECT: 'THORNS_REFLECT',

    // Blocks NEW applications of the named status (its id is the aggregator category);
    // never strips stacks already carried.
    STATUS_IMMUNITY: 'STATUS_IMMUNITY',
    STAT_BONUS: 'STAT_BONUS',
    LOGIC_OVERRIDE: 'LOGIC_OVERRIDE', // Complex logic triggers (e.g., ignore_defense)

    // WORK_TIME is deliberately separate from SPEED. SPEED is a work *rate*, so a Token
    // adding Work Time expressed as SPEED would be read with its sign inverted.
    YIELD: 'YIELD',           // units of output a Card produces
    WORK_TIME: 'WORK_TIME',   // milliseconds of Work Time a Card takes
    INPUT_COST: 'INPUT_COST', // units of input a Card consumes

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

export const MODIFIER_SOURCE_TYPES = {
    TRAIT: 'TRAIT',
    CLASS: 'CLASS',
    EQUIPMENT: 'EQUIPMENT',
    TILE: 'TILE',
    AURA: 'AURA',
    CONSUMABLE: 'CONSUMABLE'
};
