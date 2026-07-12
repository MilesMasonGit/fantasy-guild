import React, { useState, useMemo } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import GIModal from '../components/base/GIModal.jsx';
import { getAllEnemies } from '../../config/registries/enemyRegistry.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import {
    Search, Box, Skull, Trophy
} from 'lucide-react';

// Reused library sub-components (Phase 5 §5D — adapt, don't rewrite)
import { LibraryTabNavigation } from './library/LibraryTabNavigation.jsx';
import { LibraryCardPreviewGutter } from './library/LibraryCardPreviewGutter.jsx';
import { LibraryItemBar, LibraryEnemyBar } from './library/LibraryAreaSetSection.jsx';
import { CATEGORY_TABS, SORTS, buildCardCatalog, filterAndSortCards, buildProductionData } from './library/binderCatalog.js';
import { BinderCardTile } from './library/BinderCardTile.jsx';

/**
 * CollectionBinderModal — the completionist trophy gallery (Phase 7).
 *
 * Owner decision 2026-07-08: the binder has NO gameplay purpose. All card
 * management (Add/Remove-to-deck, Deployment Map, drag sources) moved to
 * the Bottom Drawer's Cards tab; what remains here is collection progress
 * and lifetime stats — copies owned, times performed, items gathered,
 * enemies slain. It also absorbs the old Collection Codex
 * (CollectionModal), whose TopBar button now opens this binder.
 */

const CollectionBinderModal = ({ isOpen, onClose }) => {
    const engine = useEngine();

    const [searchScope, setSearchScope] = useState('cards'); // cards | items | enemies
    const [searchMode, setSearchMode] = useState('name');
    const [categoryTab, setCategoryTab] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedEnemyId, setSelectedEnemyId] = useState(null);

    // Re-render on collection changes; completion ticks (card completed /
    // craft finished) keep the lifetime stats live while the binder is open.
    // deepClone matters: collection is mutated in place, so anything short
    // of a full snapshot makes the staleness check pass and the binder
    // would go stale (bug found in the Phase 7 smoke test).
    const collection = useGameState(
        state => state.collection || {},
        ['collection_updated', 'registry_updated', 'area:card_completed', 'area:craft_completed'],
        null,
        { deepClone: true }
    );
    const playsets = collection.playsets || {};
    const unlockedAreaIds = collection.unlockedAreaSets || [];

    const handleClearAll = () => {
        setSearchTerm('');
        setCategoryTab('all');
        setSortBy('name');
        setSearchScope('cards');
        setSearchMode('name');
    };

    const handleNavigationInspect = (id, type) => {
        setSelectedTemplateId(type === 'card' ? id : null);
        setSelectedItemId(type === 'item' ? id : null);
        setSelectedEnemyId(type === 'enemy' ? id : null);
    };

    const handleNavigationSearch = (term, mode, scope = 'items') => {
        setSearchTerm(term);
        if (mode) setSearchMode(mode);
        setSearchScope(scope);
    };

    // ------------------------------------------------------------------
    // Card catalog: everything obtainable from unlocked areas' pools, plus
    // anything already owned regardless of source (shared helpers, Phase 7).
    // ------------------------------------------------------------------
    const catalog = useMemo(
        () => buildCardCatalog(playsets, unlockedAreaIds),
        [playsets, unlockedAreaIds, collection]
    );

    const filteredCards = useMemo(
        () => filterAndSortCards(catalog, {
            categoryTab,
            searchTerm: searchScope === 'cards' ? searchTerm : '',
            deployFilter: 'all',
            sortBy
        }),
        [catalog, categoryTab, searchTerm, searchScope, sortBy]
    );

    // Completion summary for the header line
    const collectedCount = catalog.filter(e => e.owned > 0).length;
    const masteredCount = catalog.filter(e => e.owned >= 4).length;

    // Items / Enemies scopes (reused from the old modal, discovery unchanged)
    const filteredItems = useMemo(() => {
        if (searchScope !== 'items') return [];
        return Object.values(getAllItems()).filter(item => {
            if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return !!collection.discoveredItems?.[item.id];
        });
    }, [searchScope, searchTerm, collection]);

    const filteredEnemies = useMemo(() => {
        if (searchScope !== 'enemies') return [];
        return Object.values(getAllEnemies()).filter(enemy => {
            if (searchTerm && !enemy.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return !!collection.discoveredEnemies?.[enemy.id];
        });
    }, [searchScope, searchTerm, collection]);

    // ------------------------------------------------------------------
    // Preview gutter data (shared computation, Phase 7)
    // ------------------------------------------------------------------
    const selectedTemplate = useMemo(() => selectedTemplateId ? getCard(selectedTemplateId) : null, [selectedTemplateId]);
    const productionData = useMemo(() => buildProductionData(selectedTemplate), [selectedTemplate]);

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title="Collection Binder"
            maxWidth="max-w-[1360px]"
            className="h-[90vh] w-full mx-4"
        >
            <div className="flex h-full gap-6 overflow-hidden justify-center">
                {/* Column 1: Scope + binder controls */}
                <div className={cn(
                    "w-64 shrink-0 flex flex-col h-full rounded-xl border overflow-hidden",
                    searchScope === 'cards' && "bg-gi-intent-blueprint/5 border-gi-intent-blueprint/20",
                    searchScope === 'items' && "bg-gi-gold/5 border-gi-gold/20",
                    searchScope === 'enemies' && "bg-gi-danger/5 border-gi-danger/20"
                )}>
                    <div className="p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                        <LibraryTabNavigation
                            searchScope={searchScope}
                            setSearchScope={setSearchScope}
                            setSearchMode={setSearchMode}
                            handleClearAll={handleClearAll}
                        />

                        {/* Search */}
                        <div className="flex items-center gap-2 bg-gi-base border border-gi-border rounded-lg px-3 py-2">
                            <Search size={14} className="text-gi-muted shrink-0" />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder={`Search ${searchScope}...`}
                                className="bg-transparent outline-none text-sm text-gi-text w-full"
                            />
                        </div>

                        {searchScope === 'cards' && (
                            <>
                                {/* Sort */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-gi-muted gi-caps tracking-widest">Sort by</span>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {SORTS.map(s => (
                                            <button
                                                key={s.key}
                                                onClick={() => setSortBy(s.key)}
                                                className={cn(
                                                    "px-2 py-1.5 rounded text-xs border transition-colors",
                                                    sortBy === s.key ? "bg-gi-primary/20 border-gi-primary/40 text-gi-text" : "border-gi-border text-gi-muted hover:text-gi-text"
                                                )}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Collection progress (Phase 7 — the binder's whole job now) */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-gi-muted gi-caps tracking-widest flex items-center gap-1">
                                        <Trophy size={11} className="text-gi-gold" /> Progress
                                    </span>
                                    <ProgressLine label="Collected" value={collectedCount} total={catalog.length} />
                                    <ProgressLine label="Mastered (4/4)" value={masteredCount} total={catalog.length} />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Column 2: Binder grid / item & enemy lists */}
                <div className="flex-1 max-w-[800px] min-w-0 flex flex-col h-full overflow-hidden">
                    {searchScope === 'cards' && (
                        <div className="flex items-center gap-1.5 pb-3 shrink-0">
                            {CATEGORY_TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setCategoryTab(tab.key)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-t-lg text-xs font-bold gi-caps tracking-wider border-b-2 transition-colors",
                                        categoryTab === tab.key
                                            ? "border-gi-primary text-gi-text bg-gi-primary/10"
                                            : "border-transparent text-gi-muted hover:text-gi-text"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-8">
                        {searchScope === 'cards' ? (
                            filteredCards.length > 0 ? (
                                <div className="grid grid-cols-4 gap-3">
                                    {filteredCards.map(entry => (
                                        <BinderCardTile
                                            key={entry.id}
                                            entry={entry}
                                            isSelected={selectedTemplateId === entry.id}
                                            onSelect={() => handleNavigationInspect(entry.id, 'card')}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState icon={<Search size={48} />} label="No cards match" />
                            )
                        ) : searchScope === 'items' ? (
                            filteredItems.length > 0 ? (
                                <div className="w-full flex flex-col gap-1.5 items-center">
                                    {filteredItems.map(item => (
                                        <LibraryItemBar key={item.id} item={item} isSelected={selectedItemId === item.id} onAction={() => handleNavigationInspect(item.id, 'item')} />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState icon={<Box size={48} />} label="No items found" />
                            )
                        ) : (
                            filteredEnemies.length > 0 ? (
                                <div className="w-full flex flex-col gap-1.5 items-center">
                                    {filteredEnemies.map(enemy => (
                                        <LibraryEnemyBar key={enemy.id} enemy={enemy} isSelected={selectedEnemyId === enemy.id} onAction={() => handleNavigationInspect(enemy.id, 'enemy')} />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState icon={<Skull size={48} />} label="No enemies found" />
                            )
                        )}
                    </div>
                </div>

                {/* Column 3: Preview gutter + lifetime stats */}
                <div className="w-80 shrink-0 flex flex-col h-full gap-3 overflow-hidden">
                    <div className="flex-1 min-h-0 bg-gi-base rounded-xl border border-gi-border/20 overflow-hidden relative">
                        <LibraryCardPreviewGutter
                            selectedTemplateId={selectedTemplateId}
                            selectedItemId={selectedItemId}
                            selectedEnemyId={selectedEnemyId}
                            productionData={productionData}
                            inputs={productionData.inputs}
                            outputs={productionData.outputs}
                            handleNavigationInspect={handleNavigationInspect}
                            handleNavigationSearch={handleNavigationSearch}
                        />
                    </div>
                    <LifetimeStatsPanel
                        collection={collection}
                        templateId={selectedTemplateId}
                        itemId={selectedItemId}
                        enemyId={selectedEnemyId}
                        engine={engine}
                    />
                </div>
            </div>
        </GIModal>
    );
};

const EmptyState = ({ icon, label }) => (
    <div className="flex flex-col items-center justify-center p-12 text-center gap-4 mt-20 opacity-40">
        <span className="text-gi-muted">{icon}</span>
        <h3 className="text-lg font-base text-gi-muted uppercase">{label}</h3>
    </div>
);

const ProgressLine = ({ label, value, total }) => (
    <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px]">
            <span className="text-gi-muted">{label}</span>
            <span className="text-gi-text font-bold tabular-nums">{value}/{total}</span>
        </div>
        <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div className="h-full bg-gi-gold" style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }} />
        </div>
    </div>
);

/**
 * Lifetime stats for the selected entry (Phase 7 — the binder's reason to
 * exist). Cards: copies owned + times performed. Items: gathered lifetime
 * + banked now. Enemies: slain count.
 */
const LifetimeStatsPanel = ({ collection, templateId, itemId, enemyId, engine }) => {
    if (!templateId && !itemId && !enemyId) return null;

    let lines = [];
    if (templateId) {
        const owned = collection.playsets?.[templateId] || 0;
        const template = getCard(templateId);
        const uses = collection.cardUseCounts?.[templateId] || 0;
        lines = [
            { label: 'Copies owned', value: `${owned}/4${owned >= 4 ? ' · Mastered' : ''}` },
            { label: template?.cardType === 'station' ? 'Items crafted here' : 'Times performed', value: uses.toLocaleString() }
        ];
    } else if (itemId) {
        lines = [
            { label: 'Gathered (lifetime)', value: (collection.itemLifetimeCounts?.[itemId] || 0).toLocaleString() },
            { label: 'In bank now', value: (engine.InventoryManager.getItemCount(itemId) || 0).toLocaleString() }
        ];
    } else if (enemyId) {
        lines = [
            { label: 'Slain', value: (collection.enemyKillCounts?.[enemyId] || 0).toLocaleString() }
        ];
    }

    return (
        <div className="shrink-0 bg-gi-base rounded-xl border border-gi-border/20 p-3 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-gi-muted uppercase tracking-widest flex items-center gap-1">
                <Trophy size={11} className="text-gi-gold" /> Lifetime Stats
            </span>
            {lines.map(line => (
                <div key={line.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-gi-muted">{line.label}</span>
                    <span className="text-gi-text font-bold tabular-nums">{line.value}</span>
                </div>
            ))}
        </div>
    );
};

export default CollectionBinderModal;
