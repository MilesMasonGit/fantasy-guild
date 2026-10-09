import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import * as DiscardBin from '../../../systems/board/DiscardBin.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { useActiveDrag, useLiveDropTarget } from '../../dnd/DndKit.jsx';
import ToastContainer from '../base/ToastContainer.jsx';
import DiscardBinPanel, { binAccepts, dropIntoBin, useBinRefresh } from './DiscardBinPanel.jsx';
import { SIDE_COLUMN_PX, NOTIFICATION_COLUMN, NOTIFICATION_STRIP_PX, columnWidthCss } from './boardConstants.js';

/**
 * The Notifications and Bin sidebars. On the playmat each is a slim tab on the screen edge that
 * pops out over the mat while the pointer is on it, and closes when the pointer leaves; the mat
 * itself keeps the width the old column took.
 * ⚠️ Both panels stay mounted whether open or closed. Closing only fades them, because the
 * Toast list holds state and the bin's slots are drag sources that must not vanish under a drag
 * in progress. The bin's drop target is switched off while it is closed, since dnd-kit ignores
 * opacity and pointer-events and a hidden target would otherwise still catch drops.
 */

/** How far from a sidebar's tab, towards the mat, a carried Token must come to open the bin. */
export const SIDEBAR_APPROACH_PX = 64;

const inside = (p, r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

/**
 * Whether a dragged pointer is at a sidebar. While it is shut: within `margin` of its tab on
 * the mat's side, anywhere along the height the open panel would cover. Once open: anywhere on
 * the tab or the panel. Rects are `{left, right, top, bottom}`; `towardMat` is the side of the
 * tab the mat is on.
 */
export function pointerAtSidebar(point, { strip, panel, towardMat, open, margin = SIDEBAR_APPROACH_PX }) {
    if (!point || !strip) return false;
    const top = Math.min(strip.top, panel?.top ?? strip.top);
    const bottom = Math.max(strip.bottom, panel?.bottom ?? strip.bottom);
    if (open && panel) {
        return inside(point, {
            left: Math.min(strip.left, panel.left), right: Math.max(strip.right, panel.right), top, bottom
        });
    }
    return inside(point, {
        left: towardMat === 'left' ? strip.left - margin : strip.left,
        right: towardMat === 'left' ? strip.right : strip.right + margin,
        top, bottom
    });
}

/**
 * Open state for one sidebar. Without a drag it follows the pointer over the tab or panel; during
 * a drag that `watches` it follows where the dragged pointer is instead (enter and leave are not
 * reported while a drag has the pointer).
 */
function usePopOut({ towardMat, watches = null }) {
    const wrapRef = useRef(null);
    const stripRef = useRef(null);
    const panelRef = useRef(null);
    const [hovered, setHovered] = useState(false);
    const hoveredRef = useRef(false);
    const [near, setNear] = useState(false);
    const nearRef = useRef(false);
    const { activePayload } = useActiveDrag();
    const dragging = !!activePayload;
    const followsDrag = dragging && !!watches?.(activePayload);

    useEffect(() => { hoveredRef.current = hovered; }, [hovered]);

    // Listens to the window itself rather than `DragPointerContext`, which rides on animation
    // frames and so stalls whenever frames do; only a change of answer re-renders.
    useEffect(() => {
        const set = (next) => {
            if (next === nearRef.current) return;
            nearRef.current = next;
            setNear(next);
        };
        if (!followsDrag) { set(false); return undefined; }
        // A drag that starts on the open panel (a binned Token) finds it already open.
        set(hoveredRef.current);
        const onMove = (e) => set(pointerAtSidebar({ x: e.clientX, y: e.clientY }, {
            strip: stripRef.current?.getBoundingClientRect(),
            panel: panelRef.current?.getBoundingClientRect(),
            towardMat,
            open: nearRef.current
        }));
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => window.removeEventListener('pointermove', onMove);
    }, [followsDrag, towardMat]);

    // Once the drag lets go, ask the page again where the pointer is.
    useEffect(() => {
        if (activePayload) return;
        setHovered(!!wrapRef.current?.matches?.(':hover'));
    }, [activePayload]);

    const open = followsDrag ? near : (!dragging && hovered);
    return {
        open, wrapRef, stripRef, panelRef,
        /** Whether a watched drag has it open, as of the latest pointer move (before React redraws). */
        openNow: () => followsDrag && nearRef.current,
        hoverProps: { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
    };
}

/** The panel's slot beside its tab: flush against it, on the mat's side. */
const panelPlace = (towardMat) => ({
    [towardMat === 'left' ? 'right' : 'left']: '100%',
    width: columnWidthCss(NOTIFICATION_COLUMN)
});

const PANEL_CLS = 'absolute z-20 flex flex-col rounded-lg border border-gi-border/40 bg-gi-surface/95 shadow-[0_0_24px_rgba(0,0,0,0.6)] transition-opacity duration-150';

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

export const NotificationsSidebar = ({ towardMat }) => {
    const [listHidden, setListHidden] = useState(false);
    const toastsDrawn = useDrawn('notifications');
    const count = useToastCount();
    const pop = usePopOut({ towardMat });
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
                {!listHidden && toastsDrawn && (
                    <div className="min-h-0 overflow-y-auto gi-scrollbar">
                        <ToastContainer />
                    </div>
                )}
            </section>
        </div>
    );
};

/** What the bin sidebar opens for: a Token carried off the mat, or one carried out of the bin. */
const watchesBin = (payload) => binAccepts(payload) || payload?.from?.binnedId != null;

// The bin panel redraws only for its own reasons, not for the sidebar's per-frame drag checks.
const BinPanel = React.memo(DiscardBinPanel);

export const BinSidebar = ({ towardMat }) => {
    const binDrawn = useDrawn('bin');
    useBinRefresh();
    const pop = usePopOut({ towardMat, watches: watchesBin });
    const { activePayload } = useActiveDrag();
    // Only a Token headed for the bin is dropped on it. A binned Token dragged back out must
    // find the mat under the panel, so the target stays off while it is in the hand.
    const dropsOpen = pop.open && !!activePayload && binAccepts(activePayload);
    // A release on the open bin bins the Token even before dnd-kit has caught up with the bin
    // opening (`useLiveDropTarget`). The same rule: only a Token headed for the bin.
    const binEl = () => pop.panelRef.current?.querySelector('[data-discard-bin]') || null;
    useLiveDropTarget({
        accepts: binAccepts,
        contains: (p) => {
            const el = pop.openNow() ? binEl() : null;
            return !!el && inside(p, el.getBoundingClientRect());
        },
        onDrop: (payload) => dropIntoBin(payload),
        node: binEl
    });
    return (
        <div
            ref={pop.wrapRef}
            data-sidebar="bin"
            data-open={pop.open}
            className="relative shrink-0 h-28"
            {...pop.hoverProps}
        >
            <Tab label="Bin" count={`${DiscardBin.binContents().length}/${DiscardBin.BIN_SIZE}`} stripRef={pop.stripRef} open={pop.open} data-sidebar-tab />
            <div
                ref={pop.panelRef}
                inert={!pop.open}
                style={{ ...panelPlace(towardMat), bottom: 0 }}
                className={cn(PANEL_CLS, 'p-1', pop.open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
            >
                {binDrawn && <BinPanel dropDisabled={!dropsOpen} />}
            </div>
        </div>
    );
};

/** The notification side's strip on the playmat: the Notifications and Bin tabs. */
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
                <BinSidebar towardMat={towardMat} />
            </div>
        </aside>
    );
};

export default NotificationSidebars;
