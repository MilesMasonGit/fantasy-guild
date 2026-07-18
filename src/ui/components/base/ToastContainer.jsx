import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import { cn } from '../../utils/cn.js';
import Toast from './Toast.jsx';

/**
 * ToastContainer
 * A global fixed-position portal that subscribes to the engine's EventBus
 * and manages the active array of Toasts.
 */
const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);
    const [collapsed, setCollapsed] = useState(false);
    const [position, setPosition] = useState(SettingsManager.get('notifications.position') || 'center_bottom');

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

    // Portal to <body>: ancestor transforms/filters would otherwise hijack the
    // fixed positioning, and parent stacking contexts would paint drawers and
    // overlays on top of the toasts.
    return createPortal(
        <div className={cn("fixed z-[9999] pointer-events-none flex gap-1 w-full", getPositionClasses(position))}>
            {toasts.length > 0 && (
                <div className="flex gap-1.5 mb-0.5">
                    {toasts.length > 1 && !collapsed && (
                        <button onClick={() => NotificationSystem.dismissAll()} className={controlClass}>
                            Clear All
                        </button>
                    )}
                    <button onClick={() => setCollapsed(c => !c)} className={controlClass}>
                        {collapsed ? `Show (${hiddenCount})` : 'Hide'}
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
        </div>,
        document.body
    );
};

export default ToastContainer;
