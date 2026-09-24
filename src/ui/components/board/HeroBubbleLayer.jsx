import { useEffect, useRef, useState } from 'react';
import { FLAG_PX } from './flagGeometry.js';
import { MAT_Z } from './matLayers.js';
import { blockedLineFor, readyToSpeak } from './heroBubbles.js';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';

/** How often a blocked hero's line is re-read, and a waiting one checked. */
const REFRESH_MS = 500;

/**
 * ⭐ **Speech bubbles, above every hero's head.**
 *
 * One layer over the whole mat, so a bubble is never hidden by a Token, a flag
 * or another hero. Each bubble is placed from the same point `MatHero` uses and
 * glides with it for one tick while the hero walks, so it stays over the head.
 * Bubbles are not clickable: the pointer passes straight through to whatever is
 * beneath, so dragging a hero or their flag is never blocked.
 *
 * A blocked hero (`hero.alert`, the alert on the Token they hold) says what is
 * wrong for as long as it is wrong. The line is re-read twice a second, so it
 * names what is missing *now*; a shortage of items waits `INPUTS_DELAY_MS`
 * first (SB-6).
 */
export const HeroBubbleLayer = ({ heroes }) => {
    const [now, setNow] = useState(() => Date.now());
    const sinceRef = useRef(new Map());
    const anyBlocked = heroes.some(h => h.alert && h.tokenId);

    useEffect(() => {
        if (!anyBlocked) return undefined;
        const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
        return () => clearInterval(timer);
    }, [anyBlocked]);

    // When each block was first seen; a block that has cleared is forgotten so
    // it waits its delay afresh if it returns.
    const since = sinceRef.current;
    const live = new Set();
    for (const h of heroes) {
        if (!(h.alert && h.tokenId)) continue;
        const key = `${h.heroId}:${h.tokenId}:${h.alert}`;
        live.add(key);
        if (!since.has(key)) since.set(key, Date.now());
    }
    for (const key of [...since.keys()]) if (!live.has(key)) since.delete(key);

    return (
        <div
            data-hero-bubbles
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.HERO_BUBBLE }}
        >
            {heroes.map(h => {
                if (!(h.alert && h.tokenId)) return null;
                const key = `${h.heroId}:${h.tokenId}:${h.alert}`;
                if (!readyToSpeak(h.alert, since.get(key) ?? now, Math.max(now, Date.now()))) return null;
                const text = blockedLineFor(h.tokenId, h.alert);
                if (!text) return null;
                return (
                    <div
                        key={h.heroId}
                        data-hero-bubble-stack={h.heroId}
                        className="absolute flex flex-col items-center justify-end gap-1 pointer-events-none"
                        style={{
                            left: h.x,
                            // The bottom of the stack sits on the top of the hero's box
                            // (`heroPlacement`'s top, without importing it back from MatBoard).
                            top: h.y - FLAG_PX / 2 + FLAG_PX * 0.2,
                            transform: 'translate(-50%, -100%)',
                            transition: h.moving
                                ? `left ${TICK_INTERVAL_MS}ms linear, top ${TICK_INTERVAL_MS}ms linear`
                                : 'none'
                        }}
                    >
                        <div
                            data-hero-bubble={h.alert}
                            className="relative whitespace-nowrap px-2 py-1 rounded-md border border-yellow-500/70 bg-yellow-950/95 text-yellow-100 text-[11px] font-bold shadow-lg"
                        >
                            {text}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-yellow-500/70 bg-yellow-950/95" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default HeroBubbleLayer;
