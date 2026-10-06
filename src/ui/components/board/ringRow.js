
import { HERO_HIT_PX, TOKEN_BAR_GAP_U } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';
import { spawnerCountText } from './centreAlert.js';

/**
 * Ring badges: a Token's live numbers are rings that fill or empty with the number inside, in
 * one row centred under the hero and the Token together, or under the Token alone with no hero
 * at work. Fixed order: cycle, then charges, then the Token's own ring (enemy HP, a spawner's
 * count or a turn countdown).
 */

/**
 * A ring's diameter in mat units: about a third of a 1×1 Token's 128 u art. Fixed in mat units
 * like the other badges, so it scales with the mat, not with the art's pixel steps.
 */
export const RING_D_U = 42;

export const RING_STROKE_U = RING_D_U * 3 / 28;

export const RING_GAP_U = 6;

/**
 * Each ring's colour. Cycle fills, charges and HP empty; a spawner fills to its cap and a turn
 * ring empties toward its roll.
 */
export const RING_COLOUR = Object.freeze({
    cycle: '#f4f1e8',
    charges: '#fbbf24',   // the game's gi-gold
    hp: '#F09595',
    spawner: '#86efac',
    turn: '#7dd3fc',
    // A quest's progress, parchment: warmer and paler than the charges gold, so a done quest's
    // full ring is not read as charges.
    quest: '#e8c98a'
});

/**
 * The count rings that GLIDE to a new value instead of jumping: a Token's charges, and a
 * spawner's count against its cap. `RingBadge` gives them a CSS transition (`gi-ring-glide`,
 * ~0.8 s).
 */
export const GLIDING_RINGS = Object.freeze(new Set(['charges', 'spawner']));

/** The stroke a greyed ring (a blocked cycle) is drawn in. */
export const RING_GREY = '#8a8a8a';

/**
 * Where the row goes, as offsets from the Token's centre in mat units:
 * `dx` to the row's horizontal centre, `dy` to its top edge.
 *
 * * **No hero** (`heroX` null): centred under the Token, just below it.
 * * **A hero at work**: centred on the pair's combined horizontal extent — the
 *   hero's 64 u box on one side, the Token on the other — and just below the
 *   lower of the Token's bottom and the hero's feet (the hero's 128 u box is
 *   centred on its point, which is level with the Token's centre).
 *
 * `half` is half the Token's drawn box (the art or the circle, whichever is
 * larger — the same edge the progress bar hung from).
 *
 * @param {{x: number, half: number, heroX?: number|null}} pair
 * @returns {{dx: number, dy: number}}
 */
export function ringRowOffset({ x, half, heroX = null }) {
    if (heroX == null || !Number.isFinite(heroX)) {
        return { dx: 0, dy: half + TOKEN_BAR_GAP_U };
    }
    const heroHalf = HERO_HIT_PX / 2;
    const left = Math.min(x - half, heroX - heroHalf);
    const right = Math.max(x + half, heroX + heroHalf);
    const feet = FLAG_PX / 2;
    return {
        dx: (left + right) / 2 - x,
        dy: Math.max(half, feet) + TOKEN_BAR_GAP_U
    };
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
