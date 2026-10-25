// Fantasy Guild — The authorable modifier palette
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY. `cms/src/utils/constants.js`
// re-exports ten names from here by relative path. The CMS is a separate app that `npm run
// build` does not compile, so some exports (`MODIFIER_BUCKETS`, `isAuthorableModifier`) have no
// reader in the running game and must not be deleted as dead code. `src/tests/CMSBoundary.test.js`
// scans the CMS for these imports and fails if a named export goes missing.

import { EFFECT_TYPES } from '../../systems/effects/constants.js';

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
 *
 * Declaring the vocabulary per row is what lets the CMS show a skill
 * picker on Yield and a status picker on Immunity without knowing either list.
 *
 * A row without `categories` offers no narrowing at all, which is right for the
 * combat axes — their readers call `query('ARMOR')` with no category, so
 * anything but ALL would be registered and never matched.
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
        label: 'Work Time',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        inverted: true,
        hint: 'How long a cycle takes. A negative value is faster.'
    },
    {
        type: EFFECT_TYPES.INPUT_COST,
        label: 'Input Cost',
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
        label: 'Grow Time',
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
        reads: { up: (n) => `hold ${n} more harvests when ripe`, down: (n) => `hold ${n} fewer harvests when ripe` },
        label: 'Crop Load',
        when: 'never',
        scales: 'value',
        buckets: ['flat', 'percentage'],
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        hint: 'How many harvests a Field holds when its crop ripens (a Composter adds to the load). Read as the crop ripens; never fewer than one.'
    },

    // --- Support ------------------------------------------------------------
    {
        type: EFFECT_TYPES.XP_BONUS,
        reads: { up: (n) => `award ${n} more XP`, down: (n) => `award ${n} less XP` },
        label: 'XP Bonus',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Support',
        hint: 'XP awarded to the working hero per cycle.'
    },
    {
        type: EFFECT_TYPES.LOOT_MULT,
        reads: {
            up: (n) => `have a ${n} chance of double loot`,
            down: (n) => `have ${n} less chance of double loot`
        },
        label: 'Double Loot Chance',
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
        label: 'Double Item Chance',
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
    // ⚠️ Every row here has a live reader in `CombatFormulas` or
    // `CombatAttackProcessor`, queried off `hero.aggregator`.
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
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Flat damage subtracted from every hit the hero takes.'
    },
    {
        type: EFFECT_TYPES.RESIST_FLAT,
        label: 'Resistance',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Further flat damage subtracted, after Armor.'
    },
    {
        type: EFFECT_TYPES.ACCURACY,
        label: 'Accuracy',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
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
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Armour points the hero\'s hits ignore. A hit still does at least 1.'
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
        hint: 'Percentage points added to the hero\'s 5% chance to crit (a crit doubles the hit before armour).'
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

    return {
        isBuff,
        text: `${magnitude} ${direction} ${entry.label.toLowerCase()} — ${isBuff ? 'a buff' : 'a penalty'}.`
    };
}

/** Palette entry for an effect type, or null if it is not authorable. */
export function getPaletteEntry(type) {
    return MODIFIER_PALETTE.find(e => e.type === type) || null;
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

/**
 * ⚠️ **`by category` was retired from the editor.**
 *
 * It aimed at `tokenType`, which is now *derived* from what a Token has rather
 * than chosen — so authoring against it would mean targeting a value the CMS
 * computed. Tags are explicit and the author controls them, which is the whole
 * reason the owner wanted them front and centre.
 *
 * ⚠️ **`all` is not the same reach.** The category filter meant "all nearby
 * **resources**"; `all` means "all nearby **Tokens**" — broader in one
 * direction, narrower in the other. Aiming at a *kind* of Token now means
 * tagging those Tokens. `matchesTokenTarget` still understands `tokenType` so
 * that nothing already authored changes behaviour; it is simply not offered.
 *
 * ⚠️ **Nothing imports this constant.** The retirement it records lives in `matchesTokenTarget`; this export is only a label for it. Do not mistake it for machinery: deleting it would break nothing.
 */
export const RETIRED_TARGET_MODES = ['tokenType'];
