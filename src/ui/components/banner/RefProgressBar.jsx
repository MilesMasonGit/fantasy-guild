import React, { useEffect, useRef } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { cn } from '../../utils/cn.js';

/**
 * RefProgressBar — the Phase 6 §D pattern. Progress animation bypasses
 * React entirely: the bar subscribes to the high-frequency `area:progress`
 * event and writes `style.width` straight to the DOM node. React only
 * mounts/unmounts it; no setState, no reconciliation, no re-render per tick.
 */
export const RefProgressBar = React.memo(({ areaId, className, color = 'var(--color-gi-primary)', height = 'h-3' }) => {
    const barRef = useRef(null);

    useEffect(() => {
        const unsub = EventBus.subscribe(AREA_EVENTS.PROGRESS, (data) => {
            if (data?.areaId !== areaId) return;
            if (barRef.current) barRef.current.style.width = `${data.percent}%`;
        });
        return unsub;
    }, [areaId]);

    // Reuses the old build's ProgressBar visual language (`progress-track` /
    // `progress-fill--glossy` + bloom) so it matches the existing card bars,
    // while keeping the ref-driven, zero-re-render update.
    return (
        <div className={cn('progress-track w-full relative overflow-hidden', height, className)}>
            <div
                ref={barRef}
                className="progress-fill progress-fill--glossy bloom-steady h-full relative overflow-hidden z-10"
                style={{ width: '0%', '--bar-color': color, background: color }}
            />
        </div>
    );
});

export default RefProgressBar;
