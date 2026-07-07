import React from 'react';
import { useSortable } from '@dnd-kit/sortable';

/**
 * SortableCard: Wraps a card on the playmat to make it sortable via drag-and-drop.
 * 
 * Key behaviors:
 * - Drag handle is restricted to the card header (via render prop)
 * - 50% opacity ghosting when dragging
 * - No live CSS transforms — reordering is strictly on-release
 * - Passes card metadata to DragOverlay for "Icon-in-box" preview
 */
export const SortableCard = ({ id, data, disabled = false, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        isDragging,
    } = useSortable({
        id,
        data,
        disabled,
        // Disable live transform — we don't want cards sliding during drag
        transition: null,
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                opacity: isDragging ? 0.5 : 1,
                // No transform applied — cards stay put until drop
            }}
        >
            {/* Render prop pattern: pass drag handle props to children */}
            {typeof children === 'function'
                ? children({ handleProps: { ...listeners, ...attributes }, isDragging })
                : children
            }
        </div>
    );
};

export default SortableCard;
