import React, { useState, useMemo } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import GIModal from '../components/base/GIModal.jsx';
import { getAllAreaSets, getSetTotal } from '../../config/registries/areaSetRegistry.js';
import { getCard, getAllCards } from '../../config/registries/cardRegistry.js';
import * as LibraryManager from '../../systems/cards/LibraryManager.js';
import { Book, Box, Skull, Search, ChevronRight } from 'lucide-react';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getEnemy, getAllEnemies } from '../../config/registries/enemyRegistry.js';
import { getItem, getAllItems } from '../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { SUB_SKILL_TO_PARENT } from '../../config/registries/skillRegistry.js';

// Sub-components
import { LibraryTabNavigation } from './library/LibraryTabNavigation.jsx';
import { LibraryFilters } from './library/LibraryFilters.jsx';
import { LibraryCardPreviewGutter } from './library/LibraryCardPreviewGutter.jsx';
import { 
    LibraryCardBar, LibraryItemBar, LibraryEnemyBar, LibraryGlobalProgress 
} from './library/LibraryAreaSetSection.jsx';

const CardLibraryModal = ({ isOpen, onClose }) => {
    const engine = useEngine();
    const areaSets = useMemo(() => Object.values(getAllAreaSets()), []);

    // Helper to resolve all outputs for a card (including enemy drops)
    const resolveOutputs = (card) => {
        if (!card) return [];
        const traits = card.traits || [];
        const outputs = [];
        traits.forEach(t => {
            if (t.type === 'loot') {
                (t.items || []).forEach(i => outputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
            } else if (t.type === 'reward') {
                (t.rewards || []).forEach(i => outputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
            } else if ((t.type === 'yield' || t.type === 'production') && t.itemId) {
                outputs.push({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1, chance: t.chance });
            }
        });
        const combatTrait = traits.find(t => t.type === 'combat');
        const enemyId = combatTrait?.enemyId || card.enemyId;
        if (enemyId) {
            const enemy = getEnemy(enemyId);
            if (enemy?.drops) {
                enemy.drops.forEach(d => outputs.push({ id: d.itemId, amount: d.maxQty || d.quantity || 1, chance: d.chance }));
            }
        }
        if (card.outputs && Array.isArray(card.outputs)) {
            card.outputs.forEach(o => {
                if (!outputs.some(existing => existing.id === o.itemId)) {
                    outputs.push({ id: o.itemId, amount: o.quantity || o.amount || 1, chance: o.chance });
                }
            });
        }
        return outputs;
    };

    const resolveInputs = (card) => {
        if (!card) return [];
        const traits = card.traits || [];
        const inputs = traits
            .filter(t => t.type === 'inputslot' && t.itemId)
            .map(t => ({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1 }));
        if (card.inputs && Array.isArray(card.inputs)) {
            card.inputs.forEach(i => {
                if (!inputs.some(existing => existing.id === i.itemId)) {
                    inputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1 });
                }
            });
        }
        return inputs;
    };

    const [collapsedSets, setCollapsedSets] = useState(new Set());
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedEnemyId, setSelectedEnemyId] = useState(null);
    const [openDropdowns, setOpenDropdowns] = useState(new Set(['types', 'status']));
    const [searchTerm, setSearchTerm] = useState('');
    const [searchScope, setSearchScope] = useState('cards'); // cards, items, enemies
    const [searchMode, setSearchMode] = useState('name'); // name, drop, type
    const [typeFilters, setTypeFilters] = useState(new Set());
    const [skillFilters, setSkillFilters] = useState(new Set());
    const [subSkillFilters, setSubSkillFilters] = useState(new Set());
    const [areaFilters, setAreaFilters] = useState(new Set());
    const [statusFilter, setStatusFilter] = useState('all');
    const [minLevel, setMinLevel] = useState('');
    const [maxLevel, setMaxLevel] = useState('');

    const toggleDropdown = (id) => {
        const next = new Set(openDropdowns);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setOpenDropdowns(next);
    };

    const toggleSet = (setId) => {
        const next = new Set(collapsedSets);
        if (next.has(setId)) next.delete(setId);
        else next.add(setId);
        setCollapsedSets(next);
    };

    // Subscribe to collection changes
    const collection = useGameState(state => state.collection || {}, ['collection_updated', 'registry_updated'], null, { bypassClone: true });
    const playsets = collection.playsets || {};

    const handleReclaim = (templateId, areaId) => {
        const result = LibraryManager.performReclaim(templateId, areaId);
        if (!result.success) {
            console.error('[Library] Reclaim failed:', result.error);
        }
    };

    const handleWithdraw = (templateId) => {
        if (!LibraryManager.canWithdraw(templateId)) return;
        const result = engine.CardManager.createCard(templateId);
        if (result.success) {
            engine.EventBus.publish('library_card_withdrawn', { templateId });
        } else {
            console.error('[Library] Withdraw failed:', result.error);
        }
    };

    const handleNavigationInspect = (id, type) => {
        if (type === 'card') {
            setSelectedTemplateId(id);
            setSelectedItemId(null);
            setSelectedEnemyId(null);
        } else if (type === 'item') {
            setSelectedItemId(id);
            setSelectedTemplateId(null);
            setSelectedEnemyId(null);
        } else if (type === 'enemy') {
            setSelectedEnemyId(id);
            setSelectedTemplateId(null);
            setSelectedItemId(null);
        }
    };

    const selectedTemplate = useMemo(() => selectedTemplateId ? getCard(selectedTemplateId) : null, [selectedTemplateId]);
    const selectedItem = useMemo(() => selectedItemId ? getItem(selectedItemId) : null, [selectedItemId]);
    const selectedEnemy = useMemo(() => selectedEnemyId ? getEnemy(selectedEnemyId) : null, [selectedEnemyId]);

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
            inputs.push({
                id: `tool_${config.acceptedToolType}`,
                name: `${config.acceptedToolType} T${config.minToolTier}`,
                amount: config.minToolTier,
                isTool: true
            });
        }

        const outputs = resolveOutputs(selectedTemplate);
        const xpValue = config.xp || selectedTemplate.xpAwarded || 0;
        if (xpValue > 0) {
            const skillLabel = parentSkill ? (parentSkill.charAt(0).toUpperCase() + parentSkill.slice(1)) : 'General';
            outputs.unshift({
                id: 'xp_stat',
                name: `${skillLabel} XP`,
                amount: xpValue,
                isXP: true,
                chance: null
            });
        }

        return {
            inputs,
            outputs,
            background,
            stats: {
                skill: parentSkill,
                level: config.level || selectedTemplate.skillRequirement || 1,
                subskill: subskill,
                time: config.baseTickTime || null,
                energy: config.energyCost || 1
            }
        };
    }, [selectedTemplate]);

    const { inputs, outputs } = productionData;

    // Derived filtered card sets
    const filteredSets = useMemo(() => {
        return areaSets.map(set => {
            const cards = (set.cardPool || []).map(entry => getCard(entry.cardId)).filter(Boolean);
            const filteredCards = cards.filter(card => {
                if (searchTerm && searchScope === 'cards') {
                    if (!card.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                }
                if (typeFilters.size > 0 && !typeFilters.has(card.cardType?.toLowerCase())) return false;

                const pips = LibraryManager.reconcileLocation(card.id);
                const isDiscovered = pips.some(p => p.status !== 'undiscovered');
                if (statusFilter === 'discovered' && !isDiscovered) return false;
                if (statusFilter === 'undiscovered' && isDiscovered) return false;
                if (statusFilter === 'playmat' && !pips.some(p => p.status === 'in-use')) return false;
                if (statusFilter === 'storage' && !pips.some(p => p.status === 'available')) return false;

                if (skillFilters.size > 0) {
                    const cardSkills = (card.traits || []).filter(t => t.type === 'requirement' || t.type === 'skill').map(t => t.skillId).filter(Boolean);
                    const matches = cardSkills.some(s => {
                        if (skillFilters.has(s)) return true;
                        if (skillFilters.has('combat') && ['melee', 'ranged', 'magic'].includes(s)) return true;
                        return false;
                    });
                    if (!matches) return false;
                }

                if (subSkillFilters.size > 0) {
                    const cardSkills = (card.traits || []).filter(t => t.type === 'requirement' || t.type === 'skill').map(t => t.skillId).filter(Boolean);
                    if (!cardSkills.some(s => subSkillFilters.has(s))) return false;
                }

                if (areaFilters.size > 0) {
                    const cardSetId = card.areaSet || card.areaId;
                    if (!areaFilters.has(cardSetId)) return false;
                }

                const cardLevel = card.config?.level || card.skillRequirement || 1;
                if (minLevel !== '' && cardLevel < parseInt(minLevel, 10)) return false;
                if (maxLevel !== '' && cardLevel > parseInt(maxLevel, 10)) return false;

                return true;
            });

            const discovered = filteredCards.filter(card => LibraryManager.isDiscovered(card.id));
            return { ...set, discovered };
        }).filter(set => set.discovered.length > 0);
    }, [areaSets, searchTerm, typeFilters, statusFilter, playsets, minLevel, maxLevel, searchScope, collection]);

    const filteredItems = useMemo(() => {
        if (searchScope !== 'items') return [];
        const all = Object.values(getAllItems());
        return all.filter(item => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesName = item.name.toLowerCase().includes(term);
                const matchesTags = item.tags?.some(tag => tag.toLowerCase().includes(term));
                const matchesType = item.type?.toLowerCase().includes(term);
                if (!matchesName && !matchesTags && !matchesType) return false;
            }
            if (!collection.discoveredItems?.[item.id]) return false;
            return true;
        });
    }, [searchScope, searchTerm, collection]);

    const filteredEnemies = useMemo(() => {
        if (searchScope !== 'enemies') return { discovered: [] };
        const all = Object.values(getAllEnemies());
        const filtered = all.filter(enemy => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesName = enemy.name.toLowerCase().includes(term);
                const matchesTags = enemy.tags?.some(tag => tag.toLowerCase().includes(term));
                const matchesType = enemy.combatType?.toLowerCase().includes(term);
                if (!matchesName && !matchesTags && !matchesType) return false;
            }
            return true;
        });
        const discovered = filtered.filter(e => collection.discoveredEnemies?.[e.id]);
        return { discovered };
    }, [searchScope, searchTerm, collection]);

    const discoveryStats = useMemo(() => {
        if (searchScope === 'cards') {
            const allCards = Object.values(getAllCards()).filter(c => !c.id.includes('recruit') && !c.id.includes('area_dynamic'));
            const total = allCards.length;
            const discovered = allCards.filter(c => LibraryManager.isDiscovered(c.id)).length;
            return { total, discovered, label: 'Cards' };
        } else if (searchScope === 'items') {
            const allItems = Object.values(getAllItems());
            const total = allItems.length;
            const discovered = allItems.filter(i => collection.discoveredItems?.[i.id]).length;
            return { total, discovered, label: 'Items' };
        } else if (searchScope === 'enemies') {
            const allEnemies = Object.values(getAllEnemies());
            const total = allEnemies.length;
            const discovered = allEnemies.filter(e => collection.discoveredEnemies?.[e.id]).length;
            return { total, discovered, label: 'Enemies' };
        }
        return { total: 0, discovered: 0, label: '' };
    }, [searchScope, collection]);

    const toggleTypeFilter = (type) => {
        const next = new Set(typeFilters);
        if (next.has(type)) next.delete(type);
        else next.add(type);
        setTypeFilters(next);
    };

    const toggleSkillFilter = (skillId) => {
        const next = new Set(skillFilters);
        if (next.has(skillId)) next.delete(skillId);
        else next.add(skillId);
        setSkillFilters(next);
    };

    const toggleSubSkillFilter = (skillId) => {
        const next = new Set(subSkillFilters);
        if (next.has(skillId)) next.delete(skillId);
        else next.add(skillId);
        setSubSkillFilters(next);
    };

    const handleNavigationSearch = (term, mode, scope = 'items') => {
        setSearchTerm(term);
        if (mode) setSearchMode(mode);
        setSearchScope(scope);
        const catalog = document.getElementById('library-catalog');
        if (catalog) catalog.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleAreaFilter = (areaId) => {
        const next = new Set(areaFilters);
        if (next.has(areaId)) next.delete(areaId);
        else next.add(areaId);
        setAreaFilters(next);
    };

    const handleClearAll = () => {
        setSearchTerm('');
        setMinLevel('');
        setMaxLevel('');
        setTypeFilters(new Set());
        setSkillFilters(new Set());
        setSubSkillFilters(new Set());
        setAreaFilters(new Set());
        setStatusFilter('all');
        setSearchScope('cards');
        setSearchMode('name');
    };

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title="Collection Binder"
            maxWidth="max-w-[1360px]"
            className="h-[90vh] w-full mx-4"
        >
            <div className="flex h-full gap-8 overflow-hidden justify-center">
                {/* Column 1: Search & Filter */}
                <div className={cn(
                    "w-64 shrink-0 flex flex-col h-full rounded-xl border transition-all duration-500 overflow-hidden",
                    searchScope === 'cards' && "bg-gi-intent-blueprint/5 border-gi-intent-blueprint/20",
                    searchScope === 'items' && "bg-gi-gold/5 border-gi-gold/20",
                    searchScope === 'enemies' && "bg-gi-danger/5 border-gi-danger/20"
                )}>
                    <div className="p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                        <LibraryTabNavigation
                            searchScope={searchScope}
                            setSearchScope={setSearchScope}
                            setSearchMode={setSearchMode}
                            handleClearAll={handleClearAll}
                        />
                        <LibraryFilters
                            searchScope={searchScope}
                            searchMode={searchMode}
                            setSearchMode={setSearchMode}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            minLevel={minLevel}
                            setMinLevel={setMinLevel}
                            maxLevel={maxLevel}
                            setMaxLevel={setMaxLevel}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            typeFilters={typeFilters}
                            toggleTypeFilter={toggleTypeFilter}
                            skillFilters={skillFilters}
                            toggleSkillFilter={toggleSkillFilter}
                            subSkillFilters={subSkillFilters}
                            toggleSubSkillFilter={toggleSubSkillFilter}
                            areaFilters={areaFilters}
                            toggleAreaFilter={toggleAreaFilter}
                            areaSets={areaSets}
                            openDropdowns={openDropdowns}
                            toggleDropdown={toggleDropdown}
                        />
                    </div>
                </div>

                {/* Column 2: Card Catalog */}
                <div className="flex-1 max-w-[800px] min-w-0 flex flex-col h-full overflow-hidden">
                    <div id="library-catalog" className="flex-1 overflow-y-auto pr-4 custom-scrollbar flex flex-col pb-12 items-center">
                        {searchScope === 'cards' ? (
                            filteredSets.length > 0 ? (
                                filteredSets.map(set => {
                                    const setTotal = getSetTotal(set.id);
                                    const foundInSet = set.discovered.length;
                                    const isCollapsed = collapsedSets.has(set.id);

                                    return (
                                        <div key={set.id} className="w-full flex flex-col gap-4 items-center">
                                            <button
                                                onClick={() => toggleSet(set.id)}
                                                className="w-full max-w-[772px] flex items-center gap-4 group/header text-left hover:bg-white/5 p-2 rounded-lg transition-colors"
                                            >
                                                <div className="flex-1 flex items-center gap-6">
                                                    <h2 className="text-xl font-base text-gi-primary uppercase tracking-wider shrink-0">
                                                        {set.name}
                                                    </h2>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col gap-1 translate-y-[1px] w-fit">
                                                            <div className="text-[10px] text-gi-muted font-sans uppercase tracking-widest leading-none whitespace-nowrap">
                                                                {foundInSet} / {setTotal} Discovered
                                                            </div>
                                                            <div className="h-1 bg-gi-surface rounded-full overflow-hidden border border-gi-border/20 w-full">
                                                                <div
                                                                    className="h-full bg-gi-primary shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all duration-500"
                                                                    style={{ width: `${(foundInSet / setTotal) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={18} className={cn("text-gi-muted transition-transform duration-300", !isCollapsed && "rotate-90")} />
                                                    </div>
                                                </div>
                                            </button>

                                            {!isCollapsed && (
                                                <div className="w-full max-w-[672px] flex flex-col gap-1.5">
                                                    {set.discovered.map(template => {
                                                        const pips = LibraryManager.reconcileLocation(template.id);
                                                        const ownedInstances = pips.filter(p => p.status !== 'undiscovered');

                                                        if (ownedInstances.length === 0) {
                                                            return (
                                                                <LibraryCardBar
                                                                    key={`${template.id}-locked`}
                                                                    template={template}
                                                                    isLocked={true}
                                                                    isSelected={selectedTemplateId === template.id}
                                                                    onAction={() => {
                                                                        setSelectedTemplateId(template.id);
                                                                        setSelectedItemId(null);
                                                                        setSelectedEnemyId(null);
                                                                    }}
                                                                />
                                                            );
                                                        }

                                                        return ownedInstances.map((instance, idx) => (
                                                            <LibraryCardBar
                                                                key={`${template.id}-${idx}`}
                                                                template={template}
                                                                instance={instance}
                                                                isSelected={selectedTemplateId === template.id}
                                                                onAction={() => {
                                                                    setSelectedTemplateId(template.id);
                                                                    setSelectedItemId(null);
                                                                    setSelectedEnemyId(null);
                                                                }}
                                                                onToggle={() => {
                                                                    if (instance.status === 'available') {
                                                                        handleWithdraw(template.id);
                                                                    } else {
                                                                        handleReclaim(template.id, instance.areaId);
                                                                    }
                                                                }}
                                                            />
                                                        ));
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4 mt-20 opacity-40">
                                    <Search size={48} className="text-gi-muted" />
                                    <h3 className="text-lg font-base text-gi-muted uppercase">No cards found</h3>
                                </div>
                            )
                        ) : searchScope === 'items' ? (
                            filteredItems.length > 0 ? (
                                <div className="w-full flex flex-col gap-1.5 items-center">
                                    {filteredItems.map(item => (
                                        <LibraryItemBar
                                            key={item.id}
                                            item={item}
                                            isSelected={selectedItemId === item.id}
                                            onAction={() => {
                                                setSelectedItemId(item.id);
                                                setSelectedTemplateId(null);
                                                setSelectedEnemyId(null);
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-50 mt-20">
                                    <Box size={48} className="text-gi-muted mb-4" />
                                    <h3 className="text-lg font-base text-gi-muted uppercase">No items found</h3>
                                </div>
                            )
                        ) : (
                            filteredEnemies.discovered.length > 0 ? (
                                <div className="w-full flex flex-col gap-1.5 items-center">
                                    {filteredEnemies.discovered.map(enemy => (
                                        <LibraryEnemyBar
                                            key={enemy.id}
                                            enemy={enemy}
                                            isSelected={selectedEnemyId === enemy.id}
                                            onAction={() => {
                                                setSelectedEnemyId(enemy.id);
                                                setSelectedTemplateId(null);
                                                setSelectedItemId(null);
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-50 mt-20">
                                    <Skull size={48} className="text-gi-muted mb-4" />
                                    <h3 className="text-lg font-base text-gi-muted uppercase">No enemies found</h3>
                                </div>
                            )
                        )}
                    </div>
                    <div className="pt-4 pr-4 flex flex-col items-center">
                        <LibraryGlobalProgress stats={discoveryStats} />
                    </div>
                </div>

                {/* Column 3: Selected Gutter */}
                <div className="w-80 shrink-0 flex flex-col h-full bg-gi-base rounded-xl border border-gi-border/20 overflow-hidden relative">
                    <LibraryCardPreviewGutter
                        selectedTemplateId={selectedTemplateId}
                        selectedItemId={selectedItemId}
                        selectedEnemyId={selectedEnemyId}
                        productionData={productionData}
                        inputs={inputs}
                        outputs={outputs}
                        handleNavigationInspect={handleNavigationInspect}
                        handleNavigationSearch={handleNavigationSearch}
                    />
                </div>
            </div>
        </GIModal>
    );
};

export default CardLibraryModal;
