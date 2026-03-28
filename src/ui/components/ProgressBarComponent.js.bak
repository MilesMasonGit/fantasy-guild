// Fantasy Guild - Progress Bar Component
// Phase 9: Hero UI

/**
 * ProgressBarComponent - Reusable progress bar for HP, Energy, XP, etc.
 * 
 * Usage:
 *   const html = renderProgressBar({
 *     current: 75,
 *     max: 100,
 *     color: 'var(--color-hp)',
 *     label: 'HP',
 *     showText: true
 *   });
 */

/**
 * Render a progress bar
 * @param {Object} options
 * @param {number} options.current - Current value
 * @param {number} options.max - Maximum value
 * @param {string} options.color - CSS color for the fill
 * @param {string} options.label - Optional label (e.g., 'HP')
 * @param {boolean} options.showText - Show current/max text
 * @param {string} options.size - 'sm', 'md', or 'lg' (default 'md')
 * @returns {string} HTML string
 */
export function renderProgressBar(options) {
    const {
        current = 0,
        max = 100,
        color = 'var(--color-accent-primary)',
        label = '',
        showText = true,
        size = 'md'
    } = options;

    const percentage = max > 0 ? Math.min(100, (current / max) * 100) : 0;

    return `
    <div class="progress-bar flex flex-col gap-0.5 w-full">
      ${label ? `<span class="text-[9px] text-gray-400 font-pixel translate-x-1">${label}</span>` : ''}
      <div class="progress-track w-full ${size === 'sm' ? 'h-1.5' : 'h-2'}">
        <div class="progress-fill shadow-progress-glow" style="width: ${percentage}%; background: ${color};"></div>
      </div>
      ${showText ? `<span class="text-[9px] text-gray-500 font-mono text-center mt-0.5">${Math.floor(current)}/${max}</span>` : ''}
    </div>
  `;
}

/**
 * Shorthand for HP bar
 */
export function renderHpBar(current, max, size = 'sm') {
    return renderProgressBar({
        current,
        max,
        color: 'var(--color-hp)',
        label: '❤️',
        showText: true,
        size
    });
}

/**
 * Shorthand for Energy bar
 */
export function renderEnergyBar(current, max, size = 'sm') {
    return renderProgressBar({
        current,
        max,
        color: 'var(--color-energy)',
        label: '⚡',
        showText: true,
        size
    });
}

/**
 * Shorthand for XP progress bar
 */
export function renderXpBar(currentXp, xpForNext, progress, size = 'sm') {
    return renderProgressBar({
        current: Math.floor(progress * 100),
        max: 100,
        color: 'var(--color-xp)',
        showText: false,
        size
    });
}

/**
 * Render a modular progress bar (Phase 1: Modular Card System)
 * @param {Object} options
 * @param {string} options.cardId - Owner card ID
 * @param {string} options.moduleId - Unique ID for this progress module instance
 * @param {string} options.type - 'time', 'counter', or 'aggregate'
 * @param {number} options.progressPercent - Current progress (0-100)
 * @param {string} options.actionLabel - Text label (e.g. "Mining...")
 * @param {string} options.speedLabel - Speed info (e.g. "10s -> 8s")
 * @param {string} options.counterText - Descriptive counter (e.g. "3/5 Defeated")
 * @param {boolean} options.isPaused - Whether the module is stalled
 * @param {number} options.durationSec - For CSS animated bars
 * @returns {string} HTML string
 */
export function renderProgressBarModule(options) {
    const {
        cardId,
        moduleId,
        type = 'time',
        progressPercent = 0,
        actionLabel = '',
        speedLabel = '',
        counterText = '',
        isPaused = false,
        durationSec = 0
    } = options;

    let barStyle = `width: ${progressPercent}%;`;
    if (durationSec > 0 && type === 'time' && !isPaused) {
        barStyle += ` --duration: ${durationSec}s;`;
    }

    const stallClass = isPaused ? 'module-progress__bar--stalled' : '';

    return `
        <div class="module-progress" data-module-id="${moduleId}" data-card-id="${cardId}">
            <div class="module-progress__label-row">
                <span class="module-progress__action-label">${actionLabel}</span>
                <span class="module-progress__speed-info">${speedLabel}</span>
            </div>
            <div class="module-progress__bar-container">
                <div class="module-progress__bar ${stallClass}" style="${barStyle}"></div>
                ${counterText ? `<span class="module-progress__counter">${counterText}</span>` : ''}
            </div>
        </div>
    `;
}
