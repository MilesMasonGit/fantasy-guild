import React from 'react';
import { useGameState } from '../hooks/useGameState.js';
import { Package, Box, Plus } from 'lucide-react';
import { cn } from '../utils/cn.js';
import { EntityDraggable } from './base/EntityDraggable.jsx';
import { formatCompact } from '../../utils/Formatters.js';
import { Badge } from './base/Badge.jsx';
import { ItemIcon } from './base/ItemIcon.jsx';
import { InventoryGroupManager } from '../../systems/economy/InventoryGroupManager.js';
import { CurrencyManager } from '../../systems/economy/CurrencyManager.js';
import { InvGroup } from './vault/InvGroup.jsx';
import { ItemSellControls } from './vault/ItemSellControls.jsx';
import { EventBus } from '../../systems/core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { ItemDurabilityBar } from './vault/ItemDurabilityBar.jsx';

import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Single Item Row Component (Sortable)
 */
const InvItemRow = React.memo(({ item, groupId, index }) => {
    // Hooks must be called unconditionally
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: item ? `item-${item.id}` : `null-item-${index}`,
        data: item ? {
            type: 'item',
            id: item.id,
            title: item.name,
            subtitle: item.type,
            icon: item.icon,
            groupId,
            index
        } : {}
    });

    if (!item) return null;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 100 : 'auto'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="w-full"
        >
            <div className="flex items-center justify-between p-2 rounded bg-gi-surface border border-gi-border hover:border-gi-primary/50 hover:bg-gi-surface-hover group cursor-grab active:cursor-grabbing shadow-sm transition-[transform,opacity,border-color,background-color] duration-200">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="relative">
                        <ItemIcon item={item} size={32} className="bg-gi-base border border-gi-border/50 rounded shadow-inner flex-shrink-0" />
                        {item.maxDurability > 0 && (
                            <ItemDurabilityBar 
                                current={item.durability ?? item.maxDurability} 
                                max={item.maxDurability} 
                            />
                        )}
                    </div>
                    <div className="overflow-hidden">
                        <div className="gi-text-16 font-bold text-gi-text font-sans group-hover:text-gi-primary transition-colors truncate">
                            {item.name}
                        </div>
                    </div>
                </div>
                <Badge
                    value={formatCompact(item.count, 1)}
                    variant="count"
                    size="base"
                />
            </div>
        </div>
    );
});
InvItemRow.displayName = 'InvItemRow';

/**
 * InvView: The Right Panel rendering the Inventory and Vault.
 * Reactively subscribes to dynamic groups from InventoryGroupManager.
 */
export const InvView = React.memo(() => {
    const [isGroupMode, setIsGroupMode] = React.useState(false);
    const [isSearchMode, setIsSearchMode] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [pendingSellItem, setPendingSellItem] = React.useState(null);
    const [currentItemCount, setCurrentItemCount] = React.useState(0);

    const searchInputRef = React.useRef(null);

    React.useEffect(() => {
        const handleSellInitiated = (data) => {
            const template = getItem(data.itemId);
            if (template) {
                const count = InventoryManager.getItemCount(data.itemId);
                setPendingSellItem(template);
                setCurrentItemCount(count);
            }
        };

        const sub = EventBus.subscribe('dnd:sell-initiated', handleSellInitiated);
        return () => sub(); // sub is the unsubscribe function itself
    }, []);

    const handleSell = (itemId, quantity) => {
        console.log(`[InvView] Selling ${quantity}x ${itemId}`);
        InventoryManager.removeItem(itemId, quantity);

        // Award Gold (10g each for now)
        const totalGold = quantity * 10;
        CurrencyManager.addCurrency('gold', totalGold, 'merchant_sale');

        // Refresh local count after sale
        setCurrentItemCount(InventoryManager.getItemCount(itemId));
    };
    const handleToggleGroupMode = () => {
        const next = !isGroupMode;
        setIsGroupMode(next);
        if (next) setIsSearchMode(false);
    };

    const handleToggleSearch = () => {
        const next = !isSearchMode;
        setIsSearchMode(next);
        if (next) {
            setIsGroupMode(false);
            // Focus on next tick
            setTimeout(() => searchInputRef.current?.focus(), 0);
        } else {
            setSearchQuery('');
        }
    };

    // Subscription to both items and group definitions to trigger re-renders
    const rawGroupedInventory = useGameState(() => {
        return InventoryGroupManager.getGroupedInventory();
    }, ['inventory_updated'], null, { bypassClone: true });

    // Filtered inventory based on search query
    const groupedInventory = React.useMemo(() => {
        if (!searchQuery.trim()) return rawGroupedInventory;

        const q = searchQuery.toLowerCase().trim();
        return rawGroupedInventory.map(group => {
            const filteredItems = group.items.filter(item =>
                item.name.toLowerCase().includes(q) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q)))
            );

            // Return group only if it has items OR if the group name itself matches
            const groupNameMatches = group.title.toLowerCase().includes(q);

            if (filteredItems.length > 0 || groupNameMatches) {
                return { ...group, items: filteredItems };
            }
            return null;
        }).filter(Boolean);
    }, [rawGroupedInventory, searchQuery]);

    const capacityUsed = useGameState(state => state.inventory?.slots?.used || 0, ['inventory_updated']);
    const capacityMax = useGameState(state => state.inventory?.slots?.max || 20, ['inventory_updated']);

    return (
        <div className="w-64 h-full bg-gi-surface border-l border-gi-border flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-[90]">

            {/* Header */}
            <div className="border-b border-gi-border/50 bg-gi-base/50 flex flex-col shadow-md">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-gi-accent/20 rounded border border-gi-accent/30 shadow-inner">
                            <Package className="w-5 h-5 text-gi-accent" />
                        </div>
                        <h2 className="font-display font-bold text-lg text-gi-text tracking-wider text-shadow-neon">VAULT</h2>
                    </div>
                    <div className={cn(
                        "text-[10px] font-pixel px-2 py-1 rounded border shadow-sm transition-colors",
                        capacityUsed >= capacityMax
                            ? "text-gi-danger bg-gi-danger/10 border-gi-danger/30"
                            : "text-gi-muted bg-gi-surface border-gi-border"
                    )}>
                        {capacityUsed} / {capacityMax}
                    </div>
                </div>

                {/* Sub-Header Controls */}
                <div className="flex border-t border-gi-border/20">
                    <button
                        onClick={handleToggleSearch}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2 border-r border-gi-border/20 transition-colors text-gi-muted",
                            isSearchMode
                                ? "bg-gi-primary/20 text-gi-primary border-b-2 border-gi-primary/60"
                                : "hover:bg-gi-primary/10 hover:text-gi-primary"
                        )}
                    >
                        <span className="gi-text-14 font-bold uppercase tracking-tight">Search</span>
                    </button>
                    <button
                        onClick={handleToggleGroupMode}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2 transition-colors",
                            isGroupMode
                                ? "bg-gi-primary/20 text-gi-primary border-b-2 border-gi-primary/60"
                                : "hover:bg-gi-primary/10 hover:text-gi-primary text-gi-muted"
                        )}
                    >
                        <span className="gi-text-14 font-bold uppercase tracking-tight">Group Ctrl</span>
                    </button>
                </div>

                {/* Search Bar (Revealed below Sub-Header) */}
                {isSearchMode && (
                    <div className="p-2 bg-gi-base/30 border-t border-gi-border/10 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="relative group/search">
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search items..."
                                className="w-full h-8 bg-gi-base/50 border border-gi-border/40 rounded px-3 pr-8 gi-text-14 font-bold text-gi-text placeholder:text-gi-muted/50 focus:outline-none focus:border-gi-primary shadow-inner truncate transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gi-muted hover:text-gi-primary transition-colors"
                                >
                                    <Plus className="w-4 h-4 rotate-45" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Dynamic Groups Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-[4px] bg-gi-base/40">
                {groupedInventory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center opacity-30 select-none">
                        <Box size={48} className="mb-4 text-gi-muted" />
                        <p className="font-display text-sm text-gi-muted uppercase tracking-widest">Vault Empty</p>
                    </div>
                ) : (
                    <SortableContext
                        items={isGroupMode ? groupedInventory.map(g => g.id) : []}
                        strategy={verticalListSortingStrategy}
                        disabled={!isGroupMode}
                    >
                        {groupedInventory.map(group => (
                            <InvGroup
                                key={group.id}
                                group={group}
                                forceCollapsed={isGroupMode}
                                forceExpanded={!!searchQuery}
                                onRename={(id, newName) => InventoryGroupManager.renameGroup(id, newName)}
                                onDelete={(id) => InventoryGroupManager.deleteGroup(id)}
                            >
                                {!isGroupMode && (
                                    <SortableContext
                                        items={group.items.map(i => `item-${i.id}`)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {group.items.map((item, index) => (
                                            <InvItemRow
                                                key={`item-${item.id}`}
                                                item={item}
                                                groupId={group.id}
                                                index={index}
                                            />
                                        ))}
                                    </SortableContext>
                                )}
                            </InvGroup>
                        ))}
                    </SortableContext>
                )}

                {/* Add New Group Slot (Group Mode Only) */}
                {isGroupMode && (
                    <button
                        onClick={() => InventoryGroupManager.createGroup('New Group')}
                        className="mx-2 my-1 p-2 flex items-center gap-3 rounded border border-dashed border-gi-border hover:border-gi-primary/50 hover:bg-gi-primary/5 transition-all group/add"
                    >
                        <div className="w-8 h-8 rounded bg-gi-base border border-gi-border/20 flex items-center justify-center text-gi-muted group-hover/add:text-gi-primary group-hover/add:border-gi-primary/30 transition-colors">
                            <Plus size={16} />
                        </div>
                        <span className="gi-text-16 font-bold text-gi-muted uppercase tracking-wider group-hover/add:text-gi-text transition-colors">
                            Add New Group
                        </span>
                    </button>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gi-border/50 bg-gi-base/30 flex flex-col gap-3">
                <ItemSellControls
                    pendingItem={pendingSellItem}
                    setPendingItem={setPendingSellItem}
                    onSell={handleSell}
                    maxQuantity={currentItemCount}
                />
                <div className="text-[9px] text-center text-gi-muted uppercase tracking-widest font-bold">
                    Item limit managed by Guild Level
                </div>
            </div>
        </div>
    );
});
InvView.displayName = 'InvView';

export default InvView;
