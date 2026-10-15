import { useLayoutEffect, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { heroSpriteFrame } from './hitAnimations.js';
import { HERO_SHEET_GRID } from '../../../config/spriteFx.js';
import { useSpriteFxVersion, sheetOutlineLayer, sheetCellPosition } from '../../utils/spriteFx.js';
import { isDrawn } from '../../dev/perf/drawSwitches.js';
import { onDue } from './frameClock.js';

/** The sheet's row for each state the clock can ask for. */
const ROW_INDEX = { attack: 0, walk: 1, idle: 2 };

/**
 * Renders a 64x64 hero sprite sheet with 3 rows (Attack, Walk, Idle) and 8 frames per row.
 * Row 1 (index 0): Attack/Work
 * Row 2 (index 1): Walk
 * Row 3 (index 2): Idle
 * **The frame is written to the element, not kept in React state.** Each step sets the sheet's
 * `transform` and the two `data-hero-*` attributes directly, so heroes stepping 8 times a
 * second cost no React commits. React renders this only when its props change; none of the
 * per-frame values appear in the JSX, so a re-render never writes over a frame the clock has
 * already moved on. Which frame shows is pinned in `SpriteFrameSequence.test.js`.
 * **Outline** (`outline`: `'work'` | `'hover'` | `'alert'`): a generated outline sheet in the
 * same grid as the art, its cells padded one art pixel a side (`sheetOutlineLayer`), under it
 * and moved by the same frame step, so it follows every frame with no filter. It is always in
 * the tree (an empty layer when off); the step moves it only while it is on, and it takes the
 * frame showing the moment it comes on.
 * ⚠️ The outline sits outside the box that crops the art to one frame: it reaches one art pixel
 * past the frame, and inside that box a bow's tip or a foot at the frame's edge lost its ring.
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
    const shownRef = useRef({ col: 0, row: ROW_INDEX.idle });
    useSpriteFxVersion();
    const ring = outline ? sheetOutlineLayer(src, outline, size) : null;
    const ringCell = ring ? ring.cell : size;
    const ringCellRef = useRef(ringCell);
    ringCellRef.current = ringCell;

    // 8 FPS by default (125 ms a frame); a limping hero plays slower.
    // The frame is read from the clock, not counted: the Token this hero works plays its hit
    // on the strike frame, from the same clock and the hero's own phase (`hitAnimations.js`),
    // so the two never drift apart. Each step is due at the next frame boundary, on the shared
    // sprite clock (`onDue`), which steps every sprite due by a frame in that one frame. In a
    // fight (`combat`) the hero idles and plays the attack row once from `attackAt`, each real
    // attack restarting it. A layout effect, so the first frame is on the element before it
    // paints.
    useLayoutEffect(() => {
        let shownRow = null;
        let shownFrame = null;
        const step = (now) => {
            const next = heroSpriteFrame(animationState, now, { heroId, frameMs, attackAt });
            if (next.row !== shownRow || next.frame !== shownFrame) {
                shownRow = next.row;
                shownFrame = next.frame;
                const img = imgRef.current;
                const ringEl = ringRef.current;
                const root = rootRef.current;
                const rowIndex = ROW_INDEX[next.row] ?? 2;
                shownRef.current = { col: next.frame, row: rowIndex };
                if (img) img.style.transform = `translate(-${next.frame * size}px, -${rowIndex * size}px)`;
                // An outline that is off draws nothing; it takes the frame when it comes on (below).
                if (ringEl?.hasAttribute('data-sprite-ring')) {
                    ringEl.style.backgroundPosition = sheetCellPosition(next.frame, rowIndex, ringCellRef.current);
                }
                if (root) {
                    root.setAttribute('data-hero-row', next.row);
                    root.setAttribute('data-hero-frame', String(next.frame));
                }
            }
            return now + next.nextInMs;
        };
        const due = step(performance.now());
        // heroAnim off: the one frame the state asks for, then no more steps.
        return isDrawn('heroAnim') ? onDue(step, due) : undefined;
    }, [frameMs, heroId, animationState, attackAt, size]);

    // An outline turned on takes the frame already showing.
    useLayoutEffect(() => {
        const { col, row } = shownRef.current;
        if (ringRef.current) ringRef.current.style.backgroundPosition = sheetCellPosition(col, row, ringCell);
    }, [ring?.url, ringCell]);

    const flip = facingLeft ? 'scaleX(-1)' : 'none';
    return (
        <div
            ref={rootRef}
            className={cn('relative select-none', className)}
            style={{
                width: size,
                height: size
            }}
            title={alt}
            data-sprite-outline={outline || undefined}
        >
            <span
                ref={ringRef}
                aria-hidden="true"
                data-sprite-ring={ring ? outline : undefined}
                className="absolute pointer-events-none"
                style={{
                    left: -(ring?.pad || 0),
                    top: -(ring?.pad || 0),
                    width: ringCell,
                    height: ringCell,
                    backgroundImage: ring ? `url("${ring.url}")` : 'none',
                    backgroundSize: `${ringCell * HERO_SHEET_GRID.cols}px ${ringCell * HERO_SHEET_GRID.rows}px`,
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'pixelated',
                    transform: flip
                }}
            />
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0" style={{ transform: flip }}>
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
        </div>
    );
};

export default AnimatedHeroSprite;
