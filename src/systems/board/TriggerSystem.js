// Fantasy Guild — Triggered Tokens (CMS rework Phase 6)

import { EventBus } from '../core/EventBus.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { statementsOf, stationSkillOf } from '../effects/statements.js';
import { TRIGGER_EVENTS, TRIGGER_SCOPES, getTriggerEvent } from '../../config/registries/triggerRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { neighboursOf } from './adjacency.js';
import { matchesTokenTarget, filterTargetTiles } from './TileModifiers.js';
import { KEYWORD } from '../effects/statements.js';
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
 * The fifth Token category: things that **wait and react** (CMS-29).
 *
 * A Producer runs a cycle. A Context Token defines what a neighbour makes. A
 * Buff Token nudges numbers. A Triggered Token does none of those — it listens
 * for something to happen and acts, rate-limited by a cooldown rather than a
 * cycle time, with no hero and no work of its own.
 *
 * ## Two worked examples this was built to
 * * **Masonry Wheelbarrow** — reacts to a *neighbour's* cycle completing (an
 *   Ore Vein being mined) and grants an extra item. Everything before Phase 6
 *   assumed a Token reacts to its *own* cycle.
 * * **Stoneshaper Sigil** — no work cycle and no hero at all. Watches for a
 *   condition (Stone existing in the Bank) and converts on a cooldown.
 *
 * ## The rules that shape this file
 * * **Success only** (CMS-34). A failed cycle does not fire a listener: a chain
 *   reaction should cascade because something actually happened, and reacting
 *   to a stuck neighbour reads as a bug rather than a feature.
 * * **The charge burns on service, not on luck** (D-126/CMS-26). A Triggered
 *   Token that fires spends its charge whether or not its proc rolled a hit, so
 *   a Token serving 100 events wears out in 100 events regardless of luck. One
 *   predictable rule for every support Token.
 * * **How much it burns is per statement** (rework P1, concept §3.2). Each
 *   statement carries its own `chargeDelta`: negative spends and gates the
 *   effect, zero is free, positive restores up to the Token's starting charges.
 *   The arithmetic is `Charges.applyDelta`; an unauthored delta spends 1.
 * * **Scope is per Token** (CMS-30), not a single global rule — the Sigil wants
 *   adjacency, other Tokens legitimately want the whole economy.
 */

/** Live subscriptions, so `init` is idempotent across reloads and tests. */
let unsubscribers = [];

/**
 * ## ⚠️ The loop guard, and why cooldowns were not enough
 *
 * Every trigger before Phase 2 listened **outward** — at a neighbour, or at the
 * Bank. `SELF_CYCLE_COMPLETE` lets a Token react to its own completion, which
 * is the shape that can eat itself: a Token whose reaction causes a cycle to
 * complete would fire again, and again.
 *
 * **Is the cooldown sufficient?** No, and the reason is worth writing down
 * rather than discovering later. A cooldown is a *rate* limit. It is set from
 * `statement.when.cooldownMs`, which an author may leave at **zero** — the
 * editor's own default for a fresh trigger is 5000ms but nothing forces it, and
 * a zero-cooldown self-trigger has no rate limit at all. Relying on it would
 * mean a runaway loop in the tick path is one empty number box away.
 *
 * As it happens nothing a statement can *do* today publishes `CYCLE_COMPLETE`
 * — item grants, conversions and status applications all publish something
 * else — so the loop is currently unreachable. That is safety by accident, and
 * it lasts exactly until someone adds an action that completes a cycle.
 *
 * So the guard is structural and does not depend on either fact:
 *
 * 1. **Re-entrancy.** A statement already in flight on a tile cannot be
 *    re-entered. This alone makes a Token-eats-itself loop impossible.
 * 2. **Cascade depth.** A chain of *different* Tokens setting each other off
 *    is bounded, so a long ring cannot spin either. When the cap is reached the
 *    cascade stops and says so once, loudly, rather than freezing the game.
 *
 * Both are cheap: a `Set` add and a counter per fire.
 */
const inFlight = new Set();

/**
 * How deep one board event may cascade.
 *
 * Eight is far past anything a real board does — the longest authored chain is
 * a Vein feeding a Wheelbarrow — and far short of a stack overflow. It is a
 * circuit breaker, not a design limit.
 */
export const MAX_CASCADE_DEPTH = 8;

let cascadeDepth = 0;
let warnedAboutDepth = false;

/**
 * Run one statement carried by a **live effect instance** (V6).
 *
 * ⚠️ Deliberately NOT routed through `fireStatement`. That path is about a Token
 * *instance* — it is where the cooldown lives and the charge delta is spent, and
 * a live effect on a person has neither. It ticks on its own clock, which is
 * already once every five seconds, so a cooldown would be redundant. The same
 * reasoning P5 of Unified Effects recorded for carried item rules.
 *
 * The cascade guard still applies, because a live effect firing another effect
 * is exactly the shape G-17 allows and therefore exactly the shape that can spin.
 */
export function fireLiveStatement(statement, roles) {
    if (cascadeDepth >= MAX_CASCADE_DEPTH) return;
    cascadeDepth += 1;
    try {
        if (statement.keyword === KEYWORD.DEALS) DealDamage.deal(statement, roles);
        if (statement.keyword === KEYWORD.HEALS) EffectActions.heal(statement, roles);
        if (statement.keyword === KEYWORD.RESTORES) EffectActions.restore(statement, roles);
        if (statement.keyword === KEYWORD.REMOVES) EffectActions.remove(statement, roles);
        /**
         * ⭐ The other half of chaining (G-17): a live effect applying another.
         * Without this the dispatch covered only the four damage-ish verbs, so
         * the combo mechanism the editor advertises did not exist.
         */
        if (statement.keyword === KEYWORD.APPLIES && roles?.selfHeroId && statement.payload?.effectId) {
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
 * ⚠️ Keyed by the statement's **stable id**, not by its position in the array.
 * Positional keys meant reordering a Token's rules in the CMS silently remapped
 * a live save's cooldowns onto the wrong rule. Numeric leftovers from the old
 * shape are dropped rather than remapped — see the note in `BlockUpkeep.js`.
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
 * Advance every cooldown on one Token.
 *
 * Called from the board tick. Cooldowns count DOWN in real time rather than
 * being compared against a timestamp, so they behave identically whether the
 * game ran continuously or was resumed.
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
 * Run one triggered statement's action.
 *
 * Returns true if the statement actually fired, which is what spends the charge —
 * see CMS-26 above. A statement that was on cooldown, or whose condition was not
 * met, has not served and costs nothing.
 */
function fireStatement(tile, instance, statement, payload = null, { settled = false } = {}) {
    if (!isReady(instance, statement.id)) return false;

    /**
     * A statement's own charge cost gates it (concept §3.2). An effect that
     * costs more charges than the Token has left **cannot fire at all** — it
     * does not fire and go into debt, and it does not fire for free. Checked
     * before the cooldown is set below, so a blocked effect is not also put on
     * cooldown for a firing that never happened.
     *
     * An unlimited Token passes this unconditionally (R-4).
     */
    /**
     * ⚠️ **A settled moment neither pays nor is gated** — see
     * `SELF_TOKEN_DEPLETED`. The Token has already spent its last charge and
     * left the board, so asking it to afford one more would refuse every rule
     * on the moment, and taking one would run a delta against a discarded
     * object sitting where its replacement now is.
     */
    if (!settled && !Charges.canFireStatement(instance, statement)) return false;

    // --- The loop guard (see the note at the top of this file) --------------
    const key = `${tile}:${statement.id}`;
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
        runStatementActions(tile, instance, statement, payload, { settled });
    } finally {
        inFlight.delete(key);
        cascadeDepth -= 1;
    }

    // The statement served, so its name is said — the same moment and the same
    // rule as the charge delta above it (CMS-26): what is announced is that the
    // Token acted, not that every proc inside it happened to hit.
    EffectFeedback.announce(tile, statement);

    return true;
}

/**
 * What a fired statement actually does. Split out so the guard can wrap it.
 *
 * ⚠️ `payload` is the **board event's** payload, threaded through from the
 * handler so `Deals` can resolve its roles (Effects Grammar v2 V2). Everything
 * above it targets tiles and needs only `tile`; a verb that acts on a
 * *participant* needs to know who was involved, and only the event knows that.
 */
function runStatementActions(tile, instance, statement, payload = null, { settled = false } = {}) {
    // Whether this statement swapped the Token standing on `tile` for a new
    // one. See the note beside the charge delta at the end.
    let bearerReplaced = false;

    /**
     * ⭐ `Deals` — damage to somebody the moment named.
     *
     * Handled first because it is the one keyword whose target is a **role**
     * rather than a tile filter, so none of the tile-shaped machinery below
     * applies to it.
     */
    if (statement.keyword === KEYWORD.DEALS) {
        DealDamage.deal(statement, resolveRoles(payload, tile));
    }

    // The rest of the action set (V8). Same shape, same role resolution — each
    // one is a verb that does something to a participant rather than to a tile.
    if (statement.keyword === KEYWORD.HEALS) {
        EffectActions.heal(statement, resolveRoles(payload, tile));
    }
    if (statement.keyword === KEYWORD.RESTORES) {
        EffectActions.restore(statement, resolveRoles(payload, tile));
    }
    if (statement.keyword === KEYWORD.REMOVES) {
        EffectActions.remove(statement, resolveRoles(payload, tile));
    }
    if (statement.keyword === KEYWORD.SPAWNS) {
        bearerReplaced = EffectActions.spawn(statement, resolveRoles(payload, tile)) === tile;
    }
    if (statement.keyword === KEYWORD.TRANSFORMS) {
        bearerReplaced = EffectActions.transform(statement, resolveRoles(payload, tile));
    }


    /**
     * `Applies` — a status on the people working the neighbours the filter
     * names. Handled before the item-shaped payloads below because it is the
     * one keyword whose payload carries no `type` at all, and because its own
     * targeting question is answered by `StatusApplication` rather than here.
     */
    if (statement.keyword === KEYWORD.APPLIES) {
        StatusApplication.applyToNeighbours(tile, statement);
    }

    for (const modifier of [statement.payload].filter(Boolean)) {
        const chance = modifier.chance ?? 100;
        const hit = chance >= 100 || Math.random() * 100 < chance;
        if (!hit) continue;

        /**
         * ⚠️ **A firing rule lands where its sentence says it lands**
         * (Effects Robustness P1).
         *
         * Both payloads below used to drop on `tile` — the Token that fired —
         * no matter what filter the author wrote. `Grants` declares
         * `filter: true`, so *"grant 1 Copper to any adjacent Forge"* was a
         * sentence the editor generated, the CMS saved, the game loaded, and
         * the runtime then ignored. That is the exact failure the statement
         * grammar exists to make impossible, and the ambient path never had it:
         * `applicableStatements` has matched the filter since the grammar
         * shipped. Only the triggered path was missing the loop.
         */
        if (modifier.type === EFFECT_TYPES.BONUS_DROP && modifier.itemId) {
            const quantity = Math.max(1, modifier.quantity || 1);
            // An unfiltered grant is about the Token that fired, which is what
            // an author with no filter means and what this always did.
            const targets = statement.to ? filterTargetTiles(tile, statement) : [tile];
            // ⚠️ A filter naming nothing grants nothing. "To any adjacent Forge"
            // with no Forge beside it must reach nobody — falling back to the
            // firing tile would make an unmatched filter silently universal,
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

            /**
             * ⚠️ **A conversion has ONE destination, not a broadcast** (ER-14).
             *
             * `Grants` above may name several neighbours because it is a bonus:
             * granting to four Forges is four bonuses, which is what the
             * sentence says and what the author priced. A conversion is an
             * **exchange** — it consumes a fixed input — so producing onto every
             * matching neighbour would multiply the output side while the input
             * side stayed fixed. That is precisely the "scaling only the output
             * turns a scale into free money" trap UE-7 names, arriving through
             * the filter instead of through the scale.
             *
             * So the filter picks a **destination**, and the owner's own example
             * is singular: *a Sigil that turns Stone into Bricks and puts them
             * on the adjacent Kiln.* Lowest tile index wins when several match —
             * deterministic rather than arbitrary, the same tie-break
             * `Managers.js` already uses when it has to choose one neighbour.
             */
            /**
             * ⚠️ **`all` means the FIRING TILE here, not "any neighbour"**
             * (ER-14).
             *
             * `makeStatement` stamps `to: { mode: 'all' }` on every keyword that
             * can aim, so a conversion authored in the CMS and otherwise
             * untouched arrives with one. Treating that as "pick a neighbour"
             * made the commonest possible conversion produce onto whichever
             * Token happened to sit at the lowest adjacent index — while its
             * sentence named no destination at all, and the CMS hint said the
             * output "lands on this Token itself".
             *
             * The renderer and the editor were both right; this was the half
             * that lied. An unaimed conversion produces where it was made (D-40).
             */
            const aimed = statement.to?.mode && statement.to.mode !== 'all';
            const destination = aimed
                ? filterTargetTiles(tile, statement).sort((a, b) => a - b)[0]
                : tile;
            // A filter that named nothing produces nothing — the inputs are
            // still spent, exactly as a failed cycle still costs its inputs.
            if (destination === undefined) continue;

            for (const p of modifier.produces || []) {
                // Onto the board, not into the Bank (D-40) — the same place
                // every other yield lands, so it reads as one economy.
                SpriteLayer.addSprite('item', p.itemId, Math.max(1, p.quantity || 1), destination);
            }
        }
    }

    /**
     * The statement's charge delta, applied because the Token SERVED —
     * regardless of whether any proc above actually hit (CMS-26).
     *
     * The delta is per statement, not per Token (concept §3.2): one Token can
     * carry an effect that costs 2, an effect that is free, and an effect that
     * gives 1 back. A statement that authors no `chargeDelta` spends one charge,
     * which is what every statement did before this field existed.
     *
     * A positive delta is ceilinged at the Token's starting charges and an
     * unlimited Token ignores the delta entirely (R-4); both live in
     * `Charges.applyDelta`, along with the destroy-at-zero that used to be
     * written out here.
     */
    /**
     * ⚠️ **A Token that replaced itself does not pay.**
     *
     * `Transforms`, and `Spawns` onto its own tile, put a NEW instance on this
     * square. Charging the old one is charging a discarded object: the delta
     * lands on nothing, `TOKEN_CHARGES_CHANGED` announces a Token that is no
     * longer there, and — the real damage — a `uses: 1` Sapling hits zero and
     * `destroyToken` wipes **the Oak that just replaced it**, emptying the tile.
     *
     * The intended use is the broken one: "leave a Stump behind when this
     * depletes" is exactly a one-charge Token that transforms.
     */
    if (bearerReplaced || settled) return true;

    Charges.applyDelta(tile, instance, Charges.statementChargeDelta(statement));
    return false;
}

/** Does this adjacency-scoped trigger care about the Token that fired it? */
function sourceMatches(when, sourceTypeId) {
    if (!when.source?.mode) return true;                // any neighbour
    return matchesTokenTarget(when.source, getTokenType(sourceTypeId));
}

/**
 * Does this trigger care about *what* the source made?
 *
 * Only `ITEM_PRODUCED` asks. Everything else ignores the list entirely, so the
 * coarse "a neighbour completed a cycle" trigger keeps firing on every
 * completion including one that produced nothing at all.
 *
 * ⚠️ An `ITEM_PRODUCED` with no item named matches **nothing**, not everything.
 * A half-authored trigger that fired on every cycle would be indistinguishable
 * from the coarse trigger sitting right above it in the picker, which is
 * exactly the kind of quiet wrong behaviour the audit exists to catch — and it
 * does, by name.
 */
function producedMatches(definition, when, payload) {
    if (!definition?.needsItem) return true;
    if (!when.watchItemId) return false;
    return (payload?.produced || []).includes(when.watchItemId);
}

/** Handle an adjacency-scoped board event. */
function handleAdjacent(triggerId, payload) {
    const originTile = payload?.tile;
    if (originTile == null) return;

    const definition = getTriggerEvent(triggerId);

    for (const neighbour of neighboursOf(originTile)) {
        const instance = BoardState.getToken(neighbour);
        if (!instance) continue;

        const def = getTokenType(instance.typeId);
        for (const statement of triggeredStatements(def, triggerId)) {
            if ((statement.when.scope || TRIGGER_SCOPES.ADJACENT) !== TRIGGER_SCOPES.ADJACENT) continue;
            if (!sourceMatches(statement.when, payload.typeId)) continue;
            if (!producedMatches(definition, statement.when, payload)) continue;
            fireStatement(neighbour, instance, statement, payload);
        }
    }
}

/**
 * Handle a **self**-scoped board event: the Token that fired it is the Token
 * that reacts.
 *
 * Deliberately its own function rather than a flag inside `handleAdjacent`.
 * The two differ in the thing that matters most — *which tile the statement
 * runs on* — and a self-scoped statement has no "from which neighbour" filter
 * to apply, because there is no neighbour involved in the firing at all. Its
 * `to` filter still works normally: the rule reaches outward from here exactly
 * as any other statement does.
 */
function handleSelf(triggerId, payload, { settled = false } = {}) {
    const tile = payload?.tile;
    if (tile == null) return;

    /**
     * ⚠️ The bearer may have **already left the tile**, and for one moment that
     * is the normal case rather than an error: `SELF_TOKEN_DEPLETED` fires from
     * `destroyToken`, after the square has been emptied. So the departing
     * instance rides on the payload, and this is the only place that reads it.
     *
     * Falling back rather than preferring it: while a Token is still on its
     * tile, the board is the authority on what is standing there.
     */
    const instance = BoardState.getToken(tile) || payload?.instance;
    if (!instance) return;

    const def = getTokenType(instance.typeId);
    for (const statement of triggeredStatements(def, triggerId)) {
        if (statement.when.scope !== TRIGGER_SCOPES.SELF) continue;
        fireStatement(tile, instance, statement, payload, { settled });
    }
}

/**
 * Handle a global-scoped condition (CMS-35).
 *
 * Evaluated against the Bank each time the coarse `inventory_updated` fires.
 * Every Triggered Token on the board is considered, wherever it sits.
 */
function handleGlobalItemThreshold() {
    for (const [tile, instance] of BoardState.occupiedTiles()) {
        const def = getTokenType(instance.typeId);
        for (const statement of triggeredStatements(def, 'ITEM_THRESHOLD')) {
            const { watchItemId, threshold } = statement.when;
            if (!watchItemId) continue;
            if (InventoryManager.getItemCount(watchItemId) < (threshold || 1)) continue;
            fireStatement(tile, instance, statement);
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
            // CMS-34: a failed cycle produced nothing, so nothing reacts to it.
            if (payload?.failed) return;
            // COMBAT_RESOLVED fires on defeat too; only a win is an event worth
            // cascading from — a lost fight is the same "nothing happened".
            if (id === 'COMBAT_RESOLVED' && payload?.outcome !== 'victory') return;
            if (isSelf) handleSelf(id, payload, { settled: !!settled });
            else handleAdjacent(id, payload);
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

/** Whether a Token is purely triggered — no staffed production at all (CMS-80). */
export function isPurelyTriggered(def) {
    if (!def) return false;
    const hasTrigger = statementsOf(def).some(s => s?.when?.event);
    return hasTrigger && !def.config && !stationSkillOf(def);
}

/** Every trigger event id a Token listens for. Used by content validation. */
export function triggersOf(def) {
    return statementsOf(def)
        .map(s => s?.when?.event)
        .filter(Boolean);
}

/** @see getTriggerEvent — re-exported so callers need one import. */
export { getTriggerEvent };
