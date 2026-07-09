import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import {
    CATEGORY_TABS, SORTS, DEPLOYMENT_FILTERS,
    buildCardCatalog, filterAndSortCards, buildProductionData
} from '../../modals/library/binderCatalog.js';
import { BinderCardTile } from '../../modals/library/BinderCardTile.jsx';
import { DeploymentPanel } from '../../modals/library/DeploymentPanel.jsx';
import { LibraryCardPreviewGutter } from '../../modals/library/LibraryCardPreviewGutter.jsx';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { Search, Layers } from 'lucide-react';

/**
 * Cards tab (Phase 7) — the gameplay home for the card collection. All the
 * management the Collection Binder carried in Phase 5 lives here now:
 * category/deployment filtering (stations are a filter, not a tab — owner
 * decision 2026-07-08), Add/Remove-to-deck buttons, the Deployment Map,
 * and native drag onto banner deck/station slots.
 *
 * The Collection Binder itself is a stat gallery from Phase 7 on.
 */
export const CardsTab = ({ filter }) => {
    const engine = useEngine();

    const [categoryTab, setCategoryTab] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const [deployFilter, setDeployFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);

    // Auto-open payloads (§12.B): pre-apply the slot's requirements.
    useEffect(() => {
        if (!filter) return;
        setCategoryTab(filter.cardType || 'all');
        setDeployFilter(filter.deployFilter || 'available');
        setSearchTerm('');
    }, [filter]);

    // Re-render on collection changes. deepClone matters: collection is
    // mutated in place (playsets counts etc.), so anything short of a full
    // snapshot makes the staleness check pass and the tab never updates
    // (bug found in the Phase 7 smoke test).
    const collection = useGameState(state => state.collection || {}, ['collection_updated', 'registry_updated'], null, { deepClone: true });
    // Deployment changes arrive as a primitive signature so slot/station
    // moves anywhere re-render the grid and Deployment Map.
    const deploySig = useGameState(
        state => Object.entries(state.areaStates || {})
            .map(([id, a]) => `${id}:${(a.deckSlots || []).map(s => s.templateId || '_').join(',')}:${a.stationState?.activeStationCardId || ''}`)
            .join('|'),
        ['area:deck_updated', 'area:station_changed']
    );
    const playsets = collection.playsets || {};
    const unlockedAreaIds = collection.unlockedAreaSets || [];

    const catalog = useMemo(
        () => buildCardCatalog(playsets, unlockedAreaIds),
        // deploySig: allocations (slotted/available) shift with every deployment
        [playsets, unlockedAreaIds, collection, deploySig]
    );
    const filteredCards = useMemo(
        () => filterAndSortCards(catalog, { categoryTab, searchTerm, deployFilter, sortBy }),
        [catalog, categoryTab, searchTerm, deployFilter, sortBy]
    );

    const selectedTemplate = useMemo(() => selectedTemplateId ? getCard(selectedTemplateId) : null, [selectedTemplateId]);
    const productionData = useMemo(() => buildProductionData(selectedTemplate), [selectedTemplate]);

    return (
        <div className="flex h-full min-h-0">
            {/* Left: inspection panel */}
            <div className="w-80 shrink-0 border-r border-gi-border/50 bg-gi-base/40 flex flex-col gap-2 p-2 min-h-0">
                {selectedTemplateId ? (
                    <>
                        <div className="flex-1 min-h-0 bg-gi-base rounded-xl border border-gi-border/20 overflow-hidden relative">
                            <LibraryCardPreviewGutter
                                selectedTemplateId={selectedTemplateId}
                                selectedItemId={null}
                                selectedEnemyId={null}
                                productionData={productionData}
                                inputs={productionData.inputs}
                                outputs={productionData.outputs}
                                handleNavigationInspect={(id, type) => { if (type === 'card') setSelectedTemplateId(id); }}
                                handleNavigationSearch={() => {}}
                            />
                        </div>
                        <DeploymentPanel
                            templateId={selectedTemplateId}
                            unlockedAreaIds={unlockedAreaIds}
                            engine={engine}
                        />
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/50 p-6 text-center">
                        <Layers size={36} />
                        <span className="text-xs uppercase tracking-widest font-bold">Select a card to inspect</span>
                        <span className="text-[10px] normal-case tracking-normal">Drag owned cards onto an area's deck, or use Add to Deck here.</span>
                    </div>
                )}
            </div>

            {/* Center: filters + grid */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
                {/* Search & filter bar (§12.A) */}
                <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gi-border/40 bg-gi-base/30 flex-wrap">
                    <div className="flex items-center gap-1">
                        {CATEGORY_TABS.map(tab => (
                            <FilterChip key={tab.key} active={categoryTab === tab.key} onClick={() => setCategoryTab(tab.key)} label={tab.label} />
                        ))}
                    </div>
                    <div className="flex items-center gap-2 bg-gi-base border border-gi-border rounded px-2 py-1 ml-auto">
                        <Search size={12} className="text-gi-muted shrink-0" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search cards…"
                            className="bg-transparent outline-none text-xs text-gi-text w-36"
                        />
                    </div>
                    <SelectControl label="Show" value={deployFilter} onChange={setDeployFilter} options={DEPLOYMENT_FILTERS} />
                    <SelectControl label="Sort" value={sortBy} onChange={setSortBy} options={SORTS} />
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {filteredCards.length > 0 ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5">
                            {filteredCards.map(entry => (
                                <BinderCardTile
                                    key={entry.id}
                                    entry={entry}
                                    draggable
                                    isSelected={selectedTemplateId === entry.id}
                                    onSelect={() => setSelectedTemplateId(entry.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/40">
                            <Search size={32} />
                            <span className="text-xs uppercase tracking-widest font-bold">No cards match</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const FilterChip = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={cn(
            'px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors',
            active ? 'bg-gi-primary/20 border-gi-primary/40 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text'
        )}
    >
        {label}
    </button>
);

const SelectControl = ({ label, value, onChange, options }) => (
    <label className="flex items-center gap-1.5 text-[9px] font-bold text-gi-muted uppercase tracking-wide">
        {label}
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="bg-gi-base border border-gi-border rounded px-1.5 py-1 text-[10px] text-gi-text outline-none"
        >
            {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
    </label>
);

export default CardsTab;
