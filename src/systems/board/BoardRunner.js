// Fantasy Guild — The board's cycle engine (7×7 Playmat rework, Phase 4)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as InputAllocator from './InputAllocator.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * BoardRunner — every Token on the board, ticking.
 *
 * ## The fast path
 * 99% of ticks only add `delta` to a countdown. The expensive work — paying
 * inputs, granting output, spending a charge — happens only at the rare moment
 * a timer hits zero. With up to 48 live tiles at 10Hz that discipline matters
 * more than it did with 12 areas, not less.
 *
 * Tiles are a sparse map, so an early board with four Tokens iterates four
 * times, not forty-nine.
 *
 * ## A Token runs when four things are true
 *  1. It has a **config** — Context, Buff and Structure Tokens are inert by
 *     design; they work by adjacency (Phase 5), not by running.
 *  2. It has a **hero**, unless it is a Passive Generator (D-53, D-116).
 *  3. That hero meets its **skill requirement** — Access (D-67).
 *  4. Its **inputs are available** (D-127). No partial cycles: full speed or
 *     waiting.
 *
 * Fail 2 and the tile is quietly idle. Fail 3 or 4 *with a hero present* and it
 * raises a **red alert mark** (D-114), because that is a problem the player can
 * act on. Fail 2 alone raises nothing — with ~8 heroes on 48 tiles most of the
 * board is unstaffed at any moment, and flagging all of it would make the mark
 * meaningless (D-149).
 *
 * ## What this pass deliberately does NOT do (roadmap G-1)
 * A hero is **a gate, and only a gate**. D-67 gives them three board effects —
 * Speed, Access, Efficiency — and only **Access** is implemented. Hero level
 * does not change cycle time or input cost, so a level 99 hero works a Forest at
 * exactly the speed a level 1 hero does.
 *
 * That is a knowing hole, deferred to the hero rework. **Do not quietly fill it
 * in because it looks missing** — it is in the roadmap's deferred table.
 */

/** Tick counter, so progress events don't fire at full rate. */
let tickCounter = 0;

/** Publish progress every N engine ticks (~3/sec at 10Hz). */
const PROGRESS_EVERY = 3;

/** Why a staffed Token cannot work. Drives the tile's single alert mark (D-85). */
export const ALERT = {
    INPUTS: 'inputs',
    ACCESS: 'access'
};

/**
 * Whether the hero on a Token is qualified to work it.
 *
 * **Access is the only thing gating a player from high-tier content early**
 * (D-67), which makes it the load-bearing half of what a hero contributes.
 */
function heroMeetsRequirement(heroId, config) {
    const required = config.skillRequired || 0;
    if (required <= 0) return true;
    if (!heroId) return false;
    return SkillSystem.meetsRequirement(heroId, { skill: config.skill, level: required });
}

/** Set or clear a tile's alert, publishing only on an actual change. */
function setAlert(instance, index, reason) {
    if (instance.alert === reason) return;
    instance.alert = reason || null;
    EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { tile: index, alert: instance.alert });
}

/**
 * One Token finished a cycle.
 *
 * Order matters: **pay first, then produce.** Deciding the whole exchange before
 * any of it happens is what stops a Token handing out output it cannot afford —
 * the bug `CardPreflight` was written for, kept as a rule now that its old home
 * is gone.
 */
function completeCycle(index, instance, def) {
    const config = def.config;

    if (!InputAllocator.consumeInputs(config.inputs)) {
        // Raced by another Token between the availability check and here.
        // Keep the progress and wait — the cycle is not lost, only delayed.
        InputAllocator.noteStarved(instance.typeId);
        setAlert(instance, index, ALERT.INPUTS);
        return;
    }

    instance.cycleElapsedMs = 0;

    // Output lands on the BOARD, not in the Bank (D-40). It is not banked until
    // collected, and if the Bank is full it simply waits there (D-138).
    for (const output of config.outputs || []) {
        const chance = output.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;
        SpriteLayer.addSprite('item', output.itemId, output.quantity || 1, index);
    }

    if (config.xp > 0 && instance.heroId && config.skill) {
        SkillSystem.addXP(instance.heroId, config.skill, config.xp);
    }

    // Charges. `null` means unlimited (D-176) and must never be decremented —
    // it is the opposite of 0, not a large version of it.
    if (instance.usesRemaining != null) {
        instance.usesRemaining -= 1;
        if (instance.usesRemaining <= 0) {
            // **Token depletion is the only wear mechanic in the game** (D-118).
            // The Token is gone; the tile is empty and any hero on it stands
            // idle until the player returns (D-60). Managers are the mitigation
            // (Phase 7).
            const heroId = instance.heroId || null;
            BoardState.setToken(index, null);
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { tile: index, typeId: instance.typeId });
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: null });
            if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId });
            EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: index });
        }
    }

    // The board's universal unit of work. One kill counts as one cycle too
    // (D-129), so combat feeds this exactly as production does.
    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        tile: index,
        typeId: instance.typeId,
        heroId: instance.heroId || null,
        failed: false
    });

    // Cheap tally, used by the Token-type statistics surface.
    const counts = GameState.state?.collection?.cardUseCounts;
    if (counts) counts[instance.typeId] = (counts[instance.typeId] || 0) + 1;
}

/**
 * Advance every Token on the board.
 *
 * @param {number} delta milliseconds since the last tick, already time-scaled
 */
export function tick(delta) {
    const tiles = BoardState.occupiedTiles();
    if (!tiles.length) return;

    tickCounter++;
    const publishProgress = tickCounter % PROGRESS_EVERY === 0;

    for (const [index, instance] of tiles) {
        const def = getTokenType(instance.typeId);
        const config = def?.config;

        // Inert by design — nothing to advance.
        if (!config) continue;

        const needsHero = def.requiresHero !== false;
        if (needsHero && !instance.heroId) {
            // Quietly idle. NOT an alert: an unstaffed Token is not an error
            // (D-149), and most of the board is unstaffed at any moment.
            setAlert(instance, index, null);
            continue;
        }

        if (needsHero && !heroMeetsRequirement(instance.heroId, config)) {
            setAlert(instance, index, ALERT.ACCESS);
            continue;
        }

        if (config.inputs?.length && !InputAllocator.checkInputs(config.inputs).ok) {
            // Waits, keeping whatever progress it had. There are no partial
            // cycles (D-127) — it does not run slower, it runs later.
            InputAllocator.noteStarved(instance.typeId);
            setAlert(instance, index, ALERT.INPUTS);
            continue;
        }

        setAlert(instance, index, null);

        // --- the fast path: everything above is a cheap guard, this is the work
        instance.cycleElapsedMs = (instance.cycleElapsedMs || 0) + delta;

        const cycleTime = config.cycleTimeMs || 10000;
        if (instance.cycleElapsedMs >= cycleTime) {
            completeCycle(index, instance, def);
        } else if (publishProgress) {
            // Ref-based UI updates only — this bypasses React entirely, because
            // 48 tiles re-rendering three times a second is the cascade the
            // deck loop's ref-bar pattern existed to avoid.
            EventBus.publish(BOARD_EVENTS.PROGRESS, {
                tile: index,
                percent: Math.min(100, (instance.cycleElapsedMs / cycleTime) * 100)
            });
        }
    }
}

export function init() {
    logger.info('BoardRunner', 'Board cycle engine ready');
}

/**
 * Whether a hero has nothing to do — the yellow mark (D-172).
 *
 * Deliberately a **hero** fact rather than a tile fact: it lives on the person,
 * so it costs nothing against the tile's three-thing information budget (D-85).
 * It should stand out hard, because **spotting idle people is the main thing a
 * returning player needs to do**.
 */
export function isHeroIdle(heroId) {
    if (!heroId) return false;
    const hero = HeroManager.getHero(heroId);
    if (!hero || hero.status === 'wounded') return false;

    const tile = BoardState.tileOfHero(heroId);
    if (tile == null) return true;                    // in the Dock, doing nothing

    const instance = BoardState.getToken(tile);
    const def = getTokenType(instance?.typeId);
    if (!def?.config) return true;                    // standing on something inert
    return !!instance.alert;                          // staffed but stuck
}
