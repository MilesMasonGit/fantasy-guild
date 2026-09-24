// Fantasy Guild — a hero's stack of speech bubbles (Hero Speech Bubbles slice SB-C)

/**
 * ⭐ **What a hero has up above their head, as plain data.**
 *
 * Two kinds of line share one stack (SB-3):
 *
 * * a **blocked** line is a live fact (`heroBubbles.js`) — it stays for as long
 *   as the block does and is never stored here;
 * * a **moment** is an event that happened — arriving at a job, going idle, a
 *   level-up — and lives for `MOMENT_TTL_MS`, then goes by itself.
 *
 * Everything here is pure, so the rules (cap, replace, expire, order) are
 * tested without a screen.
 */

/** Bubbles above one head at once (SB-3, SBP-1). */
export const MAX_BUBBLES = 3;

/** How long a moment stays up. */
export const MOMENT_TTL_MS = 5000;

/**
 * Add a moment. One line per `key`: a repeat (the same skill levelling again)
 * replaces its earlier line rather than stacking a second copy. Oldest first.
 *
 * @returns a new list; the input is untouched
 */
export function addMoment(list, { key, text }, now, ttlMs = MOMENT_TTL_MS) {
    const kept = list.filter(m => m.key !== key && m.until > now);
    return [...kept, { key, text, until: now + ttlMs }];
}

/** The moments that have not yet expired. */
export function liveMoments(list, now) {
    return list.filter(m => m.until > now);
}

/**
 * The stack to draw, top to bottom: moments oldest first, then the blocked line
 * nearest the head. Never more than `MAX_BUBBLES` — the oldest moment gives way.
 *
 * @param {{key: string, text: string, until: number}[]} moments
 * @param {string|null} blocked  the hero's blocked line, if they are speaking it
 * @returns {{id: string, text: string, kind: 'moment'|'blocked'}[]}
 */
export function stackOf(moments, blocked, now) {
    const out = liveMoments(moments, now).map(m => ({ id: m.key, text: m.text, kind: 'moment' }));
    if (blocked) out.push({ id: 'blocked', text: blocked, kind: 'blocked' });
    return out.slice(-MAX_BUBBLES);
}

/** The lines for the three moments SB-1 names. Plain and factual (SB-5). */
export const momentText = {
    arrived: (token) => `Working at ${token}.`,
    idle: () => 'No work in range.',
    levelUp: (skill, level) => `${skill} is now level ${level}.`
};
