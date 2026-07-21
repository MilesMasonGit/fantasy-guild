// Fantasy Guild - Slot Failure Marks (Card Mutators & Tokens, Phase 9)

import { EventBus } from '../core/EventBus.js';

/**
 * SlotFailures — which deck slots failed on their last pass, for the §12
 * "Failed!" stamp and the at-a-glance bottleneck view.
 *
 * ## Why this exists at all
 * `completeWorkCycle` records the failure on the *card*, but that card is
 * ephemeral: `LoopRunner._discardActiveCard` throws it away the instant the
 * slot resolves. A stamp read off the card would flash for a single frame and
 * never actually be seen. The mark has to outlive the card, so it lives on the
 * SLOT — the same reasoning that put Tokens on slots (roadmap F1).
 *
 * ## Why it is runtime-only
 * Same as `SlotTokens` (F3) and `AreaModifiers`: derived, short-lived state
 * with a hard reset boundary. Persisting it would freeze a stale "Failed!" into
 * the save for no benefit and cost a `StateSchema` change. A fresh session
 * simply starts unmarked, and the first pass re-marks whatever still fails.
 *
 * A mark is cleared the moment that slot succeeds, so the stamp always reflects
 * the LAST attempt rather than accumulating history.
 */

export const SLOT_FAILURES_CHANGED = 'slot_failures_changed';

/** @type {Map<string, Map<number, {reason: string, detail?: object}>>} */
const failures = new Map();

function notify(areaId) {
    EventBus.publish(SLOT_FAILURES_CHANGED, { areaId: areaId ?? null });
}

/**
 * Record (or clear) the outcome of a slot's last attempt.
 * @param {?object} failure - `card.lastFailure`, or null/undefined on success
 */
export function setSlotFailure(areaId, slotIndex, failure) {
    if (!areaId || !Number.isInteger(slotIndex)) return;

    let byIndex = failures.get(areaId);

    if (!failure) {
        if (byIndex?.delete(slotIndex)) {
            if (byIndex.size === 0) failures.delete(areaId);
            notify(areaId);
        }
        return;
    }

    if (!byIndex) {
        byIndex = new Map();
        failures.set(areaId, byIndex);
    }
    byIndex.set(slotIndex, { reason: failure.reason, detail: failure.detail });
    notify(areaId);
}

/** The last failure on a slot, or null if its last attempt succeeded. */
export function getSlotFailure(areaId, slotIndex) {
    return failures.get(areaId)?.get(slotIndex) || null;
}

/** Every failed slot in an area — the §12 "diagnose the bottleneck" view. */
export function getAreaFailures(areaId) {
    const byIndex = failures.get(areaId);
    if (!byIndex) return [];
    return [...byIndex.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([slotIndex, failure]) => ({ slotIndex, ...failure }));
}

/** Drop an area's marks (deck edited, loop reset). */
export function clearAreaFailures(areaId) {
    if (failures.delete(areaId)) notify(areaId);
}

/** Drop every mark everywhere (save load, test teardown). */
export function clearAllSlotFailures() {
    failures.clear();
    notify(null);
}
