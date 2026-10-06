import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { ENEMY_SHEET_GRID } from '../../../config/spriteFx.js';
import { useSpriteFxVersion, sheetOutlineLayer } from '../../utils/spriteFx.js';

/**
 * Renders a 64px enemy sprite sheet, 4 columns × 4 rows: rows 0–1 are the **idle** cycle (8
 * frames), rows 2–3 are **attack** (8 frames).
 * ⚠️ A different grid from a hero's sheet (`AnimatedHeroSprite.jsx`: 8 columns × 3 rows, one
 * row per state). Enemy sheets read two rows per cycle, wrapping row 0 into row 1 for 8
 * frames, and row 2 into row 3, so both cycles are the same length and the frame index alone
 * (`0..7`) always picks the right column and row-within-cycle.
 * No engine coupling: which cycle plays and which way the enemy faces are pure presentation.
 * Nothing here writes to `BoardState`, subscribes to the board's event bus, or runs on the
 * engine tick; an enemy that isn't rendered costs nothing, and one that is costs one local
 * `setInterval`, like a hero's.
 * Which cycle plays: `heroId` is the Token's current worker, already tracked reactively by
 * `MatToken` (`BoardState.workerOf`). An enemy Token's only worker is a hero mid-fight, so
 * `heroId` truthy already means 'this fight is live', with no separate subscription and no
 * risk of missing a silent end-of-fight (`BoardCombat.endFight` publishes nothing to key off).
 * Facing: the sheet's native, unflipped pose faces **left**, the opposite of a hero's sheet.
 * While fought, the enemy turns to face the working hero's own side (`HeroMotion`'s `side`).
 * Otherwise it turns on its own now and then, after a fixed 12–24s pause.
 * ⚠️ This is ONE element with a CSS `background-image`, not an absolutely-positioned `<img>`
 * cropped by a clipped, transformed ancestor: that nested approach made the sprite vanish
 * while flipped in some browsers. `background-position` picking the frame and
 * `background-size` fixing the sheet's scale, both on the flipped element itself, leaves no
 * nested transform, no `overflow: hidden` and no absolutely-positioned child for a browser to
 * get wrong.
 */

const COLS = ENEMY_SHEET_GRID.cols;
const IDLE_ROW = 0;
const ATTACK_ROW = 2;
const FACING = { LEFT: -1, RIGHT: 1 };

/** How long an idle, unfought enemy waits before turning the other way. */
const TURN_PAUSE_MS = Object.freeze({ min: 12000, max: 24000 });

export const AnimatedEnemySprite = ({
    src,
    heroId = null,
    walkFacing = null,
    alt,
    size = 64,
    frameMs = 125,
    outline = null,
    className
}) => {
    const [facing, setFacing] = useState(FACING.LEFT);
    const turnTimer = useRef(null);

    // The frame is written to the element, not kept in React state: `background-position` is
    // set directly on each step, so an animating enemy costs no React commits. `frameRef`
    // keeps counting across a change of cycle.
    // The coloured outline (`outline`) is a second sheet the same size and grid as the art,
    // drawn from the generated images under it, so the same frame step moves both and nothing
    // is ever filtered.
    const artRef = useRef(null);
    const ringRef = useRef(null);
    const frameRef = useRef(0);
    const paintRef = useRef(null);
    paintRef.current = () => {
        const frame = frameRef.current;
        const row = (heroId ? ATTACK_ROW : IDLE_ROW) + Math.floor(frame / COLS);
        const col = frame % COLS;
        const pos = `-${col * size}px -${row * size}px`;
        if (artRef.current) artRef.current.style.backgroundPosition = pos;
        if (ringRef.current) ringRef.current.style.backgroundPosition = pos;
    };
    useSpriteFxVersion();
    const ring = outline ? sheetOutlineLayer(src, outline) : null;

    // The cycle (fought or not) and the cell size show at once.
    useLayoutEffect(() => { paintRef.current(); }, [heroId, size, ring?.url]);

    // Frame advance: a local clock, unrelated to the game's own tick, exactly like
    // AnimatedHeroSprite's. 8 frames either cycle.
    useEffect(() => {
        const id = setInterval(() => {
            frameRef.current = (frameRef.current + 1) % 8;
            paintRef.current();
        }, frameMs);
        return () => clearInterval(id);
    }, [frameMs]);

    // Facing: forced to the working hero's side while fought; an idle enemy's own occasional
    // turn otherwise. Switching between the two always cancels whatever timer the other one
    // was running.
    useEffect(() => {
        clearTimeout(turnTimer.current);

        if (heroId) {
            const side = BoardState.heroBodyOf(heroId)?.side;
            if (side === FACING.LEFT || side === FACING.RIGHT) setFacing(side);
            return undefined;
        }

        const scheduleTurn = () => {
            const delay = TURN_PAUSE_MS.min + Math.random() * (TURN_PAUSE_MS.max - TURN_PAUSE_MS.min);
            turnTimer.current = setTimeout(() => {
                setFacing(f => -f);
                scheduleTurn();
            }, delay);
        };
        scheduleTurn();
        return () => clearTimeout(turnTimer.current);
    }, [heroId]);

    // Walking by its spawner, it faces the way it walks, and keeps that facing when it stops.
    // The sheets have no walk cycle, so the idle cycle plays while it glides.
    useEffect(() => {
        if (heroId) return;
        if (walkFacing === FACING.LEFT || walkFacing === FACING.RIGHT) setFacing(walkFacing);
    }, [walkFacing, heroId]);

    const flip = facing === FACING.RIGHT ? 'scaleX(-1)' : 'none';
    return (
        <div
            className={cn('relative pointer-events-none select-none', className)}
            style={{ width: size, height: size }}
            title={alt}
            data-sprite-outline={outline || undefined}
        >
            {/* The outline sheet: always in the tree (an empty box when off),
                so the frame step has it to write to the moment it is wanted. */}
            <div
                ref={ringRef}
                aria-hidden="true"
                data-sprite-ring={ring ? outline : undefined}
                className="absolute inset-0"
                style={{
                    backgroundImage: ring ? `url("${ring.url}")` : 'none',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: `${size * COLS}px ${size * COLS}px`,
                    imageRendering: 'pixelated',
                    transform: flip
                }}
            />
            {/**
             * A separate element from the one `className` lands on: MatToken's own
             * landing-bounce animation (`gi-token-land`) sets `transform` too, and a CSS
             * animation on the same element would override this inline flip for its 380ms,
             * every time a fought or freshly-turned enemy is re-placed.
             */}
            <div
                ref={artRef}
                className="relative w-full h-full"
                style={{
                    backgroundImage: `url(${src})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: `${size * COLS}px ${size * COLS}px`,
                    imageRendering: 'pixelated',
                    transform: flip
                }}
                role="img"
                aria-label={alt}
            />
        </div>
    );
};

export default AnimatedEnemySprite;
