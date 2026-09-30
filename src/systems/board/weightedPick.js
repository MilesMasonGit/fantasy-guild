// Fantasy Guild — a weighted pick among Token types (a leaf module)

import { getTokenType } from '../../config/registries/tokenRegistry.js';

/**
 * Shared by `TimedChanges` (what a Token turns into) and `SpawnerSystem`
 * (what a spawner spawns). It was `TimedChanges.pickWeighted`, and
 * SpawnerSystem importing TimedChanges for it alone formed an import cycle
 * (CR3-023 group 2); `TimedChanges` still re-exports it. Moved unchanged: the
 * random stream it consumes (none for a single choice, one draw otherwise) is
 * part of the bench's identical-work gate.
 */
/** A weighted pick from `[{ typeId, weight }]`, skipping unknown types and non-positive weights. */
export function pickWeighted(entries, random = Math.random) {
    const usable = (Array.isArray(entries) ? entries : [])
        .filter(e => e?.typeId && getTokenType(e.typeId) && Number(e.weight) > 0);
    if (!usable.length) return null;
    // One choice rolls nothing, so a single-entry list never moves the random stream.
    if (usable.length === 1) return usable[0].typeId;
    const total = usable.reduce((sum, e) => sum + Number(e.weight), 0);
    let roll = random() * total;
    for (const e of usable) {
        roll -= Number(e.weight);
        if (roll < 0) return e.typeId;
    }
    return usable[usable.length - 1].typeId;
}
