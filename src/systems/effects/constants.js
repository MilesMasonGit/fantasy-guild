export const EFFECT_TYPES = {
    DAMAGE: 'DAMAGE',         // Melee, Ranged, Magic damage

    // Combat axes read as flat sums by `ModifierAggregator.query` (percentage and
    // multiplier buckets are skipped), so the palette offers only the flat bucket.
    ACCURACY: 'ACCURACY',     // points off the bearer's miss chance — CombatFormulas
    DODGE: 'DODGE',           // points on the miss chance of whoever attacks the bearer
    CRIT_CHANCE: 'CRIT_CHANCE', // points on the bearer's crit chance
    // Percent on the bearer's hits of one damage type or group (the category) — CombatFormulas.typeDamageBoost.
    TYPE_DAMAGE: 'TYPE_DAMAGE',
    // Percent off hits of one damage type or group the bearer takes (the category) — CombatFormulas.
    TYPE_RESIST: 'TYPE_RESIST',
    // Points off every resistance the bearer has, never below 0 (the Sunder status) — CombatFormulas.
    SUNDER: 'SUNDER',
    // Percent off the bearer's hits in one combat style (the category); worn gear's `damageCut`
    // registers it, no Rules row offers it — CombatFormulas.styleDamageCut.
    STYLE_DAMAGE_CUT: 'STYLE_DAMAGE_CUT',
    // ⚠️ Retired with damage types: nothing reads them, the palette no longer offers them, and the
    // content audits name an effect that still provides one.
    ARMOR: 'ARMOR',
    RESIST_FLAT: 'RESIST_FLAT',
    PIERCE: 'PIERCE',
    XP_BONUS: 'XP_BONUS',     // Bonus XP gain
    LOOT_MULT: 'LOOT_MULT',   // Chance for double loot
    // A chance to double ONE item a cycle or kill drops; the item is the rule's category (`OutputRules`).
    DOUBLE_DROP: 'DOUBLE_DROP',
    // Refresh: a chance a completed cycle spends none of the Token's charges (a Field: none of its
    // load); narrowed to the Token's skill — CycleSavings.rollRefresh.
    REFRESH: 'REFRESH',
    // Preservation: a chance a completed cycle uses none of its materials (narrowed to the Token's
    // skill), and a chance a hero's ammo, Food, drink, potion or bait is not used up (narrowed to the
    // item or its kind, `carriedKinds.js`) — CycleSavings.
    PRESERVATION: 'PRESERVATION',
    // Lucky: the chance on a Token's own rare drop table, widened from that chance as its base (a
    // percentage in proportion, a flat in points) — RareTables.
    LUCKY: 'LUCKY',
    // Giant Harvest: a chance a gathering cycle's drops all come in at ten times, the rare table's
    // too; narrowed to the Token's skill, and only a gathering skill rolls it — OutputRules.rollGiantHarvest.
    GIANT_HARVEST: 'GIANT_HARVEST',
    // How often ONE fish bites from a water's catch pool, as a percentage on its weight; the item is
    // the rule's category (`Fishing.catchOf`).
    CATCH_WEIGHT: 'CATCH_WEIGHT',
    // Moves how many stacks of one status (the category, a status effect's id) can build up on the bearer — LiveEffects.
    STATUS_MAX_STACKS: 'STATUS_MAX_STACKS',
    // How long the bearer's swing takes, as a percentage: negative is faster — CombatFormulas.
    SWING_TIME: 'SWING_TIME',
    // How much eating and drinking heal the bearer, as a percentage (Burn: -50%) — ConsumptionSystem.
    FOOD_HEALING: 'FOOD_HEALING',
    FAIL_CHANCE: 'FAIL_CHANCE', // Chance for failure/debuff
    HP_REGEN: 'HP_REGEN',

    // Blocks NEW applications of the named status (its id is the aggregator category);
    // never strips stacks already carried.
    STATUS_IMMUNITY: 'STATUS_IMMUNITY',
    STAT_BONUS: 'STAT_BONUS',

    // WORK_TIME is an amount of time, not a rate: more is slower.
    YIELD: 'YIELD',           // units of output a Token produces
    WORK_TIME: 'WORK_TIME',   // milliseconds of Work Time a Token takes
    INPUT_COST: 'INPUT_COST', // units of input a Token consumes
    // How long a Token takes to grow (`grows`) or to refill after a rest (`respawn` refill), as a
    // percentage: negative is faster — TileModifiers.growTimeOf.
    GROW_TIME: 'GROW_TIME',
    // How many harvest cycles a Field holds when its crop ripens (a Composter adds to the load);
    // read once, as it ripens — Fields.loadAtRipening.
    CROP_LOAD: 'CROP_LOAD',
    // How far a camp hands out work, as a percentage on its authored reach — Camps.reachOf.
    CAMP_REACH: 'CAMP_REACH',
    // How long a wounded hero takes to recover, as a percentage: negative is faster. Guild-wide
    // only (a Guild Hall star) — WoundedSystem.
    WOUND_TIME: 'WOUND_TIME',
    // More of one loadout category (the category) every hero may carry, as a flat count. Guild-wide
    // only (a Guild Hall star) — loadoutCaps.js.
    LOADOUT_SLOTS: 'LOADOUT_SLOTS',
    // How long Passive Production's one lap takes, as a percentage: negative is shorter. Guild-wide
    // only (a Guild Hall star) — PassiveProduction.lapMs.
    PASSIVE_LAP: 'PASSIVE_LAP',
    // XP for Everyone: XP every hero gets in every skill, once, as a rank is bought; a hero who joins
    // later arrives with the held ranks' whole gift. A Guild Hall star's only, read off its ranks,
    // never an aggregator — hallModifiers.xpForEveryoneOf.
    XP_FOR_EVERYONE: 'XP_FOR_EVERYONE',
    // Long-lasting Brews: how many cycles or fights a fresh dose lasts (a drink's and a work
    // potion's work cycles, a fight elixir's fights), resolved from the dose's own length and
    // narrowed to the kind of dose. Guild-wide only — ConsumptionSystem.doseLength.
    LONG_LASTING_BREWS: 'LONG_LASTING_BREWS',
    // Strong Drink: a percentage on every modifier a dose's effects give, narrowed to the kind of
    // dose. Guild-wide only — ConsumptionSystem.doseStrength, LiveEffects (an instance's `boost`).
    STRONG_DRINK: 'STRONG_DRINK',

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

/** How many times over a Giant Harvest's drops come in (`OutputRules.rollGiantHarvest`). */
export const GIANT_HARVEST_TIMES = 10;

export const TARGET_CATEGORIES = {
    ALL: 'ALL',
    COMBAT: 'combat'
};
