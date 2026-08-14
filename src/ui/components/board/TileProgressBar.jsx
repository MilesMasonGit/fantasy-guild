import React, { useEffect, useRef } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { cn } from '../../utils/cn.js';

/**
 * TileProgressBar — zero-re-render cycle progress bar at the bottom of a tile frame.
 *
 * Adopts the classic progress bar styling (glossy fill, shadow, rounded track)
 * with the cycle time overlaid directly on the bar. Bypasses React state updates
 * so dozens of live tiles ticking multiple times a second don't trigger component re-renders.
 */
export const TileProgressBar = ({ tile, className }) => {
    const containerRef = useRef(null);
    const fillRef = useRef(null);
    const labelRef = useRef(null);
    const { EventBus } = useEngine();

    useEffect(() => {
        if (!EventBus) return;

        const apply = (p) => {
            const container = containerRef.current;
            const fill = fillRef.current;
            const label = labelRef.current;
            if (!container || !fill) return;

            const percent = Math.max(0, Math.min(100, p?.percent || 0));
            container.style.opacity = percent > 0 ? '1' : '0';
            fill.style.width = `${percent}%`;

            if (label) {
                if (p?.combat) {
                    label.textContent = `${p.enemyHp ?? ''}/${p.enemyMaxHp ?? ''} HP`;
                } else if (p?.cycleTimeMs) {
                    const sec = p.cycleTimeMs / 1000;
                    label.textContent = Number.isInteger(sec) ? `${sec}s` : `${sec.toFixed(1)}s`;
                } else {
                    label.textContent = '';
                }
            }
        };

        const reset = () => {
            if (containerRef.current) containerRef.current.style.opacity = '0';
            if (fillRef.current) fillRef.current.style.width = '0%';
            if (labelRef.current) labelRef.current.textContent = '';
        };

        const unsubs = [
            EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => {
                if (p?.tile !== tile) return;
                apply(p);
            }),
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
                if (p?.tile === tile) reset();
            }),
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
                if (p?.tile === tile) reset();
            })
        ];
        return () => unsubs.forEach(u => u());
    }, [EventBus, tile]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "absolute bottom-1 left-1.5 right-1.5 z-20 pointer-events-none",
                "h-3.5 transition-opacity duration-150",
                className
            )}
            style={{ opacity: 0 }}
        >
            <div className="progress-track progress-track--glass relative w-full h-full overflow-hidden rounded-full border border-white/10 bg-black/65 shadow-inner flex items-center justify-center">
                <div
                    ref={fillRef}
                    className="absolute left-0 top-0 bottom-0 progress-fill progress-fill--glossy bg-gi-primary rounded-full transition-[width] duration-100 ease-linear shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                    style={{ width: '0%' }}
                />
                <span
                    ref={labelRef}
                    className="relative z-10 text-[8px] font-bold font-mono text-white gi-text-outline tracking-wider select-none leading-none drop-shadow"
                />
            </div>
        </div>
    );
};

export default TileProgressBar;
