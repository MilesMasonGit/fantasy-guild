import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { Plus, Lock } from 'lucide-react';

/**
 * TabStrip — the user-sortable tab bar shared by the Bank and Card Binder
 * panes (UI overhaul Phase 3). One consistent system (owner decision
 * 2026-07-11): renamable tabs (double-click), a gated "+" (tab count is a
 * Guild Hall upgrade path), and tabs double as drop targets — dragging a
 * tile onto a tab files it there.
 *
 * Pure presentation: all mutations arrive via callbacks.
 */
export const TabStrip = ({
    tabs,
    activeId,
    onSelect,
    onRename,
    onCreate,          // (name) => void; omit to hide the + button
    canCreate = false, // false renders the + locked with an unlock hint
    dropKind,          // 'item' | 'card' — payload kind accepted on tabs
    onDropToTab        // (tabId, payload) => void
}) => {
    const [renamingId, setRenamingId] = useState(null);
    const [creating, setCreating] = useState(false);

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {tabs.map(tab => (
                renamingId === tab.id ? (
                    <InlineNameInput
                        key={tab.id}
                        initial={tab.title}
                        onCommit={name => { if (name) onRename(tab.id, name); setRenamingId(null); }}
                    />
                ) : (
                    <TabDropButton
                        key={tab.id}
                        tab={tab}
                        active={tab.id === activeId}
                        dropKind={dropKind}
                        onSelect={onSelect}
                        onStartRename={() => setRenamingId(tab.id)}
                        onDropToTab={onDropToTab}
                    />
                )
            ))}

            {onCreate && (creating ? (
                <InlineNameInput
                    initial=""
                    placeholder="Tab name…"
                    onCommit={name => { if (name) onCreate(name); setCreating(false); }}
                />
            ) : (
                <button
                    onClick={() => canCreate && setCreating(true)}
                    disabled={!canCreate}
                    title={canCreate ? 'New tab' : 'More tabs unlock via Guild Hall upgrades'}
                    className={cn(
                        'p-1 rounded border transition-colors',
                        canCreate
                            ? 'border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-muted'
                            : 'border-gi-border/40 text-gi-muted/40 cursor-not-allowed'
                    )}
                >
                    {canCreate ? <Plus size={11} /> : <Lock size={11} />}
                </button>
            ))}
        </div>
    );
};

/** One tab: selects on click, renames on double-click, and accepts a dragged
 *  tile (kind === dropKind) to file it into this tab. */
const TabDropButton = ({ tab, active, dropKind, onSelect, onStartRename, onDropToTab }) => {
    const drop = useEntityDrop({
        id: `tabstrip-${tab.id}`,
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === dropKind,
        onDrop: p => onDropToTab?.(tab.id, p)
    });
    return (
        <button
            ref={drop.setNodeRef}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={onStartRename}
            title={`${tab.title} — double-click to rename${dropKind ? ', drop a tile here to file it' : ''}`}
            {...drop.droppableProps}
            className={cn(
                'px-2.5 py-1 rounded text-[10px] font-bold gi-caps tracking-wide border transition-colors',
                active ? 'bg-gi-primary/20 border-gi-primary/40 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text',
                drop.valid && 'ring-2 ring-gi-primary border-gi-primary'
            )}
        >
            {tab.title}
        </button>
    );
};

/** Small self-focusing input for rename/create; Enter or blur commits, Escape cancels. */
const InlineNameInput = ({ initial, placeholder, onCommit }) => {
    const [value, setValue] = useState(initial);
    const ref = useRef(null);
    useEffect(() => { ref.current?.select(); }, []);
    return (
        <input
            ref={ref}
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={e => setValue(e.target.value)}
            onBlur={() => onCommit(value.trim())}
            onKeyDown={e => {
                if (e.key === 'Enter') onCommit(value.trim());
                if (e.key === 'Escape') onCommit(null);
            }}
            className="w-24 bg-black/40 border border-gi-primary rounded px-2 py-1 text-[10px] font-bold text-gi-text outline-none"
        />
    );
};

export default TabStrip;
