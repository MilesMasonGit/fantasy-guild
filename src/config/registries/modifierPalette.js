// Fantasy Guild — The authorable modifier palette (CMS rework Phase 4)

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
 * @type {Array<{type: string, label: string, shape: string, group: string, hint: string, inverted?: boolean, when: string}>}
 */
export const MODIFIER_PALETTE = [
    // --- Production ---------------------------------------------------------
    {
        type: EFFECT_TYPES.YIELD,
        label: 'Yield',
        when: 'never',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        hint: 'Units of output produced per cycle.'
    },
    {
        type: EFFECT_TYPES.WORK_TIME,
        label: 'Work Time',
        when: 'never',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        inverted: true,
        hint: 'Milliseconds a cycle takes. NEGATIVE is faster.'
    },
    {
        type: EFFECT_TYPES.INPUT_COST,
        label: 'Input Cost',
        when: 'never',
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
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Support',
        hint: 'XP awarded to the working hero per cycle.'
    },
    {
        type: EFFECT_TYPES.LOOT_MULT,
        label: 'Double Loot Chance',
        when: 'never',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'Percent chance the whole cycle yields double.'
    },
    {
        type: EFFECT_TYPES.FAIL_CHANCE,
        label: 'Failure Chance',
        when: 'never',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'Percent chance the cycle produces nothing. Inputs and charges are still spent.'
    },

    // --- Grants -------------------------------------------------------------
    {
        type: EFFECT_TYPES.BONUS_DROP,
        label: 'Bonus Drop',
        when: 'optional',
        shape: MODIFIER_SHAPES.ITEM,
        group: 'Grants',
        hint: 'Chance to yield an extra, different item when the neighbour completes a cycle. Unlike Double Loot, this adds something the Token does not make itself.'
    },
    {
        type: EFFECT_TYPES.CONVERT,
        label: 'Convert',
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
 */
export const RETIRED_TARGET_MODES = ['tokenType'];
