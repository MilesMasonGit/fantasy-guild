// Fantasy Guild — Hero Dock activity pill logic (Hero Dock rework, Phase 4)

import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';

/**
 * What the activity pill on a dock tab should say (concept §3, State A).
 *
 * Kept as a pure function, separate from the component, so every state is
 * unit-testable — the in-combat case in particular cannot be staged from the
 * outside, because the loop runner owns `areaState.status` and rewrites it
 * every tick.
 *
 * Precedence matters: a wounded hero reads "Injured" even while still bound to
 * an area, because their condition is the thing the player needs to act on.
 *
 * @param {{wounded: boolean, areaId: string|null, areaStatus: string|null}} activity
 * @returns {{label: string, icon: 'wound'|'combat'|null, tone: string}}
 */
export function describeActivity(activity) {
    if (!activity) return { label: 'Reserve', icon: null, tone: 'idle' };

    if (activity.wounded) {
        return { label: 'Injured', icon: 'wound', tone: 'danger' };
    }
    if (activity.areaStatus === 'in_combat') {
        return { label: 'Combat', icon: 'combat', tone: 'danger' };
    }
    if (activity.areaId) {
        return {
            label: getAreaSet(activity.areaId)?.name || activity.areaId,
            icon: null,
            tone: 'deployed'
        };
    }
    return { label: 'Reserve', icon: null, tone: 'idle' };
}

/** Tailwind classes per pill tone. */
export const PILL_TONE_CLASS = {
    danger: 'text-gi-danger border-gi-danger/40 bg-gi-danger/10',
    deployed: 'text-gi-primary border-gi-primary/40 bg-gi-primary/10',
    idle: 'text-gi-muted border-gi-border/60 bg-black/30'
};
