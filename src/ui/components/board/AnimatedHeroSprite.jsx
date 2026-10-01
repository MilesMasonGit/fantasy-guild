import { useLayoutEffect, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { heroSpriteFrame } from './hitAnimations.js';
import { HERO_SHEET_GRID } from '../../../config/spriteFx.js';
import { useMatFit } from './MatFitContext.jsx';
import { useSpriteFxVersion, sheetOutlineLayer } from '../../utils/spriteFx.js';

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
 *
 * ⭐ **Outline** (Wave 5, `outline`: `'work'` | `'hover'` | `'alert'`): a
 * generated outline sheet the same size and grid as the art, under it, moved
 * by the same frame step — so it follows every frame with no filter. It is
 * always in the tree (an empty layer when off) so the step can write to it.
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
    outline = null,
    className
}) => {
    const rootRef = useRef(null);
    const imgRef = useRef(null);
    const ringRef = useRef(null);
    useSpriteFxVersion();
    const fit = useMatFit();
    const ring = outline ? sheetOutlineLayer(src, size, fit, outline) : null;

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
                const at = `translate(-${next.frame * size}px, -${(ROW_INDEX[next.row] ?? 2) * size}px)`;
                if (img) img.style.transform = at;
                if (ringRef.current) ringRef.current.style.transform = at;
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

    // An outline turned on mid-frame takes the frame already showing.
    useLayoutEffect(() => {
        if (ringRef.current && imgRef.current) ringRef.current.style.transform = imgRef.current.style.transform;
    }, [ring?.url]);

    return (
        <div
            ref={rootRef}
            className={cn('relative overflow-hidden select-none', className)}
            style={{
                width: size,
                height: size
            }}
            title={alt}
            data-sprite-outline={outline || undefined}
        >
            <div
                className="absolute inset-0"
                style={{ transform: facingLeft ? 'scaleX(-1)' : 'none' }}
            >
                <span
                    ref={ringRef}
                    aria-hidden="true"
                    data-sprite-ring={ring ? outline : undefined}
                    className="absolute left-0 top-0 pointer-events-none"
                    style={{
                        width: `${size * HERO_SHEET_GRID.cols}px`,
                        height: `${size * HERO_SHEET_GRID.rows}px`,
                        backgroundImage: ring ? `url("${ring.url}")` : 'none',
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat',
                        imageRendering: 'pixelated'
                    }}
                />
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt}
                    draggable={false}
                    className="absolute pointer-events-none"
                    style={{
                        width: `${size * HERO_SHEET_GRID.cols}px`,
                        height: `${size * HERO_SHEET_GRID.rows}px`,
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
