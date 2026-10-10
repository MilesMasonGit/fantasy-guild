/**
 * The cycle each worked Token's mat ring is drawing, by Token: so the inspection's time and XP
 * rings draw the very same fraction, on the same step (`frameClock.onStep`), frozen when the mat
 * ring is frozen. `TokenBubbles` shares its reader while it is mounted.
 */

/** instanceId → `(now) => { elapsedMs, cycleMs } | null` */
const readers = new Map();

/**
 * Share Token `instanceId`'s cycle. `read(now)` returns where the ring's cycle stands at `now`,
 * or null while it shows none (no hero, a fight, no cycle time yet).
 * @returns {() => void} stop sharing
 */
export function shareCycle(instanceId, read) {
    readers.set(instanceId, read);
    return () => {
        if (readers.get(instanceId) === read) readers.delete(instanceId);
    };
}

/** Where Token `instanceId`'s mat ring has its cycle at `now`, or null when it has none. */
export function readCycle(instanceId, now) {
    const read = readers.get(instanceId);
    return read ? read(now) : null;
}
