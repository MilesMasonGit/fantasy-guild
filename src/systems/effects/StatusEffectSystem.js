// Fantasy Guild - Status Effect System
// First pass of the unified buff & debuff engine (status_effects_concept.md).
//
// Heroes carry statuses on `hero.statuses` (persisted with the save).
// Enemies carry them on `card.combat.enemyStatuses` (ephemeral, dies with
// the encounter). Both use the same registry and the same instance shape:
//   { id, stacks, remaining? }   — 'remaining' only for layered buffs.
//
// Periodic effects tick on one global 5s clock (§1B), whether the hero is
// fighting, drawing cards, or working. DoT ticks are true damage — they
// bypass Armor/Block and CAN drop a hero to 0 (owner-locked 2026-07-12),
// which routes through the normal Forced Retreat in LoopRunner.

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import * as HeroManager from '../hero/HeroManager.js';
import { logger } from '../../utils/Logger.js';
import { STATUS_TICK_INTERVAL_MS } from '../../config/FormulaRegistry.js';
import {
    getStatusEffect,
    sumStatusEffect,
} from '../../config/registries/statusRegistry.js';

let heroTickTimer = 0;

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/**
 * Apply a status to a hero. Checks passive immunity (aggregator hook — no
 * gear grants it yet; §4C: immunity blocks NEW stacks only).
 * @returns {{ success: boolean, blocked?: boolean }}
 */
export function applyToHero(heroId, statusId, stacks = 1) {
    const hero = HeroManager.getHero(heroId);
    const def = getStatusEffect(statusId);
    if (!hero || !def) return { success: false };

    const immunity = hero.aggregator?.query('STATUS_IMMUNITY', statusId) || 0;
    if (immunity > 0) {
        EventBus.publish('status_blocked', { targetId: heroId, statusId });
        return { success: true, blocked: true };
    }

    if (!hero.statuses) hero.statuses = [];
    _applyToList(hero.statuses, def, stacks);

    logger.debug('StatusEffect', `${hero.name} gains [${def.name}] x${stacks}`);
    EventBus.publish('status_applied', { targetType: 'hero', targetId: heroId, statusId, stacks });
    EventBus.publish('heroes_updated', { source: 'status_applied', heroId });
    return { success: true };
}

/**
 * Apply a status to the enemy on a combat card.
 */
export function applyToEnemy(card, statusId, stacks = 1) {
    const def = getStatusEffect(statusId);
    if (!card?.combat || !def) return { success: false };

    if (!card.combat.enemyStatuses) card.combat.enemyStatuses = [];
    _applyToList(card.combat.enemyStatuses, def, stacks);

    EventBus.publish('status_applied', { targetType: 'enemy', targetId: card.id, statusId, stacks });
    return { success: true };
}

/** Shared stacking rules (§4A decrement merge / §4B independent layers). */
function _applyToList(statuses, def, stacks) {
    if (def.stackModel === 'layered') {
        // Each application is its own layer with an independent lifetime.
        for (let i = 0; i < stacks; i++) {
            statuses.push({ id: def.id, stacks: 1, remaining: def.duration ?? 1 });
        }
        return;
    }
    // Decrement model: one instance, re-application adds stacks (capped).
    const existing = statuses.find(s => s.id === def.id);
    if (existing) {
        existing.stacks = Math.min(existing.stacks + stacks, def.maxStacks ?? 99);
    } else {
        statuses.push({ id: def.id, stacks: Math.min(stacks, def.maxStacks ?? 99) });
    }
}

// ---------------------------------------------------------------------------
// The global 5-second clock (§1B) — hero-side periodic effects
// ---------------------------------------------------------------------------

/**
 * Called every frame by GameLoop. Fires the global status tick every 5s:
 * DoTs deal their damage (× stacks), then time-decay statuses lose a stack.
 */
export function tick(delta) {
    heroTickTimer += delta;
    if (heroTickTimer < STATUS_TICK_INTERVAL_MS) return;
    heroTickTimer -= STATUS_TICK_INTERVAL_MS;

    for (const hero of HeroManager.getAllHeroes()) {
        if (!hero.statuses || hero.statuses.length === 0) continue;
        if (hero.status === 'wounded') continue; // retreat already cleansed; safety

        const died = _fireStatusTick(hero.statuses, dmg => {
            HeroManager.modifyHeroHp(hero.id, -dmg);
            EventBus.publish('status_dot_tick', { targetType: 'hero', targetId: hero.id, damage: dmg });
            return hero.hp.current <= 0;
        });

        EventBus.publish('heroes_updated', { source: 'status_tick', heroId: hero.id });
        if (died) {
            // LoopRunner's per-area check routes 0 HP through Forced Retreat.
            logger.info('StatusEffect', `${hero.name} was downed by status damage`);
        }
    }
}

/**
 * Enemy-side periodic effects. Enemies only exist during an encounter, so
 * their clock accumulates on the combat card while the fight runs.
 * @returns {boolean} true if the enemy died to a DoT tick
 */
export function tickEnemyStatuses(card, delta) {
    const combat = card?.combat;
    if (!combat?.enemyStatuses || combat.enemyStatuses.length === 0) return false;

    combat.statusTickTimer = (combat.statusTickTimer || 0) + delta;
    if (combat.statusTickTimer < STATUS_TICK_INTERVAL_MS) return false;
    combat.statusTickTimer -= STATUS_TICK_INTERVAL_MS;

    return _fireStatusTick(combat.enemyStatuses, dmg => {
        combat.enemyHp.current = Math.max(0, combat.enemyHp.current - dmg);
        EventBus.publish('status_dot_tick', { targetType: 'enemy', targetId: card.id, damage: dmg });
        return combat.enemyHp.current <= 0;
    });
}

/**
 * One global tick over a status list: deal summed DoT damage via
 * `dealDamage(dmg) → died`, then decay all 'tick'-decay statuses by 1 stack.
 */
function _fireStatusTick(statuses, dealDamage) {
    let died = false;

    const dotDamage = sumStatusEffect(statuses, 'dot');
    if (dotDamage > 0) {
        died = dealDamage(Math.round(dotDamage)) === true;
    }

    _decay(statuses, 'tick');
    return died;
}

// ---------------------------------------------------------------------------
// Event-based decay (§4A) + combat lifecycle (§3)
// ---------------------------------------------------------------------------

/**
 * Roll the attack-fail chance (Stun) for an attacker, then decay
 * attack-attempt statuses by 1 — every attempt spends a stack, hit or miss.
 * @param {Array} statuses - the ATTACKER's status list
 * @returns {boolean} true if the attack fails
 */
export function rollAttackFailure(statuses) {
    if (!statuses || statuses.length === 0) return false;
    const failChance = sumStatusEffect(statuses, 'attack_fail');
    const failed = failChance > 0 && Math.random() < failChance;
    _decay(statuses, 'attack_attempt');
    return failed;
}

/**
 * A successful hit landed on this entity — decay hit-taken statuses
 * (Armor Shield). Misses and blocks do NOT call this (§4A).
 */
export function notifyHitTaken(statuses) {
    if (!statuses || statuses.length === 0) return;
    _decay(statuses, 'hit_taken');
}

/**
 * A combat encounter resolved for this hero: combat-only statuses clear
 * (§3A) and combat-duration buff layers (Well Fed) lose a duration point.
 */
export function notifyCombatResolved(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.statuses?.length) return;
    clearCombatOnly(hero);
    _decay(hero.statuses, 'combat_resolved');
    EventBus.publish('heroes_updated', { source: 'status_combat_resolved', heroId });
}

/**
 * A loop slot resolved for this hero — slot-duration buff layers (Cookout)
 * lose a duration point.
 */
export function notifySlotResolved(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.statuses?.length) return;
    _decay(hero.statuses, 'slot_resolved');
}

/**
 * Decay pass. Decrement statuses lose a stack; layered statuses lose a
 * duration point per layer. Emptied instances are removed.
 */
function _decay(statuses, decayTrigger) {
    for (let i = statuses.length - 1; i >= 0; i--) {
        const instance = statuses[i];
        const def = getStatusEffect(instance.id);
        if (!def || def.decay !== decayTrigger) continue;

        if (def.stackModel === 'layered') {
            instance.remaining = (instance.remaining ?? 1) - 1;
            if (instance.remaining <= 0) statuses.splice(i, 1);
        } else {
            instance.stacks -= 1;
            if (instance.stacks <= 0) statuses.splice(i, 1);
        }
    }
}

// ---------------------------------------------------------------------------
// Clearing & cleansing (§3B, §4C, §6)
// ---------------------------------------------------------------------------

/** Remove combat-only statuses (fight resolved, §3A). */
export function clearCombatOnly(heroOrId) {
    const hero = typeof heroOrId === 'string' ? HeroManager.getHero(heroOrId) : heroOrId;
    if (!hero?.statuses?.length) return;
    hero.statuses = hero.statuses.filter(s => !getStatusEffect(s.id)?.combatOnly);
}

/**
 * Clear ALL statuses — Forced Retreat cleanse (§6) and loop exit (§3B).
 */
export function clearAll(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.statuses?.length) return;
    hero.statuses = [];
    EventBus.publish('heroes_updated', { source: 'status_cleared', heroId });
}

/**
 * Active cleansing (§4C-2): purge a specific status, or every debuff when
 * statusId is omitted. The hook for Antidote/Curative Broth style cards.
 * @returns {number} instances removed
 */
export function purge(heroId, statusId = null) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.statuses?.length) return 0;
    const before = hero.statuses.length;
    hero.statuses = hero.statuses.filter(s => {
        if (statusId) return s.id !== statusId;
        return getStatusEffect(s.id)?.category !== 'debuff';
    });
    const removed = before - hero.statuses.length;
    if (removed > 0) {
        EventBus.publish('status_purged', { heroId, statusId, removed });
        EventBus.publish('heroes_updated', { source: 'status_purged', heroId });
    }
    return removed;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Task-output multiplier from yield buffs (Cookout): 1.0 = no bonus. */
export function getYieldMultiplier(heroId) {
    const hero = HeroManager.getHero(heroId);
    return 1 + sumStatusEffect(hero?.statuses, 'yield_pct');
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/**
 * Subscribe to loop lifecycle events. Called once from EngineBootstrap.
 */
export function init() {
    // Every resolved loop slot decays slot-duration buffs for the area's hero.
    EventBus.subscribe(AREA_EVENTS.CARD_COMPLETED, ({ areaId }) => {
        const heroId = GameState.state.areaStates?.[areaId]?.assignedHeroId;
        if (heroId) notifySlotResolved(heroId);
    });

    // Leaving an area ends the run and clears all statuses (§3B) — that is
    // wired in HeroAssignmentManager.unassignHero, which knows the departing
    // hero (HERO_CHANGED fires with heroId=null on unassign).

    logger.info('StatusEffect', 'Status engine ready (5s global clock)');
}
