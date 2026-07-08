import React, { useState, useMemo } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import GIModal from '../components/base/GIModal.jsx';
import { getAllAreaSets, getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getEnemy, getAllEnemies } from '../../config/registries/enemyRegistry.js';
import { getItem, getAllItems } from '../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { SUB_SKILL_TO_PARENT } from '../../config/registries/skillRegistry.js';
import { ensureAreaState } from '../../systems/area/AreaStateManager.js';
import { DeckSlotManager } from '../../systems/loop/DeckSlotManager.js';
import { StationSlotManager } from '../../systems/loop/StationSlotManager.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import {
    Search, Box, Skull, Plus, Minus, MapPin, CheckCircle2, HelpCircle
} from 'lucide-react';

// Reused library sub-components (Phase 5 §5D — adapt, don't rewrite)
import { LibraryTabNavigation } from './library/LibraryTabNavigation.jsx';
import { LibraryCardPreviewGutter } from './library/LibraryCardPreviewGutter.jsx';
import { LibraryItemBar, LibraryEnemyBar } from './library/LibraryAreaSetSection.jsx';

/**
 * CollectionBinderModal — the deck-loop replacement for CardLibraryModal
 * (Phase 5 §5D). Cards live as counts in `collection.playsets` and are
 * deployed into area deck slots / station slots from here via buttons.
 * (Drag-and-drop onto deck slots arrives with the Phase 6 Deck Focus view —
 * there is no slot UI to drop onto yet.)
 */

const CATEGORY_TABS = [
    { key: 'all', label: 'All' },
    { key: CARD_TYPES.TASK, label: 'Task' },
    { key: CARD_TYPES.COMBAT, label: 'Combat' },
    { key: CARD_TYPES.STATION, label: 'Station' },
    { key: 'consumable', label: 'Consumable' }
];

const SORTS = [
    { key: 'name', label: 'Name' },
    { key: 'area', label: 'Area' },
    { key: 'skill', label: 'Skill' },
    { key: 'level', label: 'Level' }
];

const DEPLOYMENT_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'available', label: 'Available' },
    { key: 'deployed', label: 'Fully Deployed' },
    { key: 'unowned', label: 'Not Owned' }
];

const CollectionBinderModal = ({ isOpen, onClose }) => {
    const engine = useEngine();

    const [searchScope, setSearchScope] = useState('cards'); // cards | items | enemies
    const [searchMode, setSearchMode] = useState('name');
    const [categoryTab, setCategoryTab] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const [deployFilter, setDeployFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedEnemyId, setSelectedEnemyId] = useState(null);

    // Re-render on collection and deployment changes
    const collection = useGameState(state => state.collection || {}, ['collection_updated', 'registry_updated'], null, { bypassClone: true });
    useGameState(state => state.areaStates || {}, ['area:deck_updated', 'area:station_changed'], null, { bypassClone: true });
    const playsets = collection.playsets || {};
    const unlockedAreaIds = collection.unlockedAreaSets || [];

    const handleClearAll = () => {
        setSearchTerm('');
        setCategoryTab('all');
        setSortBy('name');
        setDeployFilter('all');
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
    // anything already owned regardless of source.
    // ------------------------------------------------------------------
    const catalog = useMemo(() => {
        const ids = new Set();
        for (const areaId of unlockedAreaIds) {
            const areaSet = getAreaSet(areaId);
            Object.keys(areaSet?.deckList || {}).forEach(id => ids.add(id));
        }
        Object.keys(playsets).forEach(id => { if ((playsets[id] || 0) > 0) ids.add(id); });

        return [...ids]
            .map(id => {
                const template = getCard(id);
                if (!template) return null;
                const owned = playsets[id] || 0;
                const alloc = DeckSlotManager.getAllocations(id);
                return { id, template, owned, alloc };
            })
            .filter(Boolean)
            // Deck loop pools contain only these categories; anything else
            // (legacy quests etc.) stays out of the binder.
            .filter(e => ['task', 'combat', 'station', 'consumable'].includes(e.template.cardType));
    }, [playsets, unlockedAreaIds, collection]);

    const filteredCards = useMemo(() => {
        let list = catalog;
        if (categoryTab !== 'all') list = list.filter(e => e.template.cardType === categoryTab);
        if (searchTerm && searchScope === 'cards') {
            const term = searchTerm.toLowerCase();
            list = list.filter(e => e.template.name.toLowerCase().includes(term));
        }
        if (deployFilter === 'available') list = list.filter(e => e.owned > 0 && e.alloc.available > 0);
        if (deployFilter === 'deployed') list = list.filter(e => e.owned > 0 && e.alloc.available === 0);
        if (deployFilter === 'unowned') list = list.filter(e => e.owned === 0);

        const level = t => t.config?.level || t.skillRequirement || 1;
        const skill = t => t.config?.skill || '';
        const area = t => getAreaSet(t.areaSet)?.name || '';
        return [...list].sort((a, b) => {
            switch (sortBy) {
                case 'area': return area(a.template).localeCompare(area(b.template)) || a.template.name.localeCompare(b.template.name);
                case 'skill': return skill(a.template).localeCompare(skill(b.template)) || a.template.name.localeCompare(b.template.name);
                case 'level': return level(a.template) - level(b.template) || a.template.name.localeCompare(b.template.name);
                default: return a.template.name.localeCompare(b.template.name);
            }
        });
    }, [catalog, categoryTab, searchTerm, searchScope, deployFilter, sortBy]);

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
    // Preview gutter data (same computation the old modal fed it)
    // ------------------------------------------------------------------
    const selectedTemplate = useMemo(() => selectedTemplateId ? getCard(selectedTemplateId) : null, [selectedTemplateId]);

    const productionData = useMemo(() => {
        if (!selectedTemplate) return { inputs: [], outputs: [], stats: { level: 1 }, background: null };
        const traits = selectedTemplate.traits || [];
        const config = selectedTemplate.config || {};
        const rawSkill = config.skill || null;
        const parentSkill = SUB_SKILL_TO_PARENT[rawSkill] || rawSkill;
        const subskill = SUB_SKILL_TO_PARENT[rawSkill] ? rawSkill : (config.subskill || null);

        const bgId = selectedTemplate.background || getBiome(selectedTemplate.areaId)?.backgroundImage || getAllAreaSets()[selectedTemplate.areaSet]?.areaArt;
        const background = bgId ? resolveSpritePath(bgId) : null;

        const inputs = traits
            .filter(t => t.type === 'inputslot' && t.itemId)
            .map(t => ({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1 }));
        if (config.minToolTier && config.acceptedToolType) {
            inputs.push({ id: `tool_${config.acceptedToolType}`, name: `${config.acceptedToolType} T${config.minToolTier}`, amount: config.minToolTier, isTool: true });
        }

        const outputs = [];
        traits.forEach(t => {
            if (t.type === 'loot') (t.items || []).forEach(i => outputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
            else if (t.type === 'reward') (t.rewards || []).forEach(i => outputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
            else if ((t.type === 'yield' || t.type === 'production') && t.itemId) outputs.push({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1, chance: t.chance });
        });
        const combatTrait = traits.find(t => t.type === 'combat');
        const enemyId = combatTrait?.enemyId || selectedTemplate.enemyId;
        if (enemyId) {
            const enemy = getEnemy(enemyId);
            (enemy?.drops || []).forEach(d => outputs.push({ id: d.itemId, amount: d.maxQty || d.quantity || 1, chance: d.chance }));
        }
        (selectedTemplate.outputs || []).forEach(o => {
            if (!outputs.some(existing => existing.id === o.itemId)) outputs.push({ id: o.itemId, amount: o.quantity || o.amount || 1, chance: o.chance });
        });
        const xpValue = config.xp || selectedTemplate.xpAwarded || 0;
        if (xpValue > 0) {
            const skillLabel = parentSkill ? (parentSkill.charAt(0).toUpperCase() + parentSkill.slice(1)) : 'General';
            outputs.unshift({ id: 'xp_stat', name: `${skillLabel} XP`, amount: xpValue, isXP: true, chance: null });
        }

        return {
            inputs, outputs, background,
            stats: {
                skill: parentSkill,
                level: config.level || selectedTemplate.skillRequirement || 1,
                subskill,
                time: config.baseTickTime || null,
                energy: config.energyCost || 1
            }
        };
    }, [selectedTemplate]);

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
                                    <span className="text-[10px] font-bold text-gi-muted uppercase tracking-widest">Sort by</span>
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

                                {/* Deployment status (§5D — replaces the old Playmat/Storage filter) */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-gi-muted uppercase tracking-widest">Deployment</span>
                                    <div className="flex flex-col gap-1.5">
                                        {DEPLOYMENT_FILTERS.map(f => (
                                            <button
                                                key={f.key}
                                                onClick={() => setDeployFilter(f.key)}
                                                className={cn(
                                                    "px-2 py-1.5 rounded text-xs border text-left transition-colors",
                                                    deployFilter === f.key ? "bg-gi-primary/20 border-gi-primary/40 text-gi-text" : "border-gi-border text-gi-muted hover:text-gi-text"
                                                )}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
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
                                        "px-4 py-1.5 rounded-t-lg text-xs font-bold uppercase tracking-wider border-b-2 transition-colors",
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

                {/* Column 3: Preview gutter + deployment panel */}
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
                    {selectedTemplateId && searchScope === 'cards' && (
                        <DeploymentPanel
                            templateId={selectedTemplateId}
                            unlockedAreaIds={unlockedAreaIds}
                            engine={engine}
                        />
                    )}
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

/**
 * One card in the binder grid: art (silhouetted when unowned, §5H),
 * ownership pips (owned/4), and a deployed-count badge.
 */
const BinderCardTile = ({ entry, isSelected, onSelect }) => {
    const { template, owned, alloc } = entry;
    const spritePath = useMemo(() => {
        const bgId = template.sprite || template.background || getBiome(template.areaId)?.backgroundImage || getAreaSet(template.areaSet)?.areaArt;
        return bgId ? resolveSpritePath(bgId) : null;
    }, [template]);

    const fullyDeployed = owned > 0 && alloc.available === 0;

    return (
        <button
            onClick={onSelect}
            className={cn(
                "relative flex flex-col rounded-lg border overflow-hidden text-left transition-all group",
                isSelected ? "border-gi-primary shadow-[0_0_12px_rgba(255,255,255,0.15)]" : "border-gi-border hover:border-gi-muted",
                owned === 0 && "opacity-60"
            )}
        >
            {/* Art */}
            <div className="relative aspect-[4/3] bg-gi-base overflow-hidden">
                {spritePath ? (
                    <img
                        src={spritePath.startsWith('/') ? spritePath : `/${spritePath}`}
                        alt={template.name}
                        className={cn(
                            "w-full h-full object-cover pixel-art transition-all",
                            owned === 0 && "grayscale brightness-[0.35]" // silhouette (§5H)
                        )}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gi-muted">
                        <HelpCircle size={24} />
                    </div>
                )}
                {fullyDeployed && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-gi-primary/80 text-[9px] font-bold uppercase text-black">
                        Deployed
                    </span>
                )}
                {alloc.slotted.length > 0 && !fullyDeployed && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-gi-text">
                        {alloc.slotted.length} in use
                    </span>
                )}
            </div>

            {/* Name + pips */}
            <div className="p-2 bg-gi-surface flex flex-col gap-1.5">
                <span className="text-xs font-bold text-gi-text truncate">{template.name}</span>
                <div className="flex items-center gap-1">
                    {[0, 1, 2, 3].map(i => (
                        <span
                            key={i}
                            className={cn(
                                "w-2 h-2 rounded-full border",
                                i < owned ? "bg-gi-gold border-gi-gold" : "border-gi-border bg-transparent"
                            )}
                        />
                    ))}
                    <span className="ml-auto text-[9px] text-gi-muted uppercase">{template.cardType}</span>
                </div>
            </div>
        </button>
    );
};

/**
 * Deployment Map + Add/Remove controls (§5D). Shows where each owned copy
 * sits and moves copies in/out of area decks (or the Station Slot for
 * station cards) via buttons — the Phase 5 stand-in for drag-and-drop.
 */
const DeploymentPanel = ({ templateId, unlockedAreaIds, engine }) => {
    const template = getCard(templateId);
    const alloc = DeckSlotManager.getAllocations(templateId);
    const isStation = template?.cardType === CARD_TYPES.STATION;
    const [showAreaPicker, setShowAreaPicker] = useState(false);

    if (!template) return null;

    const areaName = (areaId) => getAreaSet(areaId)?.name || areaId;

    // Where could one more copy go?
    const addTargets = unlockedAreaIds.map(areaId => {
        ensureAreaState(areaId);
        if (isStation) {
            const occupied = engine.GameState.areaStates[areaId]?.stationState?.activeStationCardId;
            return { areaId, ok: alloc.available > 0 && occupied !== templateId, note: occupied ? 'replaces current station' : null };
        }
        const areaState = engine.GameState.areaStates[areaId];
        const inDeck = (areaState.deckSlots || []).some(s => s.templateId === templateId);
        if (inDeck) return { areaId, ok: false, note: 'already in this deck' };
        const slotIndex = (areaState.deckSlots || []).findIndex(s => !s.templateId && !s.isLocked && !s.hazard);
        if (slotIndex === -1) return { areaId, ok: false, note: 'no empty slot' };
        return { areaId, ok: alloc.available > 0, slotIndex };
    });

    const handleAdd = (target) => {
        const result = isStation
            ? StationSlotManager.slotStation(target.areaId, templateId)
            : DeckSlotManager.slotCard(target.areaId, target.slotIndex, templateId);
        if (!result.success) console.warn('[Binder] Add to deck failed:', result.error);
        setShowAreaPicker(false);
    };

    const handleRemove = (deployment) => {
        const result = deployment.slotIndex === 'station'
            ? StationSlotManager.unslotStation(deployment.areaId)
            : DeckSlotManager.unslotCard(deployment.areaId, deployment.slotIndex);
        if (!result.success) console.warn('[Binder] Remove from deck failed:', result.error);
    };

    return (
        <div className="shrink-0 bg-gi-base rounded-xl border border-gi-border/20 p-3 flex flex-col gap-2 max-h-[40%] overflow-y-auto custom-scrollbar">
            <span className="text-[10px] font-bold text-gi-muted uppercase tracking-widest">Deployment Map</span>

            {/* One line per owned copy (§5D) */}
            {alloc.owned === 0 ? (
                <span className="text-xs text-gi-muted italic">Not owned — pull it from a Booster Pack.</span>
            ) : (
                <div className="flex flex-col gap-1">
                    {alloc.slotted.map((dep, i) => (
                        <div key={`${dep.areaId}-${dep.slotIndex}`} className="flex items-center gap-2 text-xs text-gi-text">
                            <MapPin size={12} className="text-gi-primary shrink-0" />
                            <span className="truncate">
                                Copy {i + 1}: {areaName(dep.areaId)} {dep.slotIndex === 'station' ? '(Station Slot)' : `Slot ${dep.slotIndex + 1}`}
                            </span>
                            <button
                                onClick={() => handleRemove(dep)}
                                title="Remove from deck"
                                className="ml-auto p-1 rounded border border-gi-border text-gi-muted hover:text-gi-danger hover:border-gi-danger transition-colors"
                            >
                                <Minus size={12} />
                            </button>
                        </div>
                    ))}
                    {Array.from({ length: Math.max(0, alloc.available) }).map((_, i) => (
                        <div key={`avail-${i}`} className="flex items-center gap-2 text-xs text-gi-muted">
                            <CheckCircle2 size={12} className="text-gi-success shrink-0" />
                            <span>Copy {alloc.slotted.length + i + 1}: Available</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Add to Deck */}
            {alloc.available > 0 && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-gi-border/30">
                    <button
                        onClick={() => setShowAreaPicker(v => !v)}
                        className="flex items-center justify-center gap-2 px-2 py-1.5 rounded text-xs font-bold uppercase tracking-wide border border-gi-primary/40 bg-gi-primary/10 text-gi-text hover:bg-gi-primary/20 transition-colors"
                    >
                        <Plus size={12} /> {isStation ? 'Build at Outpost' : 'Add to Deck'}
                    </button>
                    {showAreaPicker && (
                        <div className="flex flex-col gap-1">
                            {addTargets.map(t => (
                                <button
                                    key={t.areaId}
                                    disabled={!t.ok}
                                    onClick={() => handleAdd(t)}
                                    className={cn(
                                        "flex items-center justify-between px-2 py-1 rounded text-xs border transition-colors",
                                        t.ok ? "border-gi-border text-gi-text hover:border-gi-primary" : "border-gi-border/40 text-gi-muted/60 cursor-not-allowed"
                                    )}
                                >
                                    <span>{areaName(t.areaId)}</span>
                                    {t.note && <span className="text-[9px] italic opacity-70">{t.note}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {alloc.owned > 0 && alloc.available === 0 && (
                <span className="text-[10px] text-gi-muted uppercase tracking-wide pt-1 border-t border-gi-border/30">
                    Fully deployed — remove a copy to redeploy it.
                </span>
            )}
        </div>
    );
};

export default CollectionBinderModal;
