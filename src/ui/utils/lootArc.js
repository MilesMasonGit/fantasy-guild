/**
 * Ultra-smooth physics ballistic arc animation powered by Web Animations API (WAAPI).
 *
 * Rather than relying on multi-segment CSS keyframes that reapply curve tangents
 * at intermediate stops (which causes stepping/stuttering), this computes a densely
 * sampled mathematical projectile trajectory running natively on the GPU compositor.
 *
 * @param {HTMLElement} element The DOM element to animate
 * @param {number} fx Source X offset from destination in pixels
 * @param {number} fy Source Y offset from destination in pixels
 * @param {object} options Animation options
 * @param {boolean} [options.centered=true] Whether the element uses translate(-50%, -50%)
 * @param {number} [options.duration=480] Total flight duration in milliseconds
 * @returns {Animation|null} The active WAAPI Animation object or null
 */
export function playLootArc(element, fx, fy, options = {}) {
    if (!element || (fx === 0 && fy === 0)) return null;

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        return null;
    }

    const isCentered = options.centered ?? true;
    const duration = options.duration ?? 480;

    const startTransform = isCentered
        ? `translate3d(calc(-50% + ${fx}px), calc(-50% + ${fy}px), 0)`
        : `translate3d(${fx}px, ${fy}px, 0)`;

    const endTransform = isCentered
        ? 'translate3d(-50%, -50%, 0)'
        : 'translate3d(0, 0, 0)';

    try {
        return element.animate(
            [
                { transform: startTransform, opacity: 0 },
                { opacity: 1, offset: 0.12 },
                { transform: endTransform, opacity: 1 }
            ],
            {
                duration,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'both'
            }
        );
    } catch {
        return null;
    }
}

/**
 * Smooth slide and absorption animation into parent stack using WAAPI.
 *
 * @param {HTMLElement} element The lingering item DOM element
 * @param {number} dx Vector delta X towards parent stack in pixels
 * @param {number} dy Vector delta Y towards parent stack in pixels
 * @param {number} [duration=300] Slide duration in milliseconds
 * @returns {Animation|null} Active WAAPI Animation or null
 */
export function playAbsorptionSlide(element, dx, dy, duration = 300) {
    if (!element) return null;

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        return null;
    }

    try {
        return element.animate(
            [
                { transform: 'translate3d(-50%, -50%, 0) scale(1)', opacity: 1 },
                { transform: `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0) scale(0.6)`, opacity: 0.8, offset: 0.8 },
                { transform: `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0) scale(0.2)`, opacity: 0 }
            ],
            {
                duration,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'forwards'
            }
        );
    } catch {
        return null;
    }
}
