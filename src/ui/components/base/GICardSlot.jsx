import React from 'react';
import { cn } from '../../utils/cn.js';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

/**
 * GI-CardSlot: The empty state visualized in the UI where a card can be dropped or drawn.
 * Used for empty Hero slots or quest capacity.
 */
export const GICardSlot = ({
    id,
    data,
    className,
    label = "Drag and Drop a Hero to Begin",
    onClick,
    ...props
}) => {
    // Make every GICardSlot a valid drop target by default
    const { isOver, setNodeRef } = useDroppable({
        id: id || "generic-slot",
        data: data || {},
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "w-full py-2 px-4 rounded border-2 border-dashed border-gi-border/50",
                "bg-gi-surface/30 backdrop-blur-sm flex items-center justify-center",
                "text-gi-muted hover:text-gi-text hover:border-gi-primary/50 hover:bg-gi-surface/50",
                "transition-all cursor-pointer group shadow-inner",
                isOver && "border-gi-primary bg-gi-primary/10 text-gi-primary", // Drop highlight
                className
            )}
            onClick={onClick}
            {...props}
        >
            <span className="font-sans font-medium tracking-wide text-xs uppercase">{label}</span>
        </div>
    );
};

export default GICardSlot;
