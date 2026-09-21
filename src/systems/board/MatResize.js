// Fantasy Guild — what a resized mat does to what is standing on it (slice 1.6d-3)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { clampToMat } from '../../config/matGeometry.js';
import { onMatTuningChanged } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';
import * as MatPlacement from './MatPlacement.js';
import * as Flags from './Flags.js';
import * as NotificationSystem from '../core/NotificationSystem.js';

/**
 * ⭐ **Shrinking the mat pulls what no longer fits back inside** (FP-98).
 *
 * The Mat Tuner's **Mat size** row changes how big the mat is while the game
 * runs. Growing it is free — everything already on the mat is still on it, and
 * **nothing moves**. Shrinking it can leave a Token, a flag or an owed spot
 * outside the new edge, and this is what happens to each of them:
 *
 * * **A Token** is clamped so its **art circle** is fully inside the new edge,
 *   and then {@link MatPlacement.findSpot} is asked where it can actually stand
 *   from there — so it ends up on the mat *and* properly spaced from the
 *   neighbours that were already there (the same spacing rule a hand drop obeys).
 * * **A flag** is clamped and nothing more (FP-83): flags never collide, several
 *   may stand at one point, and nudging one would silently change which Token its
 *   hero is working.
 * * **An owed spot** (a vacancy a Manager is going to restock, FP-19) is clamped
 *   too, so a Manager cannot be left owing a Token to a point off the mat.
 *
 * ## ⚠️ Nothing is ever lost
 * A Token that finds no clear spot within {@link PULL_REACH} of its clamped point
 * **stays at that clamped point** — fully on the mat, fully visible, simply
 * overlapping a neighbour more than a drop would be allowed to. It is never
 * removed, never sent to the Tray or the Vault, and the player is told how many
 * are crowded so they can spread them out (or widen the mat again). Depositing it
 * somewhere would be a silent removal, which is the one outcome this project
 * refuses (D-138).
 *
 * ## One announcement, not one per Token
 * Every point that changed — each Token's old and new position, each flag's —
 * goes out in a **single** `ADJACENCY_DIRTY`, so the modifier caches are rebuilt
 * once for the whole resize instead of once per Token moved.
 */

/**
 * How far a pulled-in Token may look for a clear spot, in mat units.
 *
 * ⚠️ Deliberately **not** the Mat Tuner's nudge reach. That number answers "how
 * far may a player's drop be shifted before it is refused instead", and a resize
 * is not a drop: a mat shrinking by several steps strands a whole edge at once,
 * and every one of those Tokens clamps onto nearly the same strip of mat. The
 * reach has to be wide enough for that strip to spread out along the new edge —
 * two old steps is enough for the sizes the tuner offers — and it must not be
 * zero, which is a legitimate nudge-reach setting ("refuse every crowded drop")
 * but would make a resize pile every stranded Token on one line.
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
 * Pull everything that no longer fits back onto the mat.
 *
 * Safe to call at any size: on a mat that has grown, or not changed, nothing is
 * outside the edge, so this finds nothing to do and announces nothing.
 *
 * @returns {{tokensPulled: number, flagsPulled: number, spotsPulled: number, crowded: number}}
 */
export function fitToMat() {
    const dirty = [];
    const summary = { tokensPulled: 0, flagsPulled: 0, spotsPulled: 0, crowded: 0 };

    // --- Tokens: clamp, then find a spot clear of the neighbours -------------
    //
    // In arrival order (`tokens()`), and each one is moved before the next is
    // considered, so the second Token pulled off an edge sees the first where it
    // has just landed rather than where it used to be.
    for (const token of BoardState.tokens()) {
        if (MatPlacement.insideMat(token.typeId, token)) continue;

        const from = { x: token.x, y: token.y };
        const clamped = MatPlacement.clampInside(token.typeId, from);
        const spot = MatPlacement.forceSpot(token.typeId, clamped, {
            excludeId: token.id
        });
        
        if (spot && spot.pushed && spot.pushed.length > 0) {
            for (const p of spot.pushed) {
                const tok = BoardState.getTokenById(p.id);
                if (tok) {
                    dirty.push({ x: tok.x, y: tok.y });
                    BoardState.setTokenPoint(p.id, p.x, p.y);
                    dirty.push({ x: p.x, y: p.y });
                }
            }
        }

        const to = spot ? { x: Math.round(spot.x), y: Math.round(spot.y) } : clamped;

        BoardState.setTokenPoint(token.id, to.x, to.y);
        dirty.push(from, to);
        summary.tokensPulled++;
        if (!spot) summary.crowded++;
    }

    // --- Flags: clamped only, never nudged (FP-83) ---------------------------
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

    // --- Owed spots: clamped, keeping whatever they were owed ----------------
    for (const [, vacancy] of BoardState.spotVacancies()) {
        if (!Number.isFinite(vacancy.x) || !Number.isFinite(vacancy.y)) continue;
        const at = clampToMat(vacancy);
        if (at.x === vacancy.x && at.y === vacancy.y) continue;

        const was = { x: vacancy.x, y: vacancy.y };
        const unstocked = !!vacancy.unstocked;
        BoardState.setVacancyAt(was, null);
        BoardState.setVacancyAt({ x: Math.round(at.x), y: Math.round(at.y) }, vacancy.typeId);
        const moved = BoardState.vacancyAt(BoardState.spotIdAt(Math.round(at.x), Math.round(at.y)));
        // ⚠️ `setVacancyAt` makes a fresh, stocked vacancy; a spot the player was
        // already being warned about must keep its red mark across a resize.
        if (moved) moved.unstocked = unstocked;
        dirty.push(was, { x: at.x, y: at.y });
        summary.spotsPulled++;
    }

    if (!dirty.length) return summary;

    // One rebuild for the whole resize (see the note at the top of this file).
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: dirty });
    EventBus.publish('state_changed', {});

    if (summary.crowded > 0) {
        NotificationSystem.warning(
            `${summary.crowded} Token${summary.crowded === 1 ? '' : 's'} had nowhere clear to go on the smaller mat — ${summary.crowded === 1 ? 'it is' : 'they are'} overlapping a neighbour`
        );
    }

    return summary;
}
