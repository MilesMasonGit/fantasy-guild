import React from 'react';
import { cn } from '../../utils/cn.js';
import { Plus, X } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { HeroIdentityStrip } from '../HeroIdentityStrip.jsx';

/**
 * CardSlot: The empty state visualized in the UI where a card can be dropped or drawn.
 * Used for empty Hero slots or quest capacity.
 */
export const CardSlot = ({
    id,
    data,
    className,
    label = "Drag and Drop a Hero to Begin",
    hero,
    onRemove,
    onClick,
    ...props
}) => {
    // Make every CardSlot a valid drop target by default
    const { isOver, setNodeRef } = useDroppable({
        id: id || "generic-slot",
        data: data || {},
    });

    if (hero) {
        return (
            <div className={cn("relative w-full group", className)} {...props}>
                <HeroIdentityStrip hero={hero} />
                {onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(hero.id);
                        }}
                        className="absolute -top-2 -right-2 bg-gi-danger hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                        title="Unassign Hero"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "w-full py-2 px-4 rounded border-2 border-dashed border-gi-border/50",
                "bg-gi-surface/30 backdrop-blur-sm flex items-center justify-center min-h-[60px]",
                "text-gi-muted hover:text-gi-text hover:border-gi-primary/50 hover:bg-gi-surface/50",
                "transition-all cursor-pointer shadow-inner",
                isOver && "border-gi-primary bg-gi-primary/10 text-gi-primary", // Drop highlight
                className
            )}
            onClick={onClick}
            {...props}
        >
            <span className="font-sans font-medium tracking-wide text-xs uppercase text-center">{label}</span>
        </div>
    );
};

export default CardSlot;
