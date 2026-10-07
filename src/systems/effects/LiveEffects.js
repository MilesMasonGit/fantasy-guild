import { EventBus } from '../core/EventBus.js';
import { EFFECTS } from '../../config/registries/effectRegistry.js';
import { statementsFromEntry, normaliseScale } from './effectLibrary.js';
import { KEYWORD } from './statements.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import { STATUS_TICK_INTERVAL_MS } from '../../config/FormulaRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as HeroManager from '../hero/HeroManager.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Any entity may carry live effect instances: `hero.effects = [{ effectId, scale, expiresAt, sourceId }]`,
 * references into the effect library with a clock on them. Nothing here knows what Poison is.
 *
 * ⚠️ Re-application REFRESHES; it never stacks. One effect per entity: reapplying resets its
 * clock and keeps its strength, except that a stronger scale replaces a weaker one (otherwise
 * a better item would silently do nothing).
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
 * Put a library effect on a bearer, for a while.
 *
 * @param {object} bearer  a descriptor from `heroBearer` or a registered source
 * @param {{effectId: string, scale?: number, durationMs?: number}} spec
 * @param {string|null} sourceId  what applied it, for the readout
 * @returns {boolean} whether anything is now carried
 */
export function applyTo(bearer, spec, sourceId = null, fire = null) {
    const target = bearer?.target;
    if (!target || !spec?.effectId || !EFFECTS[spec.effectId]) return false;

    const scale = normaliseScale(spec.scale);

    // No duration means fire it once, NOW (chaining), not on the next tick.
    if (!Number(spec.durationMs)) {
        if (!fire) return false;
        for (const statement of statementsFromEntry(EFFECTS[spec.effectId], { effectId: spec.effectId, scale })) {
            fire(statement, { ...bearer.roles });
        }
        return true;
    }

    const list = listOf(target);
    const existing = list.find(e => e.effectId === spec.effectId);
    const expiresAt = Date.now() + Math.max(0, Number(spec.durationMs) || 0);

    if (existing) {
        // Refresh the clock, and let a stronger application win.
        existing.expiresAt = Math.max(existing.expiresAt, expiresAt);
        existing.scale = Math.max(existing.scale, scale);
        existing.sourceId = sourceId ?? existing.sourceId;
    } else {
        list.push({ effectId: spec.effectId, scale, expiresAt, sourceId });
    }

    syncAggregator(target);
    bearer.notify?.('live_effect_applied');
    return true;
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
export function tickBearer(bearer, fire, now = Date.now()) {
    const target = bearer?.target;
    if (!target?.effects?.length) return 0;
    // A wounded hero is off the board and already cleansed.
    if (bearer.suspended?.()) return 0;

    for (const statement of liveStatements(target)) {
        if (statement?.when?.event !== EFFECT_TICK) continue;
        fire(statement, { ...bearer.roles });
    }

    const before = target.effects.length;
    target.effects = target.effects.filter(e => e.expiresAt > now);
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
 */
export function liveStatements(hero) {
    const out = [];
    for (const instance of hero?.effects || []) {
        const entry = EFFECTS[instance.effectId];
        if (!entry) continue;                       // ContentAudit names it
        out.push(...statementsFromEntry(entry, instance));
    }
    return out;
}

/**
 * What a carried effect contributes continuously: modifiers with a clock (Armor Shield, Well Fed).
 *
 * ⚠️ The combat axes go on the aggregator; the board axes are read live by `resolveAxis`.
 * Live effects follow whichever road their axis already travels, so no reader had to learn
 * about them.
 */
export function modifierStatements(hero) {
    return liveStatements(hero).filter(s => s?.keyword === KEYWORD.PROVIDES);
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
 * The global clock: fire what recurs, drop what has expired.
 *
 * ⚠️ Runs on the same 5-second interval the status engine used (`STATUS_TICK_INTERVAL_MS`),
 * so damage-over-time rates are unchanged.
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

    const now = Date.now();
    for (const bearer of allBearers()) tickBearer(bearer, fire, now);
}

/** Reset the clock. For tests, and for a fresh board. */
export function resetClock() {
    clock = 0;
}
