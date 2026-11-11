// Limes, the guide: what the save keeps of it.
//
// ⚠️ Limes is not a Token. It is never on the board, nothing works it, it is not counted in the
// mat's cap and the tick never reads it; it lives only in the save's `guide` section.

import { GameState } from '../../state/GameState.js';

function guide() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.guide || typeof state.guide !== 'object') state.guide = { limesSpot: null, lessons: true };
    return state.guide;
}

/** Where the player left Limes on the Starter Camp's mat (its middle, mat units), or null for its corner. */
export function limesSpot() {
    const spot = guide()?.limesSpot;
    return spot && Number.isFinite(spot.x) && Number.isFinite(spot.y) ? { x: spot.x, y: spot.y } : null;
}

/** Keeps Limes's spot in the save; null puts it back in its corner. */
export function setLimesSpot(spot) {
    const g = guide();
    if (!g) return;
    g.limesSpot = spot && Number.isFinite(spot.x) && Number.isFinite(spot.y)
        ? { x: Math.round(spot.x), y: Math.round(spot.y) }
        : null;
}

/** Whether this game has Limes's lessons (the new-game screen's switch; on in an older save). */
export function lessonsOn() {
    return guide()?.lessons !== false;
}

export function setLessons(on) {
    const g = guide();
    if (g) g.lessons = on !== false;
}
