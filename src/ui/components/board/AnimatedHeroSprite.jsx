import { useLayoutEffect, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { heroSpriteFrame } from './hitAnimations.js';

/** The sheet's row for each state the clock can ask for. */
const ROW_INDEX = { attack: 0, walk: 1, idle: 2 };

/**
 * Renders a 64x64 hero sprite sheet with 3 rows (Attack, Walk, Idle) and 8 frames per row.
 *
 * Row 1 (index 0): Attack/Work
 * Row 2 (index 1): Walk
 * Row 3 (index 2): Idle
 *
 * ⭐ **The frame is written to the element, not kept in React state** (CR3-301,
 * R6 rule 4). Each step sets the sheet's `transform` and the two
 * `data-hero-*` attributes directly, so eight heroes stepping 8 times a second
 * cost no React commits (it was ~42 a second on the mat and ~43 in the dock).
 * React renders this only when its props change; none of the per-frame values
 * appear in the JSX, so a re-render never writes over a frame the clock has
 * already moved on. Which frame shows is pinned in `SpriteFrameSequence.test.js`.
 */
export const AnimatedHeroSprite = ({
    src,
    alt,
    size = 64,
    animationState = 'idle', // 'idle', 'walk', 'attack', 'combat'
    facingLeft = false,
    frameMs = 125,
    heroId = null,
    attackAt = null, // 'combat': when the last real attack began (performance.now())
    className
}) => {
    const rootRef = useRef(null);
    const imgRef = useRef(null);

    // 8 FPS by default (125 ms a frame); a limping hero plays slower.
    // ⭐ The frame is read from the clock, not counted (feedback Q4, FB-10):
    // the Token this hero works plays its hit on the strike frame, from the
    // same clock and the hero's own phase (`hitAnimations.js`), so the two
    // never drift apart. Each step waits for the next frame boundary.
    // In a fight (`combat`, feedback Q6 FB-49) the hero idles and plays the
    // attack row once from `attackAt`, each real attack restarting it.
    // A layout effect, so the first frame is on the element before it paints.
    useLayoutEffect(() => {
        const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
        let timer = null;
        let shownRow = null;
        let shownFrame = null;
        const step = () => {
            const next = heroSpriteFrame(animationState, clock(), { heroId, frameMs, attackAt });
            if (next.row !== shownRow || next.frame !== shownFrame) {
                shownRow = next.row;
                shownFrame = next.frame;
                const img = imgRef.current;
                const root = rootRef.current;
                if (img) img.style.transform = `translate(-${next.frame * size}px, -${(ROW_INDEX[next.row] ?? 2) * size}px)`;
                if (root) {
                    root.setAttribute('data-hero-row', next.row);
                    root.setAttribute('data-hero-frame', String(next.frame));
                }
            }
            timer = setTimeout(step, next.nextInMs + 1);
        };
        step();
        return () => clearTimeout(timer);
    }, [frameMs, heroId, animationState, attackAt, size]);

    return (
        <div
            ref={rootRef}
            className={cn('relative overflow-hidden select-none', className)}
            style={{
                width: size,
                height: size
            }}
            title={alt}
        >
            <div
                className="absolute inset-0"
                style={{ transform: facingLeft ? 'scaleX(-1)' : 'none' }}
            >
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt}
                    draggable={false}
                    className="absolute pointer-events-none"
                    style={{
                        width: `${size * 8}px`,
                        height: `${size * 3}px`,
                        maxWidth: 'none',
                        maxHeight: 'none',
                        imageRendering: 'pixelated'
                    }}
                />
            </div>
        </div>
    );
};

export default AnimatedHeroSprite;
