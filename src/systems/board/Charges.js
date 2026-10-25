// the charges engine

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType, tokenName, tokenStartingUses, getProvidedTagsWithTiers, neverWearsOutType } from '../../config/registries/tokenRegistry.js';
import { neighbourIds } from './nearby.js';
import { contextRequirementsOf } from '../../config/registries/recipePoolRegistry.js';
import { DEFAULT_STATEMENT_CHARGE_DELTA, statementsOf } from '../effects/statements.js';
import {
    CHARGE_MOMENT, chargeDeltaOf,
} from '../../config/registries/chargeMomentRegistry.js';
import * as BoardState from './BoardState.js';
import * as Hand from './Hand.js';
import * as Respawn from './Respawn.js';

/**
 * The one place a Token's charge pool is read, moved, or spent. Two axes spend against that pool:
 * a Token's own operational cost per cycle and an effect block's own delta. Nothing near a Token
 * pays for its work: help is free (`planContextCharges`).
 *
 * The live pool is `usesRemaining`, and its ceiling is `def.uses`. Everything goes through
 * `tokenStartingUses`; nothing here reads a `def.charges` field, which is not the pool (reading the
 * wrong one produces plausible numbers rather than an obvious failure).
 *
 * `usesRemaining === null` is unlimited, and it is not zero. An unlimited Token ignores charge
 * deltas in both directions: a cost is free and a restore is a no-op. `applyDelta` returns early on
 * it and `canAfford` answers true for any amount. Every function here checks `== null` first.
 *
 * Nothing partial: a caller plans the whole set of debits, verifies it, and only then commits it
 * (`planCycle` → `commitPlan`). A plan that cannot be paid in full deducts nothing, from any tile;
 * that is why planning and committing are two functions.
 */

/** What a station spends per cycle when its recipe does not say. */
export const DEFAULT_STATION_CHARGE_COST = 1;

/**
 * What a triggered statement spends when it does not author a `chargeDelta`: -1, one charge per
 * firing (a charge burns on service, not on luck). An author who wants a free effect writes
 * `chargeDelta: 0`; the absence of the field is not that.
 *
 * Declared in `statements.js` and re-exported here: the CMS's authoring control needs the same
 * number and reads the statement grammar, not the board runtime.
 */
export { DEFAULT_STATEMENT_CHARGE_DELTA };

/**
 * Whether a Token instance's charges are unlimited: it holds none, or its type never wears out (a
 * station or a support, `wearRule.js`), whatever number a copy saved before that rule still holds.
 */
export function isUnlimited(instance) {
    if (instance?.usesRemaining == null) return true;
    return instance.typeId != null && neverWearsOutType(instance.typeId);
}

/**
 * Clear the charges a saved copy of a never-wearing type still holds, so it reads as unlimited
 * everywhere (its charge ring, its card). Called as a board comes in (`BoardRunner`); the engine
 * already treats such a copy as unlimited ({@link isUnlimited}).
 *
 * @returns {string[]} the instance ids cleared
 */
export function clearNeverWearingCharges() {
    const cleared = [];
    for (const instance of BoardState.tokens()) {
        if (instance.usesRemaining == null || !neverWearsOutType(instance.typeId)) continue;
        instance.usesRemaining = null;
        cleared.push(instance.id);
        EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
            instanceId: instance.id, delta: 0, remaining: null, typeId: instance.typeId
        });
    }
    return cleared;
}

/**
 * The ceiling a `+charges` effect may restore this Token to: the Token type's authored starting
 * charges. `null` when the type authors none; then `applyDelta` treats the instance's current value
 * as the ceiling rather than guessing, so a positive delta is a no-op instead of an unbounded
 * grant.
 */
export function maxChargesOf(instance) {
    return instance?.typeId ? tokenStartingUses(instance.typeId) : null;
}

/** Whether this Token can pay `amount` charges. Unlimited pays anything. */
export function canAfford(instance, amount) {
    if (!instance) return false;
    if (amount <= 0) return true;
    if (isUnlimited(instance)) return true;
    return instance.usesRemaining >= amount;
}

/**
 * The charge delta a statement applies at its moment.
 *
 * ⚠️ An absent `chargeDelta` does not mean one thing: it means -1 for a rule that fires and 0 for a
 * rule that does not, because those are what the two kinds of rule have always cost (see
 * `DEFAULT_CHARGE_DELTA_BY_MOMENT`). A single default in either direction would silently re-cost
 * authored content.
 *
 * An authored number always wins, `0` included.
 */
export function statementChargeDelta(statement) {
    // One reading, shared with the CMS cost strip: see `chargeDeltaOf`, which also carries the
    // Promotes exception.
    return chargeDeltaOf(statement, DEFAULT_STATEMENT_CHARGE_DELTA);
}

/**
 * What this Token's own rules cost it per completed cycle.
 *
 * Only rules that name the per-cycle moment, and only ever a cost: a positive delta is a restore,
 * and a rule that hands its Token charges back every cycle is a perpetual-motion machine rather
 * than an effect. Restores stay on a firing, where something had to happen first.
 *
 * @returns {number} charges per cycle, 0 or more
 */
export function statementCycleCost(def) {
    let cost = 0;
    for (const statement of statementsOf(def)) {
        // ⚠️ The moment must be AUTHORED, not inferred, to cost anything. An ambient `Grants` (no
        // `When` clause) can carry a dormant `chargeDelta: -1` that nothing ever spends, because
        // the only reader of that number is `TriggerSystem.fireStatement`. Inferring per-cycle from
        // the absence of a `When` clause would turn that dormant -1 into a live cost. So a
        // per-cycle cost is opt-in: the author picks the moment, the editor writes `chargeWhen`
        // beside the number, and content that predates the field costs nothing.
        if (statement?.chargeWhen !== CHARGE_MOMENT.PER_CYCLE) continue;
        const delta = statementChargeDelta(statement);
        if (delta < 0) cost += -delta;
    }
    return cost;
}

/**
 * Whether a statement's own charge cost is payable right now. A negative delta gates the effect: it
 * cannot fire at all when the Token holds fewer charges than it costs. Zero and positive deltas
 * never gate.
 */
export function canFireStatement(instance, statement) {
    const delta = statementChargeDelta(statement);
    return delta >= 0 || canAfford(instance, -delta);
}

/**
 * Remove a depleted Token from the board, unless its type respawns: then it rests where it stands
 * (`Respawn.js`).
 *
 * Token depletion is the only wear mechanic. The tile empties; the hero is not touched here, only
 * re-announced, and their flag chooses again on its next pass. Every event names the Token by
 * `instanceId` and, because it has just left the mat, by the point `x`, `y` it stood on.
 */
export function destroyToken(instance, { heroId = null, exhaustedBy = heroId } = {}) {
    // A Token type that respawns rests where it stands instead, in the player's hand too, and is
    // never depleted.
    if (Respawn.restInstead(instance, { heroId, exhaustedBy })) return;

    // In the player's hand it stays, empty, until it is put down, and goes from where it lands.
    // Skipped then if something took it off the mat or refilled it meanwhile.
    if (instance?.id != null && Hand.isInHand(instance.id)) {
        Hand.whenPutDown(instance.id, () => {
            const still = BoardState.getTokenById(instance.id);
            if (still && !isUnlimited(still) && still.usesRemaining <= 0) destroyToken(still, { heroId, exhaustedBy });
        });
        return;
    }

    const typeId = instance?.typeId || null;
    const name = getTokenType(typeId)?.name || tokenName(typeId) || typeId || 'Token';
    const instanceId = instance?.id ?? null;

    // The spot the spent Token stood on, read before removing.
    const spent = BoardState.getTokenById(instanceId);
    const spot = spent ? { x: spent.x, y: spent.y } : null;
    const at = spot || (Number.isFinite(instance?.x) && Number.isFinite(instance?.y) ? { x: instance.x, y: instance.y } : {});

    if (spent) BoardState.removeToken(spent.id);

    EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
        instanceId,
        ...at,
        severity: 'red',
        type: 'token_exhausted',
        name,
        message: `Token Exhausted: ${name}`
    });
    // ⚠️ The instance rides along, and it has to: the Token is already off the mat, so a
    // self-scoped reaction to this moment (`SELF_TOKEN_DEPLETED`) could not otherwise find the
    // Token that is reacting. `heroId` is whoever spent the last charge, when a hero did.
    EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId, ...at, typeId, instance, heroId, exhaustedBy });
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId, ...at, typeId: null });
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, ...at });
    // `points`: rebuild around the spot the Token left.
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: spot ? [spot] : [] });
}

/**
 * Move a Token's charge pool by `delta` and destroy it if that empties it.
 * - Negative spends, floored at 0. Callers gate first (`canAfford`); the floor is there so a
 * mis-gated caller cannot drive a pool negative.
 * - Positive restores, ceilinged at `maxChargesOf`: it can never exceed the Token type's starting
 * charges, so a `+3` on a Token one charge below full grants one.
 * - Zero, and anything on an unlimited Token, changes nothing and publishes nothing.
 *
 * @returns {{applied: number, remaining: number|null, depleted: boolean}}
 *          `applied` is what actually moved, which is not always `delta`.
 */
export function applyDelta(instance, delta, { heroId = null } = {}) {
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
        instanceId: instance.id,
        delta: applied,
        remaining: instance.usesRemaining,
        typeId: instance.typeId
    });

    if (instance.usesRemaining <= 0) {
        destroyToken(instance, { heroId });
        return { applied, remaining: instance.usesRemaining, depleted: true };
    }

    return { applied, remaining: instance.usesRemaining, depleted: false };
}

/**
 * Every distinct Token near a Token, with the context tags it offers, as `{ id, instance, tiers }`
 * in arrival order. Near is centre to centre, by instance id (the cached `neighbourIds`), so a 2×2
 * Token is one provider.
 */
export function contextProvidersAround(instanceId) {
    const providers = [];

    for (const id of neighbourIds(instanceId)) {
        const instance = BoardState.getTokenById(id);
        if (!instance) continue;

        const def = getTokenType(instance.typeId);
        if (!def) continue;
        const tiers = getProvidedTagsWithTiers(def);
        if (!Object.keys(tiers).length) continue;

        providers.push({ id, instance, tiers });
    }
    return providers;
}

/**
 * Whether the Tokens near a Token offer every context tag a recipe asks for, at its tier: the
 * context half of a cycle's plan, as `{ ok, debits, missing }`.
 *
 * ⚠️ No context Token ever pays for a recipe: help is free (owner, 2026-10-24). A support never
 * wears out (`wearRule.js`), and a gathering node that also offers a tag spends its charges only on
 * its own gathering. So `debits` is always empty and a requirement's authored `chargeCost` is not
 * read; only an absent tag is `missing`.
 *
 * @returns {{ok: boolean, debits: [], missing: Array<{tag: string, reason: 'absent'}>}}
 */
export function planContextCharges(instanceId, requirements) {
    const providers = contextProvidersAround(instanceId);
    const missing = [];
    // Normalised through the one reader, so a bare-string entry (what the CMS
    // writes before a tier is picked) is a tier-1 tag rather than skipped.
    for (const req of contextRequirementsOf({ requiresContext: requirements })) {
        if (!providers.some(p => (p.tiers[req.tag] || 0) >= req.minTier)) {
            missing.push({ tag: req.tag, reason: 'absent' });
        }
    }
    return { ok: missing.length === 0, debits: [], missing };
}

/**
 * Everything one craft cycle would spend out of charge pools: the station's own operational cost
 * and its recipe's context-token costs. Two separate axes that both apply.
 *
 * Nothing is deducted here. `commitPlan` does that, and only ever on a plan whose `ok` is true.
 *
 * @param {object} io the resolved recipe/IO from `RecipeResolver.effectiveIO`
 */
export function planCycle(instanceId, instance, io) {
    const stationCost = io?.recipe?.stationChargeCost ?? DEFAULT_STATION_CHARGE_COST;
    const context = planContextCharges(instanceId, io?.recipe?.requiresContext);

    const debits = [...context.debits];
    const missing = [...context.missing];

    /**
     * The Token's own per-cycle spend: what it costs to run, plus what its own rules charge it for
     * being on.
     *
     * Summed into ONE debit rather than pushed as a second, because both come out of the same pool
     * on the same tile: two debits would publish two charge-changed events for one cycle and could
     * half-pay if the pool ran out between them. It also means the atomic requirement check covers
     * the rules for free: a Token that cannot afford its own aura this cycle does not run a cycle
     * at all and deducts nothing.
     */
    const ownCost = stationCost + statementCycleCost(getTokenType(instance?.typeId));

    if (ownCost > 0 && !isUnlimited(instance)) {
        if (instance.usesRemaining < ownCost) {
            missing.push({ reason: 'station', short: ownCost - instance.usesRemaining });
        } else {
            debits.push({ id: instanceId, instance, amount: ownCost, isStation: true });
        }
    }

    return { ok: missing.length === 0, debits, missing };
}

/**
 * Spend a plan. Every debit, or none — the caller has already established that
 * the whole cycle is affordable, including its bank items.
 *
 * @returns {string[]} the instance ids of the Tokens that depleted and were removed
 */
export function commitPlan(plan, { heroId = null } = {}) {
    if (!plan?.ok) return [];
    const depleted = [];
    for (const debit of plan.debits) {
        const result = applyDelta(debit.instance, -debit.amount, {
            heroId: debit.isStation ? heroId : null
        });
        if (result.depleted) depleted.push(debit.id);
    }
    return depleted;
}
