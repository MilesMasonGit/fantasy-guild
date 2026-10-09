// triggered Tokens

import { EventBus } from '../core/EventBus.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { PLACEMENT, placementOf } from '../../config/registries/placementRegistry.js';
import { statementsOf, stationSkillOf, firingChanceOf } from '../effects/statements.js';
import { TRIGGER_EVENTS, TRIGGER_SCOPES, getTriggerEvent } from '../../config/registries/triggerRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { centreOf, distanceSq, nearRadius, tokensWithin } from './nearby.js';
import { matchesTokenTarget, filterTargets } from './TileModifiers.js';
import { KEYWORD } from '../effects/statements.js';
import * as MatCap from './MatCap.js';
import * as StatusApplication from './StatusApplication.js';
import * as DealDamage from './DealDamage.js';
import * as EffectActions from './EffectActions.js';
import * as LiveEffects from '../effects/LiveEffects.js';
import { resolveRoles } from '../../config/registries/roleRegistry.js';
import * as Charges from './Charges.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as EffectFeedback from './EffectFeedback.js';
import { logger } from '../../utils/Logger.js';

/**
 * The fifth Token category: things that wait and react.
 *
 * A Producer runs a cycle. A Context Token defines what a neighbour makes. A Buff Token nudges
 * numbers. A Triggered Token does none of those: it listens for something to happen and acts,
 * rate-limited by a cooldown rather than a cycle time, with no hero and no work of its own.
 *
 * Two worked examples: Masonry Wheelbarrow reacts to a neighbour's cycle completing (an Ore Vein
 * being mined) and grants an extra item; Stoneshaper Sigil has no work cycle and no hero, watches
 * for a condition (Stone existing in the Bank) and converts on a cooldown.
 *
 * Rules that shape this file:
 * - Success only: a failed cycle does not fire a listener. A chain reaction should cascade because
 * something actually happened, and reacting to a stuck neighbour reads as a bug.
 * - The charge burns on service, not on luck: a Triggered Token that fires spends its charge
 * whether or not its proc rolled a hit, so a Token serving 100 events wears out in 100 events
 * regardless of luck. ⚠️ Except a `Spawns` chance (`firingChance`), the ambush: it is rolled before
 * the rule fires, so a miss is no firing and costs nothing.
 * - How much it burns is per statement: each statement carries its own `chargeDelta` (negative
 * spends and gates the effect, zero is free, positive restores up to the Token's starting charges).
 * The arithmetic is `Charges.applyDelta`; an unauthored delta spends 1.
 * - Scope is per Token, not a single global rule: the Sigil wants adjacency, other Tokens want the
 * whole economy.
 */

/** Live subscriptions, so `init` is idempotent across reloads and tests. */
let unsubscribers = [];

/**
 * ⚠️ The loop guard, and why cooldowns are not enough.
 *
 * `SELF_CYCLE_COMPLETE` lets a Token react to its own completion, which is the shape that can eat
 * itself: a Token whose reaction causes a cycle to complete would fire again, and again. A cooldown
 * is only a rate limit, and `statement.when.cooldownMs` may be left at zero, which is no rate limit
 * at all.
 *
 * So the guard is structural:
 * 1. Re-entrancy: a statement already in flight on a Token cannot be re-entered. This alone makes a
 * Token-eats-itself loop impossible.
 * 2. Cascade depth: a chain of different Tokens setting each other off is bounded, so a long ring
 * cannot spin either. When the cap is reached the cascade stops and says so once, loudly, rather
 * than freezing the game.
 *
 * Both are cheap: a `Set` add and a counter per fire.
 */
const inFlight = new Set();

/**
 * How deep one board event may cascade. A circuit breaker, not a design limit: far past anything a
 * real board does and far short of a stack overflow.
 */
export const MAX_CASCADE_DEPTH = 8;

let cascadeDepth = 0;
let warnedAboutDepth = false;

/**
 * Run one statement carried by a live effect instance.
 *
 * ⚠️ Deliberately NOT routed through `fireStatement`: that path is about a Token instance, where
 * the cooldown lives and the charge delta is spent, and a live effect on a person has neither. It
 * ticks on its own clock, so a cooldown would be redundant.
 *
 * The cascade guard still applies, because a live effect firing another effect can chain and
 * therefore spin.
 */
export function fireLiveStatement(statement, roles) {
    if (cascadeDepth >= MAX_CASCADE_DEPTH) return;
    cascadeDepth += 1;
    try {
        if (statement.keyword === KEYWORD.DEALS) DealDamage.deal(statement, roles);
        if (statement.keyword === KEYWORD.HEALS) EffectActions.heal(statement, roles);
        if (statement.keyword === KEYWORD.RESTORES) EffectActions.restore(statement, roles);
        if (statement.keyword === KEYWORD.REMOVES) EffectActions.remove(statement, roles);
        // The other half of chaining: a live effect applying another. Without this the dispatch
        // covers only the damage-ish verbs.
        // An `Applies` aimed at a role goes to that role, not to the bearer.
        if (statement.keyword === KEYWORD.APPLIES && statement.target?.role) {
            StatusApplication.applyToRole(statement, roles);
        } else if (statement.keyword === KEYWORD.APPLIES && roles?.selfHeroId && statement.payload?.effectId) {
            LiveEffects.applyToHero(roles.selfHeroId, statement.payload,
                statement.sourceEffectId || null, fireLiveStatement);
        }
    } finally {
        cascadeDepth -= 1;
    }
}

/** Reset the guard. For tests, and for a board teardown mid-cascade. */
export function resetCascadeGuard() {
    inFlight.clear();
    cascadeDepth = 0;
    warnedAboutDepth = false;
}

/**
 * Per-instance cooldown state, created on first use.
 *
 * ⚠️ Keyed by the statement's stable id, not by its position in the array: positional keys meant
 * reordering a Token's rules in the CMS silently remapped a live save's cooldowns onto the wrong
 * rule. Numeric leftovers from the old shape are dropped rather than remapped (see
 * `BlockUpkeep.js`).
 */
function cooldowns(instance) {
    if (!instance.blockCooldowns) instance.blockCooldowns = {};
    for (const key of Object.keys(instance.blockCooldowns)) {
        if (/^\d+$/.test(key)) delete instance.blockCooldowns[key];
    }
    return instance.blockCooldowns;
}

/** Statements on a Token whose `When` clause names the given event. */
function triggeredStatements(def, triggerId) {
    return statementsOf(def).filter(s => s?.when?.event === triggerId);
}

/**
 * Advance every cooldown on one Token. Called from the board tick. Cooldowns count DOWN rather than
 * being compared against a timestamp, so they behave identically whether the game ran continuously
 * or was resumed.
 */
export function tickCooldowns(instance, delta) {
    const state = instance.blockCooldowns;
    if (!state) return;
    for (const key of Object.keys(state)) {
        if (state[key] > 0) state[key] = Math.max(0, state[key] - delta);
    }
}

/** Whether a statement is off cooldown and may fire. */
function isReady(instance, statementId) {
    return !(instance.blockCooldowns?.[statementId] > 0);
}

/**
 * Whether a rule-fired spawn has room under the mat's Token cap; true for every other statement. A
 * held spawn waits for the next moment, as a spawner waits for its next attempt.
 *
 * ⚠️ Asked here, never inside `EffectActions.spawn`: the Spawner System asks the cap itself before
 * calling it, and the bench's push storm (S4) drives it past the cap on purpose, so a check there
 * would change that scenario's work.
 *
 * A spawn that takes its bearer's place (`here`) adds nothing to the count, so it is never held.
 */
function spawnHasRoom(instance, statement) {
    if (statement.keyword !== KEYWORD.SPAWNS) return true;
    if (placementOf(statement.payload) === PLACEMENT.HERE && MatCap.countsTowardCap(instance)) return true;
    return MatCap.canPlaceMore(1);
}

/**
 * The chance a statement rolls before it fires (`firingChanceOf`), rolled with the game's shared
 * `Math.random`, which the bench seeds and counts. ⚠️ A statement that always fires draws nothing:
 * every existing rule must consume the same random numbers it did before chances existed.
 */
function rolledToFire(statement) {
    const chance = firingChanceOf(statement);
    return chance == null || Math.random() * 100 < chance;
}

/**
 * An enemy a rule spawns belongs to the Token that made it, as a spawner's enemies belong to their
 * spawner: it watches for heroes around that Token (`Hostiles.watchCentreOf`), so an ambusher
 * attacks whoever is working its node. Saved with the enemy. A bearer that has already left the mat
 * holds nothing.
 */
function tetherToBearer(spawnedId, bearer) {
    const spawned = BoardState.getTokenById(spawnedId);
    if (!spawned || !isEnemyDef(getTokenType(spawned.typeId))) return;
    if (!BoardState.getTokenById(bearer?.id)) return;
    spawned.tether = bearer.id;
}

/**
 * Run one triggered statement's action. Returns true if the statement actually fired, which is what
 * spends the charge. A statement that was on cooldown, or whose condition was not met, has not
 * served and costs nothing.
 */
function fireStatement(instance, statement, payload = null, { settled = false } = {}) {
    if (!instance || !isReady(instance, statement.id)) return false;

    // A statement's own charge cost gates it. An effect that costs more charges than the Token has
    // left cannot fire at all: it does not fire and go into debt, and it does not fire for free.
    // Checked before the cooldown is set below, so a blocked effect is not also put on cooldown for
    // a firing that never happened. An unlimited Token passes this unconditionally.
    // ⚠️ A settled moment neither pays nor is gated (see `SELF_TOKEN_DEPLETED`). The Token has
    // already spent its last charge and left the board, so asking it to afford one more would
    // refuse every rule on the moment, and taking one would run a delta against a discarded object
    // sitting where its replacement now is.
    if (!settled && !Charges.canFireStatement(instance, statement)) return false;

    // The loop guard (see the note at the top of this file), keyed by the Token's instance id.
    const key = `${instance.id}:${statement.id}`;
    if (inFlight.has(key)) return false;
    if (cascadeDepth >= MAX_CASCADE_DEPTH) {
        if (!warnedAboutDepth) {
            warnedAboutDepth = true;
            logger.warn('TriggerSystem',
                `A chain of triggered Tokens ran ${MAX_CASCADE_DEPTH} deep and was stopped. ` +
                'Something on the board is setting itself off in a circle.');
        }
        return false;
    }

    // Both before the cooldown is set and the charge spent: a held spawn and a missed roll are no
    // firing. The cap first, so a full mat draws no random number.
    if (!spawnHasRoom(instance, statement)) return false;
    if (!rolledToFire(statement)) return false;

    // Set the cooldown BEFORE running actions. An action that publishes an
    // event this same Token listens for would otherwise re-enter and fire
    // again — a Sigil converting Stone while watching for Stone is exactly the
    // shape that loops forever. The guard above covers the case where the
    // author left the cooldown at zero.
    cooldowns(instance)[statement.id] = statement.when?.cooldownMs || 0;

    inFlight.add(key);
    cascadeDepth += 1;
    try {
        // The charge delta lives inside, because only the actions know whether
        // the bearer replaced itself and therefore has nothing left to pay with.
        runStatementActions(instance, statement, payload, { settled });
    } finally {
        inFlight.delete(key);
        cascadeDepth -= 1;
    }

    // The statement served, so its name is said: what is announced is that the Token acted, not
    // that every proc inside it happened to hit.
    EffectFeedback.announce(instance.id, statement);

    return true;
}

/**
 * What a fired statement actually does. Split out so the guard can wrap it.
 *
 * ⚠️ `payload` is the board event's payload, threaded through from the handler so `Deals` can
 * resolve its roles: a verb that acts on a participant needs to know who was involved, and only the
 * event knows that.
 *
 * The bearer is `instance`, which may already have left the mat (a rule on its own depletion); its
 * `x`, `y` is then where it stood.
 */
function runStatementActions(instance, statement, payload = null, { settled = false } = {}) {
    // Whether this statement swapped the bearer for a new Token. See the note
    // beside the charge delta at the end.
    let bearerReplaced = false;
    const bearerPoint = centreOf(instance);
    const roles = () => resolveRoles(payload, instance.id, bearerPoint);

    // `Deals`: damage to somebody the moment named. Handled first because it is the one keyword
    // whose target is a role rather than a filter, so none of the filter machinery below applies to
    // it.
    if (statement.keyword === KEYWORD.DEALS) {
        DealDamage.deal(statement, roles());
    }

    // The rest of the action set: same shape, same role resolution, each one a verb that does
    // something to a participant.
    if (statement.keyword === KEYWORD.HEALS) {
        EffectActions.heal(statement, roles());
    }
    if (statement.keyword === KEYWORD.RESTORES) {
        EffectActions.restore(statement, roles());
    }
    if (statement.keyword === KEYWORD.REMOVES) {
        EffectActions.remove(statement, roles());
    }
    if (statement.keyword === KEYWORD.SPAWNS) {
        const landed = EffectActions.spawn(statement, roles());
        bearerReplaced = !!landed?.replacedBearer;
        if (landed && !bearerReplaced) tetherToBearer(landed.instanceId, instance);
    }
    if (statement.keyword === KEYWORD.TRANSFORMS) {
        bearerReplaced = EffectActions.transform(statement, roles());
    }


    // `Applies`: a status on the people working the neighbours the filter names. Handled before the
    // item-shaped payloads below because its payload carries no `type` at all, and because its own
    // targeting question is answered by `StatusApplication` rather than here.
    if (statement.keyword === KEYWORD.APPLIES) {
        // A role, when set, replaces the filter and the reach.
        if (statement.target?.role) StatusApplication.applyToRole(statement, roles());
        else StatusApplication.applyToNeighbours(instance.id, statement, Math.random, bearerPoint);
    }

    for (const modifier of [statement.payload].filter(Boolean)) {
        // A chance rolled before the rule fired (`rolledToFire`) is not rolled again here, which
        // would draw a second number for nothing.
        const chance = firingChanceOf(statement) != null ? 100 : (modifier.chance ?? 100);
        const hit = chance >= 100 || Math.random() * 100 < chance;
        if (!hit) continue;

        // ⚠️ A firing rule lands where its sentence says it lands. `Grants` declares `filter:
        // true`, so grant 1 Copper to any nearby Forge is a sentence the editor generates and the
        // CMS saves; the runtime must honour the filter rather than drop on the Token that fired
        // (`applicableStatements` does the same for the ambient path).
        if (modifier.type === EFFECT_TYPES.BONUS_DROP && modifier.itemId) {
            const quantity = Math.max(1, modifier.quantity || 1);
            // An unfiltered grant is about the Token that fired, which is what
            // an author with no filter means and what this always did.
            const targets = statement.to ? targetsOf(instance, statement) : [bearerSource(instance)];
            // ⚠️ A filter naming nothing grants nothing. "To any nearby Forge"
            // with no Forge beside it must reach nobody — falling back to the
            // firing Token would make an unmatched filter silently universal,
            // which is the failure `matchesTokenTarget` refuses for the same
            // reason.
            for (const target of targets) {
                SpriteLayer.addSprite('item', modifier.itemId, quantity, target);
            }
        }

        if (modifier.type === EFFECT_TYPES.CONVERT) {
            const consumes = modifier.consumes || [];
            // All-or-nothing, the same discipline production and upkeep use: a
            // conversion never half-consumes and then fails to produce.
            const affordable = consumes.every(
                c => InventoryManager.getItemCount(c.itemId) >= (c.quantity || 1)
            );
            if (!affordable) continue;

            for (const c of consumes) {
                InventoryManager.removeItem(c.itemId, c.quantity || 1);
            }

            // ⚠️ A conversion has ONE destination, not a broadcast. `Grants` above may name several
            // neighbours because it is a bonus: granting to four Forges is four bonuses, which is
            // what the sentence says and what the author priced. A conversion is an exchange: it
            // consumes a fixed input, so producing onto every matching neighbour would multiply the
            // output while the input stayed fixed (scaling only the output turns a scale into free
            // money). So the filter picks a destination: the nearest matching Token wins, then the
            // earliest placed, deterministic rather than arbitrary.
            // ⚠️ `all` means the FIRING TOKEN here, not any neighbour. `makeStatement` stamps `to:
            // { mode: 'all' }` on every keyword that can aim, so a conversion authored in the CMS
            // and otherwise untouched arrives with one. Treating that as pick a neighbour would
            // make the commonest conversion produce onto whichever Token sat at the lowest nearby
            // index, while its sentence names no destination. An unaimed conversion produces where
            // it was made.
            const aimed = statement.to?.mode && statement.to.mode !== 'all';
            const destination = aimed
                ? nearestTargetOf(instance, statement)
                : bearerSource(instance);
            // A filter that named nothing produces nothing: the inputs are still spent, exactly as
            // a failed cycle still costs its inputs.
            if (destination === undefined) continue;

            for (const p of modifier.produces || []) {
                // Onto the board, not into the Bank: the same place every other yield lands, so it
                // reads as one economy.
                SpriteLayer.addSprite('item', p.itemId, Math.max(1, p.quantity || 1), destination);
            }
        }
    }

    // The statement's charge delta, applied because the Token SERVED, regardless of whether any
    // proc above actually hit.
    // The delta is per statement, not per Token: one Token can carry an effect that costs 2, an
    // effect that is free, and an effect that gives 1 back. A statement that authors no
    // `chargeDelta` spends one charge.
    // A positive delta is ceilinged at the Token's starting charges and an unlimited Token ignores
    // the delta entirely; both live in `Charges.applyDelta`.
    // ⚠️ A Token that replaced itself does not pay. `Transforms`, and `Spawns ... here`, put a NEW
    // instance where this one stood. Charging the old one is charging a discarded object: the delta
    // lands on nothing, `TOKEN_CHARGES_CHANGED` announces a Token that is no longer there, and a
    // `uses: 1` Sapling hitting zero would announce a depletion for a Token that has already become
    // an Oak.
    if (bearerReplaced || settled) return true;

    Charges.applyDelta(instance, Charges.statementChargeDelta(statement));
    return false;
}

/**
 * The Tokens a firing rule's filter names, as instance ids in arrival order, measured from the
 * bearer, or from the point it stood on when it has already left the mat.
 */
function targetsOf(instance, statement) {
    return filterTargets(instance?.id, statement, centreOf(instance));
}

/**
 * The one Token a conversion lands on: of those its filter names, the nearest to the bearer, then
 * the earliest placed. `undefined` when the filter names nothing.
 */
function nearestTargetOf(instance, statement) {
    const from = centreOf(instance);
    const ids = targetsOf(instance, statement);
    if (!from) return ids[0];
    let best;
    let bestD = Infinity;
    // `ids` is in arrival order, so keeping the first of equal distances keeps
    // the earliest placed.
    for (const id of ids) {
        const centre = centreOf(BoardState.getTokenById(id));
        const d = centre ? distanceSq(from, centre) : Infinity;
        if (best === undefined || d < bestD) {
            best = id;
            bestD = d;
        }
    }
    return best;
}

/**
 * Where something the bearer itself produces flies from: the bearer while it
 * is on the mat, else the point it stood on.
 */
function bearerSource(instance) {
    if (BoardState.getTokenById(instance?.id)) return instance.id;
    const point = centreOf(instance);
    return point ? { centre: point } : null;
}

/** Does this adjacency-scoped trigger care about the Token that fired it? */
function sourceMatches(when, sourceTypeId) {
    if (!when.source?.mode) return true;
    return matchesTokenTarget(when.source, getTokenType(sourceTypeId));
}

/**
 * Does this trigger care about what the source made? Only `ITEM_PRODUCED` asks. Everything else
 * ignores the list entirely, so the coarse a-neighbour-completed-a-cycle trigger keeps firing on
 * every completion, including one that produced nothing.
 *
 * ⚠️ An `ITEM_PRODUCED` with no item named matches NOTHING, not everything: a half-authored trigger
 * that fired on every cycle would be indistinguishable from the coarse trigger sitting right above
 * it in the picker.
 */
function producedMatches(definition, when, payload) {
    if (!definition?.needsItem) return true;
    if (!when.watchItemId) return false;
    return (payload?.produced || []).includes(when.watchItemId);
}

/**
 * Handle an adjacency-scoped board event.
 *
 * Neighbour means Near: listeners are every Token whose centre is within Near of the source's
 * centre, named by instance id, in arrival order.
 *
 * ⚠️ The source may already have left: `TOKEN_DEPLETED` fires after it is taken off the mat. It is
 * then heard from the point its departing instance still carries, or the point the event names
 * (`x`, `y`).
 */
function handleNearby(triggerId, payload) {
    const sourceId = payload?.instanceId ?? null;
    const source = BoardState.getTokenById(sourceId);
    const origin = centreOf(source)
        || centreOf(payload?.instance)
        || (Number.isFinite(payload?.x) && Number.isFinite(payload?.y) ? { x: payload.x, y: payload.y } : null);
    if (!origin) return;

    const definition = getTriggerEvent(triggerId);

    for (const id of tokensWithin(origin, nearRadius(), sourceId)) {
        const instance = BoardState.getTokenById(id);
        if (!instance) continue;

        const def = getTokenType(instance.typeId);
        for (const statement of triggeredStatements(def, triggerId)) {
            if ((statement.when.scope || TRIGGER_SCOPES.NEARBY) !== TRIGGER_SCOPES.NEARBY) continue;
            if (!sourceMatches(statement.when, payload.typeId)) continue;
            if (!producedMatches(definition, statement.when, payload)) continue;
            fireStatement(instance, statement, payload);
        }
    }
}

/**
 * Handle a **self**-scoped board event: the Token that fired it is the Token
 * that reacts.
 *
 * Deliberately its own function rather than a flag inside `handleNearby`.
 * The two differ in the thing that matters most — *which Token the statement
 * runs on* — and a self-scoped statement has no "from which neighbour" filter
 * to apply, because there is no neighbour involved in the firing at all. Its
 * `to` filter still works normally: the rule reaches outward from here exactly
 * as any other statement does.
 */
function handleSelf(triggerId, payload, { settled = false } = {}) {
    // ⚠️ The bearer may have already left the mat, and for one moment that is the normal case:
    // `SELF_TOKEN_DEPLETED` fires from `destroyToken`, after the Token has been taken off. So the
    // departing instance rides on the payload, and this is the only place that reads it. It is a
    // fallback, not preferred: while a Token is still on the mat, the board is the authority on it.
    const instance = BoardState.getTokenById(payload?.instanceId) || payload?.instance;
    if (!instance) return;

    const def = getTokenType(instance.typeId);
    for (const statement of triggeredStatements(def, triggerId)) {
        if (statement.when.scope !== TRIGGER_SCOPES.SELF) continue;
        fireStatement(instance, statement, payload, { settled });
    }
}

/**
 * Handle a global-scoped condition. Evaluated against the Bank each time the coarse
 * `inventory_updated` fires. Every Triggered Token on the board is considered, wherever it sits.
 */
function handleGlobalItemThreshold() {
    for (const instance of BoardState.tokens()) {
        const def = getTokenType(instance.typeId);
        for (const statement of triggeredStatements(def, 'ITEM_THRESHOLD')) {
            const { watchItemId, threshold } = statement.when;
            if (!watchItemId) continue;
            if (InventoryManager.getItemCount(watchItemId) < (threshold || 1)) continue;
            fireStatement(instance, statement);
        }
    }
}

/**
 * Subscribe every trigger type. Idempotent — calling it twice replaces the
 * previous subscriptions rather than doubling them, which matters in tests and
 * after a save load.
 */
export function init() {
    // The board owns "run a statement"; `StatusApplication` only knows who to
    // run it on. Injected rather than imported, because it imports us.
    StatusApplication.setStatementRunner(fireLiveStatement);
    teardown();

    resetCascadeGuard();

    for (const definition of TRIGGER_EVENTS) {
        const { id, event, scopes, settled } = definition;

        if (scopes.includes(TRIGGER_SCOPES.GLOBAL)) {
            unsubscribers.push(EventBus.subscribe(event, () => handleGlobalItemThreshold()));
            continue;
        }

        const isSelf = scopes.includes(TRIGGER_SCOPES.SELF);

        unsubscribers.push(EventBus.subscribe(event, (payload) => {
            // A failed cycle produced nothing, so nothing reacts to it.
            if (payload?.failed) return;
            // COMBAT_RESOLVED fires on defeat too; only a win is an event worth
            // cascading from — a lost fight is the same "nothing happened".
            if (id === 'COMBAT_RESOLVED' && payload?.outcome !== 'victory') return;
            if (isSelf) handleSelf(id, payload, { settled: !!settled });
            else handleNearby(id, payload);
        }));
    }
}

/** Drop every subscription. */
export function teardown() {
    for (const unsub of unsubscribers) {
        if (typeof unsub === 'function') unsub();
    }
    unsubscribers = [];
    resetCascadeGuard();
}

/** Whether a Token is purely triggered: no staffed production at all. */
export function isPurelyTriggered(def) {
    if (!def) return false;
    const hasTrigger = statementsOf(def).some(s => s?.when?.event);
    return hasTrigger && !def.config && !stationSkillOf(def);
}

/** @see getTriggerEvent — re-exported so callers need one import. */
export { getTriggerEvent };
