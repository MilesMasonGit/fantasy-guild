// Fantasy Guild — The authorable modifier palette (CMS rework Phase 4)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (CR2-010).
// `cms/src/utils/constants.js` re-exports nine names from here by relative
// path. The CMS is a separate app: it is not compiled by `npm run build`, it
// has no test suite of its own, and the reachability tool does not know it
// exists. So some of what is below has **no reader in the running game** and
// every dead-code tool will offer it up for deletion. As of 2026-08-26 the
// exports with no game-side consumer are `MODIFIER_BUCKETS`,
// `isAuthorableModifier` and `TARGET_MODES` (plus `RETIRED_TARGET_MODES`,
// which nothing reads anywhere — see the note at its declaration).
//
// Do not take a tool's word for it. `src/tests/CMSBoundary.test.js` scans the
// CMS for these imports and fails if a named export goes missing; that test is
// the guard, and this comment is only here to explain it when it fires.

import { EFFECT_TYPES } from '../../systems/effects/constants.js';

/**
 * Which effect axes content may be authored against, and in what shape.
 *
 * ## Why this is declared in the game (CMS-5)
 * `EFFECT_TYPES` is a bag of every axis the engine has ever had, including
 * several with **no consumer anywhere**. Offering that list in the CMS would
 * let an author build a Token whose effect silently does nothing — precisely
 * the old CMS's 56 placeholder Effects problem, which CMS-36 deleted outright.
 *
 * An axis appears here only once something reads it. Adding a consumer and
 * adding a row here should be the same commit.
 *
 * ## Two shapes (CMS-25)
 * * `deterministic` — `{ type, bucket, value }`, always applies, resolved
 *   through the three-bucket formula.
 * * `proc` — resolved through the same formula to produce a **percentage**,
 *   then rolled once per cycle. `constants.js` always described these as
 *   chances ("chance for double loot", "chance for failure"); giving them their
 *   own shape stops an author building a modifier that is ambiguous about which
 *   maths path resolves it.
 *
 * ## Deliberately absent
 * * **SPEED** — CMS-21 wanted it split into WORK_SPEED/COMBAT_SPEED, but the
 *   ambiguity it feared no longer exists: work rate is `WORK_TIME`, combat
 *   attack speed comes from `FormulaRegistry` and is not modifier-driven, and
 *   `SPEED`'s only reader is the retired card-era `StatProcessor`. Offering
 *   `WORK_TIME` and omitting `SPEED` achieves CMS-21's goal with no rename
 *   (CMS-94).
 * * **DAMAGE / DEFENSE / THORNS_REFLECT** — combat balancing is deferred as its
 *   own project (CMS-2).
 * * **HP_REGEN / STAT_BONUS** — named as wanted by CMS-20, but they belong to
 *   the hero rather than the tile and have no consumer yet. They join when one
 *   is built.
 * * **LOGIC_OVERRIDE** — arbitrary code triggers cannot be a form field
 *   (CMS-24); such Tokens get a notes field and a developer, not a dropdown.
 * * **BONUS_DROP / CHARGE_EXTEND / SELL_BONUS** — CMS-27's additions, which
 *   grant items, extend charges and change Market prices rather than scaling an
 *   axis. They arrive with their consumers in Phase 5.
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
     * consumer instead (`TileModifiers.collectItemGrants`). CMS-72 routes
     * item-granting through Modifiers rather than giving it its own block
     * section, which is why it is a shape here instead of a separate concept.
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
 * ## ⚠️ `when` — the legality flag, and why it is one-sided no longer
 *
 * `triggeredOnly` used to say "hide Convert until the block has a trigger". It
 * had no mirror image, so the editor happily offered **Yield** on a triggered
 * block — where `TileModifiers` skipped it for having a trigger and
 * `TriggerSystem` ignored it for not being an item grant. Authored, saved,
 * loaded, and read by nobody.
 *
 * Every entry now declares which side of that line it lives on:
 *
 * * `never`    — only meaningful while the effect applies continuously.
 * * `optional` — works ambiently *and* on an event.
 * * `required` — meaningless without a firing moment.
 *
 * The statement grammar reads this (`statements.js`), so an impossible
 * combination is not something the editor can be talked into.
 *
 * ## `scales` — what a reference's scale multiplies (Unified Effects UE-7)
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
 * ## `categories` — what a row's optional narrowing field picks from (P4)
 *
 * `ModifierAggregator` has always matched on `mod.target.category`, and two
 * different readers pass two different vocabularies into it:
 *
 * * `'skill'`  — `BoardRunner` passes the Token's `config.skill` on **every**
 *   `resolveAxis` call, so a rule can read *"+10% yield to Mining only"*.
 * * `'status'` — `StatusEffectSystem` passes a status id, which is how
 *   `STATUS_IMMUNITY` names the one status it blocks.
 *
 * Both were live and unwritable: the machinery matched a field no editor
 * offered. Declaring the vocabulary per row is what lets the CMS show a skill
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
 * both the sentence and `ContentAudit` say so. This was a hardcoded
 * `group === 'Combat'` check in three places until P4; `STATUS_IMMUNITY` has the
 * same property and is not combat, so the property is now declared rather than
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
        label: 'Work Time',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        inverted: true,
        hint: 'Milliseconds a cycle takes. NEGATIVE is faster.'
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
        hint: 'Units of input consumed. NEGATIVE is cheaper.'
    },

    // --- Support ------------------------------------------------------------
    {
        type: EFFECT_TYPES.XP_BONUS,
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
        label: 'Failure Chance',
        when: 'never',
        scales: 'value',
        categories: 'skill',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'Percent chance the cycle produces nothing. Inputs and charges are still spent.'
    },

    // --- Combat (Unified Effects P7) ----------------------------------------
    //
    // ⚠️ Every row here has a live reader in `CombatFormulas` or
    // `CombatAttackProcessor`, queried off `hero.aggregator`. They were readable
    // and unwritable for months (CR2-074): combat asked for them, the deleted
    // gear pipeline was the only thing that ever wrote them, and it wrote mostly
    // into axes nothing read. Content can feed them now.
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
        hint: 'Improves the chance an attack lands.'
    },
    {
        type: EFFECT_TYPES.BLOCK,
        label: 'Block Chance',
        when: 'never',
        scales: 'value',
        buckets: ['flat'],
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Percentage points of block chance. A blocked hit deals no damage.'
    },
    {
        type: EFFECT_TYPES.DAMAGE,
        label: 'Damage',
        when: 'never',
        scales: 'value',
        /**
         * ⚠️ **The one combat axis with a percentage reader** (V7).
         *
         * Every other combat row is `flat` only, because `query` sums flats and
         * silently skips the rest — offering a percentage there would offer
         * something discarded. `computeHeroDamage` genuinely multiplies by a
         * percentage bucket, which is what makes a Well Fed style buff
         * (*"+10% damage for a while"*) expressible as an ordinary effect.
         */
        buckets: ['flat', 'percentage'],
        heroOnly: true,
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Combat',
        hint: 'Flat damage added to every hit the hero lands.'
    },

    // --- Protection (Effects Robustness P4) ---------------------------------
    //
    // ⚠️ Readable and unwritable since the status engine was built:
    // `StatusEffectSystem.applyToHero` has always asked the hero's aggregator
    // whether they are immune, and nothing has ever been able to say yes.
    //
    // It needed no new grammar. `query('STATUS_IMMUNITY', statusId)` passes the
    // status id as the aggregator's **category**, which `_forEachMatching` has
    // matched on all along — so the whole gap was a missing field in the editor.
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
 * The CMS used to clamp every value to 0–100, which made a negative value
 * impossible to type — and negatives are the normal case for half this palette.
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
 * already in the palette for exactly this, but until now only the hint text
 * carried it, so authors had to remember which axis ran backwards.
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
 * How a targeted buff may name its target (CMS-18).
 *
 * Chosen per Token rather than fixed once, because different buffs want
 * different precision — see `TileModifiers.matchesTokenTarget`.
 */
export const TARGET_MODES = [
    { mode: 'all', label: 'Every adjacent Token', hint: 'No filter at all — everything on the 8 surrounding tiles.' },
    { mode: 'tag', label: 'Tokens tagged', hint: 'Every Token carrying this tag — "all adjacent Coast tokens".' },
    { mode: 'id', label: 'One exact Token', hint: 'One specific Token type — "Shrimp Beds only".' }
];

/**
 * ⚠️ **`by category` was retired from the editor** (owner decision, Q2).
 *
 * It aimed at `tokenType`, which is now *derived* from what a Token has rather
 * than chosen — so authoring against it would mean targeting a value the CMS
 * computed. Tags are explicit and the author controls them, which is the whole
 * reason the owner wanted them front and centre.
 *
 * ⚠️ **`all` is not the same reach.** The category filter meant "all adjacent
 * **resources**"; `all` means "all adjacent **Tokens**" — broader in one
 * direction, narrower in the other. Aiming at a *kind* of Token now means
 * tagging those Tokens. `matchesTokenTarget` still understands `tokenType` so
 * that nothing already authored changes behaviour; it is simply not offered.
 *
 * ⚠️ **Nothing imports this constant** — not the game, not the tests, not the
 * CMS (verified 2026-08-26, CR2-010). The retirement it records is real and
 * lives in `matchesTokenTarget`; this export is only a label for it. Left in
 * place rather than deleted because that is the owner's call, not a cleanup's,
 * but do not mistake it for machinery: unlike the rest of this file, deleting
 * it would break nothing.
 */
export const RETIRED_TARGET_MODES = ['tokenType'];
