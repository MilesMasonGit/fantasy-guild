import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../utils/cn.js';
import { Plus, X } from 'lucide-react';
/**
 * CardSlot: Visual slot on a card for heroes/items.
 * Registers as a dnd-kit droppable to allow direct slot assignments.
 *
 * The `hero` prop no longer renders anything on its own — it only marks the
 * slot as filled. Heroes are shown in the Hero Dock and on their banner card;
 * the old in-slot hero strip was pre-rework UI and is gone (Hero Dock Phase 9).
 */
export const CardSlot = ({
    id,
    data,
    className,
    label = "Drag and Drop a Hero to Begin",
    hero,
    children,
    onRemove,
    onClick,
    ...props
}) => {
    // Add droppable zone for this slot
    const { setNodeRef, isOver } = useDroppable({
        id: id,
        data: data
    });

    const isEmpty = !hero && !children;

    const handleContextMenu = (e) => {
        if (onRemove && (hero || data?.cardId)) {
            e.preventDefault();
            onRemove(hero?.id);
        }
    };

    return (
        <div
            ref={setNodeRef}
            data-type={data?.type}
            data-droppable-id={id}
            className={cn(
                "relative group transition-all duration-300 overflow-hidden dnd-target",
                isEmpty ? [
                    "w-full h-full rounded border-2 border-dashed border-gi-border/50",
                    "bg-transparent flex items-center justify-center",
                    "text-gi-muted hover:text-gi-text hover:border-gi-primary/50 hover:bg-gi-surface/50",
                    "cursor-pointer",
                    isOver && "border-gi-primary bg-gi-primary/10 shadow-[0_0_30px_rgba(6,182,212,0.3),inset_0_0_20px_rgba(6,182,212,0.2)] text-gi-primary scale-105"
                ] : [
                    "w-full h-full flex items-center",
                    isOver && "ring-2 ring-gi-primary shadow-[0_0_25px_rgba(6,182,212,0.4)] brightness-110"
                ],
                className
            )}
            onClick={onClick}
            onContextMenu={handleContextMenu}
            {...props}
        >
            {/* Content Priority: Children -> Label */}
            {children || (
                <span className="font-sans font-medium tracking-wide text-xs uppercase text-center">{label}</span>
            )}

            {/* Hover Unassign Button (Legacy Visual) */}
            {onRemove && hero && (
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
};

export default CardSlot;
