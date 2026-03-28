import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import Toast from './Toast.jsx';

/**
 * ToastContainer
 * A global fixed-position portal that subscribes to the engine's EventBus
 * and manages the active array of Toasts.
 */
const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        // Initial load of any queued toasts
        setToasts(NotificationSystem.getQueue());

        const handleAdded = (notification) => {
            setToasts(prev => [...prev, notification]);
        };

        const handleUpdated = ({ id, count, message }) => {
            setToasts(prev => prev.map(t =>
                t.id === id ? { ...t, count, message: message || t.message } : t
            ));
        };

        const handleDismissed = ({ id }) => {
            setToasts(prev => prev.filter(t => t.id !== id));
        };

        // Subscribe to engine events
        EventBus.subscribe('notification_added', handleAdded);
        EventBus.subscribe('notification_updated', handleUpdated);
        EventBus.subscribe('notification_dismissed', handleDismissed);

        return () => {
            EventBus.unsubscribe('notification_added', handleAdded);
            EventBus.unsubscribe('notification_updated', handleUpdated);
            EventBus.unsubscribe('notification_dismissed', handleDismissed);
        };
    }, []);

    const handleClose = useCallback((id) => {
        // Delegate to the vanilla system, which will fire the 'dismissed' event
        NotificationSystem.dismiss(id);
    }, []);

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col gap-3 items-center">
            <AnimatePresence mode="popLayout">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        id={toast.id}
                        message={toast.message}
                        type={toast.type}
                        count={toast.count}
                        aggregationKey={toast.aggregationKey}
                        onClose={handleClose}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ToastContainer;
