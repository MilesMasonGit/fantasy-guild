/**
 * Callouts: the quick speech-bubble popups the mat says things in. One style for every kind
 * (a spawn, an effect firing, a refused drop), each appearing over the thing it is about and
 * gone by itself. Pure, so the rules are tested without a screen.
 */

/** How long one callout lives, in ms. ⚠️ Must match `callout-pop`'s duration in `components.css`. */
export const CALLOUT_MS = 2200;

/** Callouts over one Token at once; the oldest give way. */
export const MAX_PER_ANCHOR = 3;

/** Callouts on the whole mat at once, so a busy mat cannot pile up DOM. */
export const MAX_TOTAL = 24;

/** The words for each kind. */
export const calloutText = {
    spawned: (name) => `! Spawned ${name}`,
    effect: (title) => title
};

/** Where a callout is said: over a Token (by id), or over a bare mat point. */
export function anchorKeyOf({ anchorId = null, x, y }) {
    return anchorId ? `t:${anchorId}` : `p:${Math.round(x)}_${Math.round(y)}`;
}

/**
 * Add a callout, oldest first. Past `MAX_PER_ANCHOR` over one anchor the oldest of that anchor
 * goes; past `MAX_TOTAL` the oldest overall.
 * @param {{id: number, key: string}[]} list
 * @returns a new list; the input is untouched
 */
export function addCallout(list, entry) {
    let next = [...list, entry];
    const same = next.filter(c => c.key === entry.key);
    if (same.length > MAX_PER_ANCHOR) {
        const drop = new Set(same.slice(0, same.length - MAX_PER_ANCHOR).map(c => c.id));
        next = next.filter(c => !drop.has(c.id));
    }
    return next.length > MAX_TOTAL ? next.slice(next.length - MAX_TOTAL) : next;
}
