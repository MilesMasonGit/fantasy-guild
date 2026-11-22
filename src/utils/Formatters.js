// Fantasy Guild - Formatters

/**
 * Formatting utilities for display values.
 */

/**
 * Parse a shorthand notation string into a number
 * @param {string|number} value - String to parse (e.g., "8k", "1.5m")
 * @returns {number} Parsed number
 */
export function parseNotation(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const str = value.toString().toLowerCase().trim();
    // Two-letter suffixes must be tried before single letters, or "qa" would
    // match as "q" and fail. Kept in step with formatCompact's ladder so the
    // two round-trip.
    const regex = /^([\d.]+)(qa|qi|sx|sp|oc|no|dc|[kmbt])?$/;
    const match = str.match(regex);

    if (!match) return parseFloat(str) || 0;

    const num = parseFloat(match[1]);
    const suffix = match[2];

    const multipliers = {
        'k': 1e3,
        'm': 1e6,
        'b': 1e9,
        't': 1e12,
        'qa': 1e15,
        'qi': 1e18,
        'sx': 1e21,
        'sp': 1e24,
        'oc': 1e27,
        'no': 1e30,
        'dc': 1e33
    };

    return suffix ? Math.floor(num * (multipliers[suffix] || 1)) : num;
}

/**
 * Where JavaScript stops counting exactly: 2^53 − 1 ≈ 9.007×10^15.
 *
 * Past this, integers lose precision silently — `x + 1 === x` becomes true and
 * totals drift with no error thrown. `isBeyondExactRange` lets display and
 * diagnostics flag it if content ever crosses it.
 */
export const MAX_EXACT_INTEGER = Number.MAX_SAFE_INTEGER;

/** True when a value has left the range JavaScript can represent exactly. */
export function isBeyondExactRange(num) {
    return Number.isFinite(num) && Math.abs(num) > MAX_EXACT_INTEGER;
}

/**
 * Format a large number with suffixes (K, M, B, T)
 * @param {number} num - Number to format
 * @param {number} precision - Decimal precision (default: 1)
 * @returns {string} Formatted number (e.g., "1.5M", "234K")
 */
export function formatCompact(num, precision = 1) {
    if (!isFinite(num)) return '0';
    if (Math.abs(num) < 1000) return num.toString();

    // The ladder runs past 'quadrillion' because idle-economy totals climb fast;
    // anything above the top rung falls through to exponential notation.
    const suffixes = [
        { value: 1e33, suffix: 'dc' },   // decillion
        { value: 1e30, suffix: 'no' },   // nonillion
        { value: 1e27, suffix: 'oc' },   // octillion
        { value: 1e24, suffix: 'sp' },   // septillion
        { value: 1e21, suffix: 'sx' },   // sextillion
        { value: 1e18, suffix: 'qi' },   // quintillion
        { value: 1e15, suffix: 'qa' },   // quadrillion
        { value: 1e12, suffix: 't' },
        { value: 1e9, suffix: 'b' },
        { value: 1e6, suffix: 'm' },
        { value: 1e3, suffix: 'k' }
    ];

    if (Math.abs(num) >= 1e36) return num.toExponential(precision);

    const absNum = Math.abs(num);

    for (const { value, suffix } of suffixes) {
        if (absNum >= value) {
            // Round down to 'precision' decimal places
            const factor = Math.pow(10, precision);
            const truncated = Math.floor((absNum / value) * factor) / factor;

            const formatted = (Math.sign(num) * truncated).toFixed(precision);

            const cleaned = formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
            return cleaned + suffix;
        }
    }

    return num.toString();
}

/**
 * Format a timestamp as relative time ago
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time (e.g., "5 minutes ago", "2 hours ago")
 */
export function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;

    // Format as date for older saves
    const date = new Date(timestamp);
    return date.toLocaleDateString();
}

const MINUTE_S = 60;
const HOUR_S = 3600;
const DAY_S = 86400;

const seconds = (ms) => Math.max(0, Number(ms) || 0) / 1000;

/**
 * A whole-second span in the game's one time spelling: `34s`, `4m 57s`, `1h 15m`, `1d 4h`.
 * `round` rounds to the smallest unit shown, so a countdown can round up at every size.
 * Zero parts are kept: a ticking time keeps its width (`5m 0s`).
 */
function spanText(totalSeconds, round) {
    const s = round(totalSeconds);
    if (s < MINUTE_S) return `${s}s`;
    if (s < HOUR_S) return `${Math.floor(s / MINUTE_S)}m ${s % MINUTE_S}s`;
    const m = round(totalSeconds / MINUTE_S);
    if (m < DAY_S / MINUTE_S) return `${Math.floor(m / 60)}h ${m % 60}m`;
    const h = round(totalSeconds / HOUR_S);
    return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/**
 * Time left on a running timer: rounded up, so it never reads `0s` while time is left, and zero
 * parts kept while it ticks (`5m 0s`, then `4m 59s`).
 */
export function countdownText(ms) {
    return spanText(seconds(ms), Math.ceil);
}

/**
 * Time gone by, like a stopwatch (a fight's length, playtime): rounded down, zero parts kept so a
 * live one holds its width.
 */
export function elapsedText(ms) {
    return spanText(seconds(ms), Math.floor);
}

/**
 * A fixed length (a grow time, a rest, a lap, a cycle, a swing, a speed bonus): one decimal under
 * a minute (`2.5s`, `4s`), whole seconds from a minute up, zero parts dropped (`8m`, `1h`) so it
 * reads like the timer it starts (`8m` then `8m 0s`). Past a day it is days and hours (`1d 0h`).
 */
export function lengthText(ms) {
    const total = seconds(ms);
    const tenths = Math.round(total * 10) / 10;
    if (tenths < MINUTE_S) return `${tenths}s`;
    const s = Math.round(total);
    if (s < HOUR_S) {
        const sec = s % MINUTE_S;
        return sec ? `${Math.floor(s / MINUTE_S)}m ${sec}s` : `${Math.floor(s / MINUTE_S)}m`;
    }
    const m = Math.round(total / MINUTE_S);
    if (m < DAY_S / MINUTE_S) {
        const min = m % 60;
        return min ? `${Math.floor(m / 60)}h ${min}m` : `${Math.floor(m / 60)}h`;
    }
    const h = Math.round(total / HOUR_S);
    return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

/** A rank in Roman numerals: 1 → "I", 4 → "IV", 14 → "XIV". */
export function toRoman(n) {
    let left = Math.floor(Number(n) || 0);
    if (left <= 0) return String(n);
    let out = '';
    for (const [value, letters] of ROMAN) {
        while (left >= value) {
            out += letters;
            left -= value;
        }
    }
    return out;
}
