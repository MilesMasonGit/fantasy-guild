import React, { useEffect, useRef } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { TILE_PX } from './boardConstants.js';

/**
 * TileProgressRing — the cycle progress ring, one of the three things a tile is
 * ever allowed to show (D-85).
 *
 * ## Why this writes to the DOM directly
 * Progress is high-frequency and worthless as React state. With up to 48 live
 * tiles publishing several times a second, routing it through `useState` would
 * re-render the whole board continuously — the exact cascade the deck loop's
 * ref-based progress bar existed to avoid (roadmap Appendix B, pattern 6). The
 * lesson survives the rework even though the component it was learned on does not.
 *
 * So: **one subscription per tile, one `setAttribute` per update, zero React
 * renders.** The ring is invisible until the first progress event arrives, so a
 * tile that is idle, unstaffed or stuck shows nothing — which is what keeps the
 * board quiet by default.
 *
 * In combat the same ring tracks the **current fight** (D-129, Phase 6), because
 * one kill is one cycle for every board system outside the combat engine.
 */

const SIZE = TILE_PX;
const STROKE = 3;
const R = (SIZE - STROKE * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export const TileProgressRing = ({ tile }) => {
    const circleRef = useRef(null);
    const { EventBus } = useEngine();

    useEffect(() => {
        if (!EventBus) return;

        const apply = (percent) => {
            const el = circleRef.current;
            if (!el) return;
            const clamped = Math.max(0, Math.min(100, percent));
            el.style.opacity = clamped > 0 ? '1' : '0';
            el.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - clamped / 100)));
        };

        const unsubs = [
            EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => {
                if (p?.tile !== tile) return;      // payload-filtered, like the old area events
                apply(p.percent);
            }),
            // A completed or interrupted cycle resets to empty; without this the
            // ring would sit at 99% on a Token that has stopped.
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
                if (p?.tile === tile) apply(0);
            }),
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
                if (p?.tile === tile) apply(0);
            })
        ];
        return () => unsubs.forEach(u => u());
    }, [EventBus, tile]);

    return (
        <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="absolute inset-0 pointer-events-none -rotate-90"
        >
            <circle
                ref={circleRef}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke="currentColor"
                className="text-gi-primary"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE}
                style={{ opacity: 0, transition: 'stroke-dashoffset 120ms linear' }}
            />
        </svg>
    );
};

export default TileProgressRing;
