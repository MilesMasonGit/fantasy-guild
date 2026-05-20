import React, { useState, useMemo } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import GIModal from '../components/base/GIModal.jsx';
import GISurface from '../components/base/GISurface.jsx';
import LibraryPip from '../components/library/LibraryPip.jsx';
import { getAllAreaSets, getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { getCard, getAllCards } from '../../config/registries/cardRegistry.js';
import { getSetTotal } from '../../config/registries/areaSetRegistry.js';
import * as LibraryManager from '../../systems/cards/LibraryManager.js';
import {
    Book, Trophy, MapPin, Archive, Info, Hand, Hammer,
    Map as MapIcon, Skull, Sword, PartyPopper, Leaf, HelpCircle, Layout,
    ArrowRight, Box, Package, Search, Filter,
    CheckCircle2, Circle, ChevronDown, ChevronRight, Check,
    Clock, Zap, Star, Shield, Target, Plus, Minus
} from 'lucide-react';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { BadgeItem } from '../components/hud/BadgeGutter.jsx';
import { getSkill, getAllSkills, SUB_SKILL_TO_PARENT } from '../../config/registries/skillRegistry.js';
import ActiveCardFace from '../components/ActiveCardFace.jsx';
import { getEnemy, getAllEnemies } from '../../config/registries/enemyRegistry.js';
import { getItem, getAllItems } from '../../config/registries/itemRegistry.js';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { Badge } from '../components/base/Badge.jsx';
import { RegistryManager } from '../../systems/progression/RegistryManager.js';

/**
 * CardLibraryModal: The "Binder". Displays all cards in the game (grouped by Area Set),
 * showing owned counts and exact locations for every copy via pips.
 */
const CardLibraryModal = ({ isOpen, onClose }) => {
    const engine = useEngine();
    const areaSets = useMemo(() => Object.values(getAllAreaSets()), []);

    // Helper to resolve all outputs for a card (including enemy drops)
    const resolveOutputs = (card) => {
        if (!card) return [];
        const traits = card.traits || [];
        const outputs = [];

        // 1. Direct Traits (Loot, Reward, Yield)
        traits.forEach(t => {
            if (t.type === 'loot') {
                (t.items || []).forEach(i => outputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
            } else if (t.type === 'reward') {
                (t.rewards || []).forEach(i => outputs.push({ id: i.itemId, amount: i.quantity || i.amount || 1, chance: i.chance }));
            } else if ((t.type === 'yield' || t.type === 'production') && t.itemId) {
                outputs.push({ id: t.itemId, amount: t.quantity || t.count || t.amount || 1, chance: t.chance });
            }
        });

        // 2. Enemy Drops (Combat Cards)
        const combatTrait = traits.find(t => t.type === 'combat');
        const enemyId = combatTrait?.enemyId || card.enemyId;
        if (enemyId) {
            const enemy = getEnemy(enemyId);
            if (enemy?.drops) {
                enemy.drops.forEach(d => outputs.push({ id: d.itemId, amount: d.maxQty || d.quantity || 1, chance: d.chance }));
            }
        }

        // 3. Top-level outputs (Compatibility)
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
        
        // 1. Top-level inputs (Compatibility)
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
    const [previewTab, setPreviewTab] = useState(null);
    const [openDropdowns, setOpenDropdowns] = useState(new Set(['types', 'status']));
    const [searchTerm, setSearchTerm] = useState('');
    const [searchScope, setSearchScope] = useState('cards'); // cards, items
    const [searchMode, setSearchMode] = useState('name'); // cards: name; items: input, output, tag
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

    // Subscribe to collection changes (playsets, discoveries, provenance)
    const collection = useGameState(state => state.collection || {}, ['state_changed', 'collection_updated', 'registry_updated']);
    const playsets = collection.playsets || {};
    
    // We also need to listen to card movements to re-reconcile locations
    const _cardsRevision = useGameState(state => state.cards?._rev || 0, ['cards_updated', 'state_changed']);

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

    const selectedTemplate = useMemo(() => {
        if (selectedTemplateId) return getCard(selectedTemplateId);
        return null;
    }, [selectedTemplateId]);

    const selectedItem = useMemo(() => {
        if (selectedItemId) return getItem(selectedItemId);
        return null;
    }, [selectedItemId]);

    const selectedEnemy = useMemo(() => {
        if (selectedEnemyId) return getEnemy(selectedEnemyId);
        return null;
    }, [selectedEnemyId]);

    // Derived Production & Stats for the selected card
    const productionData = useMemo(() => {
        if (!selectedTemplate) return { inputs: [], outputs: [], stats: { level: 1 }, background: null };
        const traits = selectedTemplate.traits || [];
        const config = selectedTemplate.config || {};
        const rawSkill = config.skill || null;
        const parentSkill = SUB_SKILL_TO_PARENT[rawSkill] || rawSkill;
        const subskill = SUB_SKILL_TO_PARENT[rawSkill] ? rawSkill : (config.subskill || null);

        // Resolve Background
        const bgId = selectedTemplate.background || getBiome(selectedTemplate.areaId)?.backgroundImage || getAreaSet(selectedTemplate.areaSet)?.areaArt;
        const background = bgId ? resolveSpritePath(bgId) : null;

        // 1. Resolve Inputs (Traits + Tools)
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

        // 2. Resolve Outputs (Traits + XP)
        const outputs = resolveOutputs(selectedTemplate);
        const xpValue = config.xp || selectedTemplate.xpAwarded || 0;
        if (xpValue > 0) {
            const skillLabel = parentSkill ? (parentSkill.charAt(0).toUpperCase() + parentSkill.slice(1)) : 'General';
            outputs.unshift({
                id: 'xp_stat',
                name: `${skillLabel} XP`,
                amount: xpValue,
                isXP: true,
                chance: null // Hide percentage
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
                energy: config.energyCost || 1 // Default to 1 if not specified
            }
        };
    }, [selectedTemplate]);

    const { inputs, outputs } = productionData;

    // Derived filtered card sets
    const filteredSets = useMemo(() => {
        return areaSets.map(set => {
            const cards = (set.cardPool || []).map(entry => getCard(entry.cardId)).filter(Boolean);

            const filteredCards = cards.filter(card => {
                // Text Search based on Scope and Mode
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    if (searchScope === 'cards') {
                        if (!card.name.toLowerCase().includes(term)) return false;
                    }
                }

                // Type Filter
                if (typeFilters.size > 0 && !typeFilters.has(card.cardType?.toLowerCase())) return false;

                // Status Filter
                const pips = LibraryManager.reconcileLocation(card.id);
                const isDiscovered = pips.some(p => p.status !== 'undiscovered');
                if (statusFilter === 'discovered' && !isDiscovered) return false;
                if (statusFilter === 'undiscovered' && isDiscovered) return false;
                if (statusFilter === 'playmat' && !pips.some(p => p.status === 'in-use')) return false;
                if (statusFilter === 'storage' && !pips.some(p => p.status === 'available')) return false;

                // Skill Filter
                if (skillFilters.size > 0) {
                    const cardSkills = (card.traits || [])
                        .filter(t => t.type === 'requirement' || t.type === 'skill')
                        .map(t => t.skillId)
                        .filter(Boolean);

                    const matches = cardSkills.some(s => {
                        if (skillFilters.has(s)) return true;
                        // Handle 'Combat' group
                        if (skillFilters.has('combat') && ['melee', 'ranged', 'magic'].includes(s)) return true;
                        return false;
                    });

                    if (!matches) return false;
                }

                // Sub-skill Filter
                if (subSkillFilters.size > 0) {
                    const cardSkills = (card.traits || [])
                        .filter(t => t.type === 'requirement' || t.type === 'skill')
                        .map(t => t.skillId)
                        .filter(Boolean);

                    if (!cardSkills.some(s => subSkillFilters.has(s))) return false;
                }

                // Area Filter
                if (areaFilters.size > 0) {
                    const cardSetId = card.areaSet || card.areaId;
                    if (!areaFilters.has(cardSetId)) return false;
                }

                // Level Filter
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
            // Discovery Filter
            if (!collection.discoveredItems?.[item.id]) return false;

            return true;
        });
    }, [searchScope, searchTerm, collection]);

    const filteredEnemies = useMemo(() => {
        if (searchScope !== 'enemies') return { discovered: [], undiscovered: [] };
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

        const discovered = filtered.filter(e => GameState.state?.collection?.discoveredEnemies?.[e.id]);

        return { discovered };
    }, [searchScope, searchTerm, collection]);

    const discoveryStats = useMemo(() => {
        if (searchScope === 'cards') {
            const allCards = Object.values(getAllCards()).filter(c => !c.id.includes('recruit') && !c.id.includes('area_dynamic')); // Filter out technical cards
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

    // Derived provenance for selected items
    const itemProvenance = useMemo(() => {
        if (!selectedItemId) return { producers: { discovered: [], undiscovered: [] }, consumers: { discovered: [], undiscovered: [] } };
        
        const allCards = Object.values(getAllAreaSets()).flatMap(set => set.cardPool || []).map(entry => getCard(entry.cardId)).filter(Boolean);
        const allEnemies = Object.values(getAllEnemies());

        // 1. Find Producers (Output of)
        const producers = allCards.filter(card => {
            const outputs = resolveOutputs(card);
            const hasItem = outputs.some(o => o.id === selectedItemId);
            if (!hasItem) return false;

            // Combat cards are sources of enemies, not items directly
            // Only include them if they have a non-combat way to produce the item
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
            const inputs = resolveInputs(card);
            return inputs.some(i => i.id === selectedItemId);
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
    }, [selectedItemId, areaSets, collection]);

    // Toggle Type Filter
    const toggleTypeFilter = (type) => {
        const next = new Set(typeFilters);
        if (next.has(type)) next.delete(type);
        else next.add(type);
        setTypeFilters(next);
    };

    // Toggle Skill Filter
    const toggleSkillFilter = (skillId) => {
        const next = new Set(skillFilters);
        if (next.has(skillId)) next.delete(skillId);
        else next.add(skillId);
        setSkillFilters(next);
    };

    // Toggle Sub-skill Filter
    const toggleSubSkillFilter = (skillId) => {
        const next = new Set(subSkillFilters);
        if (next.has(skillId)) next.delete(skillId);
        else next.add(skillId);
        setSubSkillFilters(next);
    };

    // Navigation Search Helper (Switches tabs and populates search)
    const handleNavigationSearch = (term, mode, scope = 'items') => {
        setSearchTerm(term);
        if (mode) setSearchMode(mode);
        setSearchScope(scope);
        // Scroll to top of catalog
        const catalog = document.getElementById('library-catalog');
        if (catalog) catalog.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Toggle Area Filter
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

    // Mock state for previewing templates in the library
    const previewCardState = useMemo(() => {
        if (!selectedTemplate) return null;
        return {
            id: 'preview',
            templateId: selectedTemplate.id,
            traits: selectedTemplate.traits || [],
            status: 'idle',
            progress: 0,
            areaId: 'guild_hall_v1', // Default context
            assignedIds: [],
            isGhost: true // Optimization hint
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
            <div className="flex h-full gap-8 overflow-hidden justify-center">
                {/* Column 1: Search & Filter */}
                <div className={cn(
                    "w-64 shrink-0 flex flex-col h-full rounded-xl border transition-all duration-500 overflow-hidden",
                    searchScope === 'cards' && "bg-gi-intent-blueprint/5 border-gi-intent-blueprint/20",
                    searchScope === 'items' && "bg-gi-gold/5 border-gi-gold/20",
                    searchScope === 'enemies' && "bg-gi-danger/5 border-gi-danger/20"
                )}>
                    <div className="p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                        {/* Search Section */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-display font-bold text-gi-primary uppercase tracking-widest flex items-center gap-2">
                                    <Search size={14} />
                                    Search
                                </label>
                                <button
                                    onClick={handleClearAll}
                                    className="text-[10px] font-display font-bold text-gi-gold hover:text-white uppercase tracking-widest transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                            {/* Search Scope Stack */}
                            <div className="flex flex-col gap-2">
                                {[
                                    { id: 'cards', label: 'Cards', icon: Book },
                                    { id: 'items', label: 'Items', icon: Box },
                                    { id: 'enemies', label: 'Enemies', icon: Skull }
                                ].map(s => {
                                    const Icon = s.icon;
                                    const isActive = searchScope === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => {
                                                setSearchScope(s.id);
                                                setSearchMode('name');
                                            }}
                                            className={cn(
                                                "w-full flex items-center px-6 py-4 rounded-xl border-2 transition-all relative group",
                                                isActive
                                                    ? "bg-white/5 border-white/40 text-white"
                                                    : "bg-transparent border-white/5 text-gi-muted hover:border-white/20 hover:bg-white/5"
                                            )}
                                        >
                                            {isActive && (
                                                <ChevronRight 
                                                    size={20} 
                                                    strokeWidth={3} 
                                                    className="absolute left-2 text-white animate-in fade-in slide-in-from-left-1 duration-300" 
                                                />
                                            )}
                                            
                                            <div className={cn(
                                                "flex items-center gap-4 transition-transform duration-300",
                                                isActive ? "translate-x-8" : "translate-x-0"
                                            )}>
                                                <Icon size={24} strokeWidth={2.5} />
                                                <span className="text-lg font-display font-bold uppercase tracking-widest">
                                                    {s.label}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Contextual Search Parameters (Enemies) */}
                            {searchScope === 'enemies' && (
                                <div className="flex gap-1 p-1 bg-black/20 rounded-lg border border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {[
                                        { id: 'name', label: 'Name' },
                                        { id: 'drop', label: 'Drop' },
                                        { id: 'type', label: 'Type' }
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setSearchMode(m.id)}
                                            className={cn(
                                                "flex-1 py-1 rounded-md text-[9px] font-display font-bold uppercase tracking-tighter transition-all",
                                                searchMode === m.id
                                                    ? "bg-gi-primary text-gi-primary-text"
                                                    : "text-gi-muted hover:text-gi-text"
                                            )}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Search Controls */}
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={
                                            searchScope === 'cards' ? "Search by name..." :
                                            searchScope === 'items' ? "Search Name or Tag" :
                                            `Search by ${searchMode}...`
                                        }
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-sans focus:outline-none focus:border-gi-primary/50 transition-colors"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="text-gi-muted hover:text-gi-text"
                                            >
                                                &times;
                                            </button>
                                        )}
                                        <Search size={14} className="text-gi-muted" />
                                    </div>
                                </div>

                                {/* Level Range Filters */}
                                {searchScope !== 'items' && (
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                value={minLevel}
                                                onChange={(e) => setMinLevel(e.target.value)}
                                                placeholder="Min Lvl"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-sans focus:outline-none focus:border-gi-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                value={maxLevel}
                                                onChange={(e) => setMaxLevel(e.target.value)}
                                                placeholder="Max Lvl"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-sans focus:outline-none focus:border-gi-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Discovery Toggles */}
                        <div className="flex flex-col gap-1.5">
                            <button
                                onClick={() => setStatusFilter(statusFilter === 'discovered' ? 'all' : 'discovered')}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                    statusFilter === 'discovered'
                                        ? "bg-gi-primary/10 border border-gi-primary/30 text-gi-primary"
                                        : "hover:bg-white/5 text-gi-muted"
                                )}
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                    statusFilter === 'discovered' ? "bg-gi-primary border-gi-primary" : "border-white/20 bg-black/20"
                                )}>
                                    {statusFilter === 'discovered' && <Check size={10} className="text-black" strokeWidth={4} />}
                                </div>
                                <span className="flex-1 text-left">Discovered</span>
                            </button>
                            <button
                                onClick={() => setStatusFilter(statusFilter === 'undiscovered' ? 'all' : 'undiscovered')}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                    statusFilter === 'undiscovered'
                                        ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                        : "hover:bg-white/5 text-gi-muted"
                                )}
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                    statusFilter === 'undiscovered' ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                )}>
                                    {statusFilter === 'undiscovered' && <Check size={10} className="text-black" strokeWidth={4} />}
                                </div>
                                <span className="flex-1 text-left">Missing</span>
                            </button>

                            {searchScope !== 'items' && (
                                <>
                                    <button
                                        onClick={() => setStatusFilter(statusFilter === 'playmat' ? 'all' : 'playmat')}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                            statusFilter === 'playmat'
                                                ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                : "hover:bg-white/5 text-gi-muted"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                            statusFilter === 'playmat' ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                        )}>
                                            {statusFilter === 'playmat' && <Check size={10} className="text-black" strokeWidth={4} />}
                                        </div>
                                        <span className="flex-1 text-left">On Playmat</span>
                                    </button>

                                    <button
                                        onClick={() => setStatusFilter(statusFilter === 'storage' ? 'all' : 'storage')}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                            statusFilter === 'storage'
                                                ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                : "hover:bg-white/5 text-gi-muted"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                            statusFilter === 'storage' ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                        )}>
                                            {statusFilter === 'storage' && <Check size={10} className="text-black" strokeWidth={4} />}
                                        </div>
                                        <span className="flex-1 text-left">In Storage</span>
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Advanced Filters (Hidden in Item Mode) */}
                        {searchScope !== 'items' && (
                            <div className="flex flex-col gap-8">
                                {/* Card Types Dropdown */}
                                <div className="flex flex-col border-b border-gi-border/20 pb-2">
                                    <button
                                        onClick={() => toggleDropdown('types')}
                                        className="flex items-center justify-between w-full py-2 group/drop"
                                    >
                                        <label className="text-[10px] font-display font-bold text-gi-primary uppercase tracking-widest flex items-center gap-2 cursor-pointer group-hover/drop:text-gi-gold transition-colors">
                                            <Box size={14} />
                                            Card Types
                                            {typeFilters.size > 0 && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gi-primary/20 text-[8px] text-gi-primary">
                                                    {typeFilters.size}
                                                </span>
                                            )}
                                        </label>
                                        <ChevronDown
                                            size={14}
                                            className={cn(
                                                "text-gi-muted transition-transform duration-300",
                                                !openDropdowns.has('types') && "-rotate-90"
                                            )}
                                        />
                                    </button>

                                    {openDropdowns.has('types') && (
                                        <div className="flex flex-col gap-1 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {['Combat', 'Task', 'Project', 'Blueprint', 'Artifact'].map(type => {
                                                const t = type.toLowerCase();
                                                const isActive = typeFilters.has(t);
                                                return (
                                                    <button
                                                        key={type}
                                                        onClick={() => toggleTypeFilter(t)}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                                            isActive
                                                                ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                                : "hover:bg-white/5 text-gi-muted"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                            isActive ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                                        )}>
                                                            {isActive && <Check size={10} className="text-black" strokeWidth={4} />}
                                                        </div>
                                                        <span className="flex-1 text-left">{type}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Skills Dropdown */}
                                <div className="flex flex-col border-b border-gi-border/20 pb-2">
                                    <button
                                        onClick={() => toggleDropdown('skills')}
                                        className="flex items-center justify-between w-full py-2 group/drop"
                                    >
                                        <label className="text-[10px] font-display font-bold text-gi-primary uppercase tracking-widest flex items-center gap-2 cursor-pointer group-hover/drop:text-gi-gold transition-colors">
                                            <Sword size={14} />
                                            Skills
                                            {skillFilters.size > 0 && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gi-primary/20 text-[8px] text-gi-primary">
                                                    {skillFilters.size}
                                                </span>
                                            )}
                                        </label>
                                        <ChevronDown
                                            size={14}
                                            className={cn(
                                                "text-gi-muted transition-transform duration-300",
                                                !openDropdowns.has('skills') && "-rotate-90"
                                            )}
                                        />
                                    </button>

                                    {openDropdowns.has('skills') && (
                                        <div className="flex flex-col gap-1 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {[
                                                { id: 'combat', name: 'Combat' },
                                                { id: 'industry', name: 'Industry' },
                                                { id: 'nature', name: 'Nature' },
                                                { id: 'nautical', name: 'Nautical' },
                                                { id: 'crafting', name: 'Crafting' },
                                                { id: 'culinary', name: 'Culinary' },
                                                { id: 'crime', name: 'Crime' },
                                                { id: 'occult', name: 'Occult' },
                                                { id: 'science', name: 'Science' }
                                            ].map(skill => {
                                                const isActive = skillFilters.has(skill.id);
                                                return (
                                                    <button
                                                        key={skill.id}
                                                        onClick={() => toggleSkillFilter(skill.id)}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                                            isActive
                                                                ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                                : "hover:bg-white/5 text-gi-muted"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                            isActive ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                                        )}>
                                                            {isActive && <Check size={10} className="text-black" strokeWidth={4} />}
                                                        </div>
                                                        <span className="flex-1 text-left">{skill.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Sub-skills Dropdown */}
                                <div className="flex flex-col border-b border-gi-border/20 pb-2">
                                    <button
                                        onClick={() => toggleDropdown('subskills')}
                                        className="flex items-center justify-between w-full py-2 group/drop"
                                    >
                                        <label className="text-[10px] font-display font-bold text-gi-primary uppercase tracking-widest flex items-center gap-2 cursor-pointer group-hover/drop:text-gi-gold transition-colors">
                                            <Hand size={14} />
                                            Sub-skills
                                            {subSkillFilters.size > 0 && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gi-primary/20 text-[8px] text-gi-primary">
                                                    {subSkillFilters.size}
                                                </span>
                                            )}
                                        </label>
                                        <ChevronDown
                                            size={14}
                                            className={cn(
                                                "text-gi-muted transition-transform duration-300",
                                                !openDropdowns.has('subskills') && "-rotate-90"
                                            )}
                                        />
                                    </button>

                                    {openDropdowns.has('subskills') && (
                                        <div className="flex flex-col gap-1 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {[
                                                'mining', 'logging', 'smelting', 'smithing', 'crafting',
                                                'foraging', 'herbalism', 'hunting', 'harvesting',
                                                'fishing', 'sailing', 'swimming',
                                                'cooking', 'brewing', 'butchery',
                                                'bartering', 'recruitment', 'propaganda', 'diplomacy',
                                                'pickpocketing', 'lockpicking', 'stealth',
                                                'rituals', 'summoning', 'enchanting',
                                                'engineering', 'alchemy', 'medicine'
                                            ].sort().map(s => {
                                                const isActive = subSkillFilters.has(s);
                                                const label = s.charAt(0).toUpperCase() + s.slice(1);
                                                return (
                                                    <button
                                                        key={s}
                                                        onClick={() => toggleSubSkillFilter(s)}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                                            isActive
                                                                ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                                : "hover:bg-white/5 text-gi-muted"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                            isActive ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                                        )}>
                                                            {isActive && <Check size={10} className="text-black" strokeWidth={4} />}
                                                        </div>
                                                        <span className="flex-1 text-left">{label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Areas Dropdown */}
                                <div className="flex flex-col border-b border-gi-border/20 pb-2">
                                    <button
                                        onClick={() => toggleDropdown('areas')}
                                        className="flex items-center justify-between w-full py-2 group/drop"
                                    >
                                        <label className="text-[10px] font-display font-bold text-gi-primary uppercase tracking-widest flex items-center gap-2 cursor-pointer group-hover/drop:text-gi-gold transition-colors">
                                            <MapIcon size={14} />
                                            Areas
                                            {areaFilters.size > 0 && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gi-primary/20 text-[8px] text-gi-primary">
                                                    {areaFilters.size}
                                                </span>
                                            )}
                                        </label>
                                        <ChevronDown
                                            size={14}
                                            className={cn(
                                                "text-gi-muted transition-transform duration-300",
                                                !openDropdowns.has('areas') && "-rotate-90"
                                            )}
                                        />
                                    </button>

                                    {openDropdowns.has('areas') && (
                                        <div className="flex flex-col gap-1 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {areaSets.map(area => {
                                                const isActive = areaFilters.has(area.id);
                                                return (
                                                    <button
                                                        key={area.id}
                                                        onClick={() => toggleAreaFilter(area.id)}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                                            isActive
                                                                ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                                : "hover:bg-white/5 text-gi-muted"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                            isActive ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                                        )}>
                                                            {isActive && <Check size={10} className="text-black" strokeWidth={4} />}
                                                        </div>
                                                        <span className="flex-1 text-left">{area.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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
                                            {/* Set Header (Collapsible) */}
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
                                                            <ChevronRight 
                                                                size={18} 
                                                                className={cn(
                                                                    "text-gi-muted transition-transform duration-300",
                                                                    !isCollapsed ? "rotate-90" : ""
                                                                )} 
                                                            />
                                                        </div>
                                                    </div>
                                            </button>

                                            {/* Card List */}
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
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-lg font-base text-gi-muted uppercase">No cards found</h3>
                                        <p className="text-xs text-gi-muted font-sans">Try adjusting your filters or search term.</p>
                                    </div>
                                </div>
                            )
                        ) : searchScope === 'items' ? (
                            filteredItems.length > 0 ? (
                                <div className="w-full flex flex-col gap-1.5 items-center">
                                    {filteredItems.map(item => (
                                        <LibraryItemBar
                                            key={item.id}
                                            item={item}
                                            ownedCount={getItemOwnedCount(item.id)}
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
                    {/* Discovery Tracker fixed at bottom */}
                    <div className="pt-4 pr-4 flex flex-col items-center">
                        <LibraryGlobalProgress stats={discoveryStats} />
                    </div>
                </div>

                <div className="w-80 shrink-0 flex flex-col h-full bg-gi-base rounded-xl border border-gi-border/20 overflow-hidden relative">
                    {selectedTemplate ? (
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

                                {/* Visual Spacer to show background art */}
                                <div className="h-48 pointer-events-none" aria-hidden="true" />
                                
                                {/* Essential Stats */}
                                {selectedTemplate.cardType !== 'combat' && (
                                    <div className="grid grid-cols-2 gap-2 mt-2 w-full">
                                        {/* Requirement: Level + Skill */}
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
                    ) : selectedItem ? (
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
                                            <span className="text-sm font-bold text-white">{engine.InventoryManager.getItemCount(selectedItem.id)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gi-surface/80 border border-gi-border/20">
                                        <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-gi-text border border-white/10">
                                            <Trophy size={16} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gi-muted uppercase tracking-wider gi-text-outline">Lifetime</span>
                                            <span className="text-sm font-bold text-white">{GameState.state?.collection?.itemLifetimeCounts?.[selectedItem.id] || 0}</span>
                                        </div>
                                    </div>
                                </div>

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
                    ) : selectedEnemy ? (
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
                                            <span className="text-sm font-bold text-white">{GameState.state?.collection?.enemyKillCounts?.[selectedEnemy.id] || 0}</span>
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
                    ) : (
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
                    )}
                </div>
            </div>
        </GIModal>
    );
};

/**
 * LibraryItemBar: A horizontal list item for Items in the Registry.
 * Uses silver/grey styling and shows owned counts.
 */
const LibraryItemBar = ({ item, ownedCount, isSelected, onAction }) => {
    const typeBadge = { 
        id: 'type', 
        icon: <Package size={24} />, 
        label: "Item", 
        color: "text-gi-muted", 
        description: "A resource or item used in crafting or as a reward." 
    };
    
    const spriteBadge = { 
        id: 'sprite', 
        icon: (
            <div className="w-8 h-8 flex items-center justify-center bg-black/40 rounded border border-white/5 overflow-hidden">
                <ItemIcon item={item.id} size={32} className="pixel-art" />
            </div>
        ),
        label: item.name, 
        color: "text-white" 
    };

    return (
        <div className="flex items-center gap-4 group/row w-full max-w-[772px]">
            {/* 1. Add Button Spacer (for alignment with cards) */}
            <div className="w-12 shrink-0" />

            {/* 2. Type Badge */}
            <div className="origin-center shrink-0">
                <BadgeItem {...typeBadge} variant="minimal" />
            </div>

            {/* 3. Icon (Sprite) */}
            <div className="origin-center shrink-0">
                <BadgeItem {...spriteBadge} variant="minimal" />
            </div>

            {/* 4. Bar */}
            <div
                onClick={onAction}
                className={cn(
                    "relative flex-1 min-w-0 h-12 rounded-lg border-2 overflow-hidden group transition-all duration-300 bg-black/40 gi-border-item",
                    isSelected ? "border-gi-primary shadow-[0_0_20px_rgba(255,255,255,0.3)]" : "cursor-pointer hover:border-white/40 hover:bg-black/60"
                )}
            >
                <div className="absolute inset-0 z-20 flex items-center px-4">
                    <h4 className="font-silkscreen text-lg uppercase tracking-[0.05em] text-white transition-colors flex-1 truncate gi-text-outline">
                        {item.name}
                    </h4>
                    <div className="text-[10px] text-gi-muted font-sans uppercase tracking-widest gi-text-outline">
                        {item.type || 'Item'}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * LibraryEnemyBar: A horizontal list item for Enemies in the Registry.
 * Uses vibrant red/danger styling and shows level/tier.
 */
const LibraryEnemyBar = ({ enemy, isSelected, onAction }) => {
    const typeBadge = { 
        id: 'type', 
        icon: <Skull size={24} />, 
        label: "Enemy", 
        color: "text-gi-danger", 
        description: "A hostile creature that can be encountered in combat." 
    };
    
    const spriteBadge = { 
        id: 'sprite', 
        icon: (
            <div className="w-8 h-8 flex items-center justify-center bg-black/40 rounded border border-gi-danger/20 overflow-hidden">
                <span className="text-2xl leading-none">{enemy.icon || '💀'}</span>
            </div>
        ), 
        label: enemy.name, 
        color: "text-white" 
    };

    return (
        <div className="flex items-center gap-4 group/row w-full max-w-[772px]">
            {/* 1. Add Button Spacer */}
            <div className="w-12 shrink-0" />

            {/* 2. Type Badge */}
            <div className="origin-center shrink-0">
                <BadgeItem {...typeBadge} variant="minimal" />
            </div>

            {/* 3. Icon (Sprite) */}
            <div className="origin-center shrink-0">
                <BadgeItem {...spriteBadge} variant="minimal" />
            </div>

            {/* 4. Bar */}
            <div
                onClick={onAction}
                className={cn(
                    "relative flex-1 min-w-0 h-12 rounded-lg border-2 overflow-hidden group transition-all duration-300 bg-black/40 gi-border-enemy",
                    isSelected ? "border-gi-danger shadow-[0_0_20px_rgba(255,45,85,0.4)]" : "cursor-pointer hover:border-gi-danger/50 hover:bg-gi-danger/5"
                )}
            >
                {/* Background Tint */}
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-gi-danger/10 to-transparent" />

                <div className="absolute inset-0 z-20 flex items-center px-4">
                    <h4 className="font-silkscreen text-lg uppercase tracking-[0.05em] text-white transition-colors flex-1 truncate gi-text-outline">
                        {enemy.name}
                    </h4>
                    <div className="text-[10px] text-gi-danger/80 font-sans uppercase tracking-widest gi-text-outline">
                        {enemy.combatType || 'Combat'}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * LibraryUnknownBar: A silhouette bar for undiscovered entities.
 * Shows only the type badge to indicate intent.
 */
const LibraryUnknownBar = ({ type }) => {
    const badge = useMemo(() => {
        if (type === 'combat') return { id: 'type', icon: <Sword size={24} />, label: "Combat", color: "text-red-400" };
        if (type === 'enemy') return { id: 'type', icon: <Skull size={24} />, label: "Enemy", color: "text-gi-danger" };
        if (type === 'crafting') return { id: 'type', icon: <Hammer size={24} />, label: "Crafting", color: "text-orange-400" };
        if (type === 'area') return { id: 'type', icon: <MapIcon size={24} />, label: "Area", color: "text-gi-gold" };
        return { id: 'type', icon: <Hand size={24} />, label: "Task", color: "text-blue-400" };
    }, [type]);

    return (
        <div className="flex items-center gap-4 opacity-25 grayscale pointer-events-none transition-all duration-500 w-full max-w-[772px]">
            {/* 1. Add Button Spacer */}
            <div className="w-12 shrink-0" />

            {/* 2. Type Badge */}
            <div className="origin-center shrink-0">
                <BadgeItem {...badge} variant="minimal" />
            </div>

            {/* 3. Icon (Silhouette) */}
            <div className="origin-center shrink-0">
                <div className="w-8 h-8 rounded bg-white/5 border border-white/5 flex items-center justify-center text-white/20">
                    <HelpCircle size={16} />
                </div>
            </div>

            {/* 4. Bar */}
            <div className="relative flex-1 min-w-0 h-12 rounded-lg border-2 border-white/5 overflow-hidden bg-black/40">
                <div className="absolute inset-0 z-20 flex items-center px-4">
                    <h4 className="font-silkscreen text-lg uppercase tracking-[0.05em] text-white/20 gi-text-outline">
                        ???
                    </h4>
                </div>
            </div>
        </div>
    );
};

/**
 * LibraryInspectionEntryBar: A compact bar for the inspection panel sources/uses.
 */
const LibraryInspectionEntryBar = ({ item, onInspect, onSearch }) => {
    const cardTemplate = item.type === 'card' && !item.isLocked ? getCard(item.id) : null;
    const bgId = cardTemplate ? (cardTemplate.background || getBiome(cardTemplate.areaId)?.backgroundImage || getAreaSet(cardTemplate.areaSet)?.areaArt) : null;
    const backgroundPath = bgId ? resolveSpritePath(bgId) : null;

    return (
        <div 
            onClick={item.isLocked ? undefined : onInspect}
            onContextMenu={item.isLocked ? undefined : (e) => {
                e.preventDefault();
                onSearch();
            }}
            className={cn(
                "relative flex items-center justify-between p-2 rounded bg-gi-surface border transition-all duration-200 w-full text-left overflow-hidden",
                item.isLocked 
                    ? "opacity-40 grayscale border-white/5 cursor-default" 
                    : "border-gi-border hover:border-gi-primary/50 group/source cursor-pointer"
            )}
        >
            {/* Background Art Slice (for cards) */}
            {backgroundPath && (
                <div 
                    className="absolute inset-0 z-0 bg-cover bg-center opacity-30 group-hover/source:opacity-50 transition-opacity"
                    style={{ backgroundImage: `url(${backgroundPath})` }}
                />
            )}
            {/* Dark overlay for readability */}
            {backgroundPath && <div className="absolute inset-0 z-0 bg-black/40" />}

            <div className="relative z-10 flex items-center gap-3 overflow-hidden">
                <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center border shadow-inner transition-colors shrink-0",
                    item.isLocked 
                        ? "bg-white/5 border-white/10 text-white/20"
                        : "bg-black/40 border-white/10 text-gi-primary group-hover/source:bg-black/60"
                )}>
                    {item.type === 'enemy' ? <Skull size={18} /> : (item.intent === 'combat' ? <Sword size={18} /> : (item.intent === 'area' ? <MapIcon size={18} /> : <Hand size={18} />))}
                </div>
                <span className={cn(
                    "text-sm font-bold uppercase transition-colors truncate gi-text-outline",
                    item.isLocked ? "text-white/40" : "text-white group-hover/source:text-gi-primary"
                )}>
                    {item.isLocked ? '???' : item.name}
                </span>
            </div>
        </div>
    );
};

/**
 * LibraryGlobalProgress: A premium summary bar showing overall discovery stats.
 */
const LibraryGlobalProgress = ({ stats }) => {
    if (!stats || stats.total === 0) return null;
    const percent = Math.round((stats.discovered / stats.total) * 100);

    return (
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/40 border border-white/5 shadow-2xl relative overflow-hidden group w-full max-w-[772px] shrink-0">
            {/* Glossy shine effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gi-primary/10 border border-gi-primary/20 text-gi-primary">
                        <Trophy size={18} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gi-muted uppercase tracking-[0.2em] font-sans">Collection Discovery</span>
                        <h3 className="text-lg font-base text-white uppercase tracking-wider gi-text-outline">
                            {stats.label}
                        </h3>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold text-gi-primary gi-text-outline font-pixel">
                        {percent}%
                    </span>
                    <span className="text-[10px] text-gi-muted uppercase tracking-widest">
                        {stats.discovered} / {stats.total} {stats.label}
                    </span>
                </div>
            </div>

            <div className="h-1.5 bg-gi-surface rounded-full overflow-hidden border border-white/5 w-full mt-2">
                <div 
                    className="h-full bg-gradient-to-r from-gi-primary/40 to-gi-primary shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-1000 ease-out"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
};

/**
 * LibraryUndiscoveredGroup: A collapsible group for multiple unknown entries.
 */
const LibraryUndiscoveredGroup = ({ count, items, isInspection = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (count === 0) return null;

    // Inspection panel version: Single non-interactive summary bar
    if (isInspection) {
        return (
            <div className="relative flex items-center justify-between p-2 rounded bg-gi-surface border border-white/5 opacity-40 grayscale transition-all duration-200 w-full text-left overflow-hidden cursor-default">
                <div className="relative z-10 flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded flex items-center justify-center border shadow-inner bg-white/5 border-white/10 text-white/20 shrink-0">
                        <span className="text-lg font-bold text-white/40 gi-text-outline">?</span>
                    </div>
                    <span className="text-sm font-bold uppercase transition-colors truncate gi-text-outline text-white/40">
                        <span className="text-white">{count}</span> Undiscovered
                    </span>
                </div>
            </div>
        );
    }

    // Main Catalog version: Collapsible dropdown
    return (
        <div className="flex flex-col gap-1.5 mt-2 items-center">
            <div className="flex items-center gap-4 w-full max-w-[772px]">
                {/* Spacing to align with bars: 48 (button) + 16 (gap) + 32 (type) + 16 (gap) + 32 (icon) = 144px (+16px flex gap = 160px total offset) */}
                {!isInspection && <div className="w-[144px] shrink-0" />} 

                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "relative h-12 rounded-lg border-2 transition-all duration-300 flex items-center px-4 cursor-pointer group",
                        isInspection ? "w-full" : "flex-1 min-w-0",
                        isExpanded 
                            ? "bg-white/10 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
                            : "bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/20"
                    )}
                >
                    <div className={cn(
                        "flex-1 font-silkscreen text-[11px] uppercase tracking-[0.2em] transition-colors",
                        isExpanded ? "text-white" : "text-gi-muted group-hover:text-white/60"
                    )}>
                        {count} Undiscovered {isInspection ? 'Sources' : 'Entries'}
                    </div>
                    <ChevronRight 
                        size={16} 
                        className={cn(
                            "text-gi-muted transition-transform duration-500",
                            isExpanded ? "rotate-90 text-white" : "group-hover:text-white/40"
                        )} 
                    />
                </div>
            </div>

            {isExpanded && (
                <div className="flex flex-col gap-1.5 py-2">
                    {items.map((item, idx) => (
                        isInspection 
                            ? <LibraryInspectionEntryBar key={idx} item={{ ...item, isLocked: true }} />
                            : <LibraryUnknownBar key={idx} type={item.type} />
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * LibraryCardBar: A premium horizontal list item for the Binder.
 * Shows a slice of the card art as background.
 */
const LibraryCardBar = ({ template, instance, isLocked, onAction, onToggle }) => {
    const isAvailable = instance?.status === 'available';
    const isInUse = instance?.status === 'in-use';

    const intent = useMemo(() => {
        if (template.cardType === 'area') return 'area';
        if (template.cardType === 'pack') return 'pack';
        if (template.traits?.some(t => t.type === 'combat')) return 'combat';
        if (template.traits?.some(t => t.type === 'recipe_selector' || t.type === 'inputslot' || t.type === 'dynamic_inputslots')) return 'project';
        return 'task';
    }, [template]);

    const backgroundPath = useMemo(() => {
        const bgId = template.background || getBiome(template.areaId)?.backgroundImage || getAreaSet(template.areaSet)?.areaArt;
        return bgId ? resolveSpritePath(bgId) : null;
    }, [template]);

    // Badge Resolution Logic
    const badges = useMemo(() => {
        if (isLocked) return [];
        const items = [];
        
        // 1. Type Badge
        const traits = template.traits || [];
        const hasInputs = traits.some(t => ['inputslot', 'recipe_selector', 'dynamic_inputslots'].includes(t.type));
        const isRecipeBased = traits.some(t => t.type === 'recipe_selector' || t.type === 'dynamic_inputslots');
        
        const isCrafting = hasInputs && (isRecipeBased || traits.some(t => t.outputs?.length > 1));
        const isTask = traits.some(t => t.type === 'workcycle') && hasInputs && !isCrafting;
        const isGathering = traits.some(t => t.type === 'workcycle') && !hasInputs;
        
        const isCombat = traits.some(t => t.type === 'combat');
        const isArea = template.cardType === 'area';
        const isQuest = template.cardType === 'quest';
        const isProject = template.cardType === 'project';

        let typeBadge = { id: 'type', icon: <Hand size={32} />, label: "Task", color: "text-blue-400", description: "Standard task." };
        
        if (isProject) {
            typeBadge = { id: 'type', icon: <Layout size={32} />, label: "Project", color: "text-cyan-400", description: "Construction project." };
        } else if (isQuest) {
            typeBadge = { id: 'type', icon: <Target size={32} />, label: "Quest", color: "text-purple-400", description: "Unique objective." };
        } else if (isGathering) {
            typeBadge = { id: 'type', icon: <Leaf size={32} />, label: "Gathering", color: "text-gi-success", description: "Resource collection (no inputs)." };
        } else if (isCrafting) {
            typeBadge = { id: 'type', icon: <Hammer size={32} />, label: "Crafting", color: "text-orange-400", description: "Complex creation task." };
        } else if (isTask) {
            typeBadge = { id: 'type', icon: <Hand size={32} />, label: "Task", color: "text-blue-400", description: "Standard conversion task." };
        } else if (isArea) {
            typeBadge = { id: 'type', icon: <MapIcon size={32} />, label: "Area Hub", color: "text-gi-gold", description: "Central area hub." };
        } else if (isCombat) {
            typeBadge = { id: 'type', icon: <Sword size={32} />, label: "Combat", color: "text-red-400", description: "Combat encounter." };
        } else if (template.cardType === 'event') {
            typeBadge = { id: 'type', icon: <PartyPopper size={32} />, label: "Event", color: "text-orange-400", description: "Temporary event." };
        }

        items.push(typeBadge);

        // 2. Skill Badge
        const skillId = template.skill || traits.find(t => t.skill)?.skill;
        if (skillId) {
            const skillKey = skillId.toLowerCase();
            const skillDef = getSkill(skillKey);
            if (skillDef) {
                // Map skill ID to sprite ID in manifest
                const spriteMap = {
                    industry: 'skill_industry',
                    nature: 'skill_nature',
                    nautical: 'skill_nautical',
                    culinary: 'skill_culinary',
                    social: 'skill_social',
                    crime: 'skill_crime',
                    occult: 'skill_occult',
                    science: 'skill_flask'
                };

                const spriteId = spriteMap[skillDef.parentSkillId || skillKey];
                const spritePath = spriteId ? resolveSpritePath(spriteId) : null;

                items.push({
                    id: 'skill',
                    icon: spritePath ? (
                        <img
                            src={spritePath}
                            alt={skillDef.name}
                            className="w-8 h-8 pixel-art"
                        />
                    ) : (
                        <span className="text-[32px] leading-none">{skillDef.icon}</span>
                    ),
                    label: skillDef.name,
                    color: "text-white",
                    description: skillDef.description
                });
            }
        }

        return items;
    }, [template, isLocked]);

    const typeBadge = badges.find(b => b.id === 'type');
    const skillBadge = badges.find(b => b.id === 'skill');

    return (
        <div className="flex items-center gap-4 group/row w-full max-w-[772px]">
            {/* 1. Add Button (Far Left) */}
            {!isLocked && template.cardType !== 'area' ? (
                <div className="w-12 h-12 rounded-lg border border-white/10 bg-gi-surface/40 flex items-center justify-center shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle?.();
                        }}
                        className={cn(
                            "w-9 h-9 rounded border-2 flex items-center justify-center transition-all duration-200",
                            "hover:scale-110 active:scale-90",
                            instance?.status === 'in-use' 
                                ? "border-gi-danger/50 text-gi-danger hover:bg-gi-danger hover:text-white hover:shadow-[0_0_15px_rgba(255,45,85,0.4)]" 
                                : "border-gi-primary/50 text-gi-primary hover:bg-gi-primary hover:text-gi-base hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                        )}
                    >
                        {instance?.status === 'in-use' ? <Minus size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
                    </button>
                </div>
            ) : (
                <div className="w-12 shrink-0" />
            )}

            {/* 2. Card Type Badge (In between button and icon) */}
            <div className="origin-center shrink-0">
                {!isLocked && typeBadge && (
                    <BadgeItem {...typeBadge} variant="minimal" />
                )}
            </div>

            {/* 3. Icon (Skill Badge) */}
            <div className="origin-center shrink-0">
                {!isLocked && skillBadge ? (
                    <BadgeItem {...skillBadge} variant="minimal" />
                ) : (
                    <div className="w-8 h-8 rounded bg-white/5 border border-white/5 flex items-center justify-center text-white/20">
                        <HelpCircle size={16} />
                    </div>
                )}
            </div>

            {/* 4. Card Bar (Middle) */}
            <div
                onClick={onAction}
                className={cn(
                    "relative flex-1 min-w-0 h-12 rounded-lg border-2 overflow-hidden group transition-all duration-300 bg-black",
                    isLocked ? "opacity-20 grayscale cursor-default border-white/10" : "cursor-pointer hover:!border-gi-gold hover:shadow-[0_0_20px_rgba(226,255,0,0.5)]",
                    !isLocked && (
                        intent === 'combat' ? "gi-border-combat" :
                            intent === 'task' ? "gi-border-task" :
                                intent === 'project' ? "gi-border-project" :
                                    intent === 'blueprint' ? "gi-border-blueprint" :
                                        intent === 'artifact' ? "gi-border-artifact" :
                                            intent === 'area' ? "gi-border-area" :
                                                intent === 'pack' ? "gi-border-pack" :
                                                    "border-white/10"
                    )
                )}
            >
                {/* Background Art Slice */}
                {backgroundPath && (
                    <div
                        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-300 opacity-50 group-hover:opacity-80 pixel-art"
                        style={{ backgroundImage: `url(${backgroundPath})` }}
                    />
                )}

                {/* Content Overlays - Locked state only */}
                {isLocked && (
                    <div className="absolute inset-0 z-10 bg-black/80" />
                )}

                {/* Text & Controls */}
                <div className="absolute inset-0 z-20 flex items-center px-4">
                    <h4 className={cn(
                        "font-silkscreen text-lg uppercase tracking-[0.05em] text-white transition-colors flex-1 truncate",
                        "gi-text-outline"
                    )}>
                        {isLocked ? '???' : template.name}
                    </h4>
                </div>
            </div>
        </div>
    );
};

export default CardLibraryModal;
