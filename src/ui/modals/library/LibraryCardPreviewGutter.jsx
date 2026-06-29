import React, { useMemo } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { cn } from '../../utils/cn.js';
import { 
    Archive, Trophy, Shield, Target, Hammer, Zap, Clock, Skull, Sword, HelpCircle, Book, Layout, Hand, Leaf, Map as MapIcon, PartyPopper
} from 'lucide-react';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getAreaSet, getAllAreaSets } from '../../../config/registries/areaSetRegistry.js';
import { getBiome } from '../../../config/registries/biomeRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { getEnemy, getAllEnemies } from '../../../config/registries/enemyRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { ItemIcon } from '../../components/base/ItemIcon.jsx';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { RegistryManager } from '../../../systems/progression/RegistryManager.js';
import { LibraryInspectionEntryBar, LibraryUndiscoveredGroup } from './LibraryAreaSetSection.jsx';

export const LibraryCardPreviewGutter = ({
    selectedTemplateId,
    selectedItemId,
    selectedEnemyId,
    productionData,
    inputs,
    outputs,
    handleNavigationInspect,
    handleNavigationSearch
}) => {
    const engine = useEngine();

    const selectedTemplate = useMemo(() => selectedTemplateId ? getCard(selectedTemplateId) : null, [selectedTemplateId]);
    const selectedItem = useMemo(() => selectedItemId ? getItem(selectedItemId) : null, [selectedItemId]);
    const selectedEnemy = useMemo(() => selectedEnemyId ? getEnemy(selectedEnemyId) : null, [selectedEnemyId]);

    const itemProvenance = useMemo(() => {
        if (!selectedItemId) return { producers: { discovered: [], undiscovered: [] }, consumers: { discovered: [], undiscovered: [] } };
        
        const allCards = Object.values(getAllAreaSets()).flatMap(set => set.cardPool || []).map(entry => getCard(entry.cardId)).filter(Boolean);
        const allEnemies = Object.values(getAllEnemies());

        // Helper to resolve outputs (duplicate of main resolution)
        const localResolveOutputs = (card) => {
            if (!card) return [];
            const traits = card.traits || [];
            const outputsList = [];
            traits.forEach(t => {
                if (t.type === 'loot') {
                    (t.items || []).forEach(i => outputsList.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
                } else if (t.type === 'reward') {
                    (t.rewards || []).forEach(i => outputsList.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
                } else if ((t.type === 'yield' || t.type === 'production') && t.itemId) {
                    outputsList.push({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1, chance: t.chance });
                }
            });
            const combatTrait = traits.find(t => t.type === 'combat');
            const enemyId = combatTrait?.enemyId || card.enemyId;
            if (enemyId) {
                const enemy = getEnemy(enemyId);
                if (enemy?.drops) {
                    enemy.drops.forEach(d => outputsList.push({ id: d.itemId, amount: d.maxQty || d.quantity || 1, chance: d.chance }));
                }
            }
            if (card.outputs && Array.isArray(card.outputs)) {
                card.outputs.forEach(o => {
                    if (!outputsList.some(existing => existing.id === o.itemId)) {
                        outputsList.push({ id: o.itemId, amount: o.quantity || o.amount || 1, chance: o.chance });
                    }
                });
            }
            return outputsList;
        };

        const localResolveInputs = (card) => {
            if (!card) return [];
            const traits = card.traits || [];
            const inputsList = traits
                .filter(t => t.type === 'inputslot' && t.itemId)
                .map(t => ({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1 }));
            if (card.inputs && Array.isArray(card.inputs)) {
                card.inputs.forEach(i => {
                    if (!inputsList.some(existing => existing.id === i.itemId)) {
                        inputsList.push({ id: i.itemId, amount: i.quantity || i.amount || 1 });
                    }
                });
            }
            return inputsList;
        };

        // 1. Find Producers (Output of)
        const producers = allCards.filter(card => {
            const outputsList = localResolveOutputs(card);
            const hasItem = outputsList.some(o => o.id === selectedItemId);
            if (!hasItem) return false;
            const isCombat = card.traits?.some(t => t.type === 'combat');
            if (isCombat) {
                const directTraits = (card.traits || []).filter(t => t.type === 'reward' || t.type === 'loot' || t.type === 'yield' || t.type === 'production');
                const hasDirect = directTraits.some(t => {
                    if (t.type === 'loot') return (t.items || []).some(i => i.itemId === selectedItemId);
                    if (t.type === 'reward') return (t.rewards || []).some(i => i.itemId === selectedItemId);
                    return t.itemId === selectedItemId;
                });
                return hasDirect;
            }
            return true;
        });

        const dropSources = allEnemies.filter(enemy => {
            const drops = enemy.drops || [];
            return drops.some(d => d.itemId === selectedItemId);
        });

        // 2. Find Consumers (Input for)
        const consumers = allCards.filter(card => {
            const inputsList = localResolveInputs(card);
            return inputsList.some(i => i.id === selectedItemId);
        });

        // 3. Map to provenance objects with discovery status
        const mapToDiscovered = (list, type) => {
            const discovered = [];
            const undiscovered = [];
            list.forEach(entity => {
                const isItemDiscovered = RegistryManager.isLootDiscovered(entity.id, selectedItemId);
                if (isItemDiscovered) {
                    discovered.push({
                        id: entity.id,
                        name: entity.name,
                        type,
                        intent: type === 'enemy' ? 'enemy' : (entity.traits?.some(t => t.type === 'combat') ? 'combat' : 'task')
                    });
                } else {
                    undiscovered.push({
                        type,
                        intent: type === 'enemy' ? 'enemy' : (entity.traits?.some(t => t.type === 'combat') ? 'combat' : 'task')
                    });
                }
            });
            return { discovered, undiscovered };
        };

        return {
            producers: {
                discovered: [
                    ...mapToDiscovered(producers, 'card').discovered,
                    ...mapToDiscovered(dropSources, 'enemy').discovered
                ],
                undiscovered: [
                    ...mapToDiscovered(producers, 'card').undiscovered,
                    ...mapToDiscovered(dropSources, 'enemy').undiscovered
                ]
            },
            consumers: mapToDiscovered(consumers, 'card')
        };
    }, [selectedItemId, engine]);

    const itemRequirements = useMemo(() => {
        if (!selectedItem) return [];
        if (Array.isArray(selectedItem.requirements)) {
            return selectedItem.requirements.filter(r => r.skill && r.level);
        }
        if (selectedItem.skillRequired && selectedItem.levelRequired) {
            return [{ skill: selectedItem.skillRequired, level: selectedItem.levelRequired }];
        }
        return [];
    }, [selectedItem]);

    if (selectedTemplate) {
        return (
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
                {/* Animated Background Banner */}
                <div className="absolute top-0 left-0 w-full h-96 overflow-hidden pointer-events-none">
                    <div 
                        className="w-full h-full bg-cover bg-center transition-transform duration-700 hover:scale-110"
                        style={{ backgroundImage: `url(${productionData.background})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gi-base/60 to-gi-base" />
                </div>

                <div className="relative z-10 p-6 flex flex-col gap-6">
                    {/* Header Info */}
                    <div className="flex flex-col items-center text-center gap-1 py-4">
                        <h2 className="text-2xl font-base text-white uppercase tracking-[0.1em] gi-text-outline">
                            {selectedTemplate.name}
                        </h2>
                        <div className="text-[10px] text-gi-primary font-display uppercase tracking-[0.2em] gi-text-outline">
                            {selectedTemplate.cardType} • {selectedTemplate.areaId?.replace('_', ' ')}
                        </div>
                    </div>

                    {/* Visual Spacer */}
                    <div className="h-48 pointer-events-none" aria-hidden="true" />
                    
                    {/* Essential Stats */}
                    {selectedTemplate.cardType !== 'combat' && (
                        <div className="grid grid-cols-2 gap-2 mt-2 w-full">
                            {productionData.stats.skill && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                                    <div className="w-8 h-8 rounded bg-gi-primary/10 flex items-center justify-center text-gi-primary border border-gi-primary/20">
                                        <Target size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Requirement</span>
                                        <span className="text-sm font-bold text-white uppercase">
                                            {productionData.stats.level} {productionData.stats.skill}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {productionData.stats.subskill && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                                    <div className="w-8 h-8 rounded bg-gi-primary/10 flex items-center justify-center text-gi-primary border border-gi-primary/20">
                                        <Hammer size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Subskill</span>
                                        <span className="text-sm font-bold text-white uppercase">{productionData.stats.subskill}</span>
                                    </div>
                                </div>
                            )}
                            {productionData.stats.energy !== null && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-gi-text border border-white/10">
                                        <Zap size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Energy Cost</span>
                                        <span className="text-sm font-bold text-white">{productionData.stats.energy}</span>
                                    </div>
                                </div>
                            )}
                            {productionData.stats.time && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-gi-text border border-white/10">
                                        <Clock size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Base Time</span>
                                        <span className="text-sm font-bold text-white">{Math.round(productionData.stats.time / 1000)} s</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                
                    {/* Resource Breakdown */}
                    <div className="flex flex-col gap-6 mt-4">
                        {/* Enemy Target (For Combat Cards) */}
                        {selectedTemplate.traits?.some(t => t.type === 'combat') && (
                            <div className="flex flex-col gap-3 border-t border-gi-border/20 pt-6">
                                <div className="flex flex-col items-center gap-1">
                                    <h3 className="text-xl font-base text-gi-danger uppercase tracking-widest gi-text-outline">
                                        Encounters
                                    </h3>
                                    <p className="text-[10px] font-display text-gi-muted uppercase tracking-[0.2em] gi-text-outline">
                                        Click to search
                                    </p>
                                </div>
                                {(() => {
                                    const combatTrait = selectedTemplate.traits.find(t => t.type === 'combat');
                                    const enemyId = combatTrait?.enemyId || selectedTemplate.enemyId;
                                    const enemyData = getEnemy(enemyId);
                                    if (!enemyData) return null;
                                    return (
                                        <div 
                                            onClick={() => handleNavigationSearch(enemyData.name, 'name', 'enemies')}
                                            className="flex items-center gap-3 p-3 rounded bg-gi-surface border border-gi-border hover:border-gi-danger/50 group/enemy cursor-pointer transition-all duration-200"
                                        >
                                            <div className="w-10 h-10 rounded bg-gi-danger/10 flex items-center justify-center border border-gi-danger/20 shadow-inner">
                                                <Skull size={24} className="text-gi-danger" />
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="text-sm font-bold text-white uppercase group-hover/enemy:text-gi-danger transition-colors">
                                                    {enemyData.name}
                                                </div>
                                                <div className="text-[10px] text-gi-muted uppercase tracking-wider">
                                                    {enemyData.combatType} • Lvl {enemyData.level}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {selectedTemplate.cardType !== 'combat' && (
                            <div className="flex flex-col items-center gap-1 border-t border-gi-border/20 pt-6">
                                <h3 className="text-xl font-base text-gi-primary uppercase tracking-widest gi-text-outline">
                                    Production
                                </h3>
                                <p className="text-[10px] font-display text-gi-muted uppercase tracking-[0.2em] gi-text-outline">
                                    Click to search
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-6">
                            {/* Inputs */}
                            {selectedTemplate.cardType !== 'combat' && (
                                <div className="flex flex-col gap-3">
                                    <div className="text-sm font-bold text-white uppercase tracking-wider">Inputs</div>
                                    <div className="flex flex-col gap-1.5">
                                        {inputs.length > 0 ? (
                                            inputs.map((input, idx) => {
                                                const itemData = getItem(input.id);
                                                const name = input.isTool ? input.name : (itemData?.name || input.id);
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        onClick={!input.isTool ? () => handleNavigationInspect(input.id, 'item') : undefined}
                                                        onContextMenu={!input.isTool ? (e) => {
                                                            e.preventDefault();
                                                            handleNavigationSearch(name, 'output', 'items');
                                                        } : undefined}
                                                        className={cn(
                                                            "flex items-center justify-between p-2 rounded bg-gi-surface border border-gi-border transition-all duration-200 w-full text-left",
                                                            !input.isTool ? "hover:border-gi-primary/50 group/item cursor-pointer" : "opacity-80 border-white/5"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {input.isTool ? (
                                                                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10 text-white/20">
                                                                    <Hammer size={16} />
                                                                </div>
                                                            ) : (
                                                                <ItemIcon item={input.id} size={32} />
                                                            )}
                                                            <span className={cn(
                                                                "text-sm font-bold uppercase transition-colors",
                                                                !input.isTool ? "text-white group-hover/item:text-gi-primary" : "text-white/60"
                                                            )}>
                                                                {name}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-bold text-gi-primary">
                                                            {input.isTool ? 'T' + input.amount : 'x' + input.amount}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-xs text-gi-muted italic px-2">No resource requirements</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Outputs */}
                            <div className="flex flex-col gap-3">
                                <div className="text-sm font-bold text-white uppercase tracking-wider">
                                    {selectedTemplate.cardType === 'combat' ? 'Loot' : 'Outputs'}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    {outputs.length > 0 ? (
                                            outputs.map((output, idx) => {
                                                const itemData = getItem(output.id);
                                                const name = output.isXP ? output.name : (itemData?.name || output.id);
                                                const isDiscovered = output.isXP || RegistryManager.isLootDiscovered(selectedTemplateId, output.id);

                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={(!output.isXP && isDiscovered) ? () => handleNavigationInspect(output.id, 'item') : undefined}
                                                    onContextMenu={(!output.isXP && isDiscovered) ? (e) => {
                                                        e.preventDefault();
                                                        handleNavigationSearch(name, 'input', 'items');
                                                    } : undefined}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 rounded bg-gi-surface border border-gi-border transition-all duration-200 w-full text-left",
                                                        (!output.isXP && isDiscovered) ? "hover:border-gi-primary/50 group/item cursor-pointer" : "opacity-80 border-white/5"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {output.isXP ? (
                                                            <div className="w-8 h-8 rounded bg-gi-gold/20 flex items-center justify-center border border-gi-gold/30">
                                                                <Zap size={16} className="text-gi-gold" />
                                                            </div>
                                                        ) : isDiscovered ? (
                                                            <ItemIcon item={output.id} size={32} />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10 text-white/20">
                                                                <HelpCircle size={16} />
                                                            </div>
                                                        )}
                                                        <span className={cn(
                                                            "text-sm font-bold uppercase transition-colors",
                                                            isDiscovered ? "text-white group-hover/item:text-gi-primary" : "text-white/20"
                                                        )}>
                                                            {isDiscovered ? name : "???"}
                                                        </span>
                                                    </div>
                                                    {isDiscovered && (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-sm font-bold text-gi-primary">x{output.amount}</span>
                                                            {output.chance && <span className="text-[10px] text-gi-muted font-pixel">{output.chance}%</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-xs text-gi-muted italic px-2">No production outputs</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (selectedItem) {
        return (
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
                <div className="relative z-10 p-6 flex flex-col gap-6">
                    {/* Header Info */}
                    <div className="flex flex-col items-center text-center gap-1 py-4">
                        <div className="w-24 h-24 flex items-center justify-center bg-gi-surface border-2 border-gi-border/40 rounded-xl shadow-2xl mb-2">
                            <ItemIcon item={selectedItem.id} size={64} className="pixel-art" />
                        </div>
                        <h2 className="text-2xl font-base text-white uppercase tracking-[0.1em] gi-text-outline">
                            {selectedItem.name}
                        </h2>
                        <div className="text-[10px] text-gi-muted font-display uppercase tracking-[0.2em] gi-text-outline">
                            {selectedItem.type || 'Resource'} • Global Collection
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-2 mt-2 w-full">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-gi-text border border-white/10">
                                <Archive size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Owned</span>
                                <span className="text-sm font-bold text-white">{engine.InventoryManager?.getItemCount(selectedItem.id) || 0}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-gi-text border border-white/10">
                                <Trophy size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Lifetime</span>
                                <span className="text-sm font-bold text-white">{GameState?.collection?.itemLifetimeCounts?.[selectedItem.id] || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Requirements Section */}
                    {itemRequirements.length > 0 && (
                        <div className="flex flex-col gap-3 mt-4 border-t border-gi-border/20 pt-6">
                            <div className="flex flex-col items-center gap-1">
                                <h3 className="text-xl font-base text-gi-primary uppercase tracking-widest gi-text-outline">
                                    Gating & Requirements
                                </h3>
                                <p className="text-[10px] font-display text-gi-muted uppercase tracking-[0.2em] gi-text-outline">
                                    Hero Skill Requirements to Equip
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 w-full mt-2">
                                {itemRequirements.map((req, idx) => {
                                    const skillDef = getSkill(req.skill);
                                    const skillName = skillDef ? skillDef.name : req.skill;
                                    return (
                                        <div 
                                            key={idx}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20 hover:border-gi-primary/40 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded bg-gi-primary/10 flex items-center justify-center text-gi-primary border border-gi-primary/20">
                                                <Shield size={16} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Required Skill</span>
                                                <span className="text-sm font-bold text-white uppercase">
                                                    {skillName} Level {req.level}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Production Sections */}
                    <div className="flex flex-col gap-8 mt-4">
                        <div className="flex flex-col items-center gap-1 border-t border-gi-border/20 pt-6">
                            <h3 className="text-xl font-base text-gi-primary uppercase tracking-widest gi-text-outline">
                                Production
                            </h3>
                            <p className="text-[10px] font-display text-gi-muted uppercase tracking-[0.2em] gi-text-outline">
                                Left Click to Inspect • Right Click to Search
                            </p>
                        </div>

                        {/* Output Of Section */}
                        <div className="flex flex-col gap-4">
                            <div className="text-xs font-bold text-white uppercase tracking-wider opacity-60 px-1">
                                Output Of
                            </div>
                            <div className="flex flex-col gap-2">
                                {itemProvenance.producers.discovered.length > 0 ? (
                                    itemProvenance.producers.discovered.map((source) => (
                                        <LibraryInspectionEntryBar 
                                            key={source.id}
                                            item={source}
                                            onInspect={() => handleNavigationInspect(source.id, source.type)}
                                            onSearch={() => handleNavigationSearch(source.name, 'name', source.type === 'enemy' ? 'enemies' : 'cards')}
                                        />
                                    ))
                                ) : null}

                                {/* Undiscovered Producers Group */}
                                <LibraryUndiscoveredGroup 
                                    count={itemProvenance.producers.undiscovered.length} 
                                    items={itemProvenance.producers.undiscovered} 
                                    isInspection={true}
                                />

                                {itemProvenance.producers.discovered.length === 0 && itemProvenance.producers.undiscovered.length === 0 && (
                                    <div className="p-6 text-center border border-dashed border-white/5 rounded-lg opacity-40">
                                        <p className="text-[10px] text-gi-muted uppercase tracking-widest font-sans">No known production sources</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Input For Section */}
                        <div className="flex flex-col gap-4">
                            <div className="text-xs font-bold text-white uppercase tracking-wider opacity-60 px-1">
                                Input For
                            </div>
                            <div className="flex flex-col gap-2">
                                {itemProvenance.consumers.discovered.length > 0 ? (
                                    itemProvenance.consumers.discovered.map((source) => (
                                        <LibraryInspectionEntryBar 
                                            key={source.id}
                                            item={source}
                                            onInspect={() => handleNavigationInspect(source.id, source.type)}
                                            onSearch={() => handleNavigationSearch(source.name, 'name', 'cards')}
                                        />
                                    ))
                                ) : null}

                                {/* Undiscovered Consumers Group */}
                                <LibraryUndiscoveredGroup 
                                    count={itemProvenance.consumers.undiscovered.length} 
                                    items={itemProvenance.consumers.undiscovered} 
                                    isInspection={true}
                                />

                                {itemProvenance.consumers.discovered.length === 0 && itemProvenance.consumers.undiscovered.length === 0 && (
                                    <div className="p-6 text-center border border-dashed border-white/5 rounded-lg opacity-40">
                                        <p className="text-[10px] text-gi-muted uppercase tracking-widest font-sans">No known uses</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (selectedEnemy) {
        return (
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
                 <div className="relative z-10 p-6 flex flex-col gap-6">
                    {/* Header Info */}
                    <div className="flex flex-col items-center text-center gap-1 py-4">
                        <div className="w-24 h-24 flex items-center justify-center bg-gi-danger/5 border-2 border-gi-danger/20 rounded-xl shadow-2xl mb-2">
                            <span className="text-6xl leading-none">{selectedEnemy.icon || '💀'}</span>
                        </div>
                        <h2 className="text-2xl font-base text-gi-danger uppercase tracking-[0.1em] gi-text-outline">
                            {selectedEnemy.name}
                        </h2>
                        <div className="text-[10px] text-gi-muted font-display uppercase tracking-[0.2em] gi-text-outline">
                            Tier {selectedEnemy.tier || 1} • {selectedEnemy.combatType || 'Combat'}
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-2 mt-2 w-full">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                            <div className="w-8 h-8 rounded bg-gi-danger/10 flex items-center justify-center text-gi-danger border border-gi-danger/20">
                                <Skull size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Defeated</span>
                                <span className="text-sm font-bold text-white">{GameState?.collection?.enemyKillCounts?.[selectedEnemy.id] || 0}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                            <div className="w-8 h-8 rounded bg-gi-primary/10 flex items-center justify-center text-gi-primary border border-gi-primary/20">
                                <Target size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Level</span>
                                <span className="text-sm font-bold text-white">{selectedEnemy.level || 1}</span>
                            </div>
                        </div>
                    </div>

                    {/* Loot Pool */}
                    <div className="flex flex-col gap-6 mt-4">
                        <div className="flex flex-col items-center gap-1 border-t border-gi-border/20 pt-6">
                            <h3 className="text-xl font-base text-gi-danger uppercase tracking-widest gi-text-outline">
                                Loot Pool
                            </h3>
                            <p className="text-[10px] font-display text-gi-muted uppercase tracking-[0.2em] gi-text-outline">
                                Possible Drops
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {(selectedEnemy.drops || []).map((drop, idx) => {
                                const itemData = getItem(drop.itemId);
                                const isDiscovered = RegistryManager.isLootDiscovered(selectedEnemy.id, drop.itemId);
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={isDiscovered ? () => handleNavigationInspect(drop.itemId, 'item') : undefined}
                                        onContextMenu={isDiscovered ? (e) => {
                                            e.preventDefault();
                                            handleNavigationSearch(itemData?.name || drop.itemId, 'name', 'items');
                                        } : undefined}
                                        className={cn(
                                            "flex items-center justify-between p-3 rounded bg-gi-surface border border-gi-border transition-all duration-200 w-full text-left",
                                            isDiscovered ? "hover:border-gi-danger/50 group/drop cursor-pointer" : "opacity-60 border-white/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isDiscovered ? (
                                                <ItemIcon item={drop.itemId} size={32} className="pixel-art" />
                                            ) : (
                                                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10 text-white/20">
                                                    <HelpCircle size={16} />
                                                </div>
                                            )}
                                            <span className={cn(
                                                "text-sm font-bold uppercase transition-colors",
                                                isDiscovered ? "text-white group-hover/drop:text-gi-danger" : "text-white/20"
                                            )}>
                                                {isDiscovered ? (itemData?.name || drop.itemId) : "???"}
                                            </span>
                                        </div>
                                        {isDiscovered && <span className="text-xs text-gi-muted font-pixel">{drop.chance}%</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gi-surface flex items-center justify-center border border-white/5 text-gi-muted opacity-20">
                <Book size={48} />
            </div>
            <div className="flex flex-col gap-1">
                <h3 className="text-xl font-base text-gi-muted uppercase">Select an Entry</h3>
                <p className="text-sm text-gi-muted/60 font-sans max-w-[240px]">
                    Browse the collection on the left to see detailed production data, loot pools, and provenance.
                </p>
            </div>
        </div>
    );
};
