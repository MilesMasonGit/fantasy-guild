import React, { useEffect, useState, useCallback } from 'react';
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
    const [position, setPosition] = useState(SettingsManager.get('notifications.position') || 'top_right');

    useEffect(() => {
        // Initial load of any queued toasts
        setToasts(NotificationSystem.getQueue());

        const handleSettings = (settings) => {
            if (settings.notifications?.position) {
                setPosition(settings.notifications.position);
            }
        };

        const handleAdded = (notification) => {
            setToasts(prev => [...prev, notification]);
        };

        const handleUpdated = ({ id, count, message, rate, added, removed }) => {
            setToasts(prev => prev.map(t =>
                t.id === id ? { 
                    ...t, 
                    count: count ?? t.count, 
                    added: added ?? t.added,
                    removed: removed ?? t.removed,
                    message: message || t.message,
                    rate: rate ?? t.rate 
                } : t
            ));
        };

        const handleDismissed = ({ id }) => {
            setToasts(prev => prev.filter(t => t.id !== id));
        };

        // Subscribe to engine events
        EventBus.subscribe('notification_added', handleAdded);
        EventBus.subscribe('notification_updated', handleUpdated);
        EventBus.subscribe('notification_dismissed', handleDismissed);
        EventBus.subscribe('settings_updated', handleSettings);

        return () => {
            EventBus.unsubscribe('notification_added', handleAdded);
            EventBus.unsubscribe('notification_updated', handleUpdated);
            EventBus.unsubscribe('notification_dismissed', handleDismissed);
            EventBus.unsubscribe('settings_updated', handleSettings);
        };
    }, []);

    const getPositionClasses = (pos) => {
        switch (pos) {
            case 'top_left': return 'top-6 left-6 items-start flex-col';
            case 'top_right': return 'top-6 right-6 items-end flex-col';
            case 'bottom_left': return 'bottom-6 left-6 items-start flex-col-reverse';
            case 'bottom_right': return 'bottom-6 right-6 items-end flex-col-reverse';
            case 'center_top': return 'top-6 left-1/2 -translate-x-1/2 items-center flex-col';
            case 'center_bottom': return 'bottom-6 left-1/2 -translate-x-1/2 items-center flex-col-reverse';
            default: return 'top-6 right-6 items-end flex-col';
        }
    };

    const handleClose = useCallback((id) => {
        // Delegate to the vanilla system, which will fire the 'dismissed' event
        NotificationSystem.dismiss(id);
    }, []);

    return (
        <div className={cn("absolute z-[9999] pointer-events-none flex gap-2 w-full", getPositionClasses(position))}>
            {toasts.length > 1 && (
                <button
                    onClick={() => NotificationSystem.dismissAll()}
                    className="pointer-events-auto gi-text-outline uppercase text-[10px] font-bold text-gi-text/30 hover:text-white transition-all tracking-widest cursor-pointer px-3 py-1 bg-black/20 hover:bg-black/40 rounded-full border border-white/5 active:scale-95 mb-1"
                >
                    Clear All
                </button>
            )}
            <AnimatePresence mode="popLayout">
                {toasts.map(toast => (
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
                        onClose={handleClose}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ToastContainer;
