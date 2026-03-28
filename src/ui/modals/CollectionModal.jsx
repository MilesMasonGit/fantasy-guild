import React, { useState, useMemo } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { useDiscovery } from '../hooks/useDiscovery.js';
import { CodexRegistry } from '../../config/registries/CodexRegistry.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { getAllCards } from '../../config/registries/cardRegistry.js';
import { getAllEnemies } from '../../config/registries/enemyRegistry.js';
import { cn } from '../utils/cn.js';
import GIModal from '../components/base/GIModal.jsx';
import GISurface from '../components/base/GISurface.jsx';
import { Package, Book, Shield, Search, ArrowRight, Activity } from 'lucide-react';
import { ItemIcon } from '../components/base/ItemIcon.jsx';

/**
 * CollectionModal - The player's encyclopedia (Codex)
 * Displays discovered items, cards, and enemies.
 */
const CollectionModal = ({ isOpen, onClose }) => {
    const engine = useEngine();
    const { items: discoveredItems, enemies: discoveredEnemies, itemCounts, enemyKills, isDiscovered } = useDiscovery();
    
    const [activeTab, setActiveTab] = useState('items'); // 'items', 'cards', 'enemies'
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // --- Data Preparation ---
    const allItemsList = useMemo(() => Object.values(getAllItems()), []);
    const allCardsList = useMemo(() => Object.values(getAllCards()), []);
    const allEnemiesList = useMemo(() => Object.values(getAllEnemies()), []);

    const filteredEntities = useMemo(() => {
        let list = [];
        if (activeTab === 'items') list = allItemsList;
        else if (activeTab === 'cards') list = allCardsList;
        else if (activeTab === 'enemies') list = allEnemiesList;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            list = list.filter(e => e.name?.toLowerCase().includes(query) || e.id?.toLowerCase().includes(query));
        }

        // Sort: Discovered first, then by name
        return [...list].sort((a, b) => {
            const discA = isDiscovered(activeTab === 'enemies' ? 'enemy' : activeTab === 'cards' ? 'card' : 'item', a.id);
            const discB = isDiscovered(activeTab === 'enemies' ? 'enemy' : activeTab === 'cards' ? 'card' : 'item', b.id);
            if (discA !== discB) return discA ? -1 : 1;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [activeTab, searchQuery, allItemsList, allCardsList, allEnemiesList, isDiscovered]);

    const handleEntityClick = (entity) => {
        const type = activeTab === 'enemies' ? 'enemy' : activeTab === 'cards' ? 'card' : 'item';
        if (isDiscovered(type, entity.id)) {
            setSelectedEntity({ ...entity, type });
        }
    };

    const navigateTo = (type, id) => {
        let entity = null;
        if (type === 'item') entity = getAllItems()[id];
        else if (type === 'card') entity = getAllCards()[id];
        else if (type === 'enemy') entity = getAllEnemies()[id];

        if (entity && isDiscovered(type, id)) {
            setActiveTab(type === 'item' ? 'items' : type === 'enemy' ? 'enemies' : 'cards');
            setSelectedEntity({ ...entity, type });
        }
    };

    // Listen for external navigation events (e.g. from Card Library)
    React.useEffect(() => {
        if (!engine || !isOpen) return;

        const handleToggle = (data) => {
            if (data?.id && data?.type) {
                navigateTo(data.type, data.id);
            }
        };

        const unsubscribe = engine.EventBus.subscribe('ui:toggle_codex', handleToggle);
        return () => unsubscribe();
    }, [engine, isOpen]);

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title="Collection Codex"
            maxWidth="max-w-6xl"
        >
            <div className="flex h-[75vh] gap-6 overflow-hidden">
                
                {/* Left Panel: List & Tabs */}
                <div className="flex-[0.4] flex flex-col gap-4 min-w-[300px]">
                    
                    {/* Tabs */}
                    <div className="flex p-1 bg-gi-base/50 rounded-xl border border-gi-border/20">
                        {[
                            { id: 'items', label: 'Items', icon: Package },
                            { id: 'cards', label: 'Cards', icon: Book },
                            { id: 'enemies', label: 'Bestiary', icon: Shield }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSelectedEntity(null); }}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all font-display font-bold text-xs uppercase tracking-wider",
                                    activeTab === tab.id ? "bg-gi-primary text-gi-base shadow-lg" : "text-gi-muted hover:text-gi-text hover:bg-gi-surface"
                                )}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gi-muted" size={14} />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gi-base/30 border border-gi-border/20 rounded-lg pl-9 pr-4 py-2 text-xs font-display placeholder:text-gi-muted/50 focus:outline-none focus:border-gi-primary/50"
                        />
                    </div>

                    {/* Grid List */}
                    <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-4 gap-2 content-start">
                        {filteredEntities.map(entity => {
                            const discType = activeTab === 'enemies' ? 'enemy' : activeTab === 'cards' ? 'card' : 'item';
                            const discovered = isDiscovered(discType, entity.id);
                            const isSelected = selectedEntity?.id === entity.id;

                            return (
                                <button
                                    key={entity.id}
                                    onClick={() => handleEntityClick(entity)}
                                    className={cn(
                                        "aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 transition-all group",
                                        discovered 
                                            ? isSelected 
                                                ? "bg-gi-primary/20 border-gi-primary shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                                : "bg-gi-surface border-gi-border/30 hover:border-gi-primary/50"
                                            : "bg-gi-base/20 border-dashed border-gi-border/20 opacity-40 cursor-default"
                                    )}
                                    title={discovered ? entity.name : 'Undiscovered'}
                                 >
                                    <ItemIcon 
                                        item={entity} 
                                        isDiscovered={discovered} 
                                        size={32} 
                                        className={cn(
                                            "transition-transform group-active:scale-90",
                                            !discovered && "grayscale blur-[2px]"
                                        )}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Detail View */}
                <div className="flex-[0.6] flex flex-col bg-gi-base/20 rounded-2xl border border-gi-border/30 overflow-hidden backdrop-blur-sm">
                    {selectedEntity ? (
                        <EntityDetailView 
                            entity={selectedEntity} 
                            itemCounts={itemCounts}
                            enemyKills={enemyKills}
                            onNavigate={navigateTo}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gi-muted gap-4 opacity-50">
                            <Activity size={48} className="animate-pulse" />
                            <p className="font-display font-bold uppercase tracking-widest text-[10px]">
                                Select a discovered entry to view details
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </GIModal>
    );
};

/**
 * Sub-component for Entity Details
 */
const EntityDetailView = ({ entity, itemCounts, enemyKills, onNavigate }) => {
    const sources = useMemo(() => CodexRegistry.getSourcesForItem(entity.id), [entity.id]);
    const usages = useMemo(() => CodexRegistry.getUsagesForItem(entity.id), [entity.id]);
    const loot = useMemo(() => entity.type === 'enemy' ? CodexRegistry.getMaskedLootForEnemy(entity.id) : [], [entity.id, entity.type]);

    return (
        <div className="flex-1 flex flex-col overflow-y-auto p-8 custom-scrollbar">
            
            {/* Header */}
            <div className="flex gap-6 mb-8">
                <div className="w-24 h-24 bg-gi-base rounded-2xl border-2 border-gi-primary/30 flex items-center justify-center shadow-xl">
                    <ItemIcon item={entity} size={64} className="scale-125" />
                </div>
                <div className="flex flex-col justify-center">
                    <h2 className="text-2xl font-display font-bold text-gi-text uppercase tracking-wider mb-1">
                        {entity.name}
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-display font-bold text-gi-primary bg-gi-primary/10 px-2 py-0.5 rounded uppercase tracking-tighter">
                            {entity.type}
                        </span>
                        {entity.tier && (
                            <span className="text-[10px] font-display font-bold text-gi-muted bg-gi-surface/50 px-2 py-0.5 rounded uppercase tracking-tighter">
                                Tier {entity.tier}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Statistics Section */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <GISurface className="p-4 rounded-xl border border-gi-border/20 bg-gi-surface/30">
                    <div className="text-[9px] font-display font-bold text-gi-muted uppercase tracking-widest mb-1">
                        Lifetime {entity.type === 'enemy' ? 'Kills' : 'Acquired'}
                    </div>
                    <div className="text-xl font-display font-bold text-gi-text">
                        {entity.type === 'enemy' ? (enemyKills[entity.id] || 0) : (itemCounts[entity.id] || 0)}
                    </div>
                </GISurface>
                
                {entity.type === 'enemy' && (
                    <GISurface className="p-4 rounded-xl border border-gi-border/20 bg-gi-surface/30">
                        <div className="text-[9px] font-display font-bold text-gi-muted uppercase tracking-widest mb-1">
                            Base Health
                        </div>
                        <div className="text-xl font-display font-bold text-gi-text">
                            {entity.hp} <span className="text-xs text-gi-danger font-normal ml-1">HP</span>
                        </div>
                    </GISurface>
                )}
            </div>

            {/* Bi-directional Links Section */}
            <div className="flex flex-col gap-6">
                
                {/* Item Sources: "Dropped by" / "Output of" */}
                {entity.type === 'item' && sources.length > 0 && (
                    <div>
                        <h4 className="text-[10px] font-display font-bold text-gi-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                            <ArrowRight size={10} className="text-gi-primary" />
                            Sources
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {sources.map(src => (
                                <button
                                    key={`${src.type}_${src.id}`}
                                    onClick={() => onNavigate(src.type === 'enemy' ? 'enemy' : 'card', src.id)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gi-surface border border-gi-border/30 rounded-lg text-xs font-display hover:border-gi-primary/50 transition-colors uppercase"
                                >
                                    <span className="opacity-70">{src.type === 'enemy' ? '🛡️' : '📜'}</span>
                                    {src.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Item Usages: "Inputs for" */}
                {entity.type === 'item' && usages.length > 0 && (
                    <div>
                        <h4 className="text-[10px] font-display font-bold text-gi-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                            <ArrowRight size={10} className="text-gi-primary" />
                            Usage
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {usages.map(usage => (
                                <button
                                    key={usage.id}
                                    onClick={() => onNavigate('card', usage.id)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gi-surface border border-gi-border/30 rounded-lg text-xs font-display hover:border-gi-primary/50 transition-colors uppercase"
                                >
                                    <span className="opacity-70">📜</span>
                                    {usage.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Enemy Loot Table */}
                {entity.type === 'enemy' && loot.length > 0 && (
                    <div>
                        <h4 className="text-[10px] font-display font-bold text-gi-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                            <ArrowRight size={10} className="text-gi-primary" />
                            Loot Table
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                            {loot.map(drop => (
                                <button
                                    key={drop.itemId}
                                    onClick={() => drop.discovered && onNavigate('item', drop.itemId)}
                                    className={cn(
                                        "flex items-center justify-between px-4 py-2 bg-gi-surface border border-gi-border/30 rounded-lg text-xs font-display transition-colors",
                                        drop.discovered ? "hover:border-gi-primary/50" : "opacity-40 cursor-default"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                            <ItemIcon item={drop.itemId} size={16} isDiscovered={drop.discovered} />
                                            <span className="text-xs font-medium text-gi-text/80">
                                                {drop.discovered ? (getAllItems()[drop.itemId]?.name || drop.itemId) : '???'}
                                            </span>
                                        </div>
                                    <div className="text-[10px] font-bold text-gi-primary">
                                        {drop.chance}%
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
};

export default CollectionModal;
