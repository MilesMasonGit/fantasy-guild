
/**
 * What a hero has up above their head, as plain data.
 * Two kinds of line share one stack:
 * * a **blocked** line is a live fact (`heroBubbles.js`): it stays for as long as the block
 * does and is never stored here;
 * * a **moment** is an event that happened (arriving at a job, going idle, a level-up) and
 * lives for `MOMENT_TTL_MS`, then goes by itself.
 * Everything here is pure, so the rules (cap, replace, expire, order) are tested without a
 * screen.
 */

/** Bubbles above one head at once. */
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

/** The lines for the three moments. Plain and factual. */
export const momentText = {
    arrived: (token) => `Working at ${token}.`,
    idle: () => 'No work in range.',
    levelUp: (skill, level) => `${skill} is now level ${level}.`,
    // No wording of its own: the blocked sentence for its reason, already built by
    // `heroBubbles.pinRefusedLineFor`, word for word.
    pinRefused: (line) => line
};

/**
 * Which moments a hero actually says: bubbles are for unusual events, not the everyday.
 * Arriving at a job happens every few seconds on a busy mat, so it is silent; the wording
 * above stays so it can be turned back on here. The full list of every line, with its status,
 * is `docs/reference/speech_bubble_lines.md`; keep the two in step.
 * * `arrived`: dropped (routine).
 * * `idle`: kept: a hero with nothing to do is worth knowing, but it also fires whenever the
 * last Token in range runs out.
 * * `levelUp`: kept (a notable event).
 * * `pinRefused`: kept: a flag dropped on a Token its hero can't work plants as an area flag,
 * and the hero says why, once.
 */
export const MOMENT_SPOKEN = Object.freeze({
    arrived: false,
    idle: true,
    levelUp: true,
    pinRefused: true
});

/** Whether a moment of this kind (`momentText`'s key) is spoken at all. */
export function speaksMoment(kind) {
    return MOMENT_SPOKEN[kind] === true;
}
