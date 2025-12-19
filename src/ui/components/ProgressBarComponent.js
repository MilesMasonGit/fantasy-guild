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
    <div class="progress-bar progress-bar--${size}">
      ${label ? `<span class="progress-bar__label">${label}</span>` : ''}
      <div class="progress-bar__track">
        <div class="progress-bar__fill" style="width: ${percentage}%; background: ${color};"></div>
      </div>
      ${showText ? `<span class="progress-bar__text">${Math.floor(current)}/${max}</span>` : ''}
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
