// Fantasy Guild — Card Effect Resolvers (Area Deck Rework, C-3 slice 2)
//
// The registry (config/cards/effectRegistry.js) says WHAT an effect is and
// WHEN it fires. This module says what actually HAPPENS — one resolver per
// effect kind, dispatched by phase.
//
// The point of the split (D-60): adding a new card behaviour should be
// authoring plus ONE resolver here, never a new branch in the loop engine.
// Nothing in the engine may ask "what type is this card?" to decide what it
// can do.
//
// ## Migration status
// Some behaviours still run through their original engine paths because those
// paths carry a lot of preserved machinery. This is deliberate and staged:
//
//   resolved here  → restore, hazard
//   engine-owned   → work_output (WorkProcessor via the workcycle trait),
//                    combat (CombatProcessor hand-off + the in_combat status
//                    machine), token_stamp (MutatorStamping), buff (C-4)
//
// Engine-owned kinds are still declared in the registry, so a card's effect
// list is complete and its type derives correctly; they simply aren't
// dispatched from here yet. Each moves over with the component that owns it.

import { EFFECT_PHASES, effectsForPhase } from '../../../config/cards/effectRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../inventory/InventoryManager.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { logger } from '../../../utils/Logger.js';

/** Resolvers by effect kind. A kind with no resolver here is engine-owned. */
const RESOLVERS = new Map();

/**
 * Register a resolver for an effect kind.
 *
 * @param {string} kind
 * @param {(payload: object, ctx: object) => (object|void)} fn
 *        Receives the authored effect and a context (`{ heroId, areaId, card }`).
 *        May return `{ heroDied: true }` to tell the caller the hero has fallen.
 */
export function defineResolver(kind, fn) {
    if (RESOLVERS.has(kind)) throw new Error(`defineResolver: "${kind}" already has a resolver`);
    RESOLVERS.set(kind, fn);
}

/** True when this kind is dispatched from here rather than by the engine. */
export function hasResolver(kind) {
    return RESOLVERS.has(kind);
}

/**
 * Run every effect of `effects` that fires in `phase` and has a resolver.
 *
 * Effects run in authored order, so a card can damage before it yields.
 * Resolution stops early if the hero dies, so nothing resolves against a
 * corpse.
 *
 * @param {object[]} effects
 * @param {string} phase       One of EFFECT_PHASES.
 * @param {object} ctx         `{ heroId, areaId, card }`
 * @returns {{ heroDied: boolean, resolved: string[] }}
 */
export function resolveEffects(effects, phase, ctx = {}) {
    const result = { heroDied: false, resolved: [] };

    for (const effect of effectsForPhase(effects, phase)) {
        const resolver = RESOLVERS.get(effect.kind);
        if (!resolver) continue; // engine-owned; see the migration note above

        const outcome = resolver(effect, ctx) || {};
        result.resolved.push(effect.kind);

        if (outcome.heroDied) {
            result.heroDied = true;
            break;
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

/**
 * Restore HP or Energy.
 *
 * Two forms (see the registry's EFFECT_RESTORE):
 *   - direct:      `{ resource, amount }` — applied as authored.
 *   - item-backed: `{ itemId }` — one unit is drawn from the Guild Bank and
 *     the item's own `restoreAmount` applied. A `drink`-tagged item restores
 *     Energy; anything else restores HP.
 *
 * The item-backed form preserves the old consumable rule exactly: if the bank
 * is empty the time spent was the penalty and nothing happens.
 */
defineResolver('restore', (effect, { heroId }) => {
    if (!heroId) return;

    if (effect.itemId) {
        if (!InventoryManager.hasItem(effect.itemId, 1)) return;

        const item = getItem(effect.itemId);
        InventoryManager.removeItem(effect.itemId, 1);

        const amount = item?.restoreAmount || 0;
        if (amount <= 0) return;

        if (item?.tags?.includes('drink')) HeroManager.modifyHeroEnergy(heroId, amount);
        else HeroManager.modifyHeroHp(heroId, amount);
        return;
    }

    const amount = effect.amount || 0;
    if (amount <= 0) return;
    if (effect.resource === 'energy') HeroManager.modifyHeroEnergy(heroId, amount);
    else HeroManager.modifyHeroHp(heroId, amount);
});

/**
 * Damage the hero on arrival (D-8, D-11) — once per execution of the card, so
 * four hazard cards in a loop land four hits.
 *
 * Reports `heroDied` rather than handling defeat itself: the loop owns the
 * Forced Retreat sequence (penalties, unassignment, status), and that stays in
 * one place.
 */
defineResolver('hazard', (effect, { heroId }) => {
    const damage = effect.damage || 0;
    if (!heroId || damage <= 0) return;

    HeroManager.modifyHeroHp(heroId, -damage);

    const hero = HeroManager.getHero(heroId);
    if ((hero?.hp?.current ?? 1) <= 0) {
        logger.debug('effectResolvers', `Hazard killed ${heroId} for ${damage}`);
        return { heroDied: true, cause: effect.hazardType || 'hazard' };
    }
});

/** Convenience wrappers for the phases the loop runs. */
export const resolveOnDraw = (effects, ctx) => resolveEffects(effects, EFFECT_PHASES.ON_DRAW, ctx);
export const resolveOnActivate = (effects, ctx) => resolveEffects(effects, EFFECT_PHASES.ON_ACTIVATE, ctx);
export const resolveOnComplete = (effects, ctx) => resolveEffects(effects, EFFECT_PHASES.ON_COMPLETE, ctx);
