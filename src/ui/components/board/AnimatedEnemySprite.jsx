import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { RESTING_SHADOW } from '../base/TokenSprite.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';

/**
 * Renders a 64px enemy sprite sheet, 4 columns × 4 rows: rows 0–1 are the
 * **idle** cycle (8 frames), rows 2–3 are **attack** (8 frames) — Enemy
 * Animations EA-1, confirmed against the actual pixels of `ani_cow.png`,
 * not the CMS's own (backwards) assumption.
 *
 * ⚠️ **A different grid from a hero's sheet** (`AnimatedHeroSprite.jsx`'s
 * 8 columns × 3 rows, one row per state). Enemy sheets read two rows per
 * cycle, wrapping row 0 into row 1 for 8 frames, same again for row 2 into
 * row 3 — so both cycles are the same length and the frame index alone
 * (`0..7`) always picks the right column and row-within-cycle.
 *
 * ## No engine coupling (EAP-1)
 * Which cycle plays and which way the enemy faces are **pure presentation**
 * — nothing here writes to `BoardState`, subscribes to the board's event
 * bus, or runs on the engine tick. This is the direct answer to "I have
 * concerns about game performance": an enemy that isn't currently rendered
 * costs nothing, and one that is costs one local `setInterval`, exactly
 * like a hero's.
 *
 * ## Which cycle plays (EAP-2)
 * `heroId` is the Token's current worker, already tracked reactively by
 * `MatToken` (`BoardState.workerOf`) for other badges — an enemy Token's
 * only worker is a hero mid-fight (`Flags`/`BoardCombat`: nothing else can
 * claim one, and a hero who cannot fight never claims one at all). So
 * `heroId` truthy already means "this fight is live," with no separate
 * subscription needed and no risk of missing a silent end-of-fight (`
 * BoardCombat.endFight` publishes nothing to key off).
 *
 * ## Facing (EA-2, EA-3, EA-4)
 * The sheet's native, unflipped pose faces **left** — the opposite of a
 * hero's sheet. While fought, the enemy turns to face the working hero's
 * own side (`HeroMotion`'s `side`, already settled the moment that hero
 * arrived). Otherwise it turns on its own now and then, unprompted — a
 * fixed 12–24s pause between turns, EA-4.
 *
 * WARNING: this is ONE element with a CSS `background-image`, not an
 * absolutely-positioned `<img>` cropped by a clipped, transformed ancestor.
 * Two earlier versions used that nested-`<img>` approach (an outer box that
 * clipped, an inner box that flipped, a translated `<img>` picking the
 * frame) and the sprite reliably vanished while flipped in the owner's own
 * browser (reappeared at the native facing, drag/drop unaffected, so it
 * was display-only) — reproducible for them, never for this session's own
 * testing, which points at a real cross-browser rendering edge case in
 * that structure rather than a logic bug. `background-position` picking
 * the frame and `background-size` fixing the sheet's scale, both on the
 * flipped element itself, is the standard way to do this and leaves no
 * nested transform, no `overflow: hidden`, and no absolutely-positioned
 * child for a browser to get wrong.
 */

const COLS = 4;
const IDLE_ROW = 0;
const ATTACK_ROW = 2;
const FACING = { LEFT: -1, RIGHT: 1 };

/** How long an idle, unfought enemy waits before turning the other way (EA-4). */
const TURN_PAUSE_MS = Object.freeze({ min: 12000, max: 24000 });

export const AnimatedEnemySprite = ({
    src,
    heroId = null,
    walkFacing = null,
    alt,
    size = 64,
    frameMs = 125,
    className
}) => {
    const [facing, setFacing] = useState(FACING.LEFT);
    const turnTimer = useRef(null);

    // ⭐ The frame is written to the element, not kept in React state
    // (CR3-301, R6 rule 4): `background-position` is set directly on each
    // step, so an animating enemy costs no React commits. `frameRef` keeps
    // counting across a change of cycle, as the state it replaced did.
    const artRef = useRef(null);
    const frameRef = useRef(0);
    const paintRef = useRef(null);
    paintRef.current = () => {
        const el = artRef.current;
        if (!el) return;
        const frame = frameRef.current;
        const row = (heroId ? ATTACK_ROW : IDLE_ROW) + Math.floor(frame / COLS);
        const col = frame % COLS;
        el.style.backgroundPosition = `-${col * size}px -${row * size}px`;
    };

    // The cycle (fought or not) and the cell size show at once.
    useLayoutEffect(() => { paintRef.current(); }, [heroId, size]);

    // Frame advance — a local clock, unrelated to the game's own tick,
    // exactly like AnimatedHeroSprite's. 8 frames either cycle.
    useEffect(() => {
        const id = setInterval(() => {
            frameRef.current = (frameRef.current + 1) % 8;
            paintRef.current();
        }, frameMs);
        return () => clearInterval(id);
    }, [frameMs]);

    // Facing: forced to the working hero's side while fought (EA-3); an
    // idle enemy's own occasional turn otherwise (EA-4). Switching between
    // the two always cancels whatever timer the other one was running.
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

    // B7.1 (TL-16): walking by its spawner, it faces the way it walks, and
    // keeps that facing when it stops. The sheets have no walk cycle, so the
    // idle cycle plays while it glides.
    useEffect(() => {
        if (heroId) return;
        if (walkFacing === FACING.LEFT || walkFacing === FACING.RIGHT) setFacing(walkFacing);
    }, [walkFacing, heroId]);

    return (
        <div
            className={cn('pointer-events-none select-none', className)}
            style={{ width: size, height: size }}
            title={alt}
        >
            {/* A separate element from the one `className` lands on: MatToken's
                own landing-bounce animation (`gi-token-land`) sets `transform`
                too, and a CSS animation on the same element would override this
                inline flip for its 380ms, every time a fought or freshly-turned
                enemy is re-placed. */}
            {/* `background-position` (the frame) is written by `paintRef`, not here. */}
            <div
                ref={artRef}
                className="w-full h-full"
                style={{
                    backgroundImage: `url(${src})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: `${size * COLS}px ${size * COLS}px`,
                    imageRendering: 'pixelated',
                    filter: RESTING_SHADOW,
                    transform: facing === FACING.RIGHT ? 'scaleX(-1)' : 'none'
                }}
                role="img"
                aria-label={alt}
            />
        </div>
    );
};

export default AnimatedEnemySprite;
