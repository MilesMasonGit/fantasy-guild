// Fantasy Guild — the charges engine (Recipe & Charges rework, P1)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType, tokenName, tokenStartingUses, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
import { neighboursOf, neighboursOfFootprint } from './adjacency.js';
import * as BoardState from './BoardState.js';

/**
 * Charges — the one place a Token's charge pool is read, moved, or spent.
 *
 * Before this file the same eight lines ("decrement, publish, destroy at zero")
 * were written out four times — `BoardRunner`, `RecipeResolver`,
 * `TriggerSystem` and `BoardCombat` each carried a copy. Three axes now spend
 * against that pool (R-8: a station's operational cost, a recipe's context-token
 * cost, and an effect block's own delta), so the arithmetic is here once.
 *
 * ## The live pool is `usesRemaining`, and its ceiling is `def.uses`
 * `def.charges` also exists on authored Tokens and is **not** the pool — the two
 * fields disagree on 35 of the 39 authored Tokens (`tokenRegistry.js` documents
 * this at `tokenStartingUses`). Reading the wrong one produces plausible
 * numbers rather than an obvious failure, which is why nothing here reads
 * `charges` and everything goes through `tokenStartingUses`.
 *
 * ## `usesRemaining === null` is unlimited, and it is not zero (R-4, D-176)
 * An unlimited Token ignores charge deltas **in both directions**: a cost is
 * free and a restore is a no-op. `applyDelta` returns early on it before doing
 * any arithmetic, and `canAfford` answers true for any amount. Every function
 * here checks `== null` first.
 *
 * ## Nothing partial
 * A caller plans the whole set of debits, verifies it, and only then commits it
 * (`planCycle` → `commitPlan`). A plan that cannot be paid in full deducts
 * nothing at all — not one item, not one charge, from any tile. That is the
 * rule the concept calls the atomic requirement check (§3.3), and it is why
 * planning and committing are two functions rather than one.
 */

/**
 * What a station spends per cycle when its recipe does not say.
 *
 * 1, because `BoardRunner` hardcoded a decrement of 1 per completed cycle
 * before this phase, and a Token running no recipe at all still has to wear at
 * the rate it always did.
 */
export const DEFAULT_STATION_CHARGE_COST = 1;

/**
 * What a triggered statement spends when it does not author a `chargeDelta`.
 *
 * -1, for the same continuity reason as `DEFAULT_STATION_CHARGE_COST`:
 * `TriggerSystem` spent exactly one charge per firing before this phase (the
 * "charge burns on service, not on luck" rule, CMS-26), and every statement
 * authored so far predates the field. An author who wants a free effect writes
 * `chargeDelta: 0`; the absence of the field is not that.
 */
export const DEFAULT_STATEMENT_CHARGE_DELTA = -1;

/** Whether a Token instance's charges are unlimited (R-4, D-176). */
export function isUnlimited(instance) {
    return instance?.usesRemaining == null;
}

/**
 * The ceiling a `+charges` effect may restore this Token to.
 *
 * The Token type's authored starting charges. `null` when the type authors none
 * — in that case a restore has no known ceiling to aim at, and `applyDelta`
 * treats the instance's current value as the ceiling rather than guessing, so a
 * positive delta is a no-op instead of an unbounded grant.
 */
export function maxChargesOf(instance) {
    return instance?.typeId ? tokenStartingUses(instance.typeId) : null;
}

/** Whether this Token can pay `amount` charges. Unlimited pays anything (R-4). */
export function canAfford(instance, amount) {
    if (!instance) return false;
    if (amount <= 0) return true;
    if (isUnlimited(instance)) return true;
    return instance.usesRemaining >= amount;
}

/** The charge delta a statement applies when it fires. */
export function statementChargeDelta(statement) {
    const authored = statement?.chargeDelta;
    return typeof authored === 'number' ? authored : DEFAULT_STATEMENT_CHARGE_DELTA;
}

/**
 * Whether a statement's own charge cost is payable right now (concept §3.2).
 *
 * A negative delta gates the effect: it cannot fire at all when the Token holds
 * fewer charges than it costs. Zero and positive deltas never gate.
 */
export function canFireStatement(instance, statement) {
    const delta = statementChargeDelta(statement);
    return delta >= 0 || canAfford(instance, -delta);
}

/**
 * Remove a depleted Token from the board.
 *
 * **Token depletion is the only wear mechanic in the game** (D-118). The tile
 * empties and any hero standing on it stays there, idle, until the player
 * returns or a Manager restocks underneath them (D-60, D-151) — the hero is not
 * touched here, only re-announced so the UI redraws them on a bare tile.
 *
 * The vacancy is set AFTER `setToken(null)`, which clears vacancies, so that a
 * type-specific Manager knows what this tile is owed (D-35).
 */
export function destroyToken(tile, instance, { heroId = null } = {}) {
    const typeId = instance?.typeId || null;
    const name = getTokenType(typeId)?.name || tokenName(typeId) || typeId || 'Token';

    BoardState.setToken(tile, null);
    if (typeId) BoardState.setVacancy(tile, typeId);

    EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
        tile,
        severity: 'red',
        type: 'token_exhausted',
        name,
        message: `Token Exhausted: ${name}`
    });
    EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile, typeId });
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile, typeId: null });
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile, heroId });
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile });
}

/**
 * Move a Token's charge pool by `delta` and destroy it if that empties it.
 *
 * - **Negative** spends, floored at 0. Callers gate first (`canAfford`); the
 *   floor is there so a mis-gated caller cannot drive a pool negative.
 * - **Positive** restores, ceilinged at `maxChargesOf` (concept §3.2). It can
 *   never exceed the Token type's starting charges, so a `+3` on a Token one
 *   charge below full grants one.
 * - **Zero**, and anything on an unlimited Token, changes nothing and publishes
 *   nothing (R-4).
 *
 * @returns {{applied: number, remaining: number|null, depleted: boolean}}
 *          `applied` is what actually moved, which is not always `delta`.
 */
export function applyDelta(tile, instance, delta, { heroId = null } = {}) {
    if (!instance || isUnlimited(instance)) {
        return { applied: 0, remaining: instance?.usesRemaining ?? null, depleted: false };
    }

    let applied = 0;
    if (delta > 0) {
        const ceiling = maxChargesOf(instance);
        const cap = ceiling == null ? instance.usesRemaining : ceiling;
        applied = Math.max(0, Math.min(delta, cap - instance.usesRemaining));
    } else if (delta < 0) {
        applied = -Math.min(-delta, instance.usesRemaining);
    }

    if (applied === 0) {
        return { applied: 0, remaining: instance.usesRemaining, depleted: false };
    }

    instance.usesRemaining += applied;
    EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
        tile,
        delta: applied,
        remaining: instance.usesRemaining,
        typeId: instance.typeId
    });

    if (instance.usesRemaining <= 0) {
        destroyToken(tile, instance, { heroId });
        return { applied, remaining: instance.usesRemaining, depleted: true };
    }

    return { applied, remaining: instance.usesRemaining, depleted: false };
}

/**
 * Every distinct Token on a tile's perimeter, with the context tags it offers.
 *
 * Anchor-deduplicated, so a 2×2 Token touching four of a station's neighbour
 * squares is one provider and pays one cost, not four.
 */
export function contextProvidersAround(index) {
    const occ = BoardState.getOccupyingToken(index);
    const neighbours = occ && occ.footprint.length > 1
        ? neighboursOfFootprint(occ.footprint)
        : neighboursOf(index);

    const providers = [];
    const seenAnchors = new Set();

    for (const neighbour of neighbours) {
        const nOcc = BoardState.getOccupyingToken(neighbour);
        if (!nOcc?.instance) continue;
        if (seenAnchors.has(nOcc.anchorIndex)) continue;
        seenAnchors.add(nOcc.anchorIndex);

        const def = getTokenType(nOcc.instance.typeId);
        if (!def) continue;
        const tiers = getProvidedTagsWithTiers(def);
        if (!Object.keys(tiers).length) continue;

        providers.push({ tile: nOcc.anchorIndex, instance: nOcc.instance, tiers });
    }
    return providers;
}

/**
 * Which adjacent Tokens would pay a recipe's context charge costs, and how much
 * each would pay — without touching anything.
 *
 * ## Lowest remaining first (concept §3.3)
 * When several adjacent Tokens satisfy the same requirement, the one with the
 * fewest charges left pays first, so near-depleted tiles clear rather than
 * every provider sitting at a fraction forever. A cost larger than any single
 * provider holds spreads across them in that same order.
 *
 * ## Unlimited providers pay nothing (R-4)
 * An unlimited Token adjacent to the station satisfies the requirement for
 * free, and no finite neighbour is charged for it either — there is no reason
 * to wear a Token down when something beside it supplies the same tag forever.
 *
 * @returns {{ok: boolean, debits: Array<{tile, instance, amount}>, missing: Array<{tag, reason, short?: number}>}}
 */
export function planContextCharges(index, requirements) {
    const providers = contextProvidersAround(index);
    const planned = new Map();          // tile → charges this plan already claims
    const debits = [];
    const missing = [];

    const claimed = tile => planned.get(tile) || 0;

    for (const req of requirements || []) {
        if (!req?.tag) continue;
        const minTier = req.minTier || 1;
        const cost = req.chargeCost || 0;

        const eligible = providers.filter(p => (p.tiers[req.tag] || 0) >= minTier);
        if (!eligible.length) {
            missing.push({ tag: req.tag, reason: 'absent' });
            continue;
        }
        if (cost <= 0) continue;
        if (eligible.some(p => isUnlimited(p.instance))) continue;

        const byScarcity = [...eligible].sort(
            (a, b) => (a.instance.usesRemaining - claimed(a.tile)) - (b.instance.usesRemaining - claimed(b.tile))
        );

        let owed = cost;
        for (const provider of byScarcity) {
            const free = provider.instance.usesRemaining - claimed(provider.tile);
            if (free <= 0) continue;
            const take = Math.min(free, owed);
            planned.set(provider.tile, claimed(provider.tile) + take);
            owed -= take;
            if (owed === 0) break;
        }

        if (owed > 0) missing.push({ tag: req.tag, reason: 'charges', short: owed });
    }

    for (const [tile, amount] of planned) {
        const provider = providers.find(p => p.tile === tile);
        debits.push({ tile, instance: provider.instance, amount });
    }

    return { ok: missing.length === 0, debits, missing };
}

/**
 * Everything one craft cycle would spend out of charge pools: the station's own
 * operational cost (concept §3.1.1) and its recipe's context-token costs
 * (§3.1.2). **Two separate axes that both apply** (R-8).
 *
 * Nothing is deducted here. `commitPlan` does that, and only ever on a plan
 * whose `ok` is true.
 *
 * @param {object} io the resolved recipe/IO from `RecipeResolver.effectiveIO`
 */
export function planCycle(index, instance, io) {
    const stationCost = io?.recipe?.stationChargeCost ?? DEFAULT_STATION_CHARGE_COST;
    const context = planContextCharges(index, io?.recipe?.requiresContext);

    const debits = [...context.debits];
    const missing = [...context.missing];

    if (stationCost > 0 && !isUnlimited(instance)) {
        if (instance.usesRemaining < stationCost) {
            missing.push({ reason: 'station', short: stationCost - instance.usesRemaining });
        } else {
            debits.push({ tile: index, instance, amount: stationCost, isStation: true });
        }
    }

    return { ok: missing.length === 0, debits, missing };
}

/**
 * Spend a plan. Every debit, or none — the caller has already established that
 * the whole cycle is affordable, including its bank items.
 *
 * @returns {number[]} the tiles whose Token depleted and was removed
 */
export function commitPlan(plan, { heroId = null } = {}) {
    if (!plan?.ok) return [];
    const depleted = [];
    for (const debit of plan.debits) {
        const result = applyDelta(debit.tile, debit.instance, -debit.amount, {
            heroId: debit.isStation ? heroId : null
        });
        if (result.depleted) depleted.push(debit.tile);
    }
    return depleted;
}
