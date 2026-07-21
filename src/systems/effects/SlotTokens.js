// Fantasy Guild - Stamped Slot Tokens (Card Mutators & Tokens, Phase 3)

import { getToken } from '../../config/registries/TokenRegistry.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from './constants.js';

/**
 * SlotTokens — the runtime-only registry of Tokens stamped onto deck slots.
 *
 * ## Why tokens live on SLOTS, not on cards (roadmap F1)
 * An upcoming card is not an object. `LoopRunner._materializeCard()` builds a
 * card instance at the moment its slot activates; before that a `deckSlots[i]`
 * entry is just a `templateId` and some counters. So a Mutator cannot stamp a
 * Token onto "the next Fishing card" — there is no such object yet. It stamps
 * onto the next Fishing **slot index**, and the Token is applied to the card
 * when that slot materializes. §15.5's "stamp immediately" rule still holds; it
 * just addresses slots.
 *
 * ## Why this is deliberately NOT in GameState (roadmap F3)
 * Same reasoning as its sibling `../loop/AreaModifiers.js`: this is derived,
 * short-lived runtime state with a hard reset boundary, so serializing it would
 * buy nothing and cost a `StateSchema` change plus save migration.
 *
 * Every Token is wiped at the Cycle boundary (§15.3 / §7 / F2) — the moment
 * `LoopRunner._advance()` wraps `activeCardIndex` back to 0. And §8 says
 * abandoning a Cycle mid-way resets the loop outright and respawns the Hero at
 * the Guild Hall. Between those two rules there is no path by which a Token
 * needs to survive a save: the longest a Token can possibly live is one Cycle,
 * and any interruption long enough to save through is an interruption that
 * clears it anyway. Saving mid-Cycle and reloading therefore starts the Cycle
 * clean, which is the intended behaviour, not a lossy shortcut.
 *
 * ## Instance vs definition
 * What gets stamped here is the small instance shape:
 *
 *     { tokenId, sourceCardId, charges }
 *
 * The effect payload (`flat` / `multiplier` / `percentage` across the yield /
 * time / cost axes) lives on the **definition** in `TokenRegistry.js` and is
 * looked up on read — never copied onto the instance. This is the same
 * reasoning as the Phase 2 derived tags: retuning a Token in the registry takes
 * effect immediately, everywhere, with no stale copies stranded on live slots.
 *
 * Stacking is by instance count. Five Abundance tokens on one slot are five
 * entries in the array, not one entry with a merged payload — which is what
 * lets Phase 9 condense them into a `×5` badge and still trace each one back to
 * the Mutator that stamped it.
 */

/**
 * Which `EFFECT_TYPES` entry each token effect axis feeds.
 *
 * These three types are new and, in Phase 3, **nothing reads them yet** — the
 * consumers land in Phase 5 (yield into loot generation, time into
 * `currentTickTime`, cost into `consumeInputs()`). They deliberately do NOT
 * reuse `SPEED`: `SPEED` is a work-*rate*, so a Token adding Work Time would be
 * read with its sign inverted and would silently make cards faster.
 *
 * @type {Record<string, string>}
 */
export const TOKEN_AXIS_EFFECT_TYPES = {
    yield: EFFECT_TYPES.YIELD,
    time: EFFECT_TYPES.WORK_TIME,
    cost: EFFECT_TYPES.INPUT_COST
};

/** The three §15.3 buckets, in the order they resolve. */
const BUCKET_KEYS = ['flat', 'multiplier', 'percentage'];

/** @type {Map<string, Map<number, Array<{tokenId: string, sourceCardId: ?string, charges: number}>>>} */
const stamped = new Map();

/** Prefix identifying a modifier that came from a stamped Token. */
export const TOKEN_MODIFIER_SOURCE_PREFIX = 'slot-token';

function areaBucket(areaId, create = false) {
    let byIndex = stamped.get(areaId);
    if (!byIndex && create) {
        byIndex = new Map();
        stamped.set(areaId, byIndex);
    }
    return byIndex || null;
}

/**
 * Stamp a Token instance onto a deck slot.
 *
 * Stacking is intentional: calling this twice with the same `tokenId` produces
 * two independent instances. There is no merge step.
 *
 * @param {string} areaId
 * @param {number} slotIndex
 * @param {{tokenId: string, sourceCardId?: string, charges?: number}} instance
 * @returns {?object} the stored instance, or null if the input was unusable
 */
export function attachToken(areaId, slotIndex, instance) {
    if (!areaId || !Number.isInteger(slotIndex) || slotIndex < 0) return null;
    if (!instance?.tokenId) return null;

    const stored = {
        tokenId: instance.tokenId,
        sourceCardId: instance.sourceCardId ?? null,
        // Charges are how many times this Token fires on this slot. Phase 3
        // stores the value; spending it is Phase 5's job.
        charges: Number.isFinite(instance.charges) ? instance.charges : 1
    };

    const byIndex = areaBucket(areaId, true);
    const list = byIndex.get(slotIndex);
    if (list) list.push(stored);
    else byIndex.set(slotIndex, [stored]);

    return stored;
}

/**
 * Every Token instance stamped on a slot, in stamping order.
 * Returns a copy — callers must not mutate the registry through it.
 *
 * @returns {Array<object>} empty array when the slot is unstamped
 */
export function getSlotTokens(areaId, slotIndex) {
    const list = areaBucket(areaId)?.get(slotIndex);
    return list ? list.slice() : [];
}

/**
 * A flat snapshot of every stamped slot in an area, for UI and tests.
 * @returns {Array<{slotIndex: number, tokens: Array<object>}>} sorted by slot
 */
export function getAreaTokens(areaId) {
    const byIndex = areaBucket(areaId);
    if (!byIndex) return [];
    return [...byIndex.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([slotIndex, tokens]) => ({ slotIndex, tokens: tokens.slice() }));
}

/** Total Token instances stamped in an area (stacks counted individually). */
export function countAreaTokens(areaId) {
    const byIndex = areaBucket(areaId);
    if (!byIndex) return 0;
    let n = 0;
    for (const list of byIndex.values()) n += list.length;
    return n;
}

/**
 * Remove every instance of a named Token from a slot — the §15.6 targeted
 * counter primitive (an Antidote naming Poison), never a generic cleanse.
 * @returns {number} how many instances were removed
 */
export function removeTokenFromSlot(areaId, slotIndex, tokenId) {
    const byIndex = areaBucket(areaId);
    const list = byIndex?.get(slotIndex);
    if (!list) return 0;

    const kept = list.filter(t => t.tokenId !== tokenId);
    const removed = list.length - kept.length;
    if (removed === 0) return 0;

    if (kept.length) byIndex.set(slotIndex, kept);
    else byIndex.delete(slotIndex);
    if (byIndex.size === 0) stamped.delete(areaId);
    return removed;
}

/** Drop every Token on one slot (e.g. the player unslots the card). */
export function clearSlotTokens(areaId, slotIndex) {
    const byIndex = areaBucket(areaId);
    if (!byIndex) return;
    byIndex.delete(slotIndex);
    if (byIndex.size === 0) stamped.delete(areaId);
}

/**
 * **The Cycle wipe (§15.3 / §7, boundary per F2).** Every Token in the area is
 * discarded, spent or not; surplus charges are never carried forward (§15.5).
 * Called from `LoopRunner._advance()` when `activeCardIndex` wraps to 0.
 */
export function clearAreaTokens(areaId) {
    stamped.delete(areaId);
}

/** Drop every Token everywhere (save load, area reset, test teardown). */
export function clearAllSlotTokens() {
    stamped.clear();
}

/**
 * Translate one Token definition into Unified Modifier Interface entries.
 *
 * The bucket a value lands in is stated explicitly rather than inferred, so
 * these never fall through `ModifierAggregator`'s legacy "bare value means a
 * percentage" path.
 *
 * @param {object} tokenDef - a `TOKENS` entry
 * @param {string} source - modifier source id, unique per instance
 * @param {object} [metadata]
 * @returns {Array<object>} UMI entries (possibly empty — combat-only tokens
 *                          carry no math axis at all, per §15.13)
 */
export function buildTokenModifiers(tokenDef, source, metadata = {}) {
    const modifiers = [];
    if (!tokenDef) return modifiers;

    for (const bucket of BUCKET_KEYS) {
        const payload = tokenDef[bucket];
        if (!payload) continue;

        for (const [axis, rawValue] of Object.entries(payload)) {
            const effectType = TOKEN_AXIS_EFFECT_TYPES[axis];
            if (!effectType) continue;
            const value = Number(rawValue);
            // A neutral contribution must be omitted, not pushed as 0 or 1 —
            // in buckets that SUM, a stray entry shifts the total (§15.3).
            if (!Number.isFinite(value) || value === 0) continue;

            modifiers.push({
                source,
                type: effectType,
                bucket,
                value,
                target: { category: TARGET_CATEGORIES.ALL },
                metadata
            });
        }
    }

    return modifiers;
}

/**
 * Apply a slot's stamped Tokens to the card that just materialized there.
 *
 * This is the F1 hand-off point: slot-addressed Tokens become real modifiers on
 * a live card's `ModifierAggregator`, each routed to its declared §15.3 bucket.
 * Must run BEFORE `recalculateCardStats()` so the modifiers are visible to the
 * stat pass rather than one card behind.
 *
 * Each instance gets its own `source` id, so five stacked tokens are five
 * traceable sources — which is what Phase 9's `+2 Yield from 'Trawler'` tooltip
 * needs, and what stops `removeModifiersBySource` taking out a whole stack.
 *
 * @param {object} card - the freshly materialized card (must have `.aggregator`)
 * @param {string} areaId
 * @param {number} slotIndex
 * @returns {number} how many modifiers were added
 */
export function applySlotTokensToCard(card, areaId, slotIndex) {
    if (!card?.aggregator) return 0;

    const instances = areaBucket(areaId)?.get(slotIndex);
    if (!instances?.length) return 0;

    let added = 0;
    instances.forEach((instance, i) => {
        // Definition looked up now, never copied onto the instance — a registry
        // retune takes effect immediately (same reasoning as Phase 2's tags).
        const tokenDef = getToken(instance.tokenId);
        if (!tokenDef) return;

        const source = `${TOKEN_MODIFIER_SOURCE_PREFIX}:${areaId}:${slotIndex}:${i}:${instance.tokenId}`;
        const modifiers = buildTokenModifiers(tokenDef, source, {
            tokenId: instance.tokenId,
            sourceCardId: instance.sourceCardId,
            slotIndex
        });

        for (const umi of modifiers) {
            card.aggregator.addModifier(umi);
            added++;
        }
    });

    return added;
}
