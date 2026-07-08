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
export const RefProgressBar = React.memo(({ areaId, className, barClassName }) => {
    const barRef = useRef(null);

    useEffect(() => {
        const unsub = EventBus.subscribe(AREA_EVENTS.PROGRESS, (data) => {
            if (data?.areaId !== areaId) return;
            if (barRef.current) barRef.current.style.width = `${data.percent}%`;
        });
        return unsub;
    }, [areaId]);

    return (
        <div className={cn('h-1.5 bg-black/50 rounded-full overflow-hidden border border-gi-border/30', className)}>
            <div
                ref={barRef}
                className={cn('h-full bg-gi-primary transition-none', barClassName)}
                style={{ width: '0%' }}
            />
        </div>
    );
});

export default RefProgressBar;
