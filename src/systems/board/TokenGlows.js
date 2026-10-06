// the transform glow on a Token

/**
 * A Token that has just become another one glows: every path through
 * `EffectActions.transformInstance`.
 *
 * Kept in a store, not an event: a transform makes a NEW instance and React draws it after the
 * tick, so an event would reach nobody. The Token reads the glow when it mounts.
 *
 * Wall clock (`Date.now()`): a glow is presentation, never saved, and does not speed up with the
 * time bank.
 */

/** How long the glow plays, in ms. */
export const GLOW_MS = 1000;

/** new instanceId → `{ fromTypeId, typeId, raisedAt }`. */
const glows = new Map();

const now = () => Date.now();

function prune(at) {
    for (const [id, g] of glows) if (at - g.raisedAt >= GLOW_MS) glows.delete(id);
}

/**
 * Light up the Token `instanceId` has just become.
 *
 * @param {string} instanceId the NEW instance
 * @param {{fromTypeId?: string|null, typeId?: string|null}} [what]
 * @param {number} [at] wall-clock time (tests)
 */
export function raiseGlow(instanceId, { fromTypeId = null, typeId = null } = {}, at = now()) {
    if (!instanceId) return;
    prune(at);
    glows.set(instanceId, { fromTypeId, typeId, raisedAt: at });
}

/**
 * The glow on a Token right now, with how long it has left, or null.
 * @returns {{fromTypeId: string|null, typeId: string|null, raisedAt: number, remainingMs: number}|null}
 */
export function glowOf(instanceId, at = now()) {
    const g = glows.get(instanceId);
    if (!g) return null;
    const remainingMs = GLOW_MS - (at - g.raisedAt);
    if (remainingMs <= 0) {
        glows.delete(instanceId);
        return null;
    }
    return { ...g, remainingMs };
}

/** Forget every glow (tests). */
export function resetGlows() {
    glows.clear();
}
