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
    ITEM: 'item'
};

/** The buckets a deterministic modifier may push into. */
export const MODIFIER_BUCKETS = ['flat', 'multiplier', 'percentage'];

/**
 * @type {Array<{type: string, label: string, shape: string, group: string, hint: string, inverted?: boolean}>}
 */
export const MODIFIER_PALETTE = [
    // --- Production ---------------------------------------------------------
    {
        type: EFFECT_TYPES.YIELD,
        label: 'Yield',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        hint: 'Units of output produced per cycle.'
    },
    {
        type: EFFECT_TYPES.WORK_TIME,
        label: 'Work Time',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        inverted: true,
        hint: 'Milliseconds a cycle takes. NEGATIVE is faster.'
    },
    {
        type: EFFECT_TYPES.INPUT_COST,
        label: 'Input Cost',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Production',
        inverted: true,
        hint: 'Units of input consumed. NEGATIVE is cheaper.'
    },

    // --- Support ------------------------------------------------------------
    {
        type: EFFECT_TYPES.XP_BONUS,
        label: 'XP Bonus',
        shape: MODIFIER_SHAPES.DETERMINISTIC,
        group: 'Support',
        hint: 'XP awarded to the working hero per cycle.'
    },
    {
        type: EFFECT_TYPES.LOOT_MULT,
        label: 'Double Loot Chance',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'Percent chance the whole cycle yields double.'
    },
    {
        type: EFFECT_TYPES.FAIL_CHANCE,
        label: 'Failure Chance',
        shape: MODIFIER_SHAPES.PROC,
        group: 'Support',
        hint: 'Percent chance the cycle produces nothing. Inputs and charges are still spent.'
    },

    // --- Grants -------------------------------------------------------------
    {
        type: EFFECT_TYPES.BONUS_DROP,
        label: 'Bonus Drop',
        shape: MODIFIER_SHAPES.ITEM,
        group: 'Grants',
        hint: 'Chance to yield an extra, different item when the neighbour completes a cycle. Unlike Double Loot, this adds something the Token does not make itself.'
    }
];

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
    { mode: 'tag', label: 'By tag', hint: 'Every Token carrying this tag — "all adjacent seafood".' },
    { mode: 'id', label: 'By exact Token', hint: 'One specific Token type — "Shrimp Beds only".' },
    { mode: 'tokenType', label: 'By category', hint: 'A whole tokenType — "all adjacent resources".' }
];
