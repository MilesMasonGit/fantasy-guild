import React from 'react';
import { useDraggable } from '@dnd-kit/core';

/**
 * EntityDraggable: Unified drag source for Heroes and Items.
 * Replaces GIDraggable with standardized behavior:
 * - 0.5 opacity ghosting when dragging
 * - Entire component is the drag handle
 * - Passes sourceCardId/sourceSlotIndex when dragged from an assigned slot (enables unassignment)
 */
export const EntityDraggable = ({
    id,
    data,
    children,
    className,
    disabled = false,
}) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id,
        data,
        disabled,
    });

    const style = {
        opacity: isDragging ? 0.5 : 1,
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

export default EntityDraggable;
