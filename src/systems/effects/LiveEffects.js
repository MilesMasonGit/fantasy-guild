import { EventBus } from '../core/EventBus.js';
import { EFFECTS } from '../../config/registries/effectRegistry.js';
import { statementsFromEntry, normaliseScale, scaleStatement, statusBlockOf, strengthenStatement } from './effectLibrary.js';
import { KEYWORD } from './statements.js';
import { EFFECT_TYPES } from './constants.js';
import { heroStatusStackCap } from '../combat/CombatFormulas.js';
import { registerProvides } from './providesModifiers.js';
import { STATUS_TICK_INTERVAL_MS } from '../../config/FormulaRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as HeroManager from '../hero/HeroManager.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Any entity may carry live effect instances: `hero.effects = [{ effectId, scale, remainingMs, sourceId }]`,
 * references into the effect library with a clock on them. Nothing here knows what Poison is.
 *
 * ⚠️ A timed instance holds the game time it has left (`remainingMs`), spent by the effect clock
 * ({@link tick}), never a wall-clock end: a reload, "Load as I left it" or a paused game must not
 * spend it, and a catch-up spends it as it plays.
 *
 * ⚠️ Re-application REFRESHES; it never stacks. One effect per entity: reapplying resets its
 * clock and keeps its strength, except that a stronger scale replaces a weaker one (otherwise
 * a better item would silently do nothing).
 *
 * ⚠️ Except a **status**: a library entry carrying a `status` block (`statusBlockOf`). Each landing
 * adds a stack up to its cap, its rules count once per stack, and it ends with its fight or after
 * its `ticks`, whichever comes first. A status lands only on someone in a fight.
 *
 * ⚠️ This module never resolves a death. Dying is implemented once, in
 * `BoardCombat.resolveDefeat`, and importing it here would be a static cycle. There must
 * never be a second subscriber that also kills.
 *
 * A bearer is anything with `effects` and an `aggregator`, described by a descriptor (target,
 * roles that name it in a sentence, how to announce a change). `HeroManager` supplies heroes;
 * anything else registers via `registerBearerSource`, so this module never imports the board.
 */

/** The moment a live effect's own statements fire on. */
export const EFFECT_TICK = 'EFFECT_TICK';

let clock = 0;

/** Every live instance a bearer is carrying. Created on first use. */
function listOf(target) {
    if (!target.effects) target.effects = [];
    return target.effects;
}

/**
 * Extra places live bearers come from, beyond the roster.
 *
 * ⚠️ Registered rather than imported, and for the same reason `fire` is injected into `tick`:
 * importing the board here would make this module unusable from a test and create an import cycle.
 */
const bearerSources = new Set();

/** Announce a source of live bearers. Idempotent — registering twice is once. */
export function registerBearerSource(fn) {
    if (typeof fn === 'function') bearerSources.add(fn);
}

/**
 * Whether a hero is in a fight, asked as a status lands. Registered by the board for the same
 * reason bearer sources are; until then no hero counts as fighting, so no status lands on one.
 */
let fightCheck = null;

/** Register the board's "is this hero fighting?" (`heroId => boolean`). */
export function setFightCheck(fn) {
    fightCheck = typeof fn === 'function' ? fn : null;
}

/** Whether a bearer is in a fight: a fight's enemy always is; a hero when the board says so. */
function inFight(bearer) {
    if (bearer?.roles?.selfFightId != null) return true;
    const heroId = bearer?.roles?.selfHeroId;
    return !!heroId && !!fightCheck?.(heroId);
}

/** A bearer's health now: a hero's, or a fight's enemy's; null for anything else. */
function healthOf(target) {
    const hp = target?.hp?.current ?? target?.combat?.enemyHp?.current;
    return Number.isFinite(hp) ? hp : null;
}

/** Who a bearer is, in the words the status events use. */
function whoIs(bearer) {
    if (bearer?.roles?.selfHeroId) return { targetType: 'hero', targetId: bearer.roles.selfHeroId };
    return { targetType: 'enemy', targetId: bearer?.roles?.selfFightId ?? null };
}

/**
 * The descriptor for a hero. `roles` is what a carried statement fires with: `self` is the
 * PERSON, not a square, which is why `selfHeroId` exists.
 */
export function heroBearer(hero) {
    return {
        target: hero,
        name: hero?.name || hero?.id || 'hero',
        roles: { self: null, selfHeroId: hero?.id ?? null, actor: null, source: null },
        suspended: () => hero?.status === 'wounded',
        notify: (source) => EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source, heroId: hero?.id })
    };
}

/** Every bearer the game currently has: the roster, plus whoever registered. */
function allBearers() {
    const out = [];
    for (const hero of HeroManager.getAllHeroes()) out.push(heroBearer(hero));
    for (const source of bearerSources) {
        try {
            for (const bearer of source() || []) if (bearer?.target) out.push(bearer);
        } catch (err) {
            logger.warn('LiveEffects', `a bearer source threw: ${err?.message || err}`);
        }
    }
    return out;
}

/**
 * The clock reading a "for the fight" or "for the cycle" instance carries: it never runs out by
 * time, only when its fight ends (`endFightEffects`) or its cycle does (`endCycleEffects`). A plain
 * number, so a save written mid-fight holds it as such.
 */
const UNTIL_FIGHT_ENDS = Number.MAX_SAFE_INTEGER;

/**
 * A landing's strength (Strong Drink): a factor of 0 or more, or null for none (1, absent, not a
 * number). An instance stores one only when it is not null, so a save without Strong Drink is as it was.
 */
function boostOf(value) {
    const n = Number(value);
    return value == null || !Number.isFinite(n) || n === 1 ? null : Math.max(0, n);
}

/** Keep the stronger of an instance's boost and a new landing's (none counts as 1). */
function keepStronger(instance, boost) {
    const now = instance.boost ?? 1;
    const next = Math.max(now, boost ?? 1);
    if (next === now) return;
    if (next === 1) delete instance.boost;
    else instance.boost = next;
}

/**
 * Put a library effect on a bearer, for a while, for the fight (`spec.forFight`), for the swing
 * being made (`spec.forSwing`), until an attack on it is over (`spec.forAttack`) or for the work
 * cycle starting (`spec.forCycle`). A status ignores all of them: it has its own lifetime.
 *
 * `forAttack` is the number, in this fight, of the attack on the bearer it lasts through (an enemy
 * move's Flutter: the hero's next swing, hit or miss); {@link endAttackEffects} takes it off as that
 * swing ends. It ends with the fight too.
 *
 * `forCycle` names the Token whose cycle it lasts (its instance id, set by `LoadoutMoments`), or is
 * `true` for whichever cycle its bearer finishes next. A bound one counts only while its hero works
 * that Token ({@link liveStatements}' `at`), so a cycle left part-way never lends it to another.
 *
 * `boost` (a dose's Strong Drink, set by `LoadoutMoments`) multiplies every number the effect
 * provides while it is carried ({@link boostOf}); a stronger landing wins, as a higher scale does.
 *
 * `poison` (a poison's item id, set by `LoadoutMoments` on a dose's "for N attacks" rule) marks an
 * effect carried for the fight that also comes off when that poison's attacks run out
 * ({@link endPoisonEffects}).
 *
 * @param {object} bearer  a descriptor from `heroBearer` or a registered source
 * @param {{effectId: string, scale?: number, durationMs?: number, forFight?: boolean, forSwing?: boolean, forAttack?: number, forCycle?: string|boolean, boost?: number}} spec
 * @param {string|null} sourceId  what applied it, for the readout
 * @returns {boolean} whether anything is now carried
 */
export function applyTo(bearer, spec, sourceId = null, fire = null) {
    const target = bearer?.target;
    if (!target || !spec?.effectId || !EFFECTS[spec.effectId]) return false;

    const status = statusBlockOf(EFFECTS[spec.effectId]);
    if (status) return applyStatus(bearer, spec, status, sourceId);

    const scale = normaliseScale(spec.scale);
    const boost = boostOf(spec.boost);
    const forSwing = !!spec.forSwing;
    const forAttack = !forSwing && Number(spec.forAttack) > 0 ? Number(spec.forAttack) : null;
    if (forAttack != null) return applyForAttack(bearer, spec.effectId, scale, forAttack, sourceId);
    const forFight = !!spec.forFight || forSwing;
    const forCycle = spec.forCycle ? spec.forCycle : null;

    // No duration means fire it once, NOW (chaining), not on the next tick.
    if (!forFight && !forCycle && !Number(spec.durationMs)) {
        if (!fire) return false;
        for (const statement of statementsFromEntry(EFFECTS[spec.effectId], { effectId: spec.effectId, scale })) {
            fire(boost === null ? statement : strengthenStatement(statement, boost), { ...bearer.roles });
        }
        return true;
    }

    const list = listOf(target);
    const existing = list.find(e => e.effectId === spec.effectId);
    const timed = !forFight && !forCycle;
    const leftMs = timed ? timeLeftFor(spec.durationMs) : null;

    if (existing) {
        // Refresh the clock, and let a stronger application win.
        existing.scale = Math.max(existing.scale, scale);
        keepStronger(existing, boost);
        existing.sourceId = sourceId ?? existing.sourceId;
        // A landing for one swing never changes the lifetime of one already carried.
        if (!forSwing) {
            // Carried for the fight and for a while, both lives stand: the fight's holds it to the
            // fight's end, and what is left of the while carries on after (`endFightEffects`).
            if (timed && existing.forFight) keepWhile(existing, leftMs);
            if (forFight && !existing.forFight && !existing.forCycle) keepWhile(existing, existing.remainingMs);
            if (timed && existing.remainingMs != null) {
                existing.remainingMs = Math.max(existing.remainingMs, leftMs);
            } else if (!timed && existing.remainingMs != null) {
                delete existing.remainingMs;
                existing.expiresAt = UNTIL_FIGHT_ENDS;
            }
            if (forFight) existing.forFight = true;
            if (forCycle) existing.forCycle = forCycle;
            if (spec.poison && existing.forFight && existing.poison == null && existing.remainingMs == null) existing.poison = spec.poison;
            delete existing.forSwing;
            delete existing.forAttack;
        }
    } else {
        list.push({
            effectId: spec.effectId, scale,
            ...(timed ? { remainingMs: leftMs } : { expiresAt: UNTIL_FIGHT_ENDS }),
            sourceId,
            ...(boost !== null ? { boost } : {}),
            ...(forFight ? { forFight: true } : {}),
            ...(forSwing ? { forSwing: true } : {}),
            ...(forCycle ? { forCycle } : {}),
            ...(forFight && !forSwing && spec.poison ? { poison: spec.poison } : {})
        });
    }

    syncAggregator(target);
    bearer.notify?.('live_effect_applied');
    return true;
}

/**
 * The game time a landing lasts `durationMs` for, as an instance holds it. What the effect clock has
 * gathered towards its next tick is added, because that tick spends a whole interval: so it ends on
 * the first tick at least `durationMs` after it landed.
 */
function timeLeftFor(durationMs) {
    return Math.max(0, Number(durationMs) || 0) + clock;
}

/** Remember the while an instance also carries for the fight (`whileLeftMs`), the longer one. */
function keepWhile(instance, leftMs) {
    if (!(leftMs > 0)) return;
    instance.whileLeftMs = Math.max(Number(instance.whileLeftMs) || 0, leftMs);
}

/**
 * Put a plain (not status) effect on a bearer until attack number `untilAttack` on it is over. One
 * already carried for the swing now lasts that long; one carried longer (the fight, a while) keeps its
 * lifetime; one carried for an attack lasts to the later of the two.
 */
function applyForAttack(bearer, effectId, scale, untilAttack, sourceId) {
    const target = bearer.target;
    const list = listOf(target);
    const existing = list.find(e => e.effectId === effectId);
    if (existing) {
        existing.scale = Math.max(existing.scale, scale);
        existing.sourceId = sourceId ?? existing.sourceId;
        if (existing.forSwing) {
            delete existing.forSwing;
            existing.forAttack = untilAttack;
        } else if (existing.forAttack != null) {
            existing.forAttack = Math.max(existing.forAttack, untilAttack);
        }
    } else {
        list.push({ effectId, scale, expiresAt: UNTIL_FIGHT_ENDS, sourceId, forFight: true, forAttack: untilAttack });
    }
    syncAggregator(target);
    bearer.notify?.('live_effect_applied');
    return true;
}

/**
 * Land one stack of a status (`statusBlockOf`) on a bearer.
 *
 * ⚠️ Only in a fight: a status lasts until its fight ends, so one landing on a gatherer would
 * never end at all. Immunity, and a stack cap moved to 0 (a Status Stack Limit of −1 on a 1-stack status),
 * block it, said as `STATUS_BLOCKED`.
 */
function applyStatus(bearer, spec, block, sourceId) {
    const target = bearer.target;
    const effectId = spec.effectId;
    if (!inFight(bearer)) return false;

    const who = whoIs(bearer);
    const blocked = () => {
        EventBus.publish(ENGINE_EVENTS.STATUS_BLOCKED, { ...who, statusId: effectId });
        return false;
    };
    if ((target.aggregator?.query(EFFECT_TYPES.STATUS_IMMUNITY, effectId) || 0) > 0) return blocked();
    const cap = heroStatusStackCap(target, effectId, block.stacks);
    if (cap === 0) return blocked();

    const list = listOf(target);
    let instance = list.find(e => e.effectId === effectId);
    if (instance) {
        // ⚠️ Never below what is already carried: a cap lowered mid-fight stops new stacks, it
        // does not strip old ones.
        const stacks = instance.stacks || 1;
        instance.stacks = Math.max(stacks, Math.min(stacks + 1, cap));
        instance.scale = Math.max(instance.scale, normaliseScale(spec.scale));
        keepStronger(instance, boostOf(spec.boost));
        if (block.ticks) instance.ticksLeft = block.ticks;
    } else {
        const boost = boostOf(spec.boost);
        instance = {
            effectId, scale: normaliseScale(spec.scale), stacks: 1,
            ...(boost !== null ? { boost } : {}),
            ...(block.ticks ? { ticksLeft: block.ticks } : {}),
            expiresAt: UNTIL_FIGHT_ENDS, forFight: true, sourceId
        };
        list.push(instance);
    }

    syncAggregator(target);
    bearer.notify?.('status_applied');
    EventBus.publish(ENGINE_EVENTS.STATUS_APPLIED, { ...who, statusId: effectId, stacks: instance.stacks });
    return true;
}

/** The statuses a fighter carries, for the readout: `{ effectId, stacks, ticksLeft }`. */
export function statusesOf(target) {
    return (target?.effects || [])
        .filter(e => e.stacks != null)
        .map(e => ({ effectId: e.effectId, stacks: e.stacks, ticksLeft: e.ticksLeft ?? null }));
}

/**
 * A swing has been made: take off everything carried "for the swing" (a boss's heavy strike).
 * @returns {number} how many instances ended
 */
export function endSwingEffects(target) {
    if (!target?.effects?.length) return 0;
    const before = target.effects.length;
    target.effects = target.effects.filter(e => !e.forSwing);
    const ended = before - target.effects.length;
    if (ended) syncAggregator(target);
    return ended;
}

/**
 * Attack number `attack` on a fighter is over (hit or miss): take off what it carried until then
 * ({@link applyTo}'s `forAttack`).
 * @returns {number} how many instances ended
 */
export function endAttackEffects(target, attack) {
    if (!target?.effects?.length || !target.effects.some(e => e.forAttack != null && e.forAttack <= attack)) return 0;
    const before = target.effects.length;
    target.effects = target.effects.filter(e => !(e.forAttack != null && e.forAttack <= attack));
    syncAggregator(target);
    return before - target.effects.length;
}

/**
 * The fight is over: take off everything a bearer was carrying "for the fight".
 * @returns {number} how many instances ended
 */
export function endFightEffects(bearer) {
    const target = bearer?.target;
    if (!target?.effects?.length) return 0;
    const before = target.effects.length;
    target.effects = target.effects.filter(e => !e.forFight || outlivesFight(e));
    const ended = before - target.effects.length;
    if (ended) {
        syncAggregator(target);
        bearer.notify?.('live_effect_expired');
    }
    return ended;
}

/**
 * Whether an instance carried for the fight also has a while left beyond it: then it stays, carried
 * for the rest of that while from here on.
 */
function outlivesFight(instance) {
    if (!(instance.whileLeftMs > 0)) return false;
    instance.remainingMs = instance.whileLeftMs;
    delete instance.whileLeftMs;
    delete instance.expiresAt;
    delete instance.forFight;
    delete instance.forSwing;
    delete instance.forAttack;
    return true;
}

/**
 * Poison `itemId`'s attacks have run out mid-fight: take off what its dose put on this bearer for the
 * fight (`poison`). The rest of the fight goes unpoisoned.
 * @returns {number} how many instances ended
 */
export function endPoisonEffects(target, itemId) {
    if (!itemId || !target?.effects?.some(e => e.poison === itemId)) return 0;
    const before = target.effects.length;
    target.effects = target.effects.filter(e => e.poison !== itemId);
    syncAggregator(target);
    return before - target.effects.length;
}

/** The same for a hero, by id. */
export function endHeroFightEffects(heroId) {
    const hero = heroId ? HeroManager.getHero(heroId) : null;
    return hero ? endFightEffects(heroBearer(hero)) : 0;
}

/**
 * A work cycle is over: take off what a bearer carried "for the cycle". With `at`, only what was
 * bound to that Token's cycle (and any unbound one); without, every one.
 * @param {string|null} [at] the Token whose cycle ended
 * @returns {number} how many instances ended
 */
export function endCycleEffects(bearer, at = null) {
    return endWhere(bearer, (e) => !!e.forCycle && (at == null || e.forCycle === true || e.forCycle === at));
}

/**
 * A work cycle is starting at Token `at`: take off what another Token's cycle left bound to the
 * bearer (a cycle left part-way). An unbound one stays: a Token's rule may have put it there for
 * this very cycle as it started.
 * @returns {number} how many instances ended
 */
export function endOtherCycleEffects(bearer, at) {
    return endWhere(bearer, (e) => !!e.forCycle && e.forCycle !== true && e.forCycle !== at);
}

/** Take off every instance `ends` says, and say so once. */
function endWhere(bearer, ends) {
    const target = bearer?.target;
    if (!target?.effects?.length) return 0;
    if (!target.effects.some(ends)) return 0;
    const before = target.effects.length;
    target.effects = target.effects.filter(e => !ends(e));
    const ended = before - target.effects.length;
    syncAggregator(target);
    bearer.notify?.('live_effect_expired');
    return ended;
}

/** The same for a hero, by id. */
export function endHeroCycleEffects(heroId, at = null) {
    const hero = heroId ? HeroManager.getHero(heroId) : null;
    return hero ? endCycleEffects(heroBearer(hero), at) : 0;
}

/** `endOtherCycleEffects` for a hero, by id. */
export function endHeroOtherCycleEffects(heroId, at) {
    const hero = heroId ? HeroManager.getHero(heroId) : null;
    return hero ? endOtherCycleEffects(heroBearer(hero), at) : 0;
}

/** Take one library effect off a bearer. `null` removes every one. */
export function removeFrom(bearer, effectId = null) {
    const target = bearer?.target;
    if (!target?.effects?.length) return 0;

    const before = target.effects.length;
    target.effects = effectId ? target.effects.filter(e => e.effectId !== effectId) : [];
    const removed = before - target.effects.length;
    if (removed) {
        syncAggregator(target);
        bearer.notify?.('live_effect_removed');
    }
    return removed;
}

/**
 * Run one bearer's clock: fire what recurs, spend `elapsedMs` of game time, then drop what has expired.
 *
 * @returns {number} how many instances expired
 */
export function tickBearer(bearer, fire, elapsedMs = STATUS_TICK_INTERVAL_MS) {
    const target = bearer?.target;
    if (!target?.effects?.length) return 0;
    // A wounded hero is off the board and already cleansed.
    if (bearer.suspended?.()) return 0;

    ticking: for (const instance of [...target.effects]) {
        const entry = EFFECTS[instance.effectId];
        if (!entry) continue;
        const statements = instanceStatements(instance, entry).filter(s => s?.when?.event === EFFECT_TICK);
        if (!statements.length) continue;
        const status = instance.stacks != null ? { stacks: instance.stacks, hp: healthOf(target) } : null;
        let downed = false;
        for (const statement of statements) {
            // A tick that downed its bearer ended the fight, and every status still to tick with it.
            if (bearer.suspended?.()) { downed = true; break; }
            fire(statement, { ...bearer.roles });
        }
        // Said after its rules ran, so the combat screen can show what the tick did.
        if (status) {
            const after = healthOf(target);
            EventBus.publish(ENGINE_EVENTS.STATUS_DOT_TICK, {
                ...whoIs(bearer), statusId: instance.effectId, stacks: status.stacks,
                hpChange: status.hp != null && after != null ? after - status.hp : null
            });
        }
        if (downed) break ticking;
    }

    // A status with a tick count spends one; the rest wait for their fight to end.
    for (const instance of target.effects) {
        if (instance.ticksLeft != null) instance.ticksLeft -= 1;
        if (instance.remainingMs != null) instance.remainingMs -= elapsedMs;
        if (instance.whileLeftMs != null) instance.whileLeftMs = Math.max(0, instance.whileLeftMs - elapsedMs);
    }

    const before = target.effects.length;
    target.effects = target.effects.filter(e => !(e.remainingMs <= 0) && !(e.ticksLeft != null && e.ticksLeft <= 0));
    const expired = before - target.effects.length;
    if (expired) {
        logger.debug('LiveEffects', `${bearer.name} lost ${expired} effect(s)`);
        syncAggregator(target);
        bearer.notify?.('live_effect_expired');
    }
    return expired;
}

/** Put a library effect on a hero, by id. The roster's shorthand for `applyTo`. */
export function applyToHero(heroId, spec, sourceId = null, fire = null) {
    const hero = HeroManager.getHero(heroId);
    return hero ? applyTo(heroBearer(hero), spec, sourceId, fire) : false;
}

/** Whether an entity is carrying a given library effect right now. */
export function carries(target, effectId) {
    return (target?.effects || []).some(e => e.effectId === effectId);
}

/** The same question about a hero, under the name its callers already use. */
export const heroCarries = carries;

/** Take one library effect off a hero, by id. `null` removes every one. */
export function removeFromHero(heroId, effectId = null) {
    const hero = HeroManager.getHero(heroId);
    return hero ? removeFrom(heroBearer(hero), effectId) : 0;
}

/**
 * The statements a hero's live effects contribute, already scaled and stamped.
 *
 * Shaped exactly like `HeroEffects.loadoutStatements`, so a consumer that reads
 * one can read the other without learning a second thing.
 *
 * `at`, when given, is the Token the hero is working: an effect bound to another Token's cycle
 * ("for the cycle", applied as that cycle started) is left out, so a cycle abandoned part-way never
 * lends its potion to the next Token. Without it, every effect counts.
 */
export function liveStatements(hero, at = undefined) {
    const out = [];
    for (const instance of hero?.effects || []) {
        if (at !== undefined && instance.forCycle && instance.forCycle !== true && instance.forCycle !== at) continue;
        const entry = EFFECTS[instance.effectId];
        if (!entry) continue;                       // ContentAudit names it
        out.push(...instanceStatements(instance, entry));
    }
    return out;
}

/**
 * One instance's statements: scaled by its tier, a status's once more by its stacks, and made stronger
 * by its `boost` (a dose's Strong Drink).
 */
function instanceStatements(instance, entry) {
    const statements = statementsFromEntry(entry, instance);
    const stacks = instance.stacks > 1 ? instance.stacks : 1;
    const stacked = stacks > 1 ? statements.map(s => scaleStatement(s, stacks)) : statements;
    return instance.boost != null ? stacked.map(s => strengthenStatement(s, instance.boost)) : stacked;
}

/**
 * What a carried effect contributes continuously: modifiers with a clock (Armor Shield, Well Fed).
 *
 * ⚠️ The combat axes go on the aggregator; the board axes are read live by `resolveAxis`.
 * Live effects follow whichever road their axis already travels, so no reader had to learn
 * about them. `at`: see {@link liveStatements}.
 */
export function modifierStatements(hero, at = undefined) {
    return liveStatements(hero, at).filter(s => s?.keyword === KEYWORD.PROVIDES);
}

/**
 * What a carried effect hands the cycle its hero finishes at Token `at`: its standing `Grants` (a
 * Birdwatcher's chance of a Bird Nest). A moment's grant fires on its moment instead.
 */
export function grantStatements(hero, at = undefined) {
    return liveStatements(hero, at).filter(s => s?.keyword === KEYWORD.GRANTS && !s.when?.event);
}

/**
 * Push a bearer's carried combat modifiers onto its aggregator (`providesModifiers.registerProvides`).
 *
 * ⚠️ Called on every change, because an expiry is a change nobody asks about: a live effect
 * ends on its own, with no player action. Registered under one source id so a re-sync is a
 * clean replace rather than an accumulation.
 */
export function syncAggregator(hero) {
    if (!hero?.aggregator) return;
    registerProvides(hero.aggregator, 'live:effects', modifierStatements(hero));
}

/**
 * The global clock: fire what recurs, drop what has expired. Every `STATUS_TICK_INTERVAL_MS`
 * (3 s), for every bearer at once: heroes in roster order, then each live fight's enemy.
 *
 * @param {number} delta ms since the last frame
 * @param {(statement: object, roles: object) => void} fire  how to run one
 *   statement. Injected rather than imported so this module stays free of the board (usable from
 *   a test, no import cycles).
 */
export function tick(delta, fire) {
    clock += delta;
    if (clock < STATUS_TICK_INTERVAL_MS) return;
    clock -= STATUS_TICK_INTERVAL_MS;

    for (const bearer of allBearers()) tickBearer(bearer, fire, STATUS_TICK_INTERVAL_MS);
}

/** Reset the clock. For tests, and for a fresh board. */
export function resetClock() {
    clock = 0;
}
