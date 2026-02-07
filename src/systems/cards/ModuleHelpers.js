// Fantasy Guild - Module Helpers
// Shared logic for generating labels and status text across modules

/**
 * Generate a status label for a progress bar
 * @param {Object} options
 * @param {string} options.status - Card status ('idle', 'working', 'paused')
 * @param {string} options.assignedHeroId - Currently assigned hero
 * @param {Array} options.missingItems - List of missing item names
 * @param {string} options.defaultAction - Default text (e.g. "Mining...")
 * @returns {string} Human-readable label
 */
export function getActionStatusLabel(options) {
    const {
        status,
        assignedHeroId,
        missingItems = [],
        missingRequirements = [],
        defaultAction = 'Working...'
    } = options;

    if (!assignedHeroId) return 'Assign a Hero';

    const allMissing = [...missingRequirements, ...missingItems];
    if (status === 'paused' && allMissing.length > 0) {
        return `Missing: ${allMissing[0]}`;
    }

    if (status === 'idle') return 'Ready';
    if (status === 'active') return defaultAction;
    if (status === 'paused') return 'Paused';

    return defaultAction;
}

/**
 * Format a duration or speed multiplier for display
 * @param {number} base - Base duration in seconds
 * @param {number} current - Current duration in seconds
 * @returns {string} E.g. "10s -> 8s" or just "10s"
 */
export function formatSpeedVisual(base, current) {
    if (!current || Math.abs(base - current) < 0.1) {
        return `${Math.round(base)}s`;
    }
    return `${Math.round(base)}s → ${Math.round(current)}s`;
}
