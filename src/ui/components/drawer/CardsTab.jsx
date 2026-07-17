import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { DEPLOYMENT_FILTERS, buildCardCatalog, buildProductionData } from '../../modals/library/binderCatalog.js';
import { DeploymentPanel } from '../../modals/library/DeploymentPanel.jsx';
import { LibraryCardPreviewGutter } from '../../modals/library/LibraryCardPreviewGutter.jsx';
import { getCard } from '../../../config/registries/cardRegistry.js';
import CardFactory from '../../../systems/cards/logic/CardFactory.js';
import ActiveCardFace from '../ActiveCardFace.jsx';
import { BinderTabManager } from '../../../systems/progression/BinderTabManager.js';
import { DeckSlotManager } from '../../../systems/loop/DeckSlotManager.js';
import { StationSlotManager } from '../../../systems/loop/StationSlotManager.js';
import { useEntityDrag, useEntityDrop, DropTarget, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { TabStrip } from './TabStrip.jsx';
import { Search, X } from 'lucide-react';

/**
 * Cards pane (overhaul Phase 3, spec §COMP-CARD) — the card collection as
 * user-sortable tabs of half-size REAL card faces (`ActiveCardFace` at the
 * sm/128 tier — same shape as the playmat rows, per spec). The tab system
 * is deliberately identical to the Bank's (owner decision 2026-07-11):
 * renamable tabs (double-click), gated "+" (Guild Hall upgrade), drag a
 * card onto a card to reorder, onto a tab to file it, onto an area's deck
 * slot to deploy (payload kind 'card' unchanged). Search matches all tabs.
 *
 * Card details + the Deployment Map live in the shared InspectionPanel
 * (`CardInspection` exported below).
 */
export const CardsTab = ({ filter, selectedTemplateId, onInspect }) => {
    const [activeTabId, setActiveTabId] = useState(null);
    const [typeFilter, setTypeFilter] = useState(null); // transient, from auto-open (§12.B)
    const [deployFilter, setDeployFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Auto-open payloads (§12.B): pre-apply the slot's requirements.
    useEffect(() => {
        if (!filter) return;
        setTypeFilter(filter.cardType || null);
        setDeployFilter(filter.deployFilter || 'available');
        setSearchTerm('');
    }, [filter]);

    // deepClone matters: collection is mutated in place (playsets counts,
    // binder tabs), so anything short of a full snapshot makes the
    // staleness check pass and the tab never updates (Phase 7 lesson).
    const collection = useGameState(state => state.collection || {}, ['collection_updated', 'registry_updated'], null, { deepClone: true });
    const deploySig = useGameState(
        state => Object.entries(state.areaStates || {})
            .map(([id, a]) => `${id}:${(a.deckSlots || []).map(s => s.templateId || '_').join(',')}:${a.stationState?.activeStationCardId || ''}`)
            .join('|'),
        ['area:deck_updated', 'area:station_changed']
    );
    const playsets = collection.playsets || {};
    const unlockedAreaIds = collection.unlockedAreaSets || [];
    const binder = collection.binder || { tabOrder: ['binder-main'], tabDefs: { 'binder-main': { id: 'binder-main', title: 'Binder', orderedCards: [] } }, cardOverrides: {}, maxTabs: 1 };

    const catalog = useMemo(
        () => buildCardCatalog(playsets, unlockedAreaIds),
        // deploySig: allocations (slotted/available) shift with every deployment
        [playsets, unlockedAreaIds, collection, deploySig]
    );

    const homeOf = (templateId) => {
        const target = binder.cardOverrides?.[templateId];
        return (target && binder.tabOrder.includes(target)) ? target : binder.tabOrder[0];
    };

    // Per-tab visual order: manually ordered ids first, then the rest.
    const tabCards = useMemo(() => {
        const map = Object.fromEntries(binder.tabOrder.map(id => [id, []]));
        const byId = Object.fromEntries(catalog.map(e => [e.id, e]));
        const placed = new Set();
        binder.tabOrder.forEach(tid => {
            (binder.tabDefs[tid]?.orderedCards || []).forEach(cardId => {
                if (byId[cardId] && homeOf(cardId) === tid) {
                    map[tid].push(byId[cardId]);
                    placed.add(cardId);
                }
            });
        });
        catalog.forEach(e => {
            if (!placed.has(e.id)) map[homeOf(e.id)]?.push(e);
        });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalog, binder]);

    const tabs = binder.tabOrder.map(id => ({ id, title: binder.tabDefs[id]?.title || 'Tab' }));
    const currentTabId = binder.tabOrder.includes(activeTabId) ? activeTabId : binder.tabOrder[0];

    const searching = searchTerm.trim().length > 0;
    const visible = useMemo(() => {
        let list = searching
            ? catalog.filter(e => e.template.name.toLowerCase().includes(searchTerm.toLowerCase()))
            : (tabCards[currentTabId] || []);
        if (typeFilter) list = list.filter(e => e.template.cardType === typeFilter);
        if (deployFilter === 'available') list = list.filter(e => e.owned > 0 && e.alloc.available > 0);
        if (deployFilter === 'deployed') list = list.filter(e => e.owned > 0 && e.alloc.available === 0);
        return list;
    }, [searching, searchTerm, catalog, tabCards, currentTabId, typeFilter, deployFilter]);

    const canReorder = !searching && !typeFilter && deployFilter === 'all';

    // A card dragged out of a board deck slot (carries `from`) is reclaimed to
    // the collection — dropping it anywhere in the Cards pane unslots it.
    const reclaimFromBoard = (payload) => {
        if (!payload?.from) return false;
        if (payload.from.station) StationSlotManager.unslotStation(payload.from.areaId);
        else DeckSlotManager.unslotCard(payload.from.areaId, payload.from.slotIndex);
        return true;
    };

    // Drop a card tile onto another tile: reorder within this tab, or file it
    // here from another tab and position it at the target.
    const handleTileDrop = (payload, targetId) => {
        if (payload?.kind !== 'card') return;
        if (reclaimFromBoard(payload)) return;
        if (payload.templateId === targetId || !canReorder) return;
        const ids = (tabCards[currentTabId] || []).map(x => x.id);
        const targetIndex = ids.indexOf(targetId);
        if (homeOf(payload.templateId) !== currentTabId) {
            BinderTabManager.moveCardToTab(payload.templateId, currentTabId, targetIndex);
        } else {
            const next = ids.filter(id => id !== payload.templateId);
            next.splice(next.indexOf(targetId), 0, payload.templateId);
            BinderTabManager.setTabOrder(currentTabId, next);
        }
    };

    // Drop on the list's empty space: reclaim a board card, else append here.
    const handleListDrop = (payload) => {
        if (payload?.kind !== 'card') return;
        if (reclaimFromBoard(payload)) return;
        if (!canReorder) return;
        if (homeOf(payload.templateId) !== currentTabId) {
            BinderTabManager.moveCardToTab(payload.templateId, currentTabId);
        } else {
            const ids = (tabCards[currentTabId] || []).map(x => x.id).filter(id => id !== payload.templateId);
            BinderTabManager.setTabOrder(currentTabId, [...ids, payload.templateId]);
        }
    };

    return (
        <div className="h-full min-h-0 flex flex-col">
            {/* Header: tabs + filters + search (§12.A) */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gi-border/40 bg-gi-base/30 flex-wrap">
                <TabStrip
                    tabs={tabs}
                    activeId={currentTabId}
                    onSelect={setActiveTabId}
                    onRename={(id, name) => BinderTabManager.renameTab(id, name)}
                    onCreate={name => {
                        const id = BinderTabManager.createTab(name);
                        if (id) setActiveTabId(id);
                    }}
                    canCreate={binder.tabOrder.length < (binder.maxTabs ?? 1)}
                    dropKind="card"
                    onDropToTab={(tabId, payload) => BinderTabManager.moveCardToTab(payload.templateId, tabId)}
                />
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
                <label className="flex items-center gap-1.5 text-[9px] font-bold text-gi-muted gi-caps tracking-wide">
                    Show
                    <select
                        value={deployFilter}
                        onChange={e => setDeployFilter(e.target.value)}
                        className="bg-gi-base border border-gi-border rounded px-1.5 py-1 text-[10px] text-gi-text outline-none"
                    >
                        {DEPLOYMENT_FILTERS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                </label>
            </div>

            {/* Half-size card grid — the list is the "append here" drop target;
                individual tiles are reorder targets nested inside it. */}
            <DropTarget
                id={`card-list-${currentTabId}`}
                surface={DND_SURFACE.DRAWER}
                accepts={p => p.kind === DRAG_KIND.CARD && (p.from || canReorder)}
                onDrop={handleListDrop}
                acceptClassName=""
                rejectClassName=""
                className="flex-1 overflow-y-auto custom-scrollbar p-3"
            >
                {searching && (
                    <div className="mb-2 text-[9px] text-gi-muted italic">Searching all tabs — sorting is paused.</div>
                )}
                {visible.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5">
                        {visible.map(entry => (
                            <BinderMiniCard
                                key={entry.id}
                                entry={entry}
                                isSelected={selectedTemplateId === entry.id}
                                onSelect={() => onInspect('card', entry.id)}
                                canReorder={canReorder}
                                onReorderDrop={handleTileDrop}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/40">
                        <Search size={32} />
                        <span className="text-xs uppercase tracking-widest font-bold">No cards here</span>
                    </div>
                )}
            </DropTarget>
        </div>
    );
};

/**
 * One binder card: the REAL card face at the sm/128 tier (spec: half-size,
 * same shape as the playmat rows) with an ownership strip beneath —
 * pips (owned/4) + deployed state. Drag source (kind 'card') for deck
 * slots AND for manual sorting; a tile is also a reorder drop target.
 */
const BinderMiniCard = ({ entry, isSelected, onSelect, canReorder, onReorderDrop }) => {
    const { template, owned, alloc } = entry;
    // Same mock-instance trick as the banner's RowTemplateCard: a real card
    // face needs an instance; preview instances are cheap and memoized.
    const mock = useMemo(() => {
        const inst = CardFactory.createInstance(entry.id, {});
        if (inst) { inst.id = `binder-${entry.id}`; inst.status = 'idle'; }
        return inst;
    }, [entry.id]);

    const fullyDeployed = owned > 0 && alloc.available === 0;

    // Drag source (deploy onto a deck/station slot, or reorder) AND a reorder
    // drop target for other card tiles — hence both hooks on one node.
    const drag = useEntityDrag({
        id: `card-src-${entry.id}`,
        kind: DRAG_KIND.CARD,
        payload: { templateId: entry.id, cardType: template.cardType },
        sourceSurface: DND_SURFACE.DRAWER
    });
    const drop = useEntityDrop({
        id: `card-tile-${entry.id}`,
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.CARD && (p.from || (canReorder && p.templateId !== entry.id)),
        onDrop: p => onReorderDrop(p, entry.id)
    });

    return (
        <div
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            onClick={onSelect}
            {...drag.handleProps}
            {...drop.droppableProps}
            title={`${template.name} — drag to sort, or onto an area's deck to slot it`}
            className={cn(
                'flex flex-col items-center gap-1 rounded-lg p-1 cursor-grab active:cursor-grabbing transition-all',
                isSelected && 'ring-2 ring-gi-primary bg-gi-primary/10',
                drop.valid && 'ring-2 ring-gi-primary',
                drag.isDragging && 'opacity-40',
                owned === 0 && 'opacity-50 grayscale'
            )}
        >
            {mock ? (
                <ActiveCardFace cardId={mock.id} cardState={mock} template={template} showActions={false} size="sm" width={100} />
            ) : (
                <div className="w-[100px] h-[128px] rounded border border-gi-border bg-gi-base" />
            )}
            {/* Ownership strip */}
            <div className="w-[100px] flex items-center gap-1 px-0.5">
                {[0, 1, 2, 3].map(i => (
                    <span
                        key={i}
                        className={cn(
                            'w-1.5 h-1.5 rounded-full border',
                            i < owned ? 'bg-gi-gold border-gi-gold' : 'border-gi-border bg-transparent'
                        )}
                    />
                ))}
                <span className="ml-auto text-[8px] font-bold uppercase text-gi-muted">
                    {fullyDeployed ? 'Deployed' : alloc.slotted.length > 0 ? `${alloc.slotted.length} in use` : ''}
                </span>
            </div>
        </div>
    );
};

/**
 * Card details (high-res preview + production info) + Deployment Map —
 * rendered by the shared InspectionPanel (overhaul Phase 2).
 */
export const CardInspection = ({ templateId, onInspect }) => {
    const engine = useEngine();
    const unlockedAreaIds = useGameState(
        state => state.collection?.unlockedAreaSets || [],
        ['collection_updated']
    );
    const selectedTemplate = useMemo(() => templateId ? getCard(templateId) : null, [templateId]);
    const productionData = useMemo(() => buildProductionData(selectedTemplate), [selectedTemplate]);

    return (
        <div className="h-full flex flex-col gap-2 p-2 min-h-0">
            <div className="flex-1 min-h-0 bg-gi-base rounded-xl border border-gi-border/20 overflow-hidden relative">
                <LibraryCardPreviewGutter
                    selectedTemplateId={templateId}
                    selectedItemId={null}
                    selectedEnemyId={null}
                    productionData={productionData}
                    inputs={productionData.inputs}
                    outputs={productionData.outputs}
                    handleNavigationInspect={(id, type) => { if (type === 'card') onInspect('card', id); }}
                    handleNavigationSearch={() => {}}
                />
            </div>
            <DeploymentPanel
                templateId={templateId}
                unlockedAreaIds={unlockedAreaIds}
                engine={engine}
            />
        </div>
    );
};

export default CardsTab;
