import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import { cn } from '../../utils/cn.js';
import Toast from './Toast.jsx';

/**
 * ToastContainer — the notifications column (D-237).
 *
 * ## It used to float, and now it is a column
 * This was a `position: fixed` overlay portalled to `<body>` at `z-[9999]`,
 * parked in whichever corner `notifications.position` named. It occupied **zero
 * layout space** and floated over the board.
 *
 * The play area is now four columns — **nav · notifications · playmat · tray**
 * (owner decision 2026-08-11) — so notifications have a place of their own and
 * no longer sit on top of the game.
 *
 * ⚠️ **`notifications.position` no longer does anything in column mode.** Its
 * six corner options describe a floating overlay that no longer exists. The
 * setting is deliberately left in place rather than ripped out — the Settings
 * screen still offers it, and quietly deleting a control the player has used
 * would be worse than one that currently has no effect. **It needs either
 * removing from Settings or repurposing**; flagged rather than decided.
 *
 * `floating` keeps the old behaviour available for anything that still wants a
 * corner overlay, and is what the component does when it is not given a column.
 */
const ToastContainer = ({ floating = false }) => {
    const [toasts, setToasts] = useState([]);
    const [collapsed, setCollapsed] = useState(false);
    // Fallback mirrors SettingsManager's `notifications.position` default —
    // keep the two in step, or a missing setting lands somewhere the Settings
    // screen never claimed.
    const [position, setPosition] = useState(SettingsManager.get('notifications.position') || 'top_right');

    useEffect(() => {
        /**
         * Mirror the engine's queue rather than keeping our own add/remove
         * bookkeeping (CR-050). The old approach drifted — any dismissal the
         * engine performed without publishing (e.g. a toast trimmed from the
         * queue whose id no longer resolved) stranded a toast in the DOM
         * forever, so a long session accumulated far more visible toasts than
         * the engine's cap allowed. The queue is the single source of truth;
         * re-snapshotting on every change makes drift structurally impossible.
         */
        const sync = () => setToasts(NotificationSystem.getQueue());

        const handleSettings = (settings) => {
            if (settings.notifications?.position) {
                setPosition(settings.notifications.position);
            }
            sync();
        };

        sync();

        EventBus.subscribe('notification_added', sync);
        EventBus.subscribe('notification_updated', sync);
        EventBus.subscribe('notification_dismissed', sync);
        EventBus.subscribe('settings_updated', handleSettings);

        return () => {
            EventBus.unsubscribe('notification_added', sync);
            EventBus.unsubscribe('notification_updated', sync);
            EventBus.unsubscribe('notification_dismissed', sync);
            EventBus.unsubscribe('settings_updated', handleSettings);
        };
    }, []);

    const getPositionClasses = (pos) => {
        switch (pos) {
            case 'top_left': return 'top-6 left-6 items-start flex-col';
            case 'top_right': return 'top-6 right-6 items-end flex-col';
            case 'bottom_left': return 'bottom-2 left-6 items-start flex-col-reverse';
            case 'bottom_right': return 'bottom-2 right-6 items-end flex-col-reverse';
            case 'center_top': return 'top-6 left-1/2 -translate-x-1/2 items-center flex-col';
            case 'center_bottom': return 'bottom-2 left-1/2 -translate-x-1/2 items-center flex-col-reverse';
            default: return 'bottom-2 left-1/2 -translate-x-1/2 items-center flex-col-reverse';
        }
    };

    const handleClose = useCallback((id) => {
        // Delegate to the vanilla system, which will fire the 'dismissed' event
        NotificationSystem.dismiss(id);
    }, []);

    // While collapsed, crisis alerts (invasions etc.) still punch through.
    const visibleToasts = collapsed ? toasts.filter(t => t.type === 'crisis') : toasts;
    const hiddenCount = toasts.length - visibleToasts.length;

    const controlClass = "pointer-events-auto gi-text-outline uppercase text-[10px] font-bold text-gi-text/30 hover:text-white transition-all tracking-widest cursor-pointer px-3 py-0.5 bg-black/20 hover:bg-black/40 rounded-full border border-white/5 active:scale-95";

    const body = (
        <div
            className={cn(
                'pointer-events-none flex gap-1',
                floating
                    // Portal to <body>: ancestor transforms/filters would
                    // otherwise hijack the fixed positioning, and parent
                    // stacking contexts would paint drawers and overlays on top.
                    ? cn('fixed z-[9999] w-full', getPositionClasses(position))
                    // In column mode none of that applies — it is an ordinary
                    // element in its own column, so it needs no portal, no fixed
                    // positioning and no z-index arms race. Newest at the top,
                    // and it scrolls rather than growing past the column.
                    : 'h-full w-full flex-col items-stretch overflow-y-auto custom-scrollbar p-2 gap-1.5'
            )}
        >
            {toasts.length > 1 && (
                <div className="flex justify-end mb-0.5">
                    <button onClick={() => NotificationSystem.dismissAll()} className={controlClass}>
                        Clear All
                    </button>
                </div>
            )}
            {/* NOTE (CR-050): exited toasts are not always removed from the
                DOM here — they linger at opacity 0. Verified NOT caused by
                `mode="popLayout"` or the child `layout` prop (both tested in
                isolation and together). Suspected framer-motion/React 19
                AnimatePresence issue; see the ticket before changing this. */}
            <AnimatePresence mode="popLayout">
                {visibleToasts.map(toast => (
                    <Toast
                        key={toast.id}
                        id={toast.id}
                        message={toast.message}
                        type={toast.type}
                        count={toast.count}
                        added={toast.added}
                        removed={toast.removed}
                        rate={toast.rate}
                        isLoss={toast.isLoss}
                        aggregationKey={toast.aggregationKey}
                        meta={toast.meta}
                        onClose={handleClose}
                    />
                ))}
            </AnimatePresence>
        </div>
    );

    return floating ? createPortal(body, document.body) : body;
};

export default ToastContainer;
