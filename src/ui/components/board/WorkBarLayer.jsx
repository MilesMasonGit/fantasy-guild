import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MAT_Z } from './matLayers.js';
import { useMatFit } from './MatFitContext.jsx';
import { useTokenState } from './tokenEvents.js';
import { watchWorkBar } from './workBar.js';
import { BAR, barPlace, cycleText, plateUnit, workBarOf } from './matMarks.js';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { useMatSize } from '../../hooks/useMatSize.js';

/** The slot the strip is centred in, in mat units: wider than any strip, so it never wraps. */
const SLOT_W = 200;

/**
 * The bar itself, at `art` mat units an art pixel: the track (`.gi-work-bar`) in its black
 * outline with a hard shadow, its fill painted by the Token's own work bar model (`TokenBubbles`
 * keeps it and feeds it the engine's events) on the shared step clock. Grey while `blocked`.
 */
export const WorkBarTrack = memo(function WorkBarTrack({ instanceId, blocked = false, art = 2 }) {
    const elRef = useRef(null);
    useLayoutEffect(() => {
        let held = null;
        const stop = watchWorkBar(instanceId, (bar) => {
            held?.attach(null);
            held = bar;
            bar?.attach(elRef.current, BAR.W);
        });
        return () => {
            stop();
            held?.attach(null);
        };
    }, [instanceId]);
    return (
        <div
            data-work-bar-outline
            className="relative shrink-0"
            style={{ padding: BAR.OUTLINE * art, background: '#000', boxShadow: `${art}px ${art}px 0 #000` }}
        >
            <div
                ref={elRef}
                data-work-bar={instanceId}
                data-work-bar-blocked={blocked ? 'true' : undefined}
                aria-hidden="true"
                className="gi-work-bar relative"
                style={{ width: BAR.W * art, height: BAR.H * art }}
            />
        </div>
    );
});

/** The cycle's length the Token's bar model knows: set when the engine says one, never per tick. */
function useCycleLength(instanceId) {
    const [ms, setMs] = useState(null);
    useEffect(() => {
        let stopLength = null;
        const stop = watchWorkBar(instanceId, (bar) => {
            stopLength?.();
            stopLength = bar ? bar.watchLength(setMs) : null;
        });
        return () => {
            stop();
            stopLength?.();
        };
    }, [instanceId]);
    return ms;
}

const BAR_ROUTES = Object.freeze([
    BOARD_EVENTS.ALERT_CHANGED,             // blocked, or going again
    BOARD_EVENTS.HERO_MOVED                 // the hero arrived, or came round the other side
]);

/**
 * One worked Token's strip: the bar and, beside it, the time one cycle takes ("3.0s"), on the
 * see-through dark strip the names wear. Read only on the events about that Token. Takes no
 * pointer: nothing on it is a button, and it has no tooltip (the Token's card says the rest).
 */
const WorkBar = memo(function WorkBar({ tokenId, heroId, x, y, typeId, fit, matH }) {
    const bar = useTokenState(tokenId, () => workBarOf(tokenId), () => ({
        byId: BAR_ROUTES,
        byKey: [{ event: BOARD_EVENTS.HERO_MOVED, field: 'heroId', key: heroId }],
        broadcast: [ENGINE_EVENTS.GAME_RESET]
    }));
    const ms = useCycleLength(tokenId);
    if (!bar || x == null) return null;
    const art = boardScaleAt(fit);
    const u = plateUnit(fit);
    const place = barPlace({ x, y, typeId: bar.typeId || typeId, side: bar.side, fit, matH, width: SLOT_W });
    const time = cycleText(ms);
    return (
        <div
            data-work-bar-slot={tokenId}
            className="absolute flex justify-center pointer-events-none"
            style={{ left: place.left, top: place.top, width: place.width }}
        >
            <div
                data-work-strip={tokenId}
                className="flex items-center"
                style={{
                    gap: BAR.GAP * art,
                    padding: `${BAR.PAD_Y * art}px ${BAR.PAD_X * art}px`,
                    background: 'var(--color-mat-backing)'
                }}
            >
                <WorkBarTrack instanceId={tokenId} blocked={bar.blocked} art={art} />
                {time && (
                    <span
                        data-work-cycle={tokenId}
                        className="font-bold tabular-nums leading-none text-white whitespace-nowrap"
                        // The kit's small size, counter-scaled so the pixel font lands on whole screen pixels.
                        style={{ fontSize: `calc(var(--font-size-xxs, 14px) * ${u})` }}
                    >
                        {time}
                    </span>
                )}
            </div>
        </div>
    );
});

/**
 * The work bars, one per hero at work (not in a fight), in one layer over the floor loot
 * (`MAT_Z.WORK_BAR`): in a Token's own box the loot lying at its feet covered it. `bars` are
 * `{ tokenId, heroId, typeId, x, y }`. The layer takes no pointer: a press goes to whatever is
 * under the bar.
 * A fight has none: its button stands between the two fighters' health bars (`FightLayer`).
 */
export const WorkBarLayer = memo(function WorkBarLayer({ bars }) {
    const fit = useMatFit() || 1;
    const mat = useMatSize();
    return (
        <div
            data-work-bars
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.WORK_BAR }}
        >
            {bars.map(b => (
                <WorkBar
                    key={b.tokenId}
                    tokenId={b.tokenId}
                    heroId={b.heroId}
                    typeId={b.typeId}
                    x={b.x}
                    y={b.y}
                    fit={fit}
                    matH={mat.h}
                />
            ))}
        </div>
    );
});
