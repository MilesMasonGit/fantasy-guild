/**
 * A collected sprite's short slide in, by the Web Animations API: three keyframes, fading in
 * over the first eighth and easing out along a straight line from its source offset to rest.
 *
 * ⚠️ The keyframes carry only the flight's offset, never the element's own centring: the
 * sprite centres itself with the CSS `translate` property (Tailwind's `-translate-x-1/2`),
 * which composes with `transform` instead of being replaced by it, so a `-50%` here would
 * centre it twice. Nothing is held after the landing (`fill: 'backwards'`): a held 3D
 * transform keeps the sprite on a composited layer of its own, drawn resampled (soft).
 *
 * @param {HTMLElement} element The DOM element to animate
 * @param {number} fx Source X offset from destination in pixels
 * @param {number} fy Source Y offset from destination in pixels
 * @param {object} options Animation options
 * @param {number} [options.duration=480] Total flight duration in milliseconds
 * @returns {Animation|null} The active WAAPI Animation object or null
 */
export function playLootArc(element, fx, fy, options = {}) {
    if (!element || (fx === 0 && fy === 0)) return null;

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        return null;
    }

    const duration = options.duration ?? 480;

    try {
        return element.animate(
            [
                { transform: `translate3d(${fx}px, ${fy}px, 0)`, opacity: 0 },
                { opacity: 1, offset: 0.12 },
                { transform: 'translate3d(0px, 0px, 0)', opacity: 1 }
            ],
            {
                duration,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'backwards'
            }
        );
    } catch {
        return null;
    }
}

/**
 * Smooth slide and absorption animation into parent stack using WAAPI.
 * Like the arc, the keyframes leave the sprite's own centring to its `translate` property.
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
                { transform: 'translate3d(0px, 0px, 0) scale(1)', opacity: 1 },
                { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.6)`, opacity: 0.8, offset: 0.8 },
                { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.2)`, opacity: 0 }
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
