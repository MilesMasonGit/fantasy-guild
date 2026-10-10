
import { spawnerCountText } from './centreAlert.js';

/**
 * Bubbles: a Token's live numbers are rings that fill or empty with the number inside, each in
 * its own fixed spot inside the Token's box ({@link bubbleSlot}).
 */

/**
 * A ring's diameter in mat units: a little under a third of a 1×1 Token's 128 u art, so three fit side by side along its bottom. Fixed in mat units
 * like the other badges, so it scales with the mat, not with the art's pixel steps.
 */
export const RING_D_U = 40;

export const RING_STROKE_U = RING_D_U * 3 / 28;

/**
 * Each ring's colour. Cycle fills and charges empty; a spawner fills to its cap and a turn
 * ring empties toward its roll.
 */
export const RING_COLOUR = Object.freeze({
    cycle: '#f4f1e8',
    charges: '#fbbf24',   // the game's gi-gold
    spawner: '#86efac',
    turn: '#7dd3fc',
    grow: '#bef264',
    // A resting Token refilling: lavender, apart from the charges gold it refills.
    respawn: '#c4b5fd',
    // A quest's progress, parchment: warmer and paler than the charges gold, so a done quest's
    // full ring is not read as charges.
    quest: '#e8c98a',
    // Skill XP in the inspection.
    xp: '#fb923c'
});

/**
 * The count rings that GLIDE to a new value instead of jumping: a Token's charges, a
 * spawner's count against its cap and a quest's progress. `RingBadge` gives them a CSS
 * transition (`gi-ring-glide`, ~0.8 s).
 */
export const GLIDING_RINGS = Object.freeze(new Set(['charges', 'spawner', 'quest']));

/** The stroke a greyed ring (a blocked cycle) is drawn in. */
export const RING_GREY = '#8a8a8a';

/**
 * Where each bubble sits inside a Token's box, in mat units from the box's top-left. The
 * layout is fixed: timer top-left, cycle bottom-left, quest bottom-centre, charges bottom-right
 * and the middle row (gear, spawner count,
 * disallow mark) centred on the box.
 * A small Token's box is half as wide as three bubbles, so its corner bubbles hang off the box
 * by {@link SMALL_OVERHANG_U} instead of sitting inside it.
 * @param {'timer'|'cycle'|'quest'|'charges'} slot
 * @param {{boxPx: number, small?: boolean}} box
 * @returns {{left: number, top: number}}
 */
export function bubbleSlot(slot, { boxPx, small = false }) {
    const inset = small ? -SMALL_OVERHANG_U : BUBBLE_INSET_U;
    const far = boxPx - RING_D_U - inset;
    switch (slot) {
        case 'timer': return { left: inset, top: inset };
        case 'cycle': return { left: inset, top: far };
        case 'quest': return { left: (boxPx - RING_D_U) / 2, top: far };
        case 'charges': return { left: far, top: far };
        default: return { left: 0, top: 0 };
    }
}

/** How far a bubble sits in from its corner of a full-size Token's box. */
export const BUBBLE_INSET_U = 2;

/** How far a small Token's corner bubbles hang off its box: three side by side then just touch. */
export const SMALL_OVERHANG_U = RING_D_U * 0.75;

/** How long a count bubble stays up after its number changes. */
export const BUBBLE_RECENT_MS = 2000;

/** A timer bubble shows by itself once this little time is left. */
export const TIMER_SOON_MS = 10000;

/** Whether a timer bubble shows: while hovered, and in its last {@link TIMER_SOON_MS}. */
export function timerVisible(hovered, inMs) {
    if (inMs == null) return false;
    return !!hovered || inMs <= TIMER_SOON_MS;
}

/**
 * The cycle ring's number: whole seconds left, rounded up, never below 1s
 * while the cycle is still running (it reads `3s`, `2s`, `1s`).
 */
export function cycleSecondsText(elapsedMs, cycleTimeMs) {
    if (!(cycleTimeMs > 0)) return '';
    const left = Math.max(0, cycleTimeMs - (elapsedMs || 0));
    return `${Math.max(1, Math.ceil(left / 1000))}s`;
}

/**
 * How full the charges ring is: charges left over the Token's starting
 * charges, clamped to 1 (a restocked Token can hold more than it started
 * with). No starting count to compare against reads as full.
 */
export function chargesFraction(usesRemaining, startingUses) {
    if (usesRemaining == null) return null;
    if (!(startingUses > 0)) return 1;
    return Math.max(0, Math.min(1, usesRemaining / startingUses));
}

/**
 * A count short enough to sit inside a ring: `7`, `250`, `1.2k`, `12k`, `3M`.
 */
export function ringCount(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    const a = Math.abs(v);
    if (a < 1000) return String(Math.round(v));
    if (a < 10000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    if (a < 1e6) return `${Math.round(v / 1000)}k`;
    return `${(v / 1e6).toFixed(a < 1e7 ? 1 : 0).replace(/\.0$/, '')}M`;
}

/**
 * A spawner's standing ring: its family's live count against its cap, `3/5`, filling toward
 * the cap. Null for a Token that is not a working spawner (`SpawnerSystem.spawnerCounts` gave
 * null).
 * @param {{count: number, cap: number}|null} counts
 * @returns {{kind: 'spawner', fraction: number, text: string, title: string}|null}
 */
export function spawnerRing(counts) {
    const text = spawnerCountText(counts);
    if (!text) return null;
    const fraction = counts.cap > 0 ? Math.max(0, Math.min(1, counts.count / counts.cap)) : 1;
    return { kind: 'spawner', fraction, text, title: `${text} spawned` };
}

/**
 * A quest Token's standing ring: its progress, `3/10`, filling toward done. Null for anything
 * that is not a quest (`detail.quest` null).
 * @param {{currentCount: number, requiredCount: number, title?: string}|null} quest
 * @returns {{kind: 'quest', fraction: number, text: string, title: string}|null}
 */
export function questRing(quest) {
    if (!quest) return null;
    const required = Math.max(1, Number(quest.requiredCount) || 1);
    const current = Math.max(0, Math.min(required, Number(quest.currentCount) || 0));
    const text = `${ringCount(current)}/${ringCount(required)}`;
    return {
        kind: 'quest',
        fraction: current / required,
        text,
        title: quest.title ? `${quest.title}: ${text}` : text
    };
}

/** How often the turn ring re-reads its game-time clock (ms). */
export const TURN_COUNTDOWN_REFRESH_MS = 250;

/**
 * How full the turn ring is: time left to the next roll over the roll cycle, so it empties
 * toward the roll. No cycle: empty.
 */
export function turnFraction(inMs, everyMs) {
    if (!(everyMs > 0)) return 0;
    return Math.max(0, Math.min(1, (Number(inMs) || 0) / everyMs));
}
