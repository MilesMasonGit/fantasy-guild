// each Hideout's last theft, as heard: what its card names (UI memory only)

import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The `THEFT` payload each Hideout last said, by its instance id: what its card names as its last
 * theft. Never saved; a catch-up (a quiet bus) and a load leave it empty until the next theft, and a
 * new board forgets it.
 */
const last = new Map();
let offs = null;

/** Start hearing thefts. Idempotent: the mat's callout layer starts it as it mounts. */
export function startTheftWatch() {
    if (offs) return;
    offs = [
        EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => {
            if (p?.instanceId) last.set(p.instanceId, p);
        }, UI_LISTENER),
        EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, () => last.clear(), UI_LISTENER),
        EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, () => last.clear(), UI_LISTENER)
    ];
}

/** The last theft Hideout `instanceId` said, or null. */
export function lastTheftOf(instanceId) {
    return last.get(instanceId) || null;
}

/** Forget every theft and stop hearing them (tests). */
export function resetTheftWatch() {
    offs?.forEach(off => off());
    offs = null;
    last.clear();
}
