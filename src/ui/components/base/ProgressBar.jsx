import React from 'react';

/**
 * ProgressBar
 * A highly reusable progressive fill bar.
 * Handles both continuous CSS-driven animation (Work Cycles) and discrete state-driven styling (HP/Energy).
 * 
 * @param {Object} props
 * @param {number} props.current - Current value (or percent if no max)
 * @param {number} props.max - Max value (default 100)
 * @param {string} props.color - CSS color or variable (e.g. 'var(--color-hp)' or '#facc15')
 * @param {string} props.label - Optional text label (e.g. 'HP', '❤️')
 * @param {boolean} props.showText - Show "current/max" numerical readout
 * @param {number} props.durationSec - If > 0, animates the fill over this duration (CSS time-based tracking)
 * @param {boolean} props.isPaused - True pulses the bar red (for stalled tasks)
 * @param {string} props.size - 'sm', 'md', or 'lg' track height (default 'md')
 */
const ProgressBar = ({
    current = 0,
    max = 100,
    color = 'var(--color-accent-primary)',
    label = '',
    showText = false,
    durationSec = 0,
    isPaused = false,
    size = 'md'
}) => {
    // Calculate safe percentage
    const percentage = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

    // Track height mappings
    const heightClass = {
        sm: 'h-1.5',
        md: 'h-2',
        lg: 'h-3'
    }[size] || 'h-2';

    // Build dynamic inline styles
    const styles = {};
    if (percentage > 0 || isPaused || durationSec === 0) {
        styles.width = `${percentage}%`;
    }

    // Only apply background color if it's not a generic animation bar, 
    // or if the color is explicitly provided over the default.
    // However, if paused, we want it to pulse red (handled by classes).
    if (!isPaused) {
        styles.background = color;
    }

    if (durationSec > 0 && !isPaused) {
        styles.setProperty('--duration', `${durationSec}s`);
    }

    // Dynamic Classes
    const pausedClass = isPaused
        ? 'animate-pulse-red shadow-[0_0_12px_rgba(239,68,68,0.5)] bg-red-500'
        : 'shadow-progress-glow';

    return (
        <div className="flex flex-col gap-0.5 w-full">
            {label && (
                <span className="text-[9px] text-gray-400 font-pixel translate-x-1">
                    {label}
                </span>
            )}

            <div className={`relative w-full bg-black/60 rounded overflow-hidden ${heightClass}`}>
                <div
                    className={`h-full transition-all duration-300 ease-out ${pausedClass}`}
                    style={styles}
                />
            </div>

            {showText && (
                <span className="text-[9px] text-gray-500 font-mono text-center mt-0.5">
                    {Math.floor(current)}/{max}
                </span>
            )}
        </div>
    );
};

export default ProgressBar;
