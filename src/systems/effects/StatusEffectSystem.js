// Heroes carry statuses on `hero.statuses` (persisted); enemies on `card.combat.enemyStatuses`
// (ephemeral). Same instance shape: { id, stacks, remaining? }, `remaining` only for layered buffs.
//
// Periodic effects tick on one global 5s clock. DoT ticks are true damage: they bypass
// Armor/Block and CAN drop a hero to 0, which publishes `hero_downed` for `BoardCombat`.

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import * as HeroManager from '../hero/HeroManager.js';
import { logger } from '../../utils/Logger.js';
import { STATUS_TICK_INTERVAL_MS } from '../../config/FormulaRegistry.js';
import {
    getStatusEffect,
    sumStatusEffect,
} from '../../config/registries/statusRegistry.js';
import { EFFECT_TYPES } from './constants.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

let heroTickTimer = 0;

/**
 * Apply a status to a hero. Immunity (aggregator hook) blocks NEW stacks only.
 * @returns {{ success: boolean, blocked?: boolean }}
 */
export function applyToHero(heroId, statusId, stacks = 1) {
    const hero = HeroManager.getHero(heroId);
    const def = getStatusEffect(statusId);
    if (!hero || !def) return { success: false };

    // ⚠️ Axis name from `EFFECT_TYPES`, not a string literal, so every writer and this reader spell it the same.
    const immunity = hero.aggregator?.query(EFFECT_TYPES.STATUS_IMMUNITY, statusId) || 0;
    if (immunity > 0) {
        EventBus.publish(ENGINE_EVENTS.STATUS_BLOCKED, { targetId: heroId, statusId });
        return { success: true, blocked: true };
    }

    if (!hero.statuses) hero.statuses = [];
    _applyToList(hero.statuses, def, stacks);

    logger.debug('StatusEffect', `${hero.name} gains [${def.name}] x${stacks}`);
    EventBus.publish(ENGINE_EVENTS.STATUS_APPLIED, { targetType: 'hero', targetId: heroId, statusId, stacks });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'status_applied', heroId });
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

    EventBus.publish(ENGINE_EVENTS.STATUS_APPLIED, { targetType: 'enemy', targetId: card.id, statusId, stacks });
    return { success: true };
}

/** Shared stacking rules: decrement merge, or independent layers. */
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
            EventBus.publish(ENGINE_EVENTS.STATUS_DOT_TICK, { targetType: 'hero', targetId: hero.id, damage: dmg });
            return hero.hp.current <= 0;
        });

        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'status_tick', heroId: hero.id });
        if (died) {
            // Announced rather than resolved here: the whole cost of dying is implemented once, in
            // `BoardCombat.resolveDefeat`, and this module must not import BoardCombat (a static
            // cycle). `BoardCombat.init` owns the response.
            // ⚠️ There must never be a second subscriber that also kills.
            logger.info('StatusEffect', `${hero.name} was downed by status damage`);
            EventBus.publish(ENGINE_EVENTS.HERO_DOWNED, { heroId: hero.id, cause: 'status' });
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
        EventBus.publish(ENGINE_EVENTS.STATUS_DOT_TICK, { targetType: 'enemy', targetId: card.id, damage: dmg });
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
 * (Armor Shield). Misses and blocks do NOT call this.
 */
export function notifyHitTaken(statuses) {
    if (!statuses || statuses.length === 0) return;
    _decay(statuses, 'hit_taken');
}

/**
 * A combat encounter resolved for this hero: combat-only statuses clear
 * and combat-duration buff layers (Well Fed) lose a duration point.
 */
export function notifyCombatResolved(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.statuses?.length) return;
    clearCombatOnly(hero);
    _decay(hero.statuses, 'combat_resolved');
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'status_combat_resolved', heroId });
}

/**
 * A work cycle resolved for this hero: cycle-duration buff layers (Cookout) lose a duration
 * point. The decay trigger keeps its authored name `slot_resolved` so no status content
 * has to be re-authored.
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

/** Remove combat-only statuses. */
export function clearCombatOnly(heroOrId) {
    const hero = typeof heroOrId === 'string' ? HeroManager.getHero(heroOrId) : heroOrId;
    if (!hero?.statuses?.length) return;
    hero.statuses = hero.statuses.filter(s => !getStatusEffect(s.id)?.combatOnly);
}

/** Clear ALL statuses (the defeat cleanse). */
export function clearAll(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.statuses?.length) return;
    hero.statuses = [];
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'status_cleared', heroId });
}

/**
 * Active cleansing: purge a specific status, or every debuff when statusId is omitted.
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
        EventBus.publish(ENGINE_EVENTS.STATUS_PURGED, { heroId, statusId, removed });
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'status_purged', heroId });
    }
    return removed;
}

/** Task-output multiplier from yield buffs (Cookout): 1.0 = no bonus. */
export function getYieldMultiplier(heroId) {
    const hero = HeroManager.getHero(heroId);
    return 1 + sumStatusEffect(hero?.statuses, 'yield_pct');
}

/**
 * Subscribe to board cycle events. Called once from EngineBootstrap.
 */
export function init() {
    // Every completed Token cycle decays cycle-duration buffs for the hero who worked it.
    EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, ({ heroId }) => {
        if (heroId) notifySlotResolved(heroId);
    });

    // Statuses are NOT cleared when a hero moves between tiles (the most frequent action) or a
    // buff the player just bought would vanish. The clear points are defeat (`clearAll`) and
    // the per-fight clear in `notifyCombatResolved`.

    logger.info('StatusEffect', 'Status engine ready (5s global clock)');
}
