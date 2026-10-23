import { memo, useMemo, useState } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import * as EquipmentManager from '../../../systems/equipment/EquipmentManager.js';
import { unequipOrAnnounce } from '../dock/dockEquip.js';
import { useEntityDrag, useEntityDrop, DropTarget, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { formatCompact } from '../../../utils/Formatters.js';
import { matCap } from '../../../systems/board/MatCap.js';
import { isMapItem, whatItWrites, MAP_TEXT } from '../../../systems/atlas/mapItems.js';
import { Landmark, Lock, Check, BoxSelect } from 'lucide-react';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/** Hard cap on bank tabs: 1 free + 15 via Guild Hall (max total 16). */
const BANK_TAB_CAP = 16;

/**
 * Bank pane: the guild bank as user-sortable tabs of compact reorderable item lists. Tabs
 * start at 1 and unlock via Guild Hall; lists pack compact with no slot grid; stack size,
 * total slots and tab count are three separate upgrade stats.
 * Tabs reuse the inventory group system (groupOrder/groupDefs/itemOverrides, persisted). An
 * item with no override lives in the FIRST tab. Drag a tile onto a tile to reorder, onto a tab
 * to file it there, onto a hero to equip (payload kind 'item'). Search matches ALL tabs. Item
 * details live in the shared InspectionPanel.
 */
export const BankTab = ({ selectedItemId, onInspect, searchQuery = '' }) => {
    const [activeTabId, setActiveTabId] = useState(null);
    // Select mode: multi-select stacks to drag-move between tabs.
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());

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
        [ENGINE_EVENTS.INVENTORY_UPDATED]
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

    const activeSearch = (searchQuery || '').trim();
    const searching = activeSearch.length > 0;
    const visible = useMemo(() => {
        let list = searching
            ? stocked.filter(e => {
                const term = activeSearch.toLowerCase();
                return e.template.name.toLowerCase().includes(term)
                    || e.template.tags?.some(tag => tag.toLowerCase().includes(term));
            })
            : (tabItems[currentTabId] || []);
        return list;
    }, [searching, activeSearch, stocked, tabItems, currentTabId]);

    // Manual sorting is only meaningful on the plain tab view.
    const canReorder = !searching;

    /** Drop on a tile: reorder within this tab, unequip hero item, or file + position from another tab. */
    const handleTileDrop = (payload, targetId) => {
        if (payload?.kind !== 'item') return;
        if (payload.fromHeroId != null && payload.fromSlot != null) {
            return unequipOrAnnounce(EquipmentManager, payload.fromHeroId, payload.fromSlot);
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
            return unequipOrAnnounce(EquipmentManager, payload.fromHeroId, payload.fromSlot);
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
            return unequipOrAnnounce(EquipmentManager, payload.fromHeroId, payload.fromSlot);
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
    };

    // Live entries for the current selection (stale ids drop out naturally).
    const selectedEntries = useMemo(
        () => stocked.filter(e => selectedIds.has(e.id)),
        [stocked, selectedIds]
    );

    return (
        <div className="h-full min-h-0 flex flex-row">
            <div className="flex-1 flex flex-col min-w-0">
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gi-border/40 bg-gi-base/30 flex-wrap">
                <BankTabStrip
                    tabs={tabs}
                    activeId={currentTabId}
                    onSelect={setActiveTabId}
                    firstItemByTab={Object.fromEntries(bank.groupOrder.map(gid => [gid, tabItems[gid]?.[0]?.template || null]))}
                    onDropToTab={handleTabDrop}
                />
                <Tooltip lines={[selectMode ? 'Exit select mode' : 'Select multiple items to move']}>
                <button
                    onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                    className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded border text-(length:--font-size-xs) font-bold uppercase tracking-wide transition-colors',
                        selectMode
                            ? 'border-gi-primary bg-gi-primary/15 text-gi-text'
                            : 'border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-muted'
                    )}
                >
                    <BoxSelect size={11} /> {selectMode ? 'Done' : 'Select'}
                </button>
                </Tooltip>
                {/**
                 * No Sell button: nothing sells to the merchant. Select mode only moves
                 * stacks.
                 */}
                {selectMode && (
                    <span className="text-(length:--font-size-xs) text-gi-muted tabular-nums">{selectedEntries.length} selected</span>
                )}
                <Tooltip lines={['Item stacks in the bank / slot capacity']}>
                <span
                    className={cn(
                        'text-(length:--font-size-xs) font-bold px-1.5 py-0.5 rounded border tabular-nums ml-auto',
                        stocked.length >= bank.maxSlots ? 'text-gi-danger border-gi-danger/40 bg-gi-danger/10' : 'text-gi-muted border-gi-border'
                    )}
                >
                    {stocked.length}/{bank.maxSlots}
                </span>
                </Tooltip>
            </div>

            {/**
             * No Upkeep toggle: the Upkeep Summary lives on the mat's top bar, so the Bank
             * shows its items only.
             */}
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
                    <div className="mb-2 text-(length:--font-size-xs) text-gi-muted italic">Searching all tabs — sorting is paused.</div>
                )}
                {selectMode && (
                    <div className="mb-2 text-(length:--font-size-xs) text-gi-muted italic">
                        Click items to select them — drag any selected item onto a tab to move them all.
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
                            <span className="text-(length:--font-size-xs) normal-case">Drag items onto this tab to file them here.</span>
                        )}
                    </div>
                )}
            </DropTarget>

            </div>
        </div>
    );
};

/** One banked item — a native drag source (kind 'item') and a reorder drop target.
 *  In select mode a checked tile drags the WHOLE selection (payload.selection). */
const ItemTile = ({ entry, selected, onSelect, checked = false, selectMode = false, selectionIds = null, canReorder = false, onReorderDrop }) => {
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
    const nodeRef = useMemo(() => mergeRefs(drag.setNodeRef, drop.setNodeRef), [drag.setNodeRef, drop.setNodeRef]);
    return (
        <ItemTileBody
            entry={entry}
            selected={selected}
            onSelect={onSelect}
            checked={checked}
            selectMode={selectMode}
            cue={drop.valid}
            held={drag.isDragging}
            nodeRef={nodeRef}
            handleProps={drag.handleProps}
            droppableProps={drop.droppableProps}
        />
    );
};

// ⚠️ Apart from its drag hooks on purpose: dnd-kit redraws their holder at every drag start, end
// and change of target; the tile is memoised on what it draws.
const ItemTileBody = memo(function ItemTileBody({ entry, selected, onSelect, checked, selectMode, cue, held, nodeRef, handleProps, droppableProps }) {
    const { template, count } = entry;
    return (
        <Tooltip
            title={template.name}
            lines={[
                `×${count.toLocaleString('en-US')}`,
                selectMode ? `Click to ${checked ? 'deselect' : 'select'}` : 'Drag to sort, or onto a hero to equip'
            ]}
        >
        <button
            ref={nodeRef}
            data-bank-item={template.id}
            onClick={onSelect}
            {...handleProps}
            {...droppableProps}
            className={cn(
                'relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing text-center min-w-0 min-h-0 aspect-square',
                selected && !selectMode ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border bg-gi-base/60 hover:border-gi-muted',
                checked && 'border-gi-primary bg-gi-primary/15 ring-1 ring-gi-primary/60',
                cue && 'ring-2 ring-gi-primary border-gi-primary',
                held && 'opacity-40'
            )}
        >
            {checked && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded bg-gi-primary text-black flex items-center justify-center">
                    <Check size={11} strokeWidth={3} />
                </span>
            )}
            <ItemIcon item={template} size={64} className="shrink-0" title={null} />
            <span className="text-xs md:leading-[calc(1.25/0.875)] font-bold text-gi-text mt-1.5 tabular-nums">
                {formatCompact(count, 1)}
            </span>
        </button>
        </Tooltip>
    );
});

/**
 * BankTabStrip: the fixed, system-owned bank tabs. Always BANK_TAB_CAP slots; unlocked tabs
 * show the 32px sprite of their first item (or the slot number when empty), locked slots
 * render greyed with a lock. No player create/rename/delete. Tabs accept item drops (single
 * stack or a whole select-mode selection).
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
                <Tooltip key={`locked-${i}`} lines={['Locked — unlock more tabs via Guild Hall upgrades']}>
                    <div className="w-10 h-10 rounded border border-gi-border/30 bg-black/20 flex items-center justify-center text-gi-muted/30 shrink-0">
                        <Lock size={12} />
                    </div>
                </Tooltip>
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
        <BankTabButtonBody
            tab={tab}
            index={index}
            first={first}
            active={active}
            onSelect={onSelect}
            cue={drop.valid}
            dropRef={drop.setNodeRef}
            droppableProps={drop.droppableProps}
        />
    );
};

// ⚠️ Apart from its drop hook on purpose: dnd-kit redraws the hook's holder at every drag start,
// end and change of target; the tab is memoised on what it draws.
const BankTabButtonBody = memo(function BankTabButtonBody({ tab, index, first, active, onSelect, cue, dropRef, droppableProps }) {
    return (
        <button
            ref={dropRef}
            onClick={() => onSelect(tab.id)}
            {...droppableProps}
            title={first ? `Tab ${index + 1} — ${first.name}` : `Tab ${index + 1} (empty)`}
            className={cn(
                'w-10 h-10 rounded border flex items-center justify-center transition-colors shrink-0',
                active ? 'border-gi-primary bg-gi-primary/15' : 'border-gi-border bg-black/40 hover:border-gi-muted',
                cue && 'ring-2 ring-gi-primary border-gi-primary'
            )}
        >
            {first
                ? <ItemIcon item={first} size={32} className="pointer-events-none" />
                : <span className="text-(length:--font-size-xs) font-bold text-gi-muted">{index + 1}</span>}
        </button>
    );
});

/**
 * Item details, rendered by the shared InspectionPanel. Nothing sells, so there are no sell
 * controls.
 */
export const ItemInspection = ({ entry }) => {
    const { template, count } = entry;
    const writes = isMapItem(template) ? whatItWrites(template, { cap: matCap() }) : null;
    return (
        <div className="p-4 flex flex-col gap-4 text-xs text-gi-text">
            <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-32 h-32 mb-1">
                    <ItemIcon item={template} size={128} className="shrink-0" />
                </div>
                <h3 className="text-base md:leading-[calc(1.75/1.125)] font-bold text-gi-text mt-1 leading-tight select-text">
                    {template.name}
                </h3>
                <span className="text-xs text-gi-muted uppercase tracking-wider mt-1 select-text">
                    {MAP_TEXT.typeLabel[template.type] || template.type || 'item'}
                </span>

                {template.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                        {template.tags.map(tag => (
                            <span 
                                key={tag} 
                                className="px-2 py-0.5 rounded border border-gi-border/50 text-(length:--font-size-xs) font-medium text-gi-muted uppercase tracking-wider"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {template.description && (
                <div className="text-left py-1">
                    <p className="text-xs text-gi-text/85 leading-relaxed select-text font-medium">
                        {template.description.replace(/^["']|["']$/g, '')}
                    </p>
                </div>
            )}

            {writes && (
                <div data-map-writes className="flex flex-col gap-2 pt-1 border-t border-gi-border/30">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-(length:--font-size-xs) font-bold uppercase tracking-wider text-gi-muted">{MAP_TEXT.whatItWrites}</span>
                        <span className="text-xs font-bold text-gi-text text-right">{writes.headline}</span>
                    </div>
                    <ul className="flex flex-col gap-1">
                        {writes.lines.map((line, i) => (
                            <li
                                key={`${line.role}-${line.typeId}-${i}`}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181412] border border-white/10 text-xs"
                            >
                                <ItemIcon item={line.typeId} size={16} className="shrink-0" />
                                <span className="font-medium text-gi-text tabular-nums">{line.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

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
                                +{template.restoreAmount} HP
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Bank count only: nothing sells, so an item has no Value to show. */}
            <div className="flex items-center gap-2 text-xs pt-1">
                <div className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#181412] border border-white/10">
                    <span className="text-gi-muted">Bank</span>
                    <span className="font-bold text-gi-text tabular-nums">{count.toLocaleString()}</span>
                </div>
            </div>

        </div>
    );
};

export default BankTab;
