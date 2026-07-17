import React, { useState, useRef } from 'react';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import { motion } from 'framer-motion';
import { Map as MapIcon, Hammer, PartyPopper, Sword, Lock, Weight, Skull, Hand, TrendingUp, TrendingDown, Leaf, Target, Layout } from 'lucide-react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getCard } from '../../../config/registries/index.js';
import { cn } from '../../utils/cn.js';
import GUTooltip from '../base/GUTooltip.jsx';
import { GameState } from '../../../state/GameState.js';
import { getTileType } from '../../../config/registries/tileRegistry.js';
import { getTrait } from '../../../config/registries/traitRegistry.js';
import { SUB_SKILL_TO_PARENT } from '../../../config/registries/skillRegistry.js';

// Skill/Category Hierarchy for relevance filtering (derived from the skill registry)
const CATEGORY_PARENTS = {
    ...SUB_SKILL_TO_PARENT,
    melee: 'combat', ranged: 'combat', magic: 'combat', defense: 'combat'
};

/**
 * BadgeGutter - Displays a column of informational badges on the left side of the card.
 * Positioned relative to the TOP-LEFT of the card container.
 */
export const BadgeGutter = React.memo(({ template, isLocked, isVisible = true, aggregator = null }) => {
    if (!template || !isVisible) return null;

    const badges = [];

    // 1. Resolve Category based on Traits (Refined Heuristics)
    const traits = template.traits || [];
    
    const isArea = template.cardType === 'area';
    const isQuest = template.cardType === 'quest';
    const isProject = template.cardType === 'project';
    const isEvent = template.cardType === 'event';
    const isInvasion = traits.some(t => t.type === 'debuff_timer');

    // "Tasks" rules
    // Is Station if it is explicitly a station or uses recipes
    const isStation = template.cardType === 'station' || traits.some(t => t.type === 'recipe_selector' || t.type === 'dynamic_inputslots');
    
    // Has inputs if it has inputslots or a top-level inputs array
    const hasInputs = traits.some(t => t.type === 'inputslot') || (template.inputs && template.inputs.length > 0);
    
    const configOutputs = template.config?.outputs || [];

    // Has encounter if it has a combat trait or top-level encounter/combat trigger in config
    const hasEncounter = traits.some(t => t.type === 'combat') 
        || !!template.config?.enemyId 
        || (template.outputs && template.outputs.some(o => o.type === 'encounter' || o.type === 'enemy'))
        || configOutputs.some(o => o.type === 'combat_trigger' || o.type === 'encounter' || o.type === 'enemy');

    // Has non-encounter outputs
    const hasNonEncounterOutputs = traits.some(t => t.outputs?.length > 0 || t.type === 'loot' || t.type === 'reward' || t.type === 'yield' || t.type === 'production') 
        || (template.outputs && template.outputs.some(o => o.type !== 'encounter' && o.type !== 'enemy'))
        || configOutputs.some(o => o.type !== 'combat_trigger' && o.type !== 'encounter' && o.type !== 'enemy');

    const isPureCombat = template.cardType === 'combat' 
        || !!template.config?.enemyId 
        || configOutputs.some(o => o.type === 'combat_trigger' && o.chance >= 100);

    const isGathering = !hasInputs && !isStation && hasNonEncounterOutputs && !isPureCombat;
    const isCrafting = hasInputs && !isStation;
    const isCombat = hasEncounter;

    // Build the primary badge (only ONE primary badge based on hierarchy)
    if (isProject) {
        badges.push({ id: 'type', icon: <Layout size={16} />, label: "Project", color: "text-cyan-400", description: "A large-scale construction or ritual. Requires sustained effort and resources to complete." });
    } else if (isQuest) {
        badges.push({ id: 'type', icon: <Target size={16} />, label: "Quest", color: "text-purple-400", description: "A unique objective. Complete the requirements to earn special rewards and advance the story." });
    } else if (isArea) {
        badges.push({ id: 'type', icon: <MapIcon size={16} />, label: "Area Hub", color: "text-gi-gold", description: "The central hub for this area. Purchase card packs to unlock new tasks and quests." });
    } else if (isInvasion) {
        badges.push({ id: 'type', icon: <Skull size={16} />, label: "Invasion", color: "text-red-500", description: "Hostile forces attacking your guild. Defeat them quickly to prevent negative consequences." });
    } else if (isEvent) {
        badges.push({ id: 'type', icon: <PartyPopper size={16} />, label: "World Event", color: "text-orange-400", description: "A temporary event. Provides unique opportunities or challenges until completed or expires." });
    } else {
        // Standard Task derived rules
        if (isStation) {
            badges.push({ id: 'type', icon: <Hammer size={16} />, label: "Station", color: "text-amber-500", description: "A facility for advanced crafting. Select from multiple recipes to process materials." });
        } else if (isCrafting) {
            badges.push({ id: 'type', icon: <Hand size={16} />, label: "Crafting", color: "text-orange-400", description: "Convert multiple raw materials into advanced items." });
        } else if (isGathering) {
            badges.push({ id: 'type', icon: <Leaf size={16} />, label: "Gathering", color: "text-gi-success", description: "Collect raw materials from the world. Requires no input items to produce results." });
        }
    }

    // Add Combat as an *additional* tag type if it has an encounter
    if (isCombat) {
        badges.push({ id: 'combat', icon: <Sword size={16} />, label: "Combat Encounter", color: "text-red-400", description: "Assign well-equipped heroes to defeat enemies and collect loot." });
    }

    // 2. Immobile / Locked Badge
    const isImmobile = isLocked || template.cardType === 'event' || isInvasion || isArea;
    if (isImmobile) {
        badges.push({ 
            id: 'immobile', 
            icon: <Weight size={16} />, 
            label: "Immobile", 
            color: "text-gray-400",
            description: "This card is fixed to its current position and cannot be moved."
        });
    }

    // 3. Dynamic Modifiers (Boosts / Debuffs)
    if (aggregator && aggregator.modifiers) {
        // Grouping Map: sourceName -> { typeLabel -> sumValue }
        const groups = new Map();
        const tileMap = GameState.grid?.tileMap || {};
        
        // Get card's relevant categories/skills for filtering
        const cardSkills = [
            template.skill?.toLowerCase(),
            template.category?.toLowerCase(),
            ...traits.filter(t => t.skill).map(t => t.skill.toLowerCase())
        ].filter(Boolean);
        
        const cardCategories = new Set([template.cardType?.toLowerCase(), ...cardSkills]);
        // Add parent categories to the set to allow broad boosts (e.g. Nature boost for Harvesting task)
        cardSkills.forEach(skill => {
            const parent = CATEGORY_PARENTS[skill];
            if (parent) cardCategories.add(parent);
        });

        for (let [sourceId, mods] of aggregator.modifiers) {
            let sourceName = "Unknown Source";
            
            // AuraManager wraps everything in 'aura:', so we need to unwrap for resolution
            if (sourceId.startsWith('aura:')) {
                sourceId = sourceId.replace('aura:', '');
            }

            if (sourceId.startsWith('tile:')) {
                const coords = sourceId.replace('tile:', '');
                const tileId = tileMap[coords];
                const tile = tileId ? getTileType(tileId) : null;
                
                if (tile) {
                    const category = tile.bonuses?.[0]?.category || "";
                    if (category) {
                        const capCat = category.charAt(0).toUpperCase() + category.slice(1);
                        sourceName = `${capCat} Tile`;
                    } else {
                        sourceName = `${tile.name || "Unknown"} Tile`;
                    }
                } else {
                    sourceName = "Nearby Tile";
                }
            } else if (sourceId.startsWith('hero:')) {
                const parts = sourceId.split(':');
                const heroId = parts[1];
                
                const hero = (GameState.state.heroes || []).find(h => h.id === heroId) || (GameState.state.bench || []).find(h => h.id === heroId);
                const trait = getTrait(hero?.traitId);
                
                if (trait) {
                    sourceName = `${trait.name} Hero`;
                } else {
                    sourceName = "Assigned Hero";
                }
            } else {
                // Check if it's a card ID
                const srcCard = GameState.getCardById(sourceId);
                sourceName = srcCard?.name || "Nearby Card";
            }

            if (!groups.has(sourceName)) groups.set(sourceName, {});
            const sourceGroup = groups.get(sourceName);

            for (const mod of mods) {
                const val = mod.value || 0;
                if (val === 0) continue;
                
                // Filter: Only show modifiers that actually affect this card
                const modCategory = (mod.target?.category || "all").toLowerCase();
                const isRelevant = modCategory === "all" || cardCategories.has(modCategory);
                if (!isRelevant) continue;

                let typeLabel = mod.type;
                // Standardize XP labels
                const upperType = typeLabel.toUpperCase();
                if (upperType === 'XP_GAIN' || upperType === 'XP_BONUS' || upperType === 'XPGAIN') {
                    typeLabel = "XP";
                } else if (upperType === 'SPEED') {
                    typeLabel = "Task Time";
                }

                if (!sourceGroup[typeLabel]) sourceGroup[typeLabel] = 0;
                sourceGroup[typeLabel] += val;
            }
        }

        let boostLines = [];
        let debuffLines = [];

        for (const [sourceName, types] of groups) {
            for (const [typeLabel, totalVal] of Object.entries(types)) {
                if (totalVal === 0) continue;

                let displayPercent = Math.round(totalVal * 100);
                let displaySign = totalVal > 0 ? "+" : "";

                // Special handling for Task Time Reduction reporting
                if (typeLabel === "Task Time") {
                    const reduction = (1 - (1 / (1 + totalVal))) * 100;
                    displayPercent = Math.abs(Math.round(reduction));
                    displaySign = totalVal > 0 ? "-" : "+";
                }
                
                const line = (
                    <div key={`${sourceName}-${typeLabel}`} className="flex items-center gap-1 text-[11px] leading-tight">
                        <span className="text-white font-bold whitespace-nowrap">{displaySign}{displayPercent}% {typeLabel}</span>
                        <span className="italic text-white/40 whitespace-nowrap"> - {sourceName}</span>
                    </div>
                );
                
                if (totalVal > 0) boostLines.push(line);
                else if (totalVal < 0) debuffLines.push(line);
            }
        }

        if (boostLines.length > 0) {
            badges.push({
                id: 'boost',
                icon: <TrendingUp size={16} />,
                label: "Active Boosts",
                color: "text-gi-success",
                children: <div className="flex flex-col gap-1 mt-1">{boostLines}</div>
            });
        }
        if (debuffLines.length > 0) {
            badges.push({
                id: 'debuff',
                icon: <TrendingDown size={16} />,
                label: "Active Debuffs",
                color: "text-gi-danger",
                children: <div className="flex flex-col gap-1 mt-1">{debuffLines}</div>
            });
        }
    }

    if (badges.length === 0) return null;

    return (
        <div 
            className="absolute flex flex-col gap-3 z-50 pointer-events-none items-end"
            style={{
                left: -80, // 72px width + 8px gap
                top: 0,
                width: 72
            }}
        >
            {badges.map(badge => (
                <BadgeItem key={badge.id} id={badge.id} {...badge} />
            ))}
        </div>
    );
});

export const BadgeItem = ({ id, icon, label, color, description, children, variant = 'default' }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [mousePos, setMousePos] = useState(null);

    const handlePointerMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    const isBoost = ['boost', 'debuff'].includes(id);
    const isMinimal = variant === 'minimal';

    return (
        <div 
            className="group relative flex items-center justify-center"
            onPointerEnter={() => setIsHovered(true)}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => {
                setIsHovered(false);
                setMousePos(null);
            }}
        >
            <div className={cn(
                "flex items-center justify-center transition-all duration-300 pointer-events-auto",
                !isMinimal && "w-[72px] h-[72px] rounded-xl bg-black/80 border border-white/10 shadow-lg hover:border-white/40 hover:scale-105",
                isMinimal && "w-8 h-8 hover:scale-110",
                color
            )}>
                {React.isValidElement(icon) 
                    ? React.cloneElement(icon, { size: isMinimal ? 32 : 52 }) 
                    : icon}
            </div>
            
            {isHovered && SettingsManager.get('ui.tooltipsEnabled') && SettingsManager.get('ui.tooltipsCardBadges') && (
                <GUTooltip 
                    title={label} 
                    description={description ? <div className="italic">{description}</div> : null} 
                    mousePos={mousePos} 
                    color={color}
                    width={isBoost ? 'auto' : 240}
                >
                    {children}
                </GUTooltip>
            )}
        </div>
    );
};

export default BadgeGutter;
