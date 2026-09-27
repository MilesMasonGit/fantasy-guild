// Fantasy Guild — the transform glow on a Token (Token Lifecycle feedback Q4: FB-11)

/**
 * ⭐ **A Token that has just become another one glows** (FB-11): a sapling
 * grown into a tree, a Coast turned into a Shrimp Coast and back, a Foundation
 * built into its station — every path through `EffectActions.transformInstance`.
 *
 * ## Why a store and not an event
 * A transform replaces the Token with a **new instance, with a new id**, in
 * the middle of an engine tick; React draws that new Token afterwards, so an
 * event would reach nobody. The glow is kept here under the NEW id, and the
 * Token reads it when it mounts (the same pattern as `TokenNotices`).
 *
 * ## Which clock
 * Wall clock (`Date.now()`): a glow is presentation, not game state — never
 * saved, and it does not speed up with the time bank. Nothing is raised while
 * the time bank replays time away (the caller checks), like spawn notices.
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
