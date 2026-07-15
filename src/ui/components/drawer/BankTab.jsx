import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { CommerceSystem } from '../../../systems/economy/CommerceSystem.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { beginNativeDrag, endNativeDrag, getNativeDrag, readDropPayload } from '../../dnd/nativeDrag.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { formatCompact } from '../../../utils/Formatters.js';
import { Search, Coins, Landmark, X, Lock, Check, AlertTriangle, BoxSelect } from 'lucide-react';

/** Hard cap on bank tabs: 5 free + 15 via Guild Hall (owner design 2026-07-14). */
const BANK_TAB_CAP = 20;

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
export const BankTab = ({ filter, selectedItemId, onInspect }) => {
    const [activeTabId, setActiveTabId] = useState(null);
    const [typeFilter, setTypeFilter] = useState(null); // transient, from auto-open (§12.B)
    const [searchTerm, setSearchTerm] = useState('');
    const [dragOverItemId, setDragOverItemId] = useState(null);
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

    const searching = searchTerm.trim().length > 0;
    const visible = useMemo(() => {
        let list = searching
            ? stocked.filter(e => {
                const term = searchTerm.toLowerCase();
                return e.template.name.toLowerCase().includes(term)
                    || e.template.tags?.some(tag => tag.toLowerCase().includes(term));
            })
            : (tabItems[currentTabId] || []);
        if (typeFilter) list = list.filter(e => e.template.type === typeFilter);
        return list;
    }, [searching, searchTerm, stocked, tabItems, currentTabId, typeFilter]);

    // Manual sorting is only meaningful on the plain tab view.
    const canReorder = !searching && !typeFilter;

    /** Drop on a tile: reorder within this tab, or file + position from another tab. */
    const handleTileDrop = (e, targetId) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverItemId(null);
        const payload = readDropPayload(e);
        if (payload?.kind !== 'item' || payload.itemId === targetId || !canReorder) return;
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

    /** Drop on empty space: append to this tab. */
    const handleListDrop = (e) => {
        e.preventDefault();
        const payload = readDropPayload(e);
        if (payload?.kind !== 'item' || !canReorder) return;
        const ids = (tabItems[currentTabId] || []).map(x => x.id).filter(id => id !== payload.itemId);
        if (homeOf(payload.itemId) !== currentTabId) {
            InventoryManager.moveItemToGroup(payload.itemId, currentTabId);
        } else {
            InventoryManager.setGroupOrder(currentTabId, [...ids, payload.itemId]);
        }
    };

    /** Drop on a tab: file the dragged stack — or the whole selection — there. */
    const handleTabDrop = (tabId, e) => {
        e.preventDefault();
        const payload = readDropPayload(e);
        if (payload?.kind !== 'item') return;
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

    const confirmSell = () => {
        selectedEntries.forEach(e => CommerceSystem.sellItem(e.id, e.count));
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
                <div className="flex items-center gap-2 bg-gi-base border border-gi-border rounded px-2 py-1 ml-auto">
                    <Search size={12} className="text-gi-muted shrink-0" />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search all tabs…"
                        className="bg-transparent outline-none text-xs text-gi-text w-36"
                    />
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-gi-gold tabular-nums">
                    <Coins size={12} /> {formatCompact(gold, 2)}
                </span>
                <span
                    title="Item stacks in the bank / slot capacity (upgradeable later)"
                    className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums',
                        stocked.length >= bank.maxSlots ? 'text-gi-danger border-gi-danger/40 bg-gi-danger/10' : 'text-gi-muted border-gi-border'
                    )}
                >
                    {stocked.length}/{bank.maxSlots}
                </span>
            </div>

            {/* Compact reorderable list */}
            <div
                className="flex-1 overflow-y-auto custom-scrollbar p-3"
                onDragOver={e => { if (getNativeDrag()?.kind === 'item' && canReorder) e.preventDefault(); }}
                onDrop={handleListDrop}
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
                                dragOver={canReorder && dragOverItemId === entry.id}
                                onDragOverTile={e => {
                                    if (getNativeDrag()?.kind === 'item' && canReorder) {
                                        e.preventDefault();
                                        setDragOverItemId(entry.id);
                                    }
                                }}
                                onDragLeaveTile={() => setDragOverItemId(d => (d === entry.id ? null : d))}
                                onDropTile={e => handleTileDrop(e, entry.id)}
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
            </div>

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
const ItemTile = ({ entry, selected, onSelect, checked = false, selectMode = false, selectionIds = null, dragOver, onDragOverTile, onDragLeaveTile, onDropTile }) => {
    const { template, count } = entry;
    return (
        <button
            onClick={onSelect}
            draggable
            onDragStart={e => beginNativeDrag(e, {
                kind: 'item',
                itemId: entry.id,
                ...(selectMode && checked && selectionIds?.size > 1
                    ? { selection: [...selectionIds] }
                    : {})
            })}
            onDragEnd={endNativeDrag}
            onDragOver={onDragOverTile}
            onDragLeave={onDragLeaveTile}
            onDrop={onDropTile}
            title={selectMode
                ? `${template.name} ×${count} — click to ${checked ? 'deselect' : 'select'}`
                : `${template.name} ×${count} — drag to sort, or onto a hero to equip`}
            className={cn(
                'relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing text-center min-w-0 min-h-0 aspect-square',
                selected && !selectMode ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border bg-gi-base/60 hover:border-gi-muted',
                checked && 'border-gi-primary bg-gi-primary/15 ring-1 ring-gi-primary/60',
                dragOver && 'ring-2 ring-gi-primary border-gi-primary'
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
    const [dragOverId, setDragOverId] = useState(null);
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {tabs.map((tab, i) => {
                const first = firstItemByTab[tab.id];
                const active = tab.id === activeId;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onSelect(tab.id)}
                        onDragOver={e => {
                            if (getNativeDrag()?.kind === 'item') {
                                e.preventDefault();
                                setDragOverId(tab.id);
                            }
                        }}
                        onDragLeave={() => setDragOverId(d => (d === tab.id ? null : d))}
                        onDrop={e => { setDragOverId(null); onDropToTab(tab.id, e); }}
                        title={first ? `Tab ${i + 1} — ${first.name}` : `Tab ${i + 1} (empty)`}
                        className={cn(
                            'w-10 h-10 rounded border flex items-center justify-center transition-colors shrink-0',
                            active ? 'border-gi-primary bg-gi-primary/15' : 'border-gi-border bg-black/40 hover:border-gi-muted',
                            dragOverId === tab.id && 'ring-2 ring-gi-primary border-gi-primary'
                        )}
                    >
                        {first
                            ? <ItemIcon item={first} size={32} className="pointer-events-none" />
                            : <span className="text-[10px] font-bold text-gi-muted">{i + 1}</span>}
                    </button>
                );
            })}
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

/**
 * SellConfirmModal — bulk-sell warning (owner design 2026-07-14): lists every
 * stack about to be sold with its gold value; nothing is sold until confirmed.
 * Portaled to <body> so drawer transforms/stacking can't trap or cover it.
 */
const SellConfirmModal = ({ entries, onCancel, onConfirm }) => {
    const total = entries.reduce((sum, e) => sum + CommerceSystem.getItemPrice(e.id) * e.count, 0);
    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70" onClick={onCancel}>
            <div
                className="w-[26rem] max-w-[90vw] rounded-xl border border-gi-danger/60 bg-[#12141d] shadow-2xl p-4 flex flex-col gap-3"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 text-gi-danger font-bold uppercase tracking-widest text-xs">
                    <AlertTriangle size={14} /> Sell {entries.length} item stack{entries.length === 1 ? '' : 's'}?
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    {entries.map(e => (
                        <div key={e.id} className="flex items-center gap-2 px-2 py-1 rounded bg-black/40 border border-white/5">
                            <ItemIcon item={e.template} size={24} className="shrink-0" />
                            <span className="text-xs text-gi-text flex-1 truncate">{e.template.name}</span>
                            <span className="text-[10px] text-gi-muted tabular-nums">×{e.count}</span>
                            <span className="text-[10px] text-gi-gold tabular-nums flex items-center gap-1 w-16 justify-end">
                                <Coins size={9} /> {(CommerceSystem.getItemPrice(e.id) * e.count).toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] text-gi-muted">Entire stacks are sold. This can't be undone.</span>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 rounded border border-gi-border text-[11px] font-bold uppercase text-gi-muted hover:text-gi-text transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-3 py-1.5 rounded border border-gi-gold/60 bg-gi-gold/15 text-[11px] font-bold uppercase text-gi-text hover:bg-gi-gold/25 transition-colors flex items-center gap-1.5"
                        >
                            <Coins size={11} className="text-gi-gold" /> Sell for {total.toLocaleString()}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

/** Item details + sell controls — rendered by the shared InspectionPanel. */
export const ItemInspection = ({ entry, engine }) => {
    const { template, count } = entry;
    const [sellQty, setSellQty] = useState(1);

    useEffect(() => { setSellQty(1); }, [entry.id]);

    const value = template.baseValue || 1;
    const clampedQty = Math.max(1, Math.min(count, Math.floor(sellQty) || 1));

    const handleSell = (quantity) => {
        const result = CommerceSystem.sellItem(entry.id, quantity);
        if (!result.success) {
            engine.EventBus.publish('ui:notify', { message: result.error || 'Sale failed', type: 'error' });
        }
    };

    return (
        <div className="p-5 flex flex-col gap-5">
            {/* Header: Centered 128px sprite, name, and type */}
            <div className="flex flex-col items-center text-center">
                <ItemIcon item={template} size={128} className="shrink-0" />
                <h3 className="text-base md:text-lg font-bold text-gi-text mt-3 leading-tight select-text">
                    {template.name}
                </h3>
                <span className="text-xs md:text-sm text-gi-muted uppercase tracking-wider mt-1 select-text">
                    {template.type || 'item'}
                </span>
            </div>

            {/* Details Table */}
            <div className="flex flex-col gap-2 pt-1">
                <DetailLine label="In bank" value={count.toLocaleString()} />
                <DetailLine label="Sell value" value={`${value} gold`} />
                {template.equipSlot && <DetailLine label="Equips as" value={template.equipSlot} />}
                {template.toolType && <DetailLine label="Tool type" value={template.toolType} />}
                {template.restoreAmount > 0 && (
                    <DetailLine 
                        label="Restores" 
                        value={`${template.restoreAmount} ${template.tags?.includes('drink') ? 'Energy' : 'HP'}`} 
                    />
                )}
            </div>

            {/* Tags */}
            {template.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                    {template.tags.map(tag => (
                        <span 
                            key={tag} 
                            className="px-2 py-0.5 rounded border border-gi-border/50 text-[10px] font-medium text-gi-muted uppercase"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Description */}
            {template.description && (
                <p className="text-xs md:text-sm text-gi-text/80 leading-relaxed text-center italic select-text gi-description">
                    "{template.description}"
                </p>
            )}

            {/* Sell controls */}
            <div className="flex flex-col gap-2 pt-3 border-t border-gi-border/40">
                <span className="text-xs font-bold text-gi-muted uppercase tracking-wider">Sell Items</span>
                <div className="flex items-center gap-2">
                    <input
                        type="number" 
                        min="1" 
                        max={count} 
                        value={sellQty}
                        onChange={e => setSellQty(e.target.value)}
                        className="w-16 bg-black/40 border border-gi-border rounded px-2.5 py-1.5 text-xs md:text-sm text-gi-text outline-none font-mono"
                    />
                    <button
                        onClick={() => handleSell(clampedQty)}
                        className="flex-1 px-3 py-1.5 rounded border border-gi-gold/50 bg-gi-gold/10 text-xs md:text-sm font-bold uppercase text-gi-text hover:bg-gi-gold/20 transition-colors"
                    >
                        Sell ({clampedQty * value}g)
                    </button>
                    <button
                        onClick={() => handleSell(count)}
                        className="px-3 py-1.5 rounded border border-gi-border text-xs md:text-sm font-bold uppercase text-gi-muted hover:text-gi-text transition-colors"
                    >
                        All
                    </button>
                </div>
            </div>
        </div>
    );
};

const DetailLine = ({ label, value }) => (
    <div className="flex items-center justify-between gap-2 text-xs md:text-sm">
        <span className="text-gi-muted">{label}</span>
        <span className="text-gi-text font-bold capitalize tabular-nums">{value}</span>
    </div>
);

export default BankTab;
