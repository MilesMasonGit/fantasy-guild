
/**
 * What a hero has up above their head, as plain data.
 * Two kinds of line share one stack:
 * * a **blocked** line is a live fact (`heroBubbles.js`): it stays for as long as the block
 * does and is never stored here;
 * * a **moment** is an event that happened (going idle, a level-up, a Token the hero used up)
 * and lives for `MOMENT_TTL_MS`, then goes by itself.
 * Everything here is pure, so the rules (cap, replace, expire, order) are tested without a
 * screen.
 */

/** Bubbles above one head at once. */
export const MAX_BUBBLES = 3;

/** How long a moment stays up. */
export const MOMENT_TTL_MS = 5000;

/** How long "{token} Depleted" stays up: a hero chopping tree after tree says it often. */
export const DEPLETED_TTL_MS = 3000;

/**
 * Add a moment. One line per `key`: a repeat (the same skill levelling again)
 * replaces its earlier line rather than stacking a second copy. Oldest first. `from` (a
 * level-up's starting level) rides along.
 *
 * @returns a new list; the input is untouched
 */
export function addMoment(list, { key, text, from }, now, ttlMs = MOMENT_TTL_MS) {
    const kept = list.filter(m => m.key !== key && m.until > now);
    return [...kept, { key, text, from, until: now + ttlMs }];
}

/**
 * The level a hero's level-up bubble for this skill counts its gain from: where the bubble still
 * up started, so quick level-ups coalesce into one bubble with the total; else the level this
 * one started at.
 */
export function levelUpFrom(list, key, oldLevel, now) {
    const live = list.find(m => m.key === key && m.until > now && Number.isFinite(m.from));
    return live ? live.from : oldLevel;
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
    // `gained`: levels since this hero's last level-up bubble for the skill.
    levelUp: (skill, level, gained) => `Leveled up ${skill} to ${level}!${gained >= 2 ? ` (+${gained})` : ''}`,
    // Said by the hero whose work spent the Token's last charge.
    depleted: (token) => `${token} Depleted`,
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
 * * `depleted`: kept: the hero who used a Token up says so.
 * * `pinRefused`: kept: a flag dropped on a Token its hero can't work plants as an area flag,
 * and the hero says why, once.
 */
export const MOMENT_SPOKEN = Object.freeze({
    arrived: false,
    idle: true,
    levelUp: true,
    depleted: true,
    pinRefused: true
});

/** Whether a moment of this kind (`momentText`'s key) is spoken at all. */
export function speaksMoment(kind) {
    return MOMENT_SPOKEN[kind] === true;
}
