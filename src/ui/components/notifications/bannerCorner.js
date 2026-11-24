import { BANNER_KINDS, TONE } from '../../../systems/notifications/bannerKinds.js';

/**
 * The banner corner's rules, pure: the show/hide icon at the top right lists every banner up, or
 * tucks them away and lets each new one pop out for {@link PEEK_MS}.
 */

/** How long a new banner shows while the corner is hidden, before it tucks back in. */
export const PEEK_MS = 5000;

/**
 * The banners this view may show and what the icon says: `away` (the World Map or the Guild Hall)
 * keeps only kinds that point to a Token, so an event can be reached from there; the rest wait for
 * the mat. `count` is how many the icon holds, `problem` whether one of them is a problem.
 * @param {object[]} banners every banner up, newest first
 * @param {boolean} away
 */
export function cornerBanners(banners, away) {
    const list = away ? banners.filter(b => BANNER_KINDS[b.kind]?.pointsTo) : banners;
    return { list, count: list.length, problem: list.some(b => b.tone === TONE.PROBLEM) };
}

/**
 * Which banners pop out of a hidden corner, after the banners up changed or time passed. A banner
 * met for the first time while the corner is hidden pops out until `now + PEEK_MS`, unless it was
 * put back quietly (a load, a standing event's reminder); open, nothing pops (everything is
 * listed), and closing tucks every one away at once.
 * @param {{banners: object[], seen: Set<number>, peeks: Map<number, number>, open: boolean, now: number}} at
 *   `seen` the ids already met, `peeks` each popped-out id and when it tucks in
 * @returns {{seen: Set<number>, peeks: Map<number, number>}}
 */
export function peeksAfter({ banners, seen, peeks, open, now }) {
    const nextSeen = new Set();
    const next = new Map();
    for (const b of banners) {
        nextSeen.add(b.id);
        if (open) continue;
        const until = peeks.get(b.id);
        if (until != null) {
            if (until > now) next.set(b.id, until);
        } else if (!seen.has(b.id) && !b.quiet) {
            next.set(b.id, now + PEEK_MS);
        }
    }
    return { seen: nextSeen, peeks: next };
}

/** Whether two peek maps say the same. */
export function samePeeks(a, b) {
    if (a.size !== b.size) return false;
    for (const [id, until] of a) if (b.get(id) !== until) return false;
    return true;
}

/** The banners the corner draws: all of `list` while open, else the ones popped out. */
export function bannersOut(list, open, peeks) {
    return open ? list : list.filter(b => peeks.has(b.id));
}
