import { EventBus } from '../core/EventBus.js';
import { EFFECTS } from '../../config/registries/effectRegistry.js';
import { statementsFromEntry, normaliseScale, scaleStatement, statusBlockOf } from './effectLibrary.js';
import { KEYWORD } from './statements.js';
import { EFFECT_TYPES } from './constants.js';
import { heroStatusStackCap } from '../../utils/CombatFormulas.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import { STATUS_TICK_INTERVAL_MS } from '../../config/FormulaRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as HeroManager from '../hero/HeroManager.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import * as GameClock from '../core/GameClock.js';

/**
 * Any entity may carry live effect instances: `hero.effects = [{ effectId, scale, expiresAt, sourceId }]`,
 * references into the effect library with a clock on them. Nothing here knows what Poison is.
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
 * Put a library effect on a bearer, for a while, for the fight (`spec.forFight`), for the swing
 * being made (`spec.forSwing`) or for the work cycle starting (`spec.forCycle`). A status ignores
 * all of them: it has its own lifetime.
 *
 * `forCycle` names the Token whose cycle it lasts (its instance id, set by `LoadoutMoments`), or is
 * `true` for whichever cycle its bearer finishes next. A bound one counts only while its hero works
 * that Token ({@link liveStatements}' `at`), so a cycle left part-way never lends it to another.
 *
 * @param {object} bearer  a descriptor from `heroBearer` or a registered source
 * @param {{effectId: string, scale?: number, durationMs?: number, forFight?: boolean, forSwing?: boolean, forCycle?: string|boolean}} spec
 * @param {string|null} sourceId  what applied it, for the readout
 * @returns {boolean} whether anything is now carried
 */
export function applyTo(bearer, spec, sourceId = null, fire = null) {
    const target = bearer?.target;
    if (!target || !spec?.effectId || !EFFECTS[spec.effectId]) return false;

    const status = statusBlockOf(EFFECTS[spec.effectId]);
    if (status) return applyStatus(bearer, spec, status, sourceId);

    const scale = normaliseScale(spec.scale);
    const forSwing = !!spec.forSwing;
    const forFight = !!spec.forFight || forSwing;
    const forCycle = spec.forCycle ? spec.forCycle : null;

    // No duration means fire it once, NOW (chaining), not on the next tick.
    if (!forFight && !forCycle && !Number(spec.durationMs)) {
        if (!fire) return false;
        for (const statement of statementsFromEntry(EFFECTS[spec.effectId], { effectId: spec.effectId, scale })) {
            fire(statement, { ...bearer.roles });
        }
        return true;
    }

    const list = listOf(target);
    const existing = list.find(e => e.effectId === spec.effectId);
    const expiresAt = (forFight || forCycle)
        ? UNTIL_FIGHT_ENDS
        : GameClock.now() + Math.max(0, Number(spec.durationMs) || 0);

    if (existing) {
        // Refresh the clock, and let a stronger application win.
        existing.scale = Math.max(existing.scale, scale);
        existing.sourceId = sourceId ?? existing.sourceId;
        // A landing for one swing never changes the lifetime of one already carried.
        if (!forSwing) {
            existing.expiresAt = Math.max(existing.expiresAt, expiresAt);
            if (forFight) existing.forFight = true;
            if (forCycle) existing.forCycle = forCycle;
            delete existing.forSwing;
        }
    } else {
        list.push({
            effectId: spec.effectId, scale, expiresAt, sourceId,
            ...(forFight ? { forFight: true } : {}),
            ...(forSwing ? { forSwing: true } : {}),
            ...(forCycle ? { forCycle } : {})
        });
    }

    syncAggregator(target);
    bearer.notify?.('live_effect_applied');
    return true;
}

/**
 * Land one stack of a status (`statusBlockOf`) on a bearer.
 *
 * ⚠️ Only in a fight: a status lasts until its fight ends, so one landing on a gatherer would
 * never end at all. Immunity, and a stack cap moved to 0 (a Hide Vest's −1 on a 1-stack status),
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
        if (block.ticks) instance.ticksLeft = block.ticks;
    } else {
        instance = {
            effectId, scale: normaliseScale(spec.scale), stacks: 1,
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
 * The fight is over: take off everything a bearer was carrying "for the fight".
 * @returns {number} how many instances ended
 */
export function endFightEffects(bearer) {
    const target = bearer?.target;
    if (!target?.effects?.length) return 0;
    const before = target.effects.length;
    target.effects = target.effects.filter(e => !e.forFight);
    const ended = before - target.effects.length;
    if (ended) {
        syncAggregator(target);
        bearer.notify?.('live_effect_expired');
    }
    return ended;
}

/** The same for a hero, by id. */
export function endHeroFightEffects(heroId) {
    const hero = heroId ? HeroManager.getHero(heroId) : null;
    return hero ? endFightEffects(heroBearer(hero)) : 0;
}

/**
 * A work cycle is over: take off what a bearer carried "for the cycle". With `at`, only what was
 * bound to that Token's cycle (and any unbound one); without, every one (a new cycle is starting,
 * so whatever the last one left is over).
 * @param {string|null} [at] the Token whose cycle ended
 * @returns {number} how many instances ended
 */
export function endCycleEffects(bearer, at = null) {
    const target = bearer?.target;
    if (!target?.effects?.length) return 0;
    const ends = (e) => !!e.forCycle && (at == null || e.forCycle === true || e.forCycle === at);
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
 * Run one bearer's clock: fire what recurs, then drop what has expired.
 *
 * @returns {number} how many instances expired
 */
export function tickBearer(bearer, fire, now = GameClock.now()) {
    const target = bearer?.target;
    if (!target?.effects?.length) return 0;
    // A wounded hero is off the board and already cleansed.
    if (bearer.suspended?.()) return 0;

    ticking: for (const instance of [...target.effects]) {
        const entry = EFFECTS[instance.effectId];
        if (!entry) continue;
        const statements = instanceStatements(instance, entry).filter(s => s?.when?.event === EFFECT_TICK);
        if (!statements.length) continue;
        if (instance.stacks != null) {
            EventBus.publish(ENGINE_EVENTS.STATUS_DOT_TICK, { ...whoIs(bearer), statusId: instance.effectId, stacks: instance.stacks });
        }
        for (const statement of statements) {
            // A tick that downed its bearer ended the fight, and every status still to tick with it.
            if (bearer.suspended?.()) break ticking;
            fire(statement, { ...bearer.roles });
        }
    }

    // A status with a tick count spends one; the rest wait for their fight to end.
    for (const instance of target.effects) {
        if (instance.ticksLeft != null) instance.ticksLeft -= 1;
    }

    const before = target.effects.length;
    target.effects = target.effects.filter(e => e.expiresAt > now && !(e.ticksLeft != null && e.ticksLeft <= 0));
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

/** Drop everything a hero is carrying — the defeat cleanse. */
export function clearHero(heroId) {
    return removeFromHero(heroId, null);
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

/** One instance's statements: scaled by its tier, and a status's once more by its stacks. */
function instanceStatements(instance, entry) {
    const statements = statementsFromEntry(entry, instance);
    const stacks = instance.stacks > 1 ? instance.stacks : 1;
    return stacks > 1 ? statements.map(s => scaleStatement(s, stacks)) : statements;
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
 * Push a hero's carried combat modifiers onto their aggregator.
 *
 * ⚠️ Called on every change, because an expiry is a change nobody asks about: a live effect
 * ends on its own, with no player action. Registered under one source id so a re-sync is a
 * clean replace rather than an accumulation.
 */
export function syncAggregator(hero) {
    if (!hero?.aggregator) return;

    const source = 'live:effects';
    hero.aggregator.removeModifiersBySource(source);

    for (const { type, value, category } of HeroEffects.combatContributions(modifierStatements(hero))) {
        hero.aggregator.addModifier({
            type, value, bucket: 'flat', source,
            ...(category ? { target: { category } } : {})
        });
    }

    // ⚠️ Percentage-bucketed combat axes ride along separately: `combatContributions` refuses
    // anything but flat because `ModifierAggregator.query` skips the other buckets. `DAMAGE` has
    // a real percentage reader (`getPercentageBucket`), which is what makes Well Fed expressible.
    for (const statement of modifierStatements(hero)) {
        const payload = statement.payload || {};
        if (payload.bucket !== 'percentage') continue;
        if (!getPaletteEntry(payload.type)?.heroOnly) continue;
        const value = Number(payload.value);
        if (!Number.isFinite(value) || value === 0) continue;
        hero.aggregator.addModifier({ type: payload.type, value, bucket: 'percentage', source });
    }
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

    const now = GameClock.now();
    for (const bearer of allBearers()) tickBearer(bearer, fire, now);
}

/** Reset the clock. For tests, and for a fresh board. */
export function resetClock() {
    clock = 0;
}
