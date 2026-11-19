import * as GameClock from './GameClock.js';

/**
 * A rolling per-hour rate over the last `windowMs` of game time, for the XP and item readouts.
 *
 * Each record is earned over the interval before it, so n records span n intervals: the rate is
 * their sum over the time from the start of the first one's interval to now. That start is the
 * record before the first still in the window when there was one (it aged out), else one average
 * gap before the first, else (a lone moment) `minMs` before it. Dividing by first-to-now alone
 * counts n records over n - 1 gaps and reads too high just after every record.
 *
 * ⚠️ Display only, on the game clock (`GameClock.now()`), so a catch-up's last minutes read the
 * same as live play. It draws no random number and the engine never reads it.
 * @param {{ windowMs: number, minMs: number }} opts
 */
export function createRollingRate({ windowMs, minMs }) {
    /** key -> { entries: [{ amount, timestamp }], before: number|null } */
    const series = new Map();

    function prune(key) {
        const s = series.get(key);
        if (!s) return null;
        const now = GameClock.now();
        while (s.entries.length > 0 && (now - s.entries[0].timestamp) > windowMs) {
            s.before = s.entries.shift().timestamp;
        }
        if (s.entries.length === 0) {
            series.delete(key);
            return null;
        }
        return s;
    }

    return {
        record(key, amount) {
            let s = series.get(key);
            if (!s) {
                s = { entries: [], before: null };
                series.set(key, s);
            }
            s.entries.push({ amount, timestamp: GameClock.now() });
            prune(key);
        },

        /** The records still in the window, oldest first. */
        entries(key) {
            return prune(key)?.entries || [];
        },

        /** The window's sum per hour, or 0 with nothing in it. */
        perHour(key) {
            const s = prune(key);
            if (!s) return 0;
            const { entries } = s;
            const first = entries[0].timestamp;
            const last = entries[entries.length - 1].timestamp;
            // Records made in one tick (a cycle's two outputs, a gain and a spend) share one interval.
            const moments = new Set(entries.map(e => e.timestamp)).size;
            let start;
            if (s.before != null) start = s.before;
            else if (moments > 1) start = first - (last - first) / (moments - 1);
            else start = first - minMs;
            const total = entries.reduce((sum, e) => sum + e.amount, 0);
            const durationMs = Math.max(GameClock.now() - start, minMs);
            return total / (durationMs / 3_600_000);
        },

        clear() {
            series.clear();
        }
    };
}
