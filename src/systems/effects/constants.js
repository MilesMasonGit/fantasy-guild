export const EFFECT_TYPES = {
    DAMAGE: 'DAMAGE',         // Melee, Ranged, Magic damage

    // Combat axes read as flat sums by `ModifierAggregator.query` (percentage and
    // multiplier buckets are skipped), so the palette offers only the flat bucket.
    ACCURACY: 'ACCURACY',     // points off the bearer's miss chance — CombatFormulas
    DODGE: 'DODGE',           // points on the miss chance of whoever attacks the bearer
    CRIT_CHANCE: 'CRIT_CHANCE', // points on the bearer's crit chance
    // Percent on the bearer's hits of one damage type (the category) — CombatFormulas.typeDamageBoost.
    TYPE_DAMAGE: 'TYPE_DAMAGE',
    // Percent off hits of one damage type the bearer takes (the category) — CombatFormulas.
    TYPE_RESIST: 'TYPE_RESIST',
    // Points off every resistance the bearer has, never below 0 (the Sunder status) — CombatFormulas.
    SUNDER: 'SUNDER',
    // Percent off the bearer's hits in one combat style (the category); worn gear's `damageCut`
    // registers it, no Rules row offers it — CombatFormulas.styleDamageCut.
    STYLE_DAMAGE_CUT: 'STYLE_DAMAGE_CUT',
    // ⚠️ Gone with damage types: no reader and no Rules row, so the content audits name an effect
    // that still provides one as a number the game does not have. Only tests use these names.
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
    // Giant Harvest: a chance a Farming work cycle's drops all come in at ten times, the rare table's
    // too; narrowed to the Token's skill, and no other work rolls it — OutputRules.rollGiantHarvest.
    GIANT_HARVEST: 'GIANT_HARVEST',
    // Quiet: percentage points off a thief's chance of being caught at a Hideout, narrowed to the
    // Hideout's skill (Crime) — Hideouts.caughtChanceAt.
    QUIET: 'QUIET',
    // How often ONE fish bites from a water's catch pool, as a percentage on its weight; the item is
    // the rule's category (`Fishing.catchOf`).
    CATCH_WEIGHT: 'CATCH_WEIGHT',
    // Free Replant: a chance that the harvest which ends a ripe Field sows the same crop again with
    // no seed; narrowed to the Field's skill — Fields.harvested.
    FREE_REPLANT: 'FREE_REPLANT',
    // Grove Felling: a chance that a tree which falls to its Stump fells the touching trees of its
    // kind too, each paying one cycle's output and XP; narrowed to the tree's skill — GroveFelling.js.
    GROVE_FELLING: 'GROVE_FELLING',
    // Better Catch: a chance a catch is the next fish up the pool fished (the lowest Fishing level
    // above the one that bit, within the hero's level), spending the Bait of the one that bit;
    // narrowed to the water's skill — Fishing.catchOf.
    BETTER_CATCH: 'BETTER_CATCH',
    // Moves how many stacks of one status (the category, a status effect's id) can build up on the bearer — LiveEffects.
    STATUS_MAX_STACKS: 'STATUS_MAX_STACKS',
    // How long the bearer's swing takes, as a percentage: negative is faster — CombatFormulas.
    SWING_TIME: 'SWING_TIME',
    // How much a meal heals the bearer, as a percentage (Burn: -50%); drinks never heal — ConsumptionSystem.
    FOOD_HEALING: 'FOOD_HEALING',
    // The combat tricks, read off a hero for the style they fight in — CombatTricks.js.
    // Heal on Kill: whole health a hero heals on each kill (Second Wind).
    KILL_HEAL: 'KILL_HEAL',
    // Last Stand: a chance, once a fight, that an enemy's blow which would defeat the hero leaves
    // them at 1 health instead (Unbreakable).
    LAST_STAND: 'LAST_STAND',
    // Twin Strike: a chance a hero's attack strikes again at once, its ammo spent once (Twin Shot,
    // Double Cast).
    TWIN_STRIKE: 'TWIN_STRIKE',
    // Crit After Dodge: a chance an enemy's attack missing the hero makes their next landed hit a
    // sure crit (Shadowstep).
    DODGE_CRIT: 'DODGE_CRIT',
    FAIL_CHANCE: 'FAIL_CHANCE', // Chance for failure/debuff
    // Regen: how fast a hero heals out of a fight, as a percentage on 1 HP every 10 s. From what the
    // hero carries and the guild, never a Token — hero/regen.js.
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
    // How many harvests a Field gives on average when its crop ripens (a Composter adds to them,
    // lowering its chance to finish each harvest); read once, as it ripens — Fields.loadAtRipening.
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
    // Coin Find: a percentage on the coins an enemy defeated in reach drops, and on the coins a
    // Hideout in reach steals. A building's only: no Guild Hall star touches coins — CoinDrops.
    COIN_FIND: 'COIN_FIND',

    // Faith's blessings, the effects no building gives (owner, 2026-11-25), carried by a shrine.
    // Can't Run Out (also the Motherlode perk): a chance a work cycle at a Token it reaches spends none
    // of the Token's own charges, and a Field none of its load, failed cycles too; at 100 it never runs
    // out. Narrowed to the Token's skill — BoardRunner.completeCycle, CycleSavings.neverRunsOut.
    NEVER_RUNS_OUT: 'NEVER_RUNS_OUT',
    // Echo: a chance a finished work cycle repeats at once, for free (its outputs and XP again, no
    // inputs, charges, load or tool wear); narrowed to the Token's skill — BoardRunner.completeCycle.
    ECHO: 'ECHO',
    // Fortune: each finished work cycle at a Token it reaches counts this many percent toward a sure
    // rare find; the cycle that fills the count gives the Token's rarest drop for certain (25: every
    // fourth cycle). The count is the Token's own, saved; narrowed to the Token's skill — Fortune.js.
    FORTUNE: 'FORTUNE',
    // Valiant: a chance a hero brought to 0 HP in a fight it reaches flees instead of being Defeated:
    // no defeat costs (their food and drink and their gear are kept), still carried home wounded.
    // Read at the enemy they fight, with the hero's own scope — CycleSavings.fleesDefeat.
    VALIANT: 'VALIANT',
    // Wisdom: when a hero earns XP at a Token it reaches (a work cycle, a kill), every other hero
    // working or fighting a Token the same rule reaches gets this many percent of it, in the same
    // skill; a share is never shared again. Read off the Tokens' own rules (a shrine's reach), not the
    // guild's or a hero's; narrowed to the skill the XP was earned in — Wisdom.js.
    WISDOM: 'WISDOM',

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

/** The work whose cycles roll Giant Harvest; any other work, and a kill, never does. */
export const GIANT_HARVEST_SKILLS = Object.freeze(['farming']);

export const TARGET_CATEGORIES = {
    ALL: 'ALL',
    COMBAT: 'combat'
};
