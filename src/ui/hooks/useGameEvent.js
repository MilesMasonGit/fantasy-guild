import { useEffect } from 'react';
import { useEngine } from './useEngine';

/**
 * Hook to listen for transient game events (e.g., hero_hired, task_completed).
 * This is meant for triggering side-effects like animations or sounds, NOT for state updates.
 * 
 * @param {string} eventName - The name of the event to listen to
 * @param {Function} callback - The function to execute when the event fires
 */
export const useGameEvent = (eventName, callback) => {
    const { EventBus } = useEngine();

    useEffect(() => {
        const cleanup = EventBus.subscribe(eventName, callback);
        return () => {
            cleanup();
        };
    }, [EventBus, eventName, callback]);
};
