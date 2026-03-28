import React, { useState } from 'react';
import { ChevronDown, ChevronRight, PenLine, X, Check } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * InvGroup: A collapsible group for inventory items.
 * @param {Object} group - Group data { id, title, items, isCustom }
 * @param {React.ReactNode} children - The rendered items in this group
 * @param {Function} onRename - Optional callback for renaming custom groups
 * @param {Function} onDelete - Optional callback for deleting custom groups
 */
export const InvGroup = ({ group, children, onRename, onDelete, forceCollapsed = false, forceExpanded = false }) => {
    // Loot group starts open, others start closed by default
    const [isCollapsed, setIsCollapsed] = useState(group.id !== 'default-loot');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [tempName, setTempName] = useState(group.title);

    // Effectively collapsed if manually toggled OR forced by parent mode.
    // forceExpanded overrides local isCollapsed but respects parent forceCollapsed.
    const effectiveCollapsed = (isCollapsed && !forceExpanded) || forceCollapsed;
    const hasItems = group.items && group.items.length > 0;

    // 1. Droppable for items dropping INTO the group
    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: group.id,
        data: {
            type: 'inventory_group',
            id: group.id,
            itemCount: group.items.length
        }
    });

    // 2. Sortable for group REORDERING
    const {
        attributes,
        listeners,
        setNodeRef: setSortRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: group.id,
        disabled: !forceCollapsed || isRenaming || isDeleting,
        data: {
            type: 'inventory_group',
            id: group.id,
            title: group.title
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
        position: 'relative'
    };

    // Merge refs for the outer container
    const setContainerRef = (node) => {
        setDropRef(node);
        setSortRef(node);
    };

    const handleRenameStart = (e) => {
        e.stopPropagation();
        setTempName(group.title);
        setIsRenaming(true);
        setIsDeleting(false);
    };

    const handleRenameSave = (e) => {
        e.stopPropagation();
        if (tempName.trim() !== '') {
            onRename?.(group.id, tempName.trim());
        }
        setIsRenaming(false);
    };

    const handleRenameCancel = (e) => {
        e.stopPropagation();
        setTempName(group.title);
        setIsRenaming(false);
    };

    const handleDeleteStart = (e) => {
        e.stopPropagation();
        setIsDeleting(true);
        setIsRenaming(false);
    };

    // Group Icon logic: Use the first item's data for the icon if it exists
    const firstItem = hasItems ? group.items[0] : null;

    return (
        <div
            ref={setContainerRef}
            style={style}
            className={cn(
                "flex flex-col border-b border-gi-border last:border-0 transition-[transform,opacity,background-color] duration-200",
                isOver && "bg-gi-primary/5 scale-[0.99] rounded-lg",
                !effectiveCollapsed && "pb-2"
            )}
        >
            {/* Group Header */}
            <div
                className={cn(
                    "flex items-center justify-between p-2 transition-colors select-none group/header",
                    forceCollapsed ? "cursor-default border-b border-gi-border/10" : "cursor-pointer hover:bg-gi-surface-hover",
                    !effectiveCollapsed && "bg-gi-base/20",
                    isOver && "bg-gi-primary/10 border-gi-primary/30",
                    isDeleting && "bg-gi-danger/5",
                    isRenaming && "bg-gi-primary/5",
                    isDragging && "opacity-50"
                )}
                onClick={() => !forceCollapsed && setIsCollapsed(!isCollapsed)}
            >
                {/* Drag Handle (Left + Middle) */}
                <div
                    {...attributes}
                    {...listeners}
                    className={cn(
                        "flex items-center gap-2 overflow-hidden flex-1",
                        forceCollapsed && !isRenaming && !isDeleting && "cursor-grab active:cursor-grabbing"
                    )}
                >
                    {/* Group Icon (First Item) */}
                    <div className="flex-shrink-0">
                        {firstItem ? (
                            <ItemIcon
                                item={firstItem}
                                size={32}
                                className="bg-gi-base border border-gi-border/30 rounded"
                            />
                        ) : (
                            <div className="w-8 h-8 bg-gi-base border border-gi-border/30 rounded flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-gi-muted/30" />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col truncate flex-1 leading-tight">
                        {isRenaming ? (
                            <input
                                autoFocus
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSave(e);
                                    if (e.key === 'Escape') handleRenameCancel(e);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="gi-text-16 font-bold text-gi-text bg-gi-base/50 border border-gi-primary/30 rounded px-1 py-0 h-6 -ml-1 focus:outline-none focus:border-gi-primary w-full leading-none"
                                placeholder="Group Name..."
                                maxLength={15}
                            />
                        ) : isDeleting ? (
                            <span className="gi-text-16 font-pixel font-bold text-gi-danger tracking-tight truncate">
                                Confirm Del.?
                            </span>
                        ) : (
                            <span className="gi-text-16 font-bold text-gi-muted tracking-wide uppercase truncate">
                                {group.title}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">

                    {/* Group Management Mode Actions (Quill & X) - Only for Custom Groups */}
                    {forceCollapsed && group.isCustom && (
                        <div className="flex items-center gap-1.5">
                            {isRenaming ? (
                                <>
                                    <button
                                        onClick={handleRenameSave}
                                        className="p-1.5 text-gi-primary hover:bg-gi-primary/10 rounded transition-all border border-gi-primary/30 hover:border-gi-primary/50"
                                        title="Save Name"
                                    >
                                        <Check size={14} strokeWidth={3} />
                                    </button>
                                    <button
                                        onClick={handleRenameCancel}
                                        className="p-1.5 text-gi-muted hover:text-gi-text hover:bg-gi-base rounded transition-all border border-gi-border/30 shadow-sm"
                                        title="Cancel"
                                    >
                                        <X size={14} />
                                    </button>
                                </>
                            ) : isDeleting ? (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete?.(group.id); }}
                                        className="p-1.5 text-gi-danger hover:bg-gi-danger/10 rounded transition-all border border-gi-danger/30 hover:border-gi-danger/50"
                                        title="Confirm Deletion"
                                    >
                                        <Check size={14} strokeWidth={3} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsDeleting(false); }}
                                        className="p-1.5 text-gi-muted hover:text-gi-text hover:bg-gi-base rounded transition-all border border-gi-border/30 shadow-sm"
                                        title="Cancel"
                                    >
                                        <X size={14} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleRenameStart}
                                        className="p-1.5 text-gi-muted hover:text-gi-primary hover:bg-gi-primary/10 rounded transition-all border border-transparent hover:border-gi-primary/30"
                                        title="Rename Group"
                                    >
                                        <PenLine size={14} />
                                    </button>
                                    <button
                                        onClick={handleDeleteStart}
                                        className="p-1.5 text-gi-muted hover:text-gi-danger hover:bg-gi-danger/10 rounded transition-all border border-transparent hover:border-gi-danger/30"
                                        title="Delete Group"
                                    >
                                        <X size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Interaction Arrow (Hidden in Group Mode) */}
                    {!forceCollapsed && (
                        <div className="text-gi-muted group-hover/header:text-gi-primary transition-colors flex-shrink-0">
                            {effectiveCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </div>
                    )}
                </div>
            </div>

            {/* Group Content */}
            {!effectiveCollapsed && (
                <div className="px-2 py-1 flex flex-col gap-[1px] bg-gi-base/20 transition-all animate-in fade-in slide-in-from-top-1 duration-200 min-h-[40px]">
                    {hasItems ? (
                        children
                    ) : (
                        <div className="h-[50px] flex flex-col items-center justify-center opacity-20 select-none border border-dashed border-gi-border rounded">
                            <span className="text-[10px] font-pixel tracking-widest uppercase">Empty Group</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InvGroup;
