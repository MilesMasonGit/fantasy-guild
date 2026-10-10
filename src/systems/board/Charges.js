// the charges engine

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType, tokenName, tokenStartingUses, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
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
 * The one place a Token's charge pool is read, moved, or spent. Three axes spend against that pool:
 * a station's operational cost, a recipe's context-token cost, and an effect block's own delta.
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

/** Whether a Token instance's charges are unlimited. */
export function isUnlimited(instance) {
    return instance?.usesRemaining == null;
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
    // Skipped then if the drop took it off the mat (the bin) or something refilled it meanwhile.
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
 * Token is one provider and pays one cost.
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
 * Which nearby Tokens would pay a recipe's context charge costs, and how much each would pay,
 * without touching anything.
 *
 * Lowest remaining first: when several nearby Tokens satisfy the same requirement, the one with the
 * fewest charges left pays first, so near-depleted tiles clear rather than every provider sitting
 * at a fraction forever. A cost larger than any single provider holds spreads across them in that
 * same order.
 *
 * Unlimited providers pay nothing: an unlimited Token nearby satisfies the requirement for free,
 * and no finite neighbour is charged for it either.
 *
 * @returns {{ok: boolean, debits: Array<{id, instance, amount}>, missing: Array<{tag, reason, short?: number}>}}
 */
export function planContextCharges(instanceId, requirements) {
    const providers = contextProvidersAround(instanceId);
    const planned = new Map();          // provider id → charges this plan already claims
    const debits = [];
    const missing = [];

    const claimed = id => planned.get(id) || 0;

    // Normalised through the one reader, so a bare-string entry (what the CMS
    // writes before a tier is picked) is a tier-1 tag rather than skipped.
    for (const req of contextRequirementsOf({ requiresContext: requirements })) {
        const minTier = req.minTier;
        const cost = req.chargeCost;

        const eligible = providers.filter(p => (p.tiers[req.tag] || 0) >= minTier);
        if (!eligible.length) {
            missing.push({ tag: req.tag, reason: 'absent' });
            continue;
        }
        if (cost <= 0) continue;
        if (eligible.some(p => isUnlimited(p.instance))) continue;

        const byScarcity = [...eligible].sort(
            (a, b) => (a.instance.usesRemaining - claimed(a.id)) - (b.instance.usesRemaining - claimed(b.id))
        );

        let owed = cost;
        for (const provider of byScarcity) {
            const free = provider.instance.usesRemaining - claimed(provider.id);
            if (free <= 0) continue;
            const take = Math.min(free, owed);
            planned.set(provider.id, claimed(provider.id) + take);
            owed -= take;
            if (owed === 0) break;
        }

        if (owed > 0) missing.push({ tag: req.tag, reason: 'charges', short: owed });
    }

    for (const [id, amount] of planned) {
        const provider = providers.find(p => p.id === id);
        debits.push({ id, instance: provider.instance, amount });
    }

    return { ok: missing.length === 0, debits, missing };
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
