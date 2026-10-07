// what a resized mat does to what is standing on it

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { clampToMat } from '../../config/matGeometry.js';
import { onMatTuningChanged } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';
import * as MatPlacement from './MatPlacement.js';
import * as Flags from './Flags.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Shrinking the mat pulls what no longer fits back inside. Growing it is free: nothing moves.
 *
 * A Token is clamped so its art circle is fully inside the new edge, then {@link
 * MatPlacement.findSpot} picks where it can stand from there, so it ends up spaced from its
 * neighbours like a hand drop. A flag is clamped and nothing more: flags never collide, and nudging
 * one would silently change which Token its hero is working.
 *
 * ⚠️ Nothing is ever lost: a Token that finds no clear spot within {@link PULL_REACH} stays at its
 * clamped point, overlapping a neighbour more than a drop would allow. It is never removed or
 * deposited elsewhere (a silent removal), and the player is told how many are crowded.
 *
 * Every changed point goes out in a single `ADJACENCY_DIRTY`, so the modifier caches are rebuilt
 * once per resize, not once per Token.
 */

/**
 * How far a pulled-in Token may look for a clear spot, in mat units.
 *
 * ⚠️ Deliberately not the Mat Tuner's nudge reach: a resize is not a drop. Shrinking by several
 * steps strands a whole edge at once and those Tokens clamp onto nearly the same strip, so the
 * reach must be wide enough for it to spread out (two old steps), and not zero, which is a
 * legitimate nudge-reach setting.
 */
export const PULL_REACH = 320;

let unsubscribe = null;

/**
 * Listen for the mat being resized. Idempotent: calling it again replaces the
 * subscription rather than doubling it.
 */
export function init() {
    teardown();
    unsubscribe = onMatTuningChanged((key) => {
        // `null` is the tuner's Reset, which can change the mat size too.
        if (key == null || key === 'matSteps') fitToMat();
    });
}

export function teardown() {
    unsubscribe?.();
    unsubscribe = null;
}

/**
 * Pull everything that no longer fits back onto the mat. Safe at any size: if nothing is outside
 * the edge it does nothing and announces nothing.
 *
 * @returns {{tokensPulled: number, flagsPulled: number, crowded: number}}
 */
export function fitToMat() {
    const dirty = [];
    const summary = { tokensPulled: 0, flagsPulled: 0, crowded: 0 };

    // In arrival order, each Token moved before the next is considered, so the second Token pulled
    // off an edge sees the first where it landed.
    for (const token of BoardState.tokens()) {
        if (MatPlacement.insideMat(token.typeId, token)) continue;

        const from = { x: token.x, y: token.y };
        const clamped = MatPlacement.clampInside(token.typeId, from);
        const spot = MatPlacement.findSpot(token.typeId, clamped, {
            excludeId: token.id,
            reach: PULL_REACH
        });
        const to = spot ? { x: Math.round(spot.x), y: Math.round(spot.y) } : clamped;

        BoardState.setTokenPoint(token.id, to.x, to.y);
        dirty.push(from, to);
        summary.tokensPulled++;
        if (!spot) summary.crowded++;
    }

    for (const [heroId, flag] of Object.entries(BoardState.getFlags() || {})) {
        if (!flag || !Number.isFinite(flag.x) || !Number.isFinite(flag.y)) continue;
        const at = clampToMat(flag);
        if (at.x === flag.x && at.y === flag.y) continue;

        BoardState.setFlag(heroId, { ...flag, x: Math.round(at.x), y: Math.round(at.y) });
        dirty.push({ x: flag.x, y: flag.y }, { x: at.x, y: at.y });
        summary.flagsPulled++;
        // The hero is drawn from their flag, so the board has to hear about it.
        EventBus.publish(BOARD_EVENTS.HERO_MOVED, Flags.heroMovedPayload(heroId));
    }

    if (!dirty.length) return summary;

    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: dirty });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED, {});

    if (summary.crowded > 0) {
        NotificationSystem.warning(
            `${summary.crowded} Token${summary.crowded === 1 ? '' : 's'} had nowhere clear to go on the smaller mat — ${summary.crowded === 1 ? 'it is' : 'they are'} overlapping a neighbour`
        );
    }

    return summary;
}
