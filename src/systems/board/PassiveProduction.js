// Passive Production: the Guild Hall's free income, on one timer

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { PASSIVE_LAP_BASE_MS } from '../../config/registries/tokenConstants.js';
import { WISHING_WELL_ITEM, wishingWellRank, wishingWellWater, authoredStars } from '../../config/guildUpgrades.js';
import { hallLinesOf } from '../progression/hallModifiers.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { GameState } from '../../state/GameState.js';
import { isGuildHall } from './MatCap.js';
import { passiveLapMs } from './workTime.js';
import * as SpriteLayer from './SpriteLayer.js';

export { PASSIVE_LAP_BASE_MS };

/**
 * Passive Production: items a Token pays on its own, no hero needed, all on ONE lap ({@link lapMs}:
 * 10 minutes, shortened by the guild's Lap Time rules, a Guild Hall star). Each lap pays every line
 * at once, and every Token that pays shares the one lap length.
 *
 * The lines: the type's `trickle` block (`[{ itemId, quantity }]`, authored in the CMS; a line's old
 * `everyMs` is ignored), plus, on the Guild Hall, the Wishing Well's Water (`wishingWellWater` of
 * its rank) and the Well's other stars' lines (`hallModifiers.hallLinesOf`), all read live, so a
 * rank bought mid-lap pays at the new amount on the next payout.
 *
 * The pay drops as loot beside the Token, as a gathered output does (`SpriteLayer.addSprite` with
 * the Token's id): collected on hover or by auto-collect, it flies to the Hall. Nothing reaches the
 * Bank until it is collected, so a full Bank leaves it on the floor.
 *
 * Rides `TimedChanges.tick`, advanced by the tick's `delta` only, in closed form (whole laps), so one
 * big tick pays exactly what many small ones do; in bulk each item drops ONE sprite holding every lap.
 * The lap is read live: a star bought mid-lap keeps the time already run, and a lap already past the
 * new length pays on the next tick.
 *
 * State (saved, on the instance): `clocks.passiveMs`, elapsed ms in the current lap. A save from
 * before the shared timer has `clocks.trickle`, one clock per line; it is migrated on the first tick
 * (and read the same way before then): the lap starts from the furthest-along old clock, wrapped to
 * the lap, so the first payout comes no later than any old line's would have.
 */

/**
 * The lap now, in ms: the base, moved by the guild's Lap Time rules (a Guild Hall star, or a
 * Region's rule) and floored like any speed-up (`workTime.passiveLapMs`).
 */
export function lapMs() {
    return passiveLapMs(getGlobalAggregator().resolveAxis(EFFECT_TYPES.PASSIVE_LAP, PASSIVE_LAP_BASE_MS));
}

/** A positive whole quantity, or 0. */
function qty(n) {
    const q = Math.floor(Number(n));
    return Number.isFinite(q) && q > 0 ? q : 0;
}

/**
 * A Token's Passive Production lines, merged per item: `[{ itemId, quantity, source }]`, where
 * `source` is `'token'` for authored lines, `'wishing_well'` for the Well's Water and `'hall_star'`
 * for a Guild Hall star's line (an item two sources pay keeps the first one's). Empty when it pays
 * nothing.
 *
 * @param {object} instance
 * @param {object} [def] its type (read from the registry when absent)
 * @param {object} [ranks] Guild Hall upgrade ranks (read from the game when absent)
 */
export function linesOf(instance, def = getTokenType(instance?.typeId), ranks = GameState.state?.progress?.guildUpgrades) {
    const byItem = new Map();
    const add = (itemId, quantity, source) => {
        const prev = byItem.get(itemId);
        if (prev) prev.quantity += quantity;
        else byItem.set(itemId, { itemId, quantity, source });
    };
    for (const line of Array.isArray(def?.trickle) ? def.trickle : []) {
        const q = qty(line?.quantity);
        if (line?.itemId && q) add(line.itemId, q, 'token');
    }
    if (instance && isGuildHall(instance)) {
        const water = wishingWellWater(wishingWellRank(ranks || {}));
        if (water > 0) add(WISHING_WELL_ITEM, water, 'wishing_well');
        for (const line of hallLinesOf(authoredStars(), ranks || {})) add(line.itemId, line.quantity, 'hall_star');
    }
    return [...byItem.values()];
}

/** Whether a Token pays anything on the timer (only those get its clock and tooltip). */
export function hasPassiveProduction(instance) {
    return !!instance && linesOf(instance).length > 0;
}

/** Elapsed ms in the current lap, reading an old save's per-line clocks the way the first tick migrates them. */
export function elapsedOf(instance) {
    const clocks = instance?.clocks;
    const own = Number(clocks?.passiveMs);
    if (Number.isFinite(own) && own >= 0) return own;
    if (Array.isArray(clocks?.trickle)) {
        const lap = lapMs();
        let furthest = 0;
        for (const v of clocks.trickle) {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) furthest = Math.max(furthest, n % lap);
        }
        return furthest;
    }
    return 0;
}

/** Ms until the next payout. */
export function nextInMs(instance) {
    return Math.max(0, lapMs() - elapsedOf(instance));
}

/**
 * Advance a Token's Passive Production clock by `delta`, paying every line once per completed lap.
 *
 * @returns {number} how many items were paid (tests)
 */
export function advance(instance, delta) {
    if (!(delta > 0) || !instance) return 0;
    const def = getTokenType(instance.typeId);
    // The cheap test first: every Token on the mat passes through here every tick.
    if (!(Array.isArray(def?.trickle) && def.trickle.length) && !isGuildHall(instance)) return 0;
    const lines = linesOf(instance, def);
    if (!lines.length) return 0;

    const clocks = instance.clocks && typeof instance.clocks === 'object' ? instance.clocks : (instance.clocks = {});
    const lap = lapMs();
    const clock = elapsedOf(instance) + delta;
    delete clocks.trickle;
    const laps = Math.floor(clock / lap);
    clocks.passiveMs = clock - laps * lap;
    if (laps <= 0) return 0;

    let paid = 0;
    for (const line of lines) {
        SpriteLayer.addSprite('item', line.itemId, laps * line.quantity, instance.id);
        paid += laps * line.quantity;
    }
    return paid;
}
