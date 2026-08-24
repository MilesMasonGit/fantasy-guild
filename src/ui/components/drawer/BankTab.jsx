import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { CommerceSystem } from '../../../systems/economy/CommerceSystem.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import * as EquipmentManager from '../../../systems/equipment/EquipmentManager.js';
import { useEntityDrag, useEntityDrop, DropTarget, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { formatCompact } from '../../../utils/Formatters.js';
import { Coins, Landmark, X, Lock, Check, AlertTriangle, BoxSelect } from 'lucide-react';
import { SellControls } from './SellControls.jsx';

import { EventBus } from '../../../systems/core/EventBus.js';

/** Hard cap on bank tabs: 1 free + 15 via Guild Hall (max total 16). */
const BANK_TAB_CAP = 16;

/**
 * Bank pane (overhaul Phase 3, spec §COMP-BANK) — the guild bank as
 * user-sortable tabs of compact reorderable item lists (owner decisions
 * 2026-07-11: tabs start at 1 and unlock via Guild Hall; lists pack
 * compact, no slot grid; stack size / total slots / tab count are three
 * separate upgrade stats).
 *
 * Tabs reuse the inventory group system (groupOrder/groupDefs/
 * itemOverrides — persisted, and the legacy InvView spoke it too).
 * An item with no override lives in the FIRST tab. Drag a tile onto a
 * tile to reorder, onto a tab to file it there, onto a hero to equip
 * (payload kind 'item' is unchanged). Search matches ALL tabs.
 * Item details + sell controls live in the shared InspectionPanel.
 */
export const BankTab = ({ filter, selectedItemId, onInspect, searchQuery = '' }) => {
    const [activeTabId, setActiveTabId] = useState(null);
    const [typeFilter, setTypeFilter] = useState(null); // transient, from auto-open (§12.B)
    const [searchTerm, setSearchTerm] = useState('');
    // Select mode (owner design 2026-07-14): multi-select stacks to drag-move
    // between tabs or bulk-sell behind a confirmation modal.
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [sellModalOpen, setSellModalOpen] = useState(false);

    useEffect(() => {
        if (!filter) return;
        setTypeFilter(filter.itemType || null);
        setSearchTerm('');
    }, [filter]);

    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed']);
    const bank = useGameState(
        state => {
            const inv = state.inventory || {};
            return {
                stocked: Object.entries(inv.items || {})
                    .filter(([, data]) => (data?.quantity || 0) > 0)
                    .map(([id, data]) => ({ id, count: data.quantity })),
                groupOrder: [...(inv.groupOrder || [])],
                orderedByGroup: Object.fromEntries(
                    Object.entries(inv.groupDefs || {}).map(([id, def]) => [id, [...(def.orderedItems || [])]])
                ),
                titles: Object.fromEntries(
                    Object.entries(inv.groupDefs || {}).map(([id, def]) => [id, def.title || id])
                ),
                itemOverrides: { ...(inv.itemOverrides || {}) },
                maxTabs: inv.maxTabs ?? 1,
                maxSlots: inv.maxSlots ?? 20
            };
        },
        ['inventory_updated']
    );

    const stocked = useMemo(() => {
        return bank.stocked
            .map(({ id, count }) => {
                const template = getItem(id);
                return template ? { id, count, template } : null;
            })
            .filter(Boolean);
    }, [bank.stocked]);

    // Tab an item belongs to: explicit override, else the first tab.
    const homeOf = (itemId) => {
        const target = bank.itemOverrides[itemId];
        return (target && bank.groupOrder.includes(target)) ? target : bank.groupOrder[0];
    };

    // Per-tab visual order: manually ordered ids first, then the rest.
    const tabItems = useMemo(() => {
        const map = Object.fromEntries(bank.groupOrder.map(id => [id, []]));
        const byId = Object.fromEntries(stocked.map(e => [e.id, e]));
        const placed = new Set();
        bank.groupOrder.forEach(gid => {
            (bank.orderedByGroup[gid] || []).forEach(itemId => {
                if (byId[itemId] && homeOf(itemId) === gid) {
                    map[gid].push(byId[itemId]);
                    placed.add(itemId);
                }
            });
        });
        stocked.forEach(e => {
            if (!placed.has(e.id)) map[homeOf(e.id)]?.push(e);
        });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stocked, bank.groupOrder, bank.orderedByGroup, bank.itemOverrides]);

    const tabs = bank.groupOrder.map(id => ({ id, title: bank.titles[id] || 'Tab' }));
    const currentTabId = bank.groupOrder.includes(activeTabId) ? activeTabId : bank.groupOrder[0];

    const activeSearch = (searchQuery || searchTerm).trim();
    const searching = activeSearch.length > 0;
    const visible = useMemo(() => {
        let list = searching
            ? stocked.filter(e => {
                const term = activeSearch.toLowerCase();
                return e.template.name.toLowerCase().includes(term)
                    || e.template.tags?.some(tag => tag.toLowerCase().includes(term));
            })
            : (tabItems[currentTabId] || []);
        if (typeFilter) list = list.filter(e => e.template.type === typeFilter);
        return list;
    }, [searching, activeSearch, stocked, tabItems, currentTabId, typeFilter]);

    // Manual sorting is only meaningful on the plain tab view.
    const canReorder = !searching && !typeFilter;

    /** Drop on a tile: reorder within this tab, unequip hero item, or file + position from another tab. */
    const handleTileDrop = (payload, targetId) => {
        if (payload?.kind !== 'item') return;
        if (payload.fromHeroId != null && payload.fromSlot != null) {
            EquipmentManager.unequipItem(payload.fromHeroId, payload.fromSlot);
            return;
        }
        if (payload.itemId === targetId || !canReorder) return;
        const ids = (tabItems[currentTabId] || []).map(x => x.id);
        const targetIndex = ids.indexOf(targetId);
        if (homeOf(payload.itemId) !== currentTabId) {
            InventoryManager.moveItemToGroup(payload.itemId, currentTabId, targetIndex);
        } else {
            const next = ids.filter(id => id !== payload.itemId);
            next.splice(next.indexOf(targetId), 0, payload.itemId);
            InventoryManager.setGroupOrder(currentTabId, next);
        }
    };

    /** Drop on empty space: append to this tab, or unequip hero item. */
    const handleListDrop = (payload) => {
        if (payload?.kind !== 'item') return;
        if (payload.fromHeroId != null && payload.fromSlot != null) {
            EquipmentManager.unequipItem(payload.fromHeroId, payload.fromSlot);
            return;
        }
        if (!canReorder) return;
        const ids = (tabItems[currentTabId] || []).map(x => x.id).filter(id => id !== payload.itemId);
        if (homeOf(payload.itemId) !== currentTabId) {
            InventoryManager.moveItemToGroup(payload.itemId, currentTabId);
        } else {
            InventoryManager.setGroupOrder(currentTabId, [...ids, payload.itemId]);
        }
    };

    /** Drop on a tab: file the dragged stack — or unequip hero item — there. */
    const handleTabDrop = (tabId, payload) => {
        if (payload?.kind !== 'item') return;
        if (payload.fromHeroId != null && payload.fromSlot != null) {
            EquipmentManager.unequipItem(payload.fromHeroId, payload.fromSlot);
            return;
        }
        const ids = payload.selection?.length ? payload.selection : [payload.itemId];
        ids.forEach(id => InventoryManager.moveItemToGroup(id, tabId));
        if (payload.selection?.length) setSelectedIds(new Set());
    };

    const toggleSelected = (itemId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
            return next;
        });
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
        setSellModalOpen(false);
    };

    // Live entries for the current selection (stale ids drop out naturally).
    const selectedEntries = useMemo(
        () => stocked.filter(e => selectedIds.has(e.id)),
        [stocked, selectedIds]
    );

    const confirmSell = (quantities) => {
        selectedEntries.forEach(e => {
            const qty = quantities?.[e.id] ?? e.count;
            CommerceSystem.sellItem(e.id, qty);
        });
        setSelectedIds(new Set());
        setSellModalOpen(false);
    };

    return (
        <div className="h-full min-h-0 flex flex-col">
            {/* Header: tabs + search + totals */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gi-border/40 bg-gi-base/30 flex-wrap">
                <BankTabStrip
                    tabs={tabs}
                    activeId={currentTabId}
                    onSelect={setActiveTabId}
                    firstItemByTab={Object.fromEntries(bank.groupOrder.map(gid => [gid, tabItems[gid]?.[0]?.template || null]))}
                    onDropToTab={handleTabDrop}
                />
                <button
                    onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                    title={selectMode ? 'Exit select mode' : 'Select multiple items to move or sell'}
                    className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors',
                        selectMode
                            ? 'border-gi-primary bg-gi-primary/15 text-gi-text'
                            : 'border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-muted'
                    )}
                >
                    <BoxSelect size={11} /> {selectMode ? 'Done' : 'Select'}
                </button>
                {selectMode && (
                    <>
                        <span className="text-[10px] text-gi-muted tabular-nums">{selectedEntries.length} selected</span>
                        <button
                            onClick={() => setSellModalOpen(true)}
                            disabled={selectedEntries.length === 0}
                            className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors',
                                selectedEntries.length > 0
                                    ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text hover:bg-gi-gold/25'
                                    : 'border-gi-border/40 text-gi-muted/40 cursor-not-allowed'
                            )}
                        >
                            <Coins size={11} className="text-gi-gold" /> Sell…
                        </button>
                    </>
                )}
                {typeFilter && (
                    <button
                        onClick={() => setTypeFilter(null)}
                        title="Clear the slot filter"
                        className="flex items-center gap-1 px-2 py-1 rounded border border-gi-gold/50 bg-gi-gold/10 text-[10px] font-bold uppercase text-gi-text"
                    >
                        {typeFilter} <X size={10} />
                    </button>
                )}
                <span
                    title="Item stacks in the bank / slot capacity"
                    className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ml-auto',
                        stocked.length >= bank.maxSlots ? 'text-gi-danger border-gi-danger/40 bg-gi-danger/10' : 'text-gi-muted border-gi-border'
                    )}
                >
                    {stocked.length}/{bank.maxSlots}
                </span>
            </div>

            {/* Compact reorderable list — the list is the "append here" target;
                tiles are reorder targets nested inside it. */}
            <DropTarget
                id={`bank-list-${currentTabId}`}
                surface={DND_SURFACE.DRAWER}
                accepts={p => p.kind === DRAG_KIND.ITEM && (canReorder || p.fromHeroId != null)}
                onDrop={handleListDrop}
                acceptClassName=""
                rejectClassName=""
                className="flex-1 overflow-y-auto custom-scrollbar p-3"
            >
                {searching && (
                    <div className="mb-2 text-[9px] text-gi-muted italic">Searching all tabs — sorting is paused.</div>
                )}
                {selectMode && (
                    <div className="mb-2 text-[9px] text-gi-muted italic">
                        Click items to select them — drag any selected item onto a tab to move them all, or use Sell.
                    </div>
                )}
                {visible.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3">
                        {visible.map(entry => (
                            <ItemTile
                                key={entry.id}
                                entry={entry}
                                selected={selectedItemId === entry.id}
                                onSelect={() => (selectMode ? toggleSelected(entry.id) : onInspect('item', entry.id))}
                                checked={selectMode && selectedIds.has(entry.id)}
                                selectMode={selectMode}
                                selectionIds={selectedIds}
                                canReorder={canReorder}
                                onReorderDrop={handleTileDrop}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/40">
                        <Landmark size={32} />
                        <span className="text-xs uppercase tracking-widest font-bold">
                            {stocked.length === 0 ? 'Bank empty' : 'No items here'}
                        </span>
                        {!searching && stocked.length > 0 && (
                            <span className="text-[10px] normal-case">Drag items onto this tab to file them here.</span>
                        )}
                    </div>
                )}
            </DropTarget>

            {sellModalOpen && selectedEntries.length > 0 && (
                <SellConfirmModal
                    entries={selectedEntries}
                    onCancel={() => setSellModalOpen(false)}
                    onConfirm={confirmSell}
                />
            )}
        </div>
    );
};

/** One banked item — a native drag source (kind 'item') and a reorder drop target.
 *  In select mode a checked tile drags the WHOLE selection (payload.selection). */
const ItemTile = ({ entry, selected, onSelect, checked = false, selectMode = false, selectionIds = null, canReorder = false, onReorderDrop }) => {
    const { template, count } = entry;
    // A checked tile in select mode drags the WHOLE selection (payload.selection).
    const drag = useEntityDrag({
        id: `item-src-${entry.id}`,
        kind: DRAG_KIND.ITEM,
        payload: {
            itemId: entry.id,
            ...(selectMode && checked && selectionIds?.size > 1 ? { selection: [...selectionIds] } : {})
        },
        sourceSurface: DND_SURFACE.DRAWER
    });
    const drop = useEntityDrop({
        id: `item-tile-${entry.id}`,
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.ITEM && (p.fromHeroId != null || (canReorder && p.itemId !== entry.id)),
        onDrop: p => onReorderDrop(p, entry.id)
    });
    return (
        <button
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            onClick={onSelect}
            {...drag.handleProps}
            {...drop.droppableProps}
            title={selectMode
                ? `${template.name} ×${count} — click to ${checked ? 'deselect' : 'select'}`
                : `${template.name} ×${count} — drag to sort, or onto a hero to equip`}
            className={cn(
                'relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing text-center min-w-0 min-h-0 aspect-square',
                selected && !selectMode ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border bg-gi-base/60 hover:border-gi-muted',
                checked && 'border-gi-primary bg-gi-primary/15 ring-1 ring-gi-primary/60',
                drop.valid && 'ring-2 ring-gi-primary border-gi-primary',
                drag.isDragging && 'opacity-40'
            )}
        >
            {checked && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded bg-gi-primary text-black flex items-center justify-center">
                    <Check size={11} strokeWidth={3} />
                </span>
            )}
            {/* 64px Icon, no background/border box around it */}
            <ItemIcon item={template} size={64} className="shrink-0" />
            <span className="text-xs md:text-sm font-bold text-gi-text mt-1.5 tabular-nums">
                {formatCompact(count, 1)}
            </span>
        </button>
    );
};

/**
 * BankTabStrip — the fixed, system-owned bank tabs (owner design 2026-07-14):
 * always BANK_TAB_CAP slots; unlocked tabs show the 32px sprite of their first
 * item (or the slot number when empty), locked slots render greyed with a
 * lock. No player create/rename/delete. Tabs accept item drops (single stack
 * or a whole select-mode selection).
 */
const BankTabStrip = ({ tabs, activeId, onSelect, firstItemByTab, onDropToTab }) => {
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {tabs.map((tab, i) => (
                <BankTabButton
                    key={tab.id}
                    tab={tab}
                    index={i}
                    first={firstItemByTab[tab.id]}
                    active={tab.id === activeId}
                    onSelect={onSelect}
                    onDropToTab={onDropToTab}
                />
            ))}
            {Array.from({ length: Math.max(0, BANK_TAB_CAP - tabs.length) }, (_, i) => (
                <div
                    key={`locked-${i}`}
                    title="Locked — unlock more tabs via Guild Hall upgrades"
                    className="w-10 h-10 rounded border border-gi-border/30 bg-black/20 flex items-center justify-center text-gi-muted/30 shrink-0"
                >
                    <Lock size={12} />
                </div>
            ))}
        </div>
    );
};

/** One bank tab — item drop target that files the dragged stack/selection here. */
const BankTabButton = ({ tab, index, first, active, onSelect, onDropToTab }) => {
    const drop = useEntityDrop({
        id: `bank-tab-${tab.id}`,
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.ITEM,
        onDrop: p => onDropToTab(tab.id, p)
    });
    return (
        <button
            ref={drop.setNodeRef}
            onClick={() => onSelect(tab.id)}
            {...drop.droppableProps}
            title={first ? `Tab ${index + 1} — ${first.name}` : `Tab ${index + 1} (empty)`}
            className={cn(
                'w-10 h-10 rounded border flex items-center justify-center transition-colors shrink-0',
                active ? 'border-gi-primary bg-gi-primary/15' : 'border-gi-border bg-black/40 hover:border-gi-muted',
                drop.valid && 'ring-2 ring-gi-primary border-gi-primary'
            )}
        >
            {first
                ? <ItemIcon item={first} size={32} className="pointer-events-none" />
                : <span className="text-[10px] font-bold text-gi-muted">{index + 1}</span>}
        </button>
    );
};

/**
 * SellConfirmModal — bulk-sell modal with quantity sliders for each selected item.
 * Portaled to <body> so drawer transforms/stacking can't trap or cover it.
 */
const SellConfirmModal = ({ entries, onCancel, onConfirm }) => {
    const [quantities, setQuantities] = useState(() => {
        const initial = {};
        entries.forEach(e => {
            initial[e.id] = e.count;
        });
        return initial;
    });

    const setQty = (id, val, max) => {
        setQuantities(prev => ({
            ...prev,
            [id]: Math.max(1, Math.min(max, parseInt(val, 10) || 1))
        }));
    };

    const total = entries.reduce((sum, e) => {
        const qty = quantities[e.id] ?? e.count;
        return sum + CommerceSystem.getItemPrice(e.id) * qty;
    }, 0);

    const handleConfirm = () => {
        onConfirm(quantities);
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4" onClick={onCancel}>
            <div
                className="w-[48rem] max-w-[96vw] max-h-[85vh] rounded-xl border border-yellow-500/40 bg-[#12141d] shadow-2xl p-4 flex flex-col gap-3"
                onClick={e => e.stopPropagation()}
            >
                {/* Header: Title */}
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2 text-gi-text font-bold uppercase tracking-wider text-xs">
                        <Coins size={15} className="text-yellow-400" />
                        <span>Bulk Sell Items</span>
                        <span className="text-[10px] text-gi-muted font-normal">({entries.length} selected)</span>
                    </div>
                </div>

                {/* Items List with Quantity Sliders formatted in aligned grid columns */}
                <div className="max-h-[58vh] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                    {entries.map(e => {
                        const maxCount = e.count;
                        const currentQty = quantities[e.id] ?? maxCount;
                        const unitPrice = CommerceSystem.getItemPrice(e.id);
                        const itemTotal = unitPrice * currentQty;

                        return (
                            <div key={e.id} className="grid grid-cols-[1fr_180px_130px_110px] items-center gap-3 px-3.5 py-2 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                                {/* Item Identity */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <ItemIcon item={e.template} size={28} className="shrink-0" />
                                    <span className="text-xs font-bold text-gi-text truncate" title={e.template.name}>
                                        {e.template.name}
                                    </span>
                                </div>

                                {/* Slider */}
                                <div className="flex items-center">
                                    <input
                                        type="range"
                                        min="1"
                                        max={maxCount}
                                        value={currentQty}
                                        onChange={(ev) => setQty(e.id, ev.target.value, maxCount)}
                                        className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-gi-primary focus:outline-none"
                                    />
                                </div>

                                {/* Quantity Badge */}
                                <div className="flex items-center justify-center gap-1 font-mono text-xs tabular-nums font-bold text-gi-text bg-black/60 px-2 py-1 rounded border border-white/10 text-center select-none">
                                    <span>{currentQty.toLocaleString()}</span>
                                    <span className="text-[10px] text-gi-muted font-normal">/ {maxCount.toLocaleString()}</span>
                                </div>

                                {/* Gold Yield */}
                                <div className="flex items-center justify-end gap-1.5 text-xs md:text-sm font-bold text-yellow-300 font-mono tabular-nums text-right">
                                    <Coins size={12} className="text-yellow-400 shrink-0" />
                                    <span>{itemTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3.5 py-2 rounded-lg border border-gi-border/60 text-xs font-bold uppercase tracking-wider text-gi-muted hover:text-gi-text hover:border-gi-border transition-colors cursor-pointer active:scale-[0.99]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-yellow-500/60 bg-yellow-500/15 hover:bg-yellow-500/25 active:scale-[0.99] text-xs font-bold uppercase tracking-wider text-gi-text transition-all cursor-pointer shadow-sm"
                    >
                        <Coins size={14} className="text-yellow-400" />
                        <span>Sell for {total.toLocaleString()} gold</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

/** Item details + sell controls — rendered by the shared InspectionPanel. */
export const ItemInspection = ({ entry, engine, showSell = true, showViewInBank = false }) => {
    const { template, count } = entry;
    const value = template.baseValue || 1;

    const handleSell = (quantity) => {
        const result = CommerceSystem.sellItem(entry.id, quantity);
        if (!result.success) {
            engine?.EventBus?.publish?.('ui:notify', { message: result.error || 'Sale failed', type: 'error' });
        }
    };

    return (
        <div className="p-4 flex flex-col gap-4 text-xs text-gi-text">
            {/* Header: Centered 128px sprite, name, and type */}
            <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-32 h-32 mb-1">
                    <ItemIcon item={template} size={128} className="shrink-0" />
                </div>
                <h3 className="text-base md:text-lg font-bold text-gi-text mt-1 leading-tight select-text">
                    {template.name}
                </h3>
                <span className="text-xs text-gi-muted uppercase tracking-wider mt-1 select-text">
                    {template.type || 'item'}
                </span>

                {/* Tags underneath */}
                {template.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                        {template.tags.map(tag => (
                            <span 
                                key={tag} 
                                className="px-2 py-0.5 rounded border border-gi-border/50 text-[10px] font-medium text-gi-muted uppercase tracking-wider"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Description (Left-adjusted, not in quotes, if present) */}
            {template.description && (
                <div className="text-left py-1">
                    <p className="text-xs text-gi-text/85 leading-relaxed select-text font-medium">
                        {template.description.replace(/^["']|["']$/g, '')}
                    </p>
                </div>
            )}

            {/* Details Table */}
            {(template.equipSlot || template.toolType || template.restoreAmount > 0) && (
                <div className="flex flex-col gap-2 pt-1 border-t border-gi-border/30">
                    {template.equipSlot && (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#181412] border border-white/10 text-xs">
                            <span className="text-gi-muted">Equips as</span>
                            <span className="font-bold text-gi-text capitalize">{template.equipSlot}</span>
                        </div>
                    )}
                    {template.toolType && (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#181412] border border-white/10 text-xs">
                            <span className="text-gi-muted">Tool type</span>
                            <span className="font-bold text-gi-text capitalize">{template.toolType}</span>
                        </div>
                    )}
                    {template.restoreAmount > 0 && (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#181412] border border-white/10 text-xs">
                            <span className="text-gi-muted">Restores</span>
                            <span className="font-bold text-gi-text">
                                +{template.restoreAmount} {template.tags?.includes('drink') ? 'Energy' : 'HP'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Split Bank and Value badges if SellControls is not shown */}
            {(!showSell || count === 0) && (
                <div className="flex items-center gap-2 text-xs pt-1">
                    <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                        <span className="text-gi-muted">Bank</span>
                        <span className="font-bold text-gi-text tabular-nums">{count.toLocaleString()}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                        <span className="text-gi-muted">Value</span>
                        <span className="font-bold text-gi-gold tabular-nums">{value.toLocaleString()}</span>
                    </div>
                </div>
            )}

            {/* View in Bank action */}
            {showViewInBank && count > 0 && (
                <div className="pt-2 border-t border-gi-border/40">
                    <button
                        onClick={() => EventBus.publish('ui:open_drawer', { tab: 'bank' })}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border font-bold text-xs md:text-sm uppercase tracking-wide transition-colors border-gi-primary/60 bg-gi-primary/15 text-gi-text hover:bg-gi-primary/25 cursor-pointer active:scale-[0.99]"
                    >
                        <Landmark size={14} className="text-gi-primary" /> View in Item Bank
                    </button>
                </div>
            )}

            {/* Sell controls — shared SellControls component */}
            {showSell && count > 0 && (
                <SellControls
                    title="Sell Items"
                    count={count}
                    unitPrice={value}
                    onSell={handleSell}
                    entityName="Item"
                    topContent={
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                                <span className="text-gi-muted">Bank</span>
                                <span className="font-bold text-gi-text tabular-nums">{count.toLocaleString()}</span>
                            </div>
                            <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                                <span className="text-gi-muted">Value</span>
                                <span className="font-bold text-gi-gold tabular-nums">{value.toLocaleString()}</span>
                            </div>
                        </div>
                    }
                />
            )}
        </div>
    );
};

export default BankTab;
