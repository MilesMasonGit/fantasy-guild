// Fantasy Guild — The authorable modifier palette
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY. `cms/src/utils/constants.js`
// re-exports ten names from here by relative path. The CMS is a separate app that `npm run
// build` does not compile, so some exports (`MODIFIER_BUCKETS`, `isAuthorableModifier`) have no
// reader in the running game and must not be deleted as dead code. `src/tests/CMSBoundary.test.js`
// scans the CMS for these imports and fails if a named export goes missing.

import { EFFECT_TYPES, TARGET_CATEGORIES } from '../../systems/effects/constants.js';
import { COMBAT_SKILL_IDS } from './skillRegistry.js';

/**
 * Which effect axes content may be authored against, and in what shape.
 *
 * ## Why this is declared in the game
 * `EFFECT_TYPES` is a bag of every axis the engine has ever had, including
 * several with **no consumer anywhere**. Offering that list in the CMS would
 * let an author build a Token whose effect silently does nothing.
 *
 * An axis appears here only once something reads it. Adding a consumer and
 * adding a row here should be the same commit.
 *
 * ## Two shapes
 * * `deterministic` — `{ type, bucket, value }`, always applies, resolved
 *   through the three-bucket formula.
 * * `proc` — resolved through the same formula to produce a **percentage**,
 *   then rolled once per cycle. `constants.js` always described these as
 *   chances ("chance for double loot", "chance for failure"); giving them their
 *   own shape stops an author building a modifier that is ambiguous about which
 *   maths path resolves it.
 */

/** Modifier shapes. */
export const MODIFIER_SHAPES = {
    DETERMINISTIC: 'deterministic',
    PROC: 'proc',
    /**
     * Carries an **item payload** rather than a number:
     * `{ type, itemId, chance, quantity }`.
     *
     * These cannot go through the three-bucket aggregator — resolving an item
     * id as a scalar is meaningless — so they are collected and rolled by their
     * consumer instead (`TileModifiers.collectItemGrants`). Item-granting goes
     * through Modifiers rather than its own block section, which is why it is a
     * shape here instead of a separate concept.
     */
    ITEM: 'item',
    /**
     * Two item lists rather than one: `{ consumes: [...], produces: [...] }`.
     *
     * Only meaningful inside a triggered block — see `EFFECT_TYPES.CONVERT`.
     * Entries carrying `triggeredOnly` are hidden from the palette until the
     * block has a trigger, so the CMS cannot offer an action the runtime would
     * never fire.
     */
    CONVERT: 'convert'
};

/** The buckets a deterministic modifier may push into. */
export const MODIFIER_BUCKETS = ['flat', 'multiplier', 'percentage'];

/**
 * ## ⚠️ `when` — the legality flag
 *
 * An effect on the wrong side of the line is authored, saved, loaded and read by
 * nobody: **Yield** on a triggered block is skipped by `TileModifiers` (it has a
 * trigger) and ignored by `TriggerSystem` (it is not an item grant). So every
 * entry declares which side of that line it lives on:
 *
 * * `never`    — only meaningful while the effect applies continuously.
 * * `optional` — works ambiently *and* on an event.
 * * `required` — meaningless without a firing moment.
 *
 * The statement grammar reads this (`statements.js`), so an impossible
 * combination is not something the editor can be talked into.
 *
 * ## `scales` — what a reference's scale multiplies
 *
 * A bearer points at a named effect and may carry a **scale**: an integer 1–5
 * that says "the same effect, stronger". What "stronger" means is not the same
 * for every effect, so each row declares the payload field its scale touches
 * rather than the scaling code carrying a switch over effect types:
 *
 * * `'value'`    — the magnitude. Every number and every chance.
 * * `'quantity'` — how many items are granted.
 * * `'amounts'`  — a conversion's two lists, **both sides**. Scaling only the
 *   output would turn a scale into free money; scaling both keeps the exchange
 *   rate the author wrote and simply runs it harder.
 *
 * Omit it and the effect does not scale. That is the right answer more often
 * than it looks — see the note on `Acts as` in `statements.js`.
 *
 * ⚠️ A proc's scaled value is clamped by `clampModifierValue` like any other,
 * so a 40% chance at scale 3 is 100%, not 120%.
 *
 * ## `categories` — what a row's optional narrowing field picks from
 *
 * `ModifierAggregator` has always matched on `mod.target.category`, and two
 * different readers pass two different vocabularies into it:
 *
 * * `'skill'`  — `BoardRunner` passes the Token's `config.skill` on **every**
 *   `resolveAxis` call, so a rule can read *"+10% yield to Mining only"*.
 * * `'status'` — `LiveEffects` passes a status effect's id (a library entry
 *   carrying a `status` block), which is how `STATUS_IMMUNITY` names the one
 *   status it blocks.
 * * `'item'`   — `OutputRules.doubleItemDrop` passes the id of each item a
 *   cycle or kill dropped, which is how `DOUBLE_DROP` names its item.
 * * `'damageType'` — `CombatFormulas` passes a hit's damage type, which is how
 *   Type Damage % and Type Resistance % name a type; a group's row counts on its
 *   types (`ModifierAggregator._isParentOf`).
 *
 * Declaring the vocabulary per row is what lets the CMS show a skill
 * picker on Yield and a status picker on Immunity without knowing either list.
 *
 * * `'combatStyle'` — `CombatFormulas` passes the style the hero fights in (the weapon's; Melee
 *   barehanded) when it reads Damage, Swing Time and Accuracy, which is how a Hall star names the
 *   fighters it helps. These three are also the only combat axes a hero reads from the guild-wide
 *   aggregator, so a star reaches them and no other combat axis.
 *
 * A row without `categories` offers no narrowing at all, which is right for the
 * other combat axes — their readers call `query('DODGE')` with no category, so
 * anything but ALL would be registered and never matched.
 *
 * * `'equipCategory'` — `loadoutCaps.js` passes a loadout category's id
 *   (`equipmentCategories.js`), which is how `LOADOUT_SLOTS` names the kind of
 *   item it makes room for.
 * * `'skillOrCarried'` — `CycleSavings` passes a cycle's skill, or a carried item's id together
 *   with its kind (`carriedKinds.js`: ammo, Food…), which is how `PRESERVATION` names the work whose
 *   materials it keeps, or the things a hero carries it keeps.
 *
 * A `'skill'` row may add `skillTrade` (a `SKILL_TRADES` id): its reader rolls it only for that
 * trade's skills (Giant Harvest, gathering), so the CMS's picker lists those alone.
 *
 * ## `retired` — still read as a sentence, never offered
 *
 * A row the game no longer reads (flat Armor, Resistance and Pierce, gone with
 * damage types) stays here so content carrying one still renders and the audits
 * can name it; `paletteForKeyword` leaves it out of the editor's choices.
 *
 * ## `heroReads` — how the axis reads on a hero
 *
 * A carried rule (an item's, a perk's) reads "Gives the hero …" with this phrase where the Token
 * wording's verb does not fit a person: a hero is not "awarded" XP, they get it. An axis without it
 * reads "Makes the hero …" with `reads`.
 *
 * ## `heroOnly` — the axis reaches a person, never a tile
 *
 * Read off a **hero's** aggregator, so only an item (to its carrier) or an enemy
 * (to its opponent) can write it. A plain Token carrying one reaches nobody, and
 * both the sentence and `ContentAudit` say so. `STATUS_IMMUNITY` has the
 * same property and is not combat, so the property is declared rather than
 * inferred from a label.
 *
 * @type {Array<{type: string, label: string, shape: string, group: string, hint: string, inverted?: boolean, when: string, scales?: string}>}
 */
export const MODIFIER_PALETTE = [
    // --- Production ---------------------------------------------------------
    {
        type: EFFECT_TYPES.YIELD,
        label: 'Yield',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        hint: 'Units of output produced per cycle.'
    },
    {
        type: EFFECT_TYPES.WORK_TIME,
        reads: { up: (n) => `work ${n} slower`, down: (n) => `work ${n} faster` },
        label: 'Speed',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        inverted: true,
        hint: 'How long a cycle takes, shown as Speed. A negative value is faster.'
    },
    {
        type: EFFECT_TYPES.INPUT_COST,
        reads: { up: (n) => `use ${n} more of every input`, down: (n) => `use ${n} less of every input` },
        label: 'Efficiency',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        inverted: true,
        hint: 'Units of every input consumed. A negative value is cheaper. Applies to all of them — it cannot yet name one item.'
    },
    {
        /**
         * Read by `TileModifiers.growTimeOf` for a growing Token's time (a Sapling becoming a Tree)
         * and a resting Token's refill, from its neighbours and the Region's rules, never from a hero
         * (nobody works a Token while it grows or rests). The skill it narrows to is the growing
         * Token's own work skill, or else the skill of what it grows into.
         */
        type: EFFECT_TYPES.GROW_TIME,
        reads: { up: (n) => `grow and refill ${n} slower`, down: (n) => `grow and refill ${n} faster` },
        label: 'Growth',
        when: 'never',
        scales: 'value',
        buckets: ['percentage'],
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        inverted: true,
        hint: 'How long a Token takes to grow (a Sapling into a Tree) or to refill after it rests (a vein). A negative value is faster. Speed-ups stack, but together cut at most 80% of the time.'
    },
    {
        /**
         * Read by `Fields.loadAtRipening` once, as a Field's crop ripens: the harvest cycles it
         * then holds. From its neighbours and the Region's rules (a Composter in reach), narrowed
         * to the Field's own work skill.
         */
        type: EFFECT_TYPES.CROP_LOAD,
        reads: {
            up: (n, size) => `hold ${n} more ${size === '1' ? 'harvest' : 'harvests'} when ripe`,
            down: (n, size) => `hold ${n} fewer ${size === '1' ? 'harvest' : 'harvests'} when ripe`
        },
        label: 'Abundance',
        when: 'never',
        scales: 'value',
        buckets: ['flat', 'percentage'],
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        hint: 'How many harvests a Field holds when its crop ripens (a Composter adds to the load). Read as the crop ripens; never fewer than one.'
    },
    {
        /**
         * Retired: every camp works the one standard reach and nothing widens
         * it, so no code reads this axis. Kept so a Guild Hall star still carrying it reads as a
         * sentence and the audits can name it (`hallStarRule.js`); `hallRulesOf` leaves it out.
         */
        type: EFFECT_TYPES.CAMP_REACH,
        retired: true,
        reads: { up: (n) => `hand out work ${n} further away`, down: (n) => `hand out work ${n} less far away` },
        label: 'Camp Reach',
        when: 'never',
        scales: 'value',
        buckets: ['percentage'],
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        hint: 'Retired: every camp works the one standard reach, so this does nothing.'
    },

    // --- The guild (Guild Hall stars) -----------------------------------------
    //
    // ⚠️ `guildOnly`: read off the guild-wide aggregator only, which a Guild Hall star (or a
    // Region's rule) writes. On a Token or an item such a rule reaches nobody: the editors do not
    // offer these rows (`paletteForKeyword`) and the boot audit names one found there.
    {
        /** Read by `WoundedSystem` as a wound starts: the recovery time, floored like any speed-up. */
        type: EFFECT_TYPES.WOUND_TIME,
        reads: { up: (n) => `recover from a wound ${n} slower`, down: (n) => `recover from a wound ${n} faster` },
        label: 'Wound Time',
        when: 'never',
        scales: 'value',
        buckets: ['percentage'],
        guildOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Guild',
        inverted: true,
        hint: 'How long a defeated hero takes to recover. A negative value is faster. Speed-ups stack, but together cut at most 80% of the time.'
    },
    {
        /**
         * Read by `loadoutCaps.js`: how many items of one loadout category (the rule's category: a
         * Trinket, Food, Drink…) every hero may carry, on top of the category's own cap.
         */
        type: EFFECT_TYPES.LOADOUT_SLOTS,
        label: 'Loadout Slots',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        categories: 'equipCategory',
        guildOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Guild',
        hint: 'How many more items of one kind (a Trinket, a Food) every hero may carry. Pick the kind.'
    },
    {
        /**
         * Read by `PassiveProduction.lapMs` every lap: how long Passive Production's one lap takes,
         * floored like any speed-up (`workTime.passiveLapMs`). One lap for every Token that pays.
         */
        type: EFFECT_TYPES.PASSIVE_LAP,
        reads: { up: (n) => `${n} longer`, down: (n) => `${n} shorter` },
        label: 'Lap Time',
        when: 'never',
        scales: 'value',
        buckets: ['percentage'],
        guildOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Guild',
        inverted: true,
        hint: 'How long the Guild Hall\'s lap takes: its outputs (Passive Production) arrive once a lap. A negative value is a shorter lap. Speed-ups stack, but together cut at most 80% of the time.'
    },
    {
        /**
         * Read off the held ranks (`hallModifiers.xpForEveryoneOf`), never an aggregator: a rank bought
         * gives every hero on the roster the difference, once (`GuildUpgradeManager.purchaseRanks`), and
         * a hero who joins later arrives with the whole (`HeroLifecycle`). ⚠️ As every star rank, a
         * rank lists the star's whole gift so far, so a rank listing no more than the one before gives
         * nothing (the boot audit names it).
         */
        type: EFFECT_TYPES.XP_FOR_EVERYONE,
        label: 'XP for Everyone',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        guildOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Guild',
        hint: 'XP every hero gets in every skill, once, when the rank is bought; a hero who joins later arrives with it. A rank lists the star\'s whole gift so far: rank 3 of 100 a rank lists 300.'
    },

    // --- Support ------------------------------------------------------------
    {
        type: EFFECT_TYPES.XP_BONUS,
        reads: { up: (n) => `award ${n} more XP`, down: (n) => `award ${n} less XP` },
        heroReads: { up: (n) => `${n} more XP`, down: (n) => `${n} less XP` },
        label: 'XP',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Support',
        hint: 'XP awarded per cycle to the working hero, or per kill in a combat style.'
    },
    {
        type: EFFECT_TYPES.LOOT_MULT,
        reads: {
            up: (n) => `have a ${n} chance of double loot`,
            down: (n) => `have ${n} less chance of double loot`
        },
        heroReads: { up: (n) => `a ${n} chance of double loot`, down: (n) => `${n} less chance of double loot` },
        label: 'Double Loot',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'Percent chance the whole cycle yields double.'
    },
    {
        type: EFFECT_TYPES.FAIL_CHANCE,
        reads: {
            up: (n) => `have a ${n} chance to fail`,
            down: (n) => `have ${n} less chance to fail`
        },
        heroReads: { up: (n) => `a ${n} chance to fail`, down: (n) => `${n} less chance to fail` },
        label: 'Failure Chance',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'Percent chance the cycle produces nothing. Inputs and charges are still spent.'
    },
    {
        /**
         * A family ability such as the Cleaver's: a chance that one named item, when a cycle or a
         * kill drops it, comes out doubled. The item is the narrowing (`categories: 'item'`):
         * `OutputRules.doubleItemDrop` resolves the axis once per item that landed, with the item
         * id as the category, so a rule naming Raw Beef never touches the Bones beside it.
         */
        type: EFFECT_TYPES.DOUBLE_DROP,
        label: 'Double Item',
        when: 'never',
        scales: 'value',
        // A chance is a plain number of percent; resolved from a base of 0, so any other bucket is 0.
        buckets: ['flat'],
        categories: 'item',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'Percent chance that one item, when a cycle or a kill drops it, comes out doubled. Pick the item; "any item" rolls for every item that drops, each on its own.'
    },
    {
        /**
         * Read by `CycleSavings.rollRefresh` once per completed cycle, before the Token pays its
         * charges: on a hit it pays none, and a Field's harvest leaves its load as it was. A failed
         * cycle never rolls. Aimed at Tokens by the rule's `to`; the skill narrows further.
         */
        type: EFFECT_TYPES.REFRESH,
        reads: {
            up: (n) => `have a ${n} chance a cycle spends none of their charges`,
            down: (n) => `have ${n} less chance a cycle spends none of their charges`
        },
        heroReads: {
            up: (n) => `a ${n} chance a cycle spends none of the Token's charges`,
            down: (n) => `${n} less chance a cycle spends none of the Token's charges`
        },
        label: 'Refresh',
        when: 'never',
        scales: 'value',
        // A chance is a plain number of percent; resolved from a base of 0, so any other bucket is 0.
        buckets: ['flat'],
        categories: 'skill',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'A chance a cycle spends none of the Token\'s charges. In percent; a Field keeps its harvest. Aim it at Tokens; the skill narrows it further.'
    },
    {
        /**
         * Read by `CycleSavings`: once per completed cycle that would pay inputs, before it pays
         * (`BoardRunner.completeCycle`; a failed cycle pays and never rolls), with the Token's skill;
         * and each time a hero would use up ammo, Food, a drink's or potion's new dose, a fight
         * elixir's or bait, with the item and its kind (`carriedKinds.js`), at the Token they work or
         * the enemy they fight. The sentence is its own (`statementText`), since the narrowing
         * changes what it covers.
         */
        type: EFFECT_TYPES.PRESERVATION,
        reads: {
            up: (n) => `have a ${n} chance nothing is used up: a cycle's materials, ammo, Food, drinks, potions or bait`,
            down: (n) => `have ${n} less chance nothing is used up: a cycle's materials, ammo, Food, drinks, potions or bait`
        },
        heroReads: {
            up: (n) => `a ${n} chance nothing is used up: a cycle's materials, ammo, Food, drinks, potions or bait`,
            down: (n) => `${n} less chance nothing is used up: a cycle's materials, ammo, Food, drinks, potions or bait`
        },
        label: 'Preservation',
        when: 'never',
        scales: 'value',
        // A chance is a plain number of percent; resolved from a base of 0, so any other bucket is 0.
        buckets: ['flat'],
        categories: 'skillOrCarried',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'A chance a cycle uses none of its materials; it also keeps ammo, Food, drinks, potions and bait from being used up, and an item its own rule spends as it fires. In percent. Pick a skill to keep only that work\'s materials, or a kind of carried thing (Ammo, Food…) or one item to keep only those.'
    },
    {
        /**
         * Read by `RareTables.luckyChance` once per cycle or kill that rolls a rare table, with the
         * table's own chance as the base: a percentage moves it in proportion (+10 % turns 1 % into
         * 1.1 %), a flat adds points (+1 turns 1 % into 2 %). A Token with no table never reads it.
         * Aimed at Tokens by the rule's `to`.
         *
         * ⚠️ Deterministic, not `proc`, though it ends in a roll: a proc is a chance resolved from 0,
         * so the CMS stores its percentage as typed and starts it flat. Lucky's percentage is a share
         * of the table's chance (typed 10, stored 0.1), and the CMS starts it there. The sentence is
         * its own (`statementText`), since a flat reads in points.
         */
        type: EFFECT_TYPES.LUCKY,
        reads: {
            up: (n) => `have a ${n} higher chance on their rare drop table`,
            down: (n) => `have a ${n} lower chance on their rare drop table`
        },
        heroReads: {
            up: (n) => `a ${n} higher chance on the Token's rare drop table`,
            down: (n) => `a ${n} lower chance on the Token's rare drop table`
        },
        label: 'Lucky',
        when: 'never',
        scales: 'value',
        buckets: ['percentage', 'flat'],
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Support',
        hint: 'A higher chance on the Token\'s rare drop table. A percentage raises it in proportion (+10% turns 1% into 1.1%); a flat amount adds points (+1 turns 1% into 2%). Aim it at Tokens; one without a table ignores it.'
    },
    {
        /**
         * Read by `OutputRules.rollGiantHarvest` once per completed cycle, after Double Loot: on a hit
         * every drop of the cycle (each line and the rare table's find) comes in at ten times, and
         * Double Loot's doubling as well. Only a gathering skill's work rolls it (`skillTrade`), so the
         * CMS's skill picker lists those alone; a failed cycle never rolls.
         */
        type: EFFECT_TYPES.GIANT_HARVEST,
        reads: {
            up: (n) => `have a ${n} chance a gathering cycle's drops come in at ten times`,
            down: (n) => `have ${n} less chance a gathering cycle's drops come in at ten times`
        },
        heroReads: {
            up: (n) => `a ${n} chance a gathering cycle's drops come in at ten times`,
            down: (n) => `${n} less chance a gathering cycle's drops come in at ten times`
        },
        label: 'Giant Harvest',
        when: 'never',
        scales: 'value',
        // A chance is a plain number of percent; resolved from a base of 0, so any other bucket is 0.
        buckets: ['flat'],
        categories: 'skill',
        // Narrows the skill picker to one trade (`skillRegistry.SKILL_TRADES`).
        skillTrade: 'gathering',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'A chance a gathering cycle\'s drops come in at ten times: every drop, the rare table\'s find too, and with Double Loot both apply. In percent. Only gathering work (Mining, Forestry, Fishing, Farming) rolls it; pick one of those to narrow it.'
    },
    {
        /**
         * A better rod's bonus: one fish bites more often from a water's catch pool. Its weight in
         * the pool is widened by this percentage before the pick (`Fishing.catchOf` resolves the axis
         * once per catch in the pool, with the item id as the category), so +100 % on a Dolphin
         * weighted 10 beside 50 and 40 makes it 20 of 110. Usually carried on a rod; a Token in reach
         * may give it too.
         */
        type: EFFECT_TYPES.CATCH_WEIGHT,
        label: 'Catch Weight',
        when: 'never',
        scales: 'value',
        buckets: ['percentage'],
        categories: 'item',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Support',
        hint: 'How often one fish bites from a water\'s catch pool: a percentage on its weight there (+100% doubles it). Pick the fish; "any item" moves every catch alike, which changes nothing.'
    },

    // --- Combat ---------------------------------------------------------
    //
    // ⚠️ Every row here but the retired ones has a live reader in `CombatFormulas`
    // or `CombatAttackProcessor`, queried off `hero.aggregator`.
    //
    // `buckets: ['flat']` on all of them because `ModifierAggregator.query` —
    // which is what combat calls — sums flats and SKIPS percentage and
    // multiplier entries. Offering a percentage would be offering something
    // silently discarded.
    {
        type: EFFECT_TYPES.ARMOR,
        label: 'Armor',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        retired: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Retired with damage types: does nothing. Use Type Resistance % (Physical for metal armour).'
    },
    {
        type: EFFECT_TYPES.RESIST_FLAT,
        label: 'Resistance',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        retired: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Retired with damage types: does nothing. Use Type Resistance %.'
    },
    {
        type: EFFECT_TYPES.ACCURACY,
        label: 'Accuracy',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        categories: 'combatStyle',
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Percentage points taken off the hero\'s miss chance.'
    },
    {
        type: EFFECT_TYPES.DAMAGE,
        label: 'Damage',
        when: 'never',
        scales: 'value',
        /**
         * ⚠️ **The one combat axis with a percentage reader.**
         *
         * Every other combat row is `flat` only, because `query` sums flats and
         * silently skips the rest — offering a percentage there would offer
         * something discarded. `heroHitDamage` genuinely multiplies by a
         * percentage bucket, which is what makes a Well Fed style buff
         * (*"+10% damage for a while"*) expressible as an ordinary effect.
         */
        buckets: ['flat', 'percentage'],
        categories: 'combatStyle',
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Damage added to every hit the hero lands, flat or as a percentage. An enemy given it by a rule hits harder too (+100% hits double).'
    },
    {
        type: EFFECT_TYPES.DODGE,
        label: 'Dodge',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Percentage points added to the miss chance of whatever attacks the hero (misses stay between 5% and 40%).'
    },
    {
        type: EFFECT_TYPES.PIERCE,
        label: 'Pierce',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        retired: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Retired with damage types: does nothing. Use the Sunder status (a status effect that provides Sunder).'
    },
    {
        type: EFFECT_TYPES.CRIT_CHANCE,
        label: 'Crit Chance',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Percentage points added to the hero\'s 5% chance to crit (a crit doubles the hit).'
    },
    {
        /**
         * Percent points, in the flat bucket like Crit Chance: the loadout registers flats only.
         * The type or group is the rule's category; a group's row counts on each of its types
         * (`ModifierAggregator._isParentOf`).
         */
        type: EFFECT_TYPES.TYPE_DAMAGE,
        label: 'Type Damage %',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        categories: 'damageType',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Percent more damage on hits of one damage type or group: 15 means +15% (a Poisoner\'s Cloak: Poison 15). Pick which type.'
    },
    {
        type: EFFECT_TYPES.TYPE_RESIST,
        label: 'Type Resistance %',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        categories: 'damageType',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Percent off hits of one damage type or group taken: 20 means 20% less, a negative number a weakness. Pick which type. An enemy\'s plain swing is Physical.'
    },
    {
        /**
         * Points off every resistance the bearer has, in the flat bucket like Type Resistance %:
         * what the Sunder status provides, once per stack. A resistance is lowered to 0 at most; a
         * weakness is untouched (`CombatFormulas.afterSunder`).
         */
        type: EFFECT_TYPES.SUNDER,
        label: 'Sunder',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Points off every resistance the bearer has, never below 0 (a weakness stays as it is). Put it on a status: Sunder 10 stacking to 3 takes up to 30 off. Spears and some arrows land it.'
    },
    {
        /**
         * Read as a percentage off whoever carries it (`CombatFormulas` swing speeds), so it lives
         * on a lingering effect: an elixir's faster swings, a boss's enrage. Gear's flat-only
         * contributions do not carry it.
         */
        type: EFFECT_TYPES.SWING_TIME,
        label: 'Swing Time',
        when: 'never',
        scales: 'value',
        buckets: ['percentage'],
        categories: 'combatStyle',
        heroOnly: true,
        inverted: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'How long each swing takes. -25% swings a quarter sooner (a 3 s swing every 2.25 s). On a lingering effect: an elixir on a hero, or a rule putting it on an enemy.'
    },
    {
        // Read by `ConsumptionSystem` when a hero eats in a fight: Burn's half heal.
        type: EFFECT_TYPES.FOOD_HEALING,
        label: 'Food Healing',
        when: 'never',
        scales: 'value',
        buckets: ['percentage'],
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'How much a meal heals in a fight. -50% heals half, rounded halves up (Burn). On a lingering effect.'
    },

    // --- Protection ---------------------------------------------------------
    // `query('STATUS_IMMUNITY', statusId)` passes the status id as the aggregator's **category**.
    {
        type: EFFECT_TYPES.STATUS_IMMUNITY,
        label: 'Status Immunity',
        when: 'never',
        // ⚠️ No `scales`. Immunity is a switch, not a magnitude: the reader asks
        // `> 0`, so a scale of 3 would read exactly like a scale of 1 while
        // looking to the author as though it did something.
        buckets: ['flat'],
        heroOnly: true,
        categories: 'status',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Protection',
        hint: 'Blocks a status from landing. Pick which one. Any value above 0 blocks it; this never strips stacks already carried.'
    },
    {
        // Read by `LiveEffects` as a status lands, through `CombatFormulas.heroStatusStackCap`.
        type: EFFECT_TYPES.STATUS_MAX_STACKS,
        label: 'Status Stack Limit',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        categories: 'status',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Protection',
        hint: 'Moves how many stacks of one status can build up on the hero: -1 means at most 1 fewer (a Hide Vest against poison). Pick which status. At 0 stacks it cannot land; stacks already carried are never stripped.'
    },

    // --- Grants -------------------------------------------------------------
    {
        type: EFFECT_TYPES.BONUS_DROP,
        label: 'Bonus Drop',
        when: 'optional',
        scales: 'quantity',
        shape: MODIFIER_SHAPES.ITEM,
        group: 'Grants',
        hint: 'Chance to yield an extra, different item when the neighbour completes a cycle. Unlike Double Loot, this adds something the Token does not make itself.'
    },
    {
        type: EFFECT_TYPES.CONVERT,
        label: 'Convert',
        scales: 'amounts',
        shape: MODIFIER_SHAPES.CONVERT,
        group: 'Grants',
        when: 'required',
        hint: 'Consumes items from the Bank and produces others. Only meaningful in a triggered block — without a trigger it is just a production recipe.'
    }
];

/**
 * The numeric range a modifier's value may take, decided by its **shape**.
 *
 * ## Why this is here and not in the editor
 * A blanket 0–100 clamp would make a negative value impossible to type — and
 * negatives are the normal case for half this palette.
 * `WORK_TIME` and `INPUT_COST` carry `inverted: true` precisely because a
 * *reduction* is the buff: "−5% work time" is the effect an author wants most
 * often, and the three-bucket formula handles a negative percentage perfectly
 * well.
 *
 * A `proc` is the genuine exception: it resolves to a **chance**, and a
 * negative or above-100 chance is meaningless. So the clamp survives, but as a
 * property of the shape rather than a special case typed into the form. Adding
 * effect #40 needs no editor change: declare its shape and the right bounds
 * follow.
 *
 * `null` means unbounded on that side.
 *
 * @returns {{min: number|null, max: number|null}}
 */
/**
 * The buckets a row may be authored into.
 *
 * Most effects accept all three. A row that declares `buckets` accepts only
 * those — the combat axes do, because their reader sums flats and silently
 * skips everything else (see the note on that block).
 */
export function bucketsFor(entry) {
    return entry?.buckets || MODIFIER_BUCKETS;
}

export function modifierValueRange(entry) {
    if (entry?.shape === MODIFIER_SHAPES.PROC) return { min: 0, max: 100 };
    return { min: null, max: null };
}

/** A value pulled inside its shape's range. Non-numbers become 0. */
export function clampModifierValue(entry, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const { min, max } = modifierValueRange(entry);
    if (min !== null && n < min) return min;
    if (max !== null && n > max) return max;
    return n;
}

/**
 * Whether a signed value on this effect is a buff or a penalty, in words.
 *
 * The sign alone does not say: `+5%` on Yield is a gift and `+5%` on Work Time
 * is a punishment, because Work Time is milliseconds-per-cycle. `inverted` is
 * already in the palette for exactly this.
 *
 * Returns `null` when there is nothing to say (no value yet, or a shape whose
 * value is not a signed magnitude).
 *
 * @returns {{isBuff: boolean, text: string}|null}
 */
export function describeModifierDirection(entry, value, bucket = 'percentage') {
    if (!entry || entry.shape !== MODIFIER_SHAPES.DETERMINISTIC) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return null;

    const isBuff = entry.inverted ? n < 0 : n > 0;
    const magnitude = bucket === 'percentage'
        ? `${Math.abs(Math.round(n * 1000) / 10)}%`
        : `${Math.abs(n)}`;
    const direction = n < 0 ? 'less' : 'more';

    // An inverted axis stores a time or a cost, so its short name (Speed, Efficiency) would read
    // backwards beside the sign: it says what happens in its own words, as its rules text does.
    const said = entry.inverted && entry.reads
        ? (n < 0 ? entry.reads.down : entry.reads.up)(magnitude, magnitude)
        : `${magnitude} ${direction} ${entry.label.toLowerCase()}`;
    return { isBuff, text: `${said} — ${isBuff ? 'a buff' : 'a penalty'}.` };
}

/** Palette entry for an effect type, or null if it is not authorable. */
export function getPaletteEntry(type) {
    return MODIFIER_PALETTE.find(e => e.type === type) || null;
}

/**
 * Whether a `'combatStyle'` row's narrowing can match a fighter: none, every style (`combat`, `ALL`)
 * or one combat style. Anything else (a work skill) matches nobody.
 */
export function isCombatStyleScope(category) {
    if (!category || category === TARGET_CATEGORIES.ALL) return true;
    const id = String(category).toLowerCase();
    return id === TARGET_CATEGORIES.COMBAT || COMBAT_SKILL_IDS.includes(id);
}

/** Whether an effect type may be authored at all. */
export function isAuthorableModifier(type) {
    return MODIFIER_PALETTE.some(e => e.type === type);
}

/**
 * How a targeted buff may name its target.
 *
 * Chosen per Token rather than fixed once, because different buffs want
 * different precision — see `TileModifiers.matchesTokenTarget`.
 */
export const TARGET_MODES = [
    { mode: 'all', label: 'Every nearby Token', hint: 'No filter at all: every Token within reach of this one.' },
    { mode: 'tag', label: 'Tokens tagged', hint: 'Every Token carrying this tag — "all nearby Coast tokens".' },
    { mode: 'id', label: 'One exact Token', hint: 'One specific Token type — "Shrimp Beds only".' }
];
