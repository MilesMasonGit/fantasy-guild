// Fantasy Guild — Hero Dock status pip logic (Hero Dock rework, Phase 4)

import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';

/**
 * The four states a hero can be in, as a colour and nothing else (owner
 * design 2026-08-02). The dock card face shows a bare pip — no label, no icon
 * — and the player learns the vocabulary by playing:
 *
 *   red    — injured
 *   yellow — assigned to a banner but not progressing
 *   green  — actively working
 *   blue   — unassigned and available
 *
 * The area name survives in the hover tooltip, which is what `label` is for.
 * Deliberately NO reason text anywhere on the face: "just show the pip, let
 * the player figure out what it means".
 */
export const DOCK_PIP = {
    INJURED: 'injured',
    BLOCKED: 'blocked',
    WORKING: 'working',
    AVAILABLE: 'available'
};

/**
 * Area statuses that mean the loop is genuinely advancing. Anything else on a
 * banner that HAS a hero is a stall the player may want to look at.
 *
 * Listing the good states rather than the bad ones is deliberate: `paused`,
 * `idle`, a null status on a freshly-created area and any status a future
 * phase adds all fall through to "stopped" without an edit here, which is the
 * safe direction to be wrong in — a false yellow is a wasted glance, a false
 * green is a hero silently doing nothing for an hour.
 */
const PROGRESSING = new Set(['prepping', 'drawing', 'running', 'in_combat', 'shuffling']);

/**
 * Whether an assigned hero is stopped rather than working.
 *
 * Yellow covers EVERY stopped state, not just the resource ones (owner
 * decision 2026-08-02): out of inputs, out of energy, bank full, and a banner
 * the player paused by hand all read the same. The rule the player learns is
 * "yellow means this hero isn't doing anything", which stays true without
 * their having to know which of five reasons applies.
 *
 * `blocked` is the slot-failure signal — the last pass through a card failed
 * on inputs or output capacity. That does NOT pause the area (the loop
 * discards the card and carries on retrying), so it cannot be read off
 * `areaStatus` and has to be passed in by the caller.
 */
function isStopped(activity) {
    if (activity.blocked) return true;
    return !PROGRESSING.has(activity.areaStatus);
}

/**
 * Which pip a hero shows, and the label the tooltip uses.
 *
 * Kept as a pure function, separate from the component, so every state is
 * unit-testable — the in-combat case in particular cannot be staged from the
 * outside, because the loop runner owns `areaState.status` and rewrites it
 * every tick.
 *
 * Precedence matters: a wounded hero reads red even while still bound to an
 * area, because their condition is the thing the player needs to act on.
 *
 * @param {{wounded: boolean, areaId: string|null, areaStatus: string|null,
 *          blocked?: boolean}} activity
 * @returns {{pip: string, label: string}}
 */
export function describeActivity(activity) {
    if (!activity) return { pip: DOCK_PIP.AVAILABLE, label: 'Reserve' };

    if (activity.wounded) return { pip: DOCK_PIP.INJURED, label: 'Injured' };
    if (!activity.areaId) return { pip: DOCK_PIP.AVAILABLE, label: 'Reserve' };

    // Deployed: the label names the AREA rather than "Banner 1" — areas are
    // named in this game and there are only a few, so "Whispering Woods" reads
    // better than a number the player has to map back to a place.
    const label = getAreaSet(activity.areaId)?.name || activity.areaId;

    return {
        pip: isStopped(activity) ? DOCK_PIP.BLOCKED : DOCK_PIP.WORKING,
        label
    };
}

/** Fill colour per pip state. */
export const PIP_TONE_CLASS = {
    [DOCK_PIP.INJURED]: 'bg-gi-danger',
    [DOCK_PIP.BLOCKED]: 'bg-gi-warning',
    [DOCK_PIP.WORKING]: 'bg-gi-success',
    [DOCK_PIP.AVAILABLE]: 'bg-gi-info'
};
