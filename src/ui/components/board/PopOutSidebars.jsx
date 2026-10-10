import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import ToastContainer from '../base/ToastContainer.jsx';
import { SIDE_COLUMN_PX, NOTIFICATION_COLUMN, NOTIFICATION_STRIP_PX, columnWidthCss } from './boardConstants.js';

/**
 * The Notifications sidebar. On the playmat it is a slim tab on the screen edge that pops out over
 * the mat while the pointer is on it, and closes when the pointer leaves; the mat itself keeps the
 * width the old column took. It stays shut while anything is dragged.
 * The toast list is put away once its panel has faded out: each toast is a composited layer (its
 * backdrop blur) and measures its layout whenever it redraws, which an invisible panel would pay
 * for on every notification. The tab's count follows the queue on its own.
 */

/** Open state for one sidebar: it follows the pointer over the tab or panel, shut during a drag. */
function usePopOut() {
    const wrapRef = useRef(null);
    const stripRef = useRef(null);
    const panelRef = useRef(null);
    const [hovered, setHovered] = useState(false);
    const { activePayload } = useActiveDrag();
    const dragging = !!activePayload;

    // Once the drag lets go, ask the page again where the pointer is.
    useEffect(() => {
        if (activePayload) return;
        setHovered(!!wrapRef.current?.matches?.(':hover'));
    }, [activePayload]);

    return {
        open: !dragging && hovered, wrapRef, stripRef, panelRef,
        hoverProps: { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
    };
}

/** The panel's slot beside its tab: flush against it, on the mat's side. */
const panelPlace = (towardMat) => ({
    [towardMat === 'left' ? 'right' : 'left']: '100%',
    width: columnWidthCss(NOTIFICATION_COLUMN)
});

/** How long a panel takes to fade in or out (⚠️ the `duration-150` in `PANEL_CLS`). */
export const PANEL_FADE_MS = 150;

const PANEL_CLS ='absolute z-20 flex flex-col rounded-lg border border-gi-border/40 bg-gi-surface/95 shadow-[0_0_24px_rgba(0,0,0,0.6)] transition-opacity duration-150';

/** A tab: its label reads top to bottom, with an optional count above it. */
const Tab = ({ label, count, stripRef, open, className, ...rest }) => (
    <div
        ref={stripRef}
        className={cn(
            'w-full h-full flex flex-col items-center justify-start gap-1.5 py-2 rounded-md border bg-black/35 cursor-default select-none transition-colors',
            open ? 'border-gi-primary/60 bg-black/60' : 'border-gi-border/30 hover:border-gi-primary/40',
            className
        )}
        {...rest}
    >
        {count != null && (
            <span data-sidebar-count className="text-[11px] font-bold tabular-nums text-gi-text leading-none">{count}</span>
        )}
        <span
            className="text-[11px] font-bold gi-caps tracking-wider text-gi-muted"
            style={{ writingMode: 'vertical-rl' }}
        >
            {label}
        </span>
    </div>
);

/** How many notifications are waiting, kept in step with the engine's queue. */
function useToastCount() {
    const [count, setCount] = useState(() => NotificationSystem.getQueue().length);
    useEffect(() => {
        const sync = () => setCount(NotificationSystem.getQueue().length);
        const unsubs = [ENGINE_EVENTS.NOTIFICATION_ADDED, ENGINE_EVENTS.NOTIFICATION_UPDATED, ENGINE_EVENTS.NOTIFICATION_DISMISSED]
            .map(e => EventBus.subscribe(e, sync, UI_LISTENER));
        sync();
        return () => unsubs.forEach(u => u?.());
    }, []);
    return count;
}

// The toasts redraw only for their own reasons: the sidebar redraws at every drag start and end
// (it opens for some drags), and each toast re-measures its layout for its slide when it redraws.
const ToastColumn = React.memo(ToastContainer);

/** Whether the toast list is drawn: from the moment the panel opens until it has faded out. */
function useListLive(open) {
    const [live, setLive] = useState(open);
    useEffect(() => {
        if (open) { setLive(true); return undefined; }
        const t = setTimeout(() => setLive(false), PANEL_FADE_MS);
        return () => clearTimeout(t);
    }, [open]);
    return open || live;
}

export const NotificationsSidebar = ({ towardMat }) => {
    const [listHidden, setListHidden] = useState(false);
    // Kept here, not in the list, because the list is put away while the panel is shut.
    const [collapsed, setCollapsed] = useState(false);
    const toastsDrawn = useDrawn('notifications');
    const count = useToastCount();
    const pop = usePopOut();
    const listLive = useListLive(pop.open);
    return (
        <div
            ref={pop.wrapRef}
            data-sidebar="notifications"
            data-open={pop.open}
            className="relative flex-1 min-h-0"
            {...pop.hoverProps}
        >
            <Tab label="Notifications" count={count || null} stripRef={pop.stripRef} open={pop.open} data-sidebar-tab />
            <section
                ref={pop.panelRef}
                inert={!pop.open}
                style={{ ...panelPlace(towardMat), top: 0, maxHeight: '100%' }}
                className={cn(PANEL_CLS, pop.open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
            >
                <button
                    type="button"
                    onClick={() => setListHidden(h => !h)}
                    className="w-full shrink-0 text-center py-2 text-sm md:text-base font-bold text-gi-text hover:text-gi-primary border-b border-gi-border/30 transition-colors cursor-pointer select-none"
                >
                    {listHidden ? 'Show Notifications' : 'Notifications'}
                </button>
                {!listHidden && toastsDrawn && listLive && (
                    <div className="min-h-0 overflow-y-auto gi-scrollbar">
                        <ToastColumn collapsed={collapsed} onCollapsedChange={setCollapsed} />
                    </div>
                )}
            </section>
        </div>
    );
};

/** The notification side's strip on the playmat: the Notifications tab. */
export const NotificationSidebars = ({ menuRight = false }) => {
    // The column sits beside the nav, so with the nav on the right it is on the left edge.
    const towardMat = menuRight ? 'right' : 'left';
    return (
        <aside
            style={{ width: NOTIFICATION_STRIP_PX }}
            className="shrink-0 h-full flex flex-col items-center justify-center py-8 bg-transparent pointer-events-auto relative z-20 select-none"
        >
            <div
                className="w-full relative shrink-0 flex flex-col gap-2"
                style={{ height: SIDE_COLUMN_PX, maxHeight: '100%' }}
            >
                <NotificationsSidebar towardMat={towardMat} />
            </div>
        </aside>
    );
};

export default NotificationSidebars;
