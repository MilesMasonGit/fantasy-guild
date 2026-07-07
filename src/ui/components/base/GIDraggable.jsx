import React from 'react';
import { useDraggable } from '@dnd-kit/core';

/**
 * GIDraggable: A generic wrapper component that makes any child element draggable.
 * It passes the required dnd-kit attributes and node references downwards.
 */
export const GIDraggable = ({
    id,
    data,
    children,
    className,
    disabled = false,
    dragOverlayMode = true // If true, the original stays where it is while dragged (ideal for DragOverlay)
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        data,
        disabled,
    });

    const style = {
        opacity: isDragging && dragOverlayMode ? 0.4 : 1, // Dim the original if a drag overlay is active
        transform: !dragOverlayMode && transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`cursor-grab active:cursor-grabbing ${className || ''}`}
        >
            {children}
        </div>
    );
};

export default GIDraggable;
