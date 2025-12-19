// Fantasy Guild - Formatters
// Phase 3: Core Utilities

/**
 * Formatting utilities for display values
 */

/**
 * Format seconds into a human-readable time string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time (e.g., "1:30", "2h 15m", "3d 4h")
 */
export function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '--:--';

    seconds = Math.floor(seconds);

    if (seconds < 60) {
        return `0:${seconds.toString().padStart(2, '0')}`;
    }

    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
}

/**
 * Format a number with thousand separators
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted number (e.g., "1,234,567")
 */
export function formatNumber(num, decimals = 0) {
    if (!isFinite(num)) return '0';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Format a large number with suffixes (K, M, B, T)
 * @param {number} num - Number to format
 * @param {number} precision - Decimal precision (default: 1)
 * @returns {string} Formatted number (e.g., "1.5M", "234K")
 */
export function formatCompact(num, precision = 1) {
    if (!isFinite(num)) return '0';

    const suffixes = [
        { value: 1e12, suffix: 'T' },
        { value: 1e9, suffix: 'B' },
        { value: 1e6, suffix: 'M' },
        { value: 1e3, suffix: 'K' }
    ];

    const absNum = Math.abs(num);

    for (const { value, suffix } of suffixes) {
        if (absNum >= value) {
            const formatted = (num / value).toFixed(precision);
            // Remove trailing zeros
            const cleaned = formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
            return cleaned + suffix;
        }
    }

    return num.toString();
}

/**
 * Format a percentage
 * @param {number} value - Value to format (0-1 or 0-100)
 * @param {boolean} isDecimal - Whether the input is already a decimal (0-1)
 * @param {number} precision - Decimal precision (default: 0)
 * @returns {string} Formatted percentage (e.g., "75%")
 */
export function formatPercent(value, isDecimal = false, precision = 0) {
    if (!isFinite(value)) return '0%';
    const percent = isDecimal ? value * 100 : value;
    return percent.toFixed(precision) + '%';
}

/**
 * Capitalize the first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string}
 */
export function titleCase(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Convert snake_case or kebab-case to Title Case
 * @param {string} str - String to convert
 * @returns {string}
 */
export function idToTitle(str) {
    if (!str) return '';
    return str
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Pluralize a word based on count
 * @param {number} count - The count
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form (default: singular + 's')
 * @returns {string}
 */
export function pluralize(count, singular, plural = null) {
    if (count === 1) return singular;
    return plural || singular + 's';
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

// Import biome/modifier registries for location formatting
import { getBiome } from '../config/registries/biomeRegistry.js';
import { getModifier } from '../config/registries/modifierRegistry.js';

/**
 * Format a biome/modifier pair into a location display string
 * @param {string} biomeId - Biome ID (e.g., 'forest', 'mountain')
 * @param {string} modifierId - Modifier ID (e.g., 'windy', null)
 * @returns {string} Formatted location (e.g., "Windy Forest", "Mountain")
 */
export function formatLocation(biomeId, modifierId = null) {
    const biome = getBiome(biomeId);
    const modifier = getModifier(modifierId);
    const biomeName = biome?.name || 'Unknown';
    const modName = modifier?.name || '';
    return modName ? `${modName} ${biomeName}` : biomeName;
}
