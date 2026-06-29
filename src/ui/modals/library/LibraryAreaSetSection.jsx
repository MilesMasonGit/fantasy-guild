import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { 
    HelpCircle, ChevronRight, Check, Trophy, Box, Skull, Plus, Minus, Sword, Leaf, Hammer, Layout, Hand, Map as MapIcon, PartyPopper
} from 'lucide-react';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getAreaSet, getSetTotal } from '../../../config/registries/areaSetRegistry.js';
import { getBiome } from '../../../config/registries/biomeRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { ItemIcon } from '../../components/base/ItemIcon.jsx';
import { BadgeItem } from '../../components/hud/BadgeGutter.jsx';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { RegistryManager } from '../../../systems/progression/RegistryManager.js';

export const LibraryCardBar = ({ template, instance, isLocked, isSelected, onAction, onToggle }) => {
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

    const badges = useMemo(() => {
        if (isLocked) return [];
        const items = [];
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

        const skillId = template.skill || traits.find(t => t.skill)?.skill;
        if (skillId) {
            const skillKey = skillId.toLowerCase();
            const skillDef = getSkill(skillKey);
            if (skillDef) {
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
                        <img src={spritePath} alt={skillDef.name} className="w-8 h-8 pixel-art" />
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

            <div className="origin-center shrink-0">
                {!isLocked && typeBadge && <BadgeItem {...typeBadge} variant="minimal" />}
            </div>

            <div className="origin-center shrink-0">
                {!isLocked && skillBadge ? (
                    <BadgeItem {...skillBadge} variant="minimal" />
                ) : (
                    <div className="w-8 h-8 rounded bg-white/5 border border-white/5 flex items-center justify-center text-white/20">
                        <HelpCircle size={16} />
                    </div>
                )}
            </div>

            <div
                onClick={onAction}
                className={cn(
                    "relative flex-1 min-w-0 h-12 rounded-lg border-2 overflow-hidden group transition-all duration-300 bg-black",
                    isLocked ? "opacity-20 grayscale cursor-default border-white/10" : "cursor-pointer hover:!border-gi-gold hover:shadow-[0_0_20px_rgba(226,255,0,0.5)]",
                    isSelected && "border-gi-gold shadow-[0_0_20px_rgba(226,255,0,0.5)]",
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
                {backgroundPath && (
                    <div
                        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-300 opacity-50 group-hover:opacity-80 pixel-art"
                        style={{ backgroundImage: `url(${backgroundPath})` }}
                    />
                )}
                {isLocked && <div className="absolute inset-0 z-10 bg-black/80" />}
                <div className="absolute inset-0 z-20 flex items-center px-4">
                    <h4 className="font-silkscreen text-lg uppercase tracking-[0.05em] text-white transition-colors flex-1 truncate gi-text-outline">
                        {isLocked ? '???' : template.name}
                    </h4>
                </div>
            </div>
        </div>
    );
};

export const LibraryItemBar = ({ item, ownedCount, isSelected, onAction }) => {
    const typeBadge = { id: 'type', icon: <Box size={24} />, label: "Item", color: "text-gi-muted", description: "A resource or item." };
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
            <div className="w-12 shrink-0" />
            <div className="origin-center shrink-0">
                <BadgeItem {...typeBadge} variant="minimal" />
            </div>
            <div className="origin-center shrink-0">
                <BadgeItem {...spriteBadge} variant="minimal" />
            </div>
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

export const LibraryEnemyBar = ({ enemy, isSelected, onAction }) => {
    const typeBadge = { id: 'type', icon: <Skull size={24} />, label: "Enemy", color: "text-gi-danger" };
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
            <div className="w-12 shrink-0" />
            <div className="origin-center shrink-0">
                <BadgeItem {...typeBadge} variant="minimal" />
            </div>
            <div className="origin-center shrink-0">
                <BadgeItem {...spriteBadge} variant="minimal" />
            </div>
            <div
                onClick={onAction}
                className={cn(
                    "relative flex-1 min-w-0 h-12 rounded-lg border-2 overflow-hidden group transition-all duration-300 bg-black/40 gi-border-enemy",
                    isSelected ? "border-gi-danger shadow-[0_0_20px_rgba(255,45,85,0.4)]" : "cursor-pointer hover:border-gi-danger/50 hover:bg-gi-danger/5"
                )}
            >
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

export const LibraryUnknownBar = ({ type }) => {
    const badge = useMemo(() => {
        if (type === 'combat') return { id: 'type', icon: <Sword size={24} />, label: "Combat", color: "text-red-400" };
        if (type === 'enemy') return { id: 'type', icon: <Skull size={24} />, label: "Enemy", color: "text-gi-danger" };
        if (type === 'crafting') return { id: 'type', icon: <Hammer size={24} />, label: "Crafting", color: "text-orange-400" };
        if (type === 'area') return { id: 'type', icon: <MapIcon size={24} />, label: "Area", color: "text-gi-gold" };
        return { id: 'type', icon: <Hand size={24} />, label: "Task", color: "text-blue-400" };
    }, [type]);

    return (
        <div className="flex items-center gap-4 opacity-25 grayscale pointer-events-none transition-all duration-500 w-full max-w-[772px]">
            <div className="w-12 shrink-0" />
            <div className="origin-center shrink-0">
                <BadgeItem {...badge} variant="minimal" />
            </div>
            <div className="origin-center shrink-0">
                <div className="w-8 h-8 rounded bg-white/5 border border-white/5 flex items-center justify-center text-white/20">
                    <HelpCircle size={16} />
                </div>
            </div>
            <div className="relative flex-1 min-w-0 h-12 rounded-lg border-2 border-white/5 overflow-hidden bg-black/40">
                <div className="absolute inset-0 z-20 flex items-center px-4">
                    <h4 className="font-silkscreen text-lg uppercase tracking-[0.05em] text-white/20 gi-text-outline">???</h4>
                </div>
            </div>
        </div>
    );
};

export const LibraryInspectionEntryBar = ({ item, onInspect, onSearch }) => {
    const cardTemplate = item.type === 'card' && !item.isLocked ? getCard(item.id) : null;
    let bgId = null;
    if (cardTemplate) {
        bgId = cardTemplate.background;
        if (!bgId) {
            const areaSet = getAreaSet(cardTemplate.areaSet);
            if (cardTemplate.cardType === 'quest') {
                bgId = areaSet?.questBackground || 'bg_q_generic';
            } else if (cardTemplate.cardType === 'invasion') {
                bgId = areaSet?.invasionBackground || 'bg_i_village';
            } else {
                bgId = getBiome(cardTemplate.areaId)?.backgroundImage || areaSet?.areaArt;
            }
        }
    }
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
            {backgroundPath && (
                <div 
                    className="absolute inset-0 z-0 bg-cover bg-center opacity-30 group-hover/source:opacity-50 transition-opacity"
                    style={{ backgroundImage: `url(${backgroundPath})` }}
                />
            )}
            {backgroundPath && <div className="absolute inset-0 z-0 bg-black/40" />}
            <div className="relative z-10 flex items-center gap-3 overflow-hidden">
                <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center border shadow-inner transition-colors shrink-0",
                    item.isLocked ? "bg-white/5 border-white/10 text-white/20" : "bg-black/40 border-white/10 text-gi-primary group-hover/source:bg-black/60"
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

export const LibraryGlobalProgress = ({ stats }) => {
    if (!stats || stats.total === 0) return null;
    const percent = Math.round((stats.discovered / stats.total) * 100);

    return (
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/40 border border-white/5 shadow-2xl relative overflow-hidden group w-full max-w-[772px] shrink-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gi-primary/10 border border-gi-primary/20 text-gi-primary">
                        <Trophy size={18} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gi-muted uppercase tracking-[0.2em] font-sans">Collection Discovery</span>
                        <h3 className="text-lg font-base text-white uppercase tracking-wider gi-text-outline">{stats.label}</h3>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold text-gi-primary gi-text-outline font-pixel">{percent}%</span>
                    <span className="text-[10px] text-gi-muted uppercase tracking-widest">{stats.discovered} / {stats.total} {stats.label}</span>
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

export const LibraryUndiscoveredGroup = ({ count, items, isInspection = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (count === 0) return null;

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

    return (
        <div className="flex flex-col gap-1.5 mt-2 items-center w-full">
            <div className="flex items-center gap-4 w-full max-w-[772px]">
                {!isInspection && <div className="w-[144px] shrink-0" />} 
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "relative h-12 rounded-lg border-2 transition-all duration-300 flex items-center px-4 cursor-pointer group",
                        isInspection ? "w-full" : "flex-1 min-w-0",
                        isExpanded ? "bg-white/10 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/20"
                    )}
                >
                    <div className={cn(
                        "flex-1 font-silkscreen text-[11px] uppercase tracking-[0.2em] transition-colors",
                        isExpanded ? "text-white" : "text-gi-muted group-hover:text-white/60"
                    )}>
                        {count} Undiscovered {isInspection ? 'Sources' : 'Entries'}
                    </div>
                    <ChevronRight size={16} className={cn("text-gi-muted transition-transform duration-500", isExpanded ? "rotate-90 text-white" : "group-hover:text-white/40")} />
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
