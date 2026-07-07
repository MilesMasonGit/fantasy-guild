import { useState, useEffect, useRef } from 'react';
import { EventBus } from '../../systems/core/EventBus.js';

/**
 * useDndTarget
 * Determines if the current component is a valid target for the active drag operation.
 * PERFORMANCE: This hook is optimized to only trigger re-renders on drag START and END
 * by using the system EventBus instead of subscribing to the high-frequency dnd-kit context.
 * 
 * @param {Object} options
 * @param {string[]} options.accepts - List of entity types this target accepts
 * @param {Function} options.validate - Optional custom validation function (entityData => boolean)
 * @returns {Object} { activeType, activeId, isValid, isDragging }
 */
export function useDndTarget({ accepts = [], validate = null }) {
    const [dragState, setDragState] = useState({
        activeType: null,
        activeId: null,
        isValid: false,
        isDragging: false
    });

    const acceptsKey = JSON.stringify(accepts);

    // Store validate in a ref to prevent inline arrow functions from
    // destabilizing the useEffect dependency array and causing infinite loops.
    const validateRef = useRef(validate);
    useEffect(() => { validateRef.current = validate; });

    useEffect(() => {
        const handleDragStart = (activeData) => {
            const activeType = activeData.type;
            const activeId = activeData.id;
            let isValid = false;

            if (activeType === 'card' || activeData.cardType === 'blueprint') {
                isValid = accepts.includes('card') || accepts.includes('blueprint');
            } else if (accepts.includes(activeType)) {
                isValid = true;
            }

            if (isValid && validateRef.current) {
                isValid = validateRef.current(activeData);
            }

            setDragState({
                activeType,
                activeId,
                isValid,
                isDragging: true
            });
        };

        const handleDragEnd = () => {
            setDragState({
                activeType: null,
                activeId: null,
                isValid: false,
                isDragging: false
            });
        };

        // Initialize state if a drag is already in progress (Fallback)
        // Guard: Check dragState locally to prevent infinite loops if dependencies change
        if (document.body.classList.contains('is-dragging')) {
            const type = document.body.getAttribute('data-dragging-type');
            const id = document.body.getAttribute('data-dragging-id');
            
            // Only update if we aren't already reflecting this drag
            setDragState(prev => {
                if (prev.isDragging && prev.activeId === id) return prev;
                
                // If not, calculate validity once and sync
                let isValid = false;
                if (type === 'card' || type === 'blueprint') {
                    isValid = accepts.includes('card') || accepts.includes('blueprint');
                } else if (accepts.includes(type)) {
                    isValid = true;
                }

                return {
                    activeType: type,
                    activeId: id,
                    isValid,
                    isDragging: true
                };
            });
        }

        const unsubStart = EventBus.subscribe('dnd:drag-start', handleDragStart);
        const unsubEnd = EventBus.subscribe('dnd:drag-end', handleDragEnd);

        return () => {
            unsubStart();
            unsubEnd();
        };
    }, [acceptsKey]); // validate removed — stored in ref to prevent infinite loops

    return dragState;
}
