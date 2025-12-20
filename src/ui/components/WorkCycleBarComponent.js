// Fantasy Guild - Work Cycle Bar Component
// Shared component for the main card progress bar (Work Cycle / Task Duration)

/**
 * Render the main progress bar for a card
 * @param {Object} options
 * @param {string} options.cardId - The Card ID (required for DOM updates)
 * @param {number} options.durationSec - Duration in seconds (for CSS animation)
 * @param {number} options.progressPercent - Current progress percentage (0-100)
 * @param {boolean} options.isWorking - Whether the card is currently active/working
 * @param {boolean} options.isPaused - Whether the card is paused (e.g. missing resources)
 * @returns {string} HTML string
 */
export function renderWorkCycleBar(options) {
    const {
        cardId,
        durationSec = 0,
        progressPercent = 0,
        isWorking = true,
        isPaused = false
    } = options;

    let style = '';

    // If we have a specific percentage (Explore/Area style), use width
    // Otherwise, if we rely on CSS animation (Task style), use duration

    if (progressPercent > 0 || isPaused) {
        style = `width: ${progressPercent}%;`;
    }

    // Always include duration for smooth interpolation if provided
    if (durationSec > 0) {
        style += ` --duration: ${durationSec}s;`;
    }

    const pausedClass = isPaused ? 'card__progress-bar--paused' : '';
    const workingClass = isWorking ? '' : 'card__progress-bar--idle';

    return `
        <div class="card__progress" data-card-progress="${cardId}">
            <div class="card__progress-bar ${pausedClass} ${workingClass}" 
                 style="${style}"></div>
        </div>
    `;
}
