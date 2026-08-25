// Fantasy Guild - Formatters
// Phase 3: Core Utilities

/**
 * Formatting utilities for display values.
 *
 * ⚠️ This is NOT a general-purpose kit — every export below has live callers.
 * Six that had none anywhere in `src/` or `cms/src/` (`formatTime`,
 * `formatNumber`, `formatPercent`, `titleCase`, `idToTitle`, `pluralize`)
 * were deleted on 2026-08-24 (CR2-102). If you need one, add it back here
 * rather than writing a twelfth formatter somewhere else.
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
 * totals drift with no error thrown. Nothing in the game should be *designed*
 * to cross it (watch item W-7); `isBeyondExactRange` exists so display and
 * diagnostics can flag it if content ever does.
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

    // The ladder runs past 'quadrillion' because an idle economy's totals climb
    // faster than any single value does — a stack of 10^12 items at 10^3 gold
    // each is already 10^15. Anything above the top rung falls through to
    // exponential notation rather than printing 30 unreadable digits.
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

            // Reapply sign and format string
            const formatted = (Math.sign(num) * truncated).toFixed(precision);

            // Remove trailing zero only if we want it fully clean, 
            // but typical "1.0k" is often preferred. The prompt requests "1.6k". If it's 1000, "1k" is fine.
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

// `formatLocation(biomeId)` lived here and turned a biome id into a display
// name. It was exported but called from nowhere, and its only dependency was
// the biome registry, retired 2026-08-18 with the card system.

