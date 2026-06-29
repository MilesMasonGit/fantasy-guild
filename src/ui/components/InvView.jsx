import React from 'react';
import { SettingsManager } from '../../systems/core/SettingsManager.js';
import { useGameState } from '../hooks/useGameState.js';
import { Package, Box, Plus, Coins } from 'lucide-react';
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
import { CommerceSystem } from '../../systems/economy/CommerceSystem.js';
import { ItemDurabilityBar } from './vault/ItemDurabilityBar.jsx';
import { useDndTarget } from '../hooks/useDndTarget.js';
import GUTooltip from './base/GUTooltip.jsx';

import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Single Item Row Component (Sortable)
 */
const InvItemRow = React.memo(({ item, groupId, index, flash }) => {

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
            index,
            sortable: true
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
            data-item-id={item.id}
            data-type="inv-item"
        >
            <div className={cn(
                "flex items-center justify-between p-2 rounded bg-gi-surface border border-gi-border hover:border-gi-primary/50 hover:bg-gi-surface-hover group cursor-grab active:cursor-grabbing shadow-sm transition-[transform,opacity,border-color,background-color] duration-200",
                flash === 'gain' && "animate-flash-green",
                flash === 'consume' && "animate-flash-red"
            )}>
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
 * Special Currency Row for Gold (Fixed at top)
 */
const CurrencyRow = React.memo(({ amount, onPointerMove, onPointerLeave }) => (
    <div 
        className="w-full mb-1 select-none"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        data-type="currency"
    >
        <div className="flex items-center justify-between p-2 rounded bg-gi-surface border border-gi-gold/30 shadow-sm transition-all duration-200 hover:bg-gi-surface-hover hover:border-gi-gold/50">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative">
                    <div className="w-8 h-8 flex items-center justify-center bg-gi-base border border-gi-gold/20 rounded shadow-inner flex-shrink-0">
                        <Coins className="w-4 h-4 text-gi-gold" />
                    </div>
                </div>
                <div className="overflow-hidden">
                    <div className="gi-text-16 font-bold text-gi-gold font-sans truncate">
                        Coins
                    </div>
                </div>
            </div>
            <Badge
                value={formatCompact(amount, 2)}
                variant="count"
                size="base"
                className="text-gi-gold"
            />
        </div>
    </div>
));
CurrencyRow.displayName = 'CurrencyRow';

/**
 * InvView: The Right Panel rendering the Inventory and Vault.
 */
export const InvView = React.memo(() => {
    const [isGroupMode, setIsGroupMode] = React.useState(false);
    const [isSearchMode, setIsSearchMode] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [pendingSellItem, setPendingSellItem] = React.useState(null);
    const [currentItemCount, setCurrentItemCount] = React.useState(0);
    const [hoverItem, setHoverItem] = React.useState(null);
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
    const [flashStates, setFlashStates] = React.useState({});

    // Gold state for the treasury row
    const goldCount = useGameState(state => state.currency?.gold || 0, ['currency_changed']);
    const heroes = useGameState(state => state.heroes || {}, ['heroes_updated']);

    const panelRef = React.useRef(null);
    const searchInputRef = React.useRef(null);

    // Click outside handler for management modes
    React.useEffect(() => {
        if (!isGroupMode && !isSearchMode) return;

        const handleClickOutside = (e) => {
            // Check if clicking outside the panel (and not on a modal overlay)
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                // Ensure we aren't clicking on a tooltip or something that should stay open
                if (e.target.closest('.gi-modal-overlay') || e.target.closest('.gi-tooltip')) return;
                
                setIsGroupMode(false);
                setIsSearchMode(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isGroupMode, isSearchMode]);

    // Centralized Item Flash Event Subscriptions
    React.useEffect(() => {
        const onFlash = (data) => {
            const itemId = data.itemId;
            const mode = data.mode;
            setFlashStates(prev => ({ ...prev, [itemId]: mode }));
            setTimeout(() => {
                setFlashStates(prev => {
                    const next = { ...prev };
                    delete next[itemId];
                    return next;
                });
            }, 600);
        };

        const subs = [];
        const particlesOn = SettingsManager.get('ui.itemParticles');

        if (particlesOn) {
            subs.push(EventBus.subscribe('particle_landed', onFlash));
        } else {
            subs.push(EventBus.subscribe('loot_generated', (data) => {
                if (data.drops) {
                    data.drops.forEach(d => {
                        onFlash({ itemId: d.itemId, mode: 'gain' });
                    });
                }
            }));
            subs.push(EventBus.subscribe('items_consumed', (data) => {
                if (data.items) {
                    data.items.forEach(d => {
                        onFlash({ itemId: d.itemId || d.id, mode: 'consume' });
                    });
                }
            }));
        }

        return () => subs.forEach(unsub => unsub());
    }, []);

    // Event Subscriptions
    React.useEffect(() => {
        const handleSellInitiated = (data) => {
            const template = getItem(data.itemId);
            if (template) {
                setPendingSellItem(template);
                setCurrentItemCount(InventoryManager.getItemCount(data.itemId));
            }
        };
        const sub = EventBus.subscribe('dnd:sell-initiated', handleSellInitiated);
        return () => sub();
    }, []);

    // State Subscriptions
    const rawGroups = useGameState(() => InventoryGroupManager.getGroupedInventory(), ['inventory_updated'], null, { bypassClone: true });
    const { used: capacityUsed, max: capacityMax } = useGameState(state => state.inventory?.slots || { used: 0, max: 20 }, ['inventory_updated']);

    // Derived State
    const filteredGroups = React.useMemo(() => {
        if (!searchQuery.trim()) return rawGroups;
        const q = searchQuery.toLowerCase().trim();
        return rawGroups.map(group => {
            const filteredItems = group.items.filter(item => 
                item.name.toLowerCase().includes(q) || (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q)))
            );
            return (filteredItems.length > 0 || group.title.toLowerCase().includes(q)) ? { ...group, items: filteredItems } : null;
        }).filter(Boolean);
    }, [rawGroups, searchQuery]);

    const handleToggleSearch = () => {
        setIsSearchMode(prev => {
            if (!prev) {
                setIsGroupMode(false);
                setTimeout(() => searchInputRef.current?.focus(), 0);
                return true;
            }
            setSearchQuery('');
            return false;
        });
    };

    const handleSell = (itemId, quantity) => {
        const result = CommerceSystem.sellItem(itemId, quantity);
        if (result.success) {
            setCurrentItemCount(InventoryManager.getItemCount(itemId));
        }
    };

    const { isValid: isValidTarget, isDragging: isAnyDragging } = useDndTarget({
        accepts: ['item', 'inventory_group']
    });

    const onPointerMove = React.useCallback((e) => {
        if (isAnyDragging) {
            if (hoverItem) setHoverItem(null);
            return;
        }

        const target = e.target.closest('[data-type="inv-item"], [data-type="currency"]');
        if (!target) {
            if (hoverItem) setHoverItem(null);
            return;
        }

        const type = target.getAttribute('data-type');
        const itemId = target.getAttribute('data-item-id');

        if (type === 'currency') {
            setHoverItem({
                id: 'currency-gold',
                name: 'Coins',
                count: goldCount,
                tags: ['Treasury'],
                isCurrency: true
            });
            setMousePos({ x: e.clientX, y: e.clientY });
        } else if (itemId) {
            const template = getItem(itemId);
            if (template) {
                const count = InventoryManager.getItemCount(itemId);
                setHoverItem({ ...template, count });
                setMousePos({ x: e.clientX, y: e.clientY });
            }
        }
    }, [isAnyDragging, hoverItem, goldCount]);

    const onPointerLeave = React.useCallback(() => {
        setHoverItem(null);
    }, []);

    return (
        <div ref={panelRef} className="w-64 h-full bg-gi-surface border-l border-gi-border flex flex-col shadow-2xl z-[90]">
            {/* Header */}
            <div className="border-b border-gi-border/50 bg-gi-base/50 flex flex-col shadow-sm">
                <div id="inventory-hud-target" className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-gi-accent" />
                        <h2 className="font-display font-bold text-lg text-gi-text tracking-wider">VAULT</h2>
                    </div>
                    <div className={cn("text-[10px] font-pixel px-2 py-1 rounded border", capacityUsed >= capacityMax ? "text-gi-danger bg-gi-danger/10 border-gi-danger/30" : "text-gi-muted")}>
                        {capacityUsed} / {capacityMax}
                    </div>
                </div>

                <div className="flex border-t border-gi-border/20">
                    <HeaderTab label="Search" active={isSearchMode} onClick={handleToggleSearch} />
                    <HeaderTab label="Group Ctrl" active={isGroupMode} onClick={() => { setIsGroupMode(!isGroupMode); setIsSearchMode(false); }} />
                </div>

                {isSearchMode && (
                    <div className="p-2 bg-gi-base/30 border-t border-gi-border/10">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter items..."
                            className="w-full h-8 bg-gi-base/50 border border-gi-border/40 rounded px-3 gi-text-14 font-bold text-gi-text focus:border-gi-primary outline-none transition-all"
                        />
                    </div>
                )}
            </div>

            {/* List */}
            <div 
                className={cn(
                    "flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 bg-gi-base/20 dnd-target",
                )}
                data-droppable-id="inventory" 
                data-type="inventory"
                data-drag-valid={isAnyDragging ? (isValidTarget ? "true" : "false") : undefined}
                data-no-bg-highlight="true"
                data-no-outline="true"
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
            >
                {/* Special Treasury Row (Always on top, not part of groups) */}
                <CurrencyRow 
                    amount={goldCount} 
                    onPointerMove={onPointerMove}
                    onPointerLeave={onPointerLeave}
                />

                {filteredGroups.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 opacity-30 select-none">
                        <Box size={40} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gi-muted">Vault Empty</span>
                    </div>
                ) : (
                    <SortableContext items={isGroupMode ? filteredGroups.map(g => g.id) : []} strategy={verticalListSortingStrategy} disabled={!isGroupMode}>
                        {filteredGroups.map(group => (
                            <InvGroup 
                                key={group.id} 
                                group={group} 
                                forceCollapsed={isGroupMode} 
                                forceExpanded={!!searchQuery}
                                canDelete={filteredGroups.length > 1}
                                onRename={(id, name) => InventoryGroupManager.renameGroup(id, name)}
                                onDelete={(id) => InventoryGroupManager.deleteGroup(id)}
                                flashStates={flashStates}
                            >
                                {!isGroupMode && (
                                    <SortableContext items={group.items.map(i => `item-${i.id}`)} strategy={verticalListSortingStrategy}>
                                        {group.items.map((item, idx) => <InvItemRow key={`item-${item.id}`} item={item} groupId={group.id} index={idx} flash={flashStates[item.id]} />)}
                                    </SortableContext>
                                )}
                            </InvGroup>
                        ))}
                    </SortableContext>
                )}

                {isGroupMode && (
                    <button
                        onClick={() => InventoryGroupManager.createGroup('New Group')}
                        className="mx-2 my-1 p-3 flex items-center gap-3 rounded border-2 border-dashed border-gi-border hover:border-gi-primary/50 hover:bg-gi-primary/5 transition-all text-gi-muted"
                    >
                        <Plus size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Add New Group</span>
                    </button>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gi-border/50 bg-gi-base/30 flex flex-col gap-3">
                <ItemSellControls pendingItem={pendingSellItem} setPendingItem={setPendingSellItem} onSell={handleSell} maxQuantity={currentItemCount} />
                <div className="text-[9px] text-center text-gi-muted uppercase tracking-widest font-bold opacity-50">
                    Vault capacity: {capacityMax} slots
                </div>
            </div>

            {/* Tooltip Layer */}
            {hoverItem && SettingsManager.get('ui.tooltipsEnabled') && SettingsManager.get('ui.tooltipsItems') && (
                <GUTooltip 
                    title={null}
                    color={null}
                    mousePos={mousePos}
                    width="auto"
                >
                    <div className="flex flex-col gap-1">
                        <div className="flex gap-4">
                            {/* Left: 64px Sprite Showcase */}
                            <div className="flex-shrink-0 w-20 h-20 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center">
                                <ItemIcon item={hoverItem} size={64} />
                            </div>

                            {/* Right: Info Stack */}
                            <div className="flex-1 flex flex-col gap-2 py-1 pr-2">
                                <div className="gi-text-16 font-pixel font-bold uppercase text-white mb-0.5 leading-tight whitespace-nowrap">
                                    {hoverItem.name}
                                </div>

                                {/* Quantity */}
                                <div className="flex items-center gap-2 gi-text-16 font-pixel font-bold uppercase tracking-wider text-gi-accent whitespace-nowrap">
                                    <span>#</span>
                                    <span className="text-gi-text">{hoverItem.count.toLocaleString()}</span>
                                </div>

                                {/* Sell Price */}
                                <div className="flex items-center gap-2 gi-text-16 font-pixel font-bold uppercase tracking-wider text-gi-accent whitespace-nowrap">
                                    <span>$</span>
                                    <span className="text-gi-text">{hoverItem.baseValue || 1}</span>
                                </div>
                            </div>
                        </div>

                        {/* Requirements Section */}
                        {(() => {
                            const template = getItem(hoverItem.id) || hoverItem;
                            const reqs = [];
                            if (Array.isArray(template.requirements)) {
                                template.requirements.forEach(r => {
                                    if (r.skill && r.level) reqs.push(r);
                                });
                            } else if (template.skillRequired && template.levelRequired) {
                                reqs.push({ skill: template.skillRequired, level: template.levelRequired });
                            }

                            if (reqs.length === 0) return null;

                            const doesHeroMeetRequirement = (hero, req) => {
                                if (!hero || hero.isVillager) return false;
                                const skillData = hero.skills?.[req.skill];
                                const skillLevel = typeof skillData === 'number'
                                    ? skillData
                                    : (skillData?.level ?? 0);
                                return skillLevel >= req.level;
                            };

                            return reqs.map((req, idx) => {
                                const isMetByAny = Object.values(heroes).some(hero => doesHeroMeetRequirement(hero, req));
                                return (
                                    <div key={idx} className="flex items-center gap-2 gi-text-16 font-pixel font-bold uppercase tracking-wider text-gi-accent">
                                        <span className="opacity-60">Req:</span>
                                        <span className={cn("text-[10px] leading-tight flex-1", isMetByAny ? "text-gi-success" : "text-gi-danger")}>
                                            {req.skill.toUpperCase()} LV.{req.level}
                                        </span>
                                    </div>
                                );
                            });
                        })()}

                        {/* Bottom: Tags Section (Full Width) */}
                        {hoverItem.tags?.length > 0 && (
                            <div className="flex items-center gap-2 gi-text-16 font-pixel font-bold uppercase tracking-wider text-gi-accent">
                                <span className="opacity-60">@</span>
                                <span className="text-gi-muted text-[10px] leading-tight flex-1">
                                    {hoverItem.tags.join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </GUTooltip>
            )}
        </div>
    );
});

const HeaderTab = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex-1 py-2 gi-text-12 font-bold uppercase tracking-widest transition-all",
            active ? "bg-gi-primary/10 text-gi-primary border-b-2 border-gi-primary" : "text-gi-muted hover:text-gi-primary"
        )}
    >
        {label}
    </button>
);

export default InvView;
