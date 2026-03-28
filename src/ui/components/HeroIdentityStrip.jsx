import React from 'react';
import isEqual from 'fast-deep-equal/es6';
import { useDroppable } from '@dnd-kit/core';
import EntityDraggable from './base/EntityDraggable.jsx';
import ContextMenu from './base/ContextMenu.jsx';
import { MoreVertical, Swords, Skull, X } from 'lucide-react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import { formatCompact } from '../../utils/Formatters.js';
import { ItemIcon } from './base/ItemIcon.jsx';
import { Badge } from './base/Badge.jsx';
import { getXpProgress } from '../../utils/XPCurve.js';
import { getSkill, getItem } from '../../config/registries/index.js';
const SLOT_INFO = {
    weapon: { icon: '⚔️' },
    armor: { icon: '🛡️' },
    food: { icon: '🍞' },
    drink: { icon: '🍺' }
};

// Helper to calculate level from skill sums - with defensive checks
const calculateLevel = (skills) => {
    if (!skills || typeof skills !== 'object') return 1;
    const total = Object.values(skills).reduce((sum, s) => {
        const level = typeof s === 'number' ? s : (s?.level || 1);
        return sum + level;
    }, 0);
    return Math.max(1, Math.floor(total / 9)); 
};

export const HeroIdentityStrip = ({ heroId, idPrefix = 'roster', slotIndex }) => {
    const engine = useEngine();
    
    // DROPPABLE: Allow items to be dropped on the hero card for equipping
    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `droppable-hero-${heroId}`,
        data: {
            type: 'hero',
            id: heroId
        }
    });

    // Memoize events
    const events = React.useMemo(() => ['state_changed', 'heroes_updated'], []);

    const hero = useGameState(
        state => engine.HeroManager.getHero(heroId),
        ['heroes_updated']
    );

    if (!hero) return null;

    const isWounded = hero.status === 'wounded';
    const isAssigned = !!hero.assignedCardId;
    const currentLevel = calculateLevel(hero.skills);

    const handleRetire = React.useCallback(() => {
        if (!engine?.HeroManager) return;
        if (confirm(`Are you sure you want to retire ${hero.name}?`)) {
            engine.HeroManager.retireHero(hero.id);
        }
    }, [engine?.HeroManager, hero?.id, hero?.name]);

    const handleContextMenu = React.useCallback((e) => {
        e.preventDefault();
        if (idPrefix === 'roster') {
            engine.HeroManager.moveHeroToBench(heroId);
        } else if (idPrefix === 'bench') {
            const result = engine.HeroManager.moveHeroToActive(heroId);
            if (result && !result.success && result.error === 'ROSTER_FULL') {
                // The engine manager publishes the 'hero_activation_failed' or similar, 
                // but we can also trigger a local notification if needed.
                engine.EventBus.publish('ui:notify', { 
                    message: 'Active Roster is Full!', 
                    type: 'error' 
                });
            }
        }
    }, [engine, heroId, idPrefix]);

    return (
        <div 
            ref={setDroppableRef}
            data-droppable-id={`droppable-hero-${hero.id}`}
            className="rounded-lg transition-all duration-200 relative overflow-hidden"
            onContextMenu={handleContextMenu}
        >
            {/* PERFORMANCE: CSS-driven highlight via data-drag-over */}
            <div className="absolute inset-0 bg-gi-primary/5 ring-1 ring-gi-primary/30 z-0 pointer-events-none opacity-0 [[data-drag-over='true']_&]:opacity-100 transition-opacity" />
            <EntityDraggable
                id={`${idPrefix}-${hero.id}`}
                data={{
                    type: 'hero',
                    id: hero.id,
                    idPrefix,
                    title: hero.name,
                    subtitle: `${hero.className} - Lvl ${currentLevel}`,
                    icon: hero.icon,
                    // When rendered inside a card slot, include source info for unassignment
                    ...(idPrefix === 'slot' && hero.assignedCardId ? {
                        sourceCardId: hero.assignedCardId,
                        sourceSlotIndex: slotIndex,
                    } : {}),
                }}
                disabled={isWounded}
                className="w-full"
            >
                <div 
                    className={cn(
                        "flex flex-col transition-all duration-200", // Column layout to accommodate skills
                        idPrefix === 'slot'
                            ? "gap-2 border-none w-full bg-gi-surface cursor-grab active:cursor-grabbing overflow-hidden h-full rounded"
                            : cn(
                                "p-2 rounded-lg border",
                                isWounded
                                    ? 'bg-gi-danger/10 border-gi-danger/30 opacity-70 cursor-not-allowed'
                                    : isAssigned
                                        ? 'bg-gi-surface-hover border-gi-accent/30 opacity-80 cursor-grab active:cursor-grabbing'
                                        : 'bg-gi-surface border-gi-border hover:border-gi-primary/50 hover:bg-gi-surface-hover hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-grab active:cursor-grabbing'
                            )
                    )}
                >
                <div className="flex items-center gap-3">
                    {idPrefix === 'slot' ? (
                        /* Slot-Style Layout (matches InputSlotModule) */
                        <React.Fragment>
                            <div className="w-[72px] h-[72px] flex items-center justify-center bg-black/40 border-r border-white/10 flex-shrink-0 relative">
                                {isWounded ? (
                                    <Skull className="w-10 h-10 text-gi-danger" />
                                ) : (
                                    <ItemIcon item={hero} size={64} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-between pr-2">
                                <div className="gi-text-16 font-bold text-gi-text truncate mr-2">{hero.name}</div>
                                {hero.energy?.current !== undefined && (
                                    <Badge
                                        value={formatCompact(Math.floor(hero.energy.current), 1)}
                                        variant="energy"
                                        size="base"
                                    />
                                )}
                            </div>
                        </React.Fragment>
                    ) : (
                        /* Original Roster Layout */
                        <React.Fragment>
                            <div className={`
                                w-8 h-8 rounded-md flex items-center justify-center border flex-shrink-0
                                ${isWounded ? 'bg-gi-danger/20 border-gi-danger/50' : 'bg-gi-base border-gi-border/50'}
                            `}>
                                {isWounded ? (
                                    <Skull className="w-5 h-5 text-gi-danger" />
                                ) : (
                                    <ItemIcon item={hero} size={32} />
                                )}
                            </div>

                            {/* Identity Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <h4 className="gi-text-16 font-bold text-gi-text truncate">{hero.name}</h4>
                                    <span className="text-xs font-bold text-gi-primary font-display ml-2">Lvl {currentLevel}</span>
                                </div>

                                <div className="text-xs text-gi-muted truncate mt-0.5">
                                    {hero.className} {hero.traitName && `• ${hero.traitName}`}
                                </div>

                                {/* Status Pip */}
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isWounded ? 'bg-gi-danger animate-pulse' :
                                        isAssigned ? 'bg-gi-accent' :
                                            'bg-gi-success shadow-[0_0_5px_rgba(16,185,129,0.5)]'
                                        }`} />
                                    <span className="text-[10px] uppercase tracking-wider text-gi-muted font-bold">
                                        {isWounded ? 'Wounded' : isAssigned ? 'Assigned' : 'Resting'}
                                    </span>
                                </div>
                            </div>

                            {/* Context Menu (Click event propagation must be stopped so it doesn't trigger drag) */}
                            <div
                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ContextMenu
                                    align="left"
                                    trigger={
                                        <button className="p-1.5 rounded bg-gi-base/50 text-gi-muted hover:text-white hover:bg-gi-primary/20 transition-colors border border-transparent hover:border-gi-primary/30">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    }
                                    items={[
                                        { label: "View Details", icon: <Swords />, onClick: () => console.log('Details...') },
                                        { label: "Retire Hero", danger: true, onClick: handleRetire }
                                    ]}
                                />
                            </div>
                        </React.Fragment>
                    )}
                </div>

                {/* 
                  * ⚔️ PHASE 3: EQUIPMENT GRID 
                  * 2x2 grid for Weapon, Armor, Food, Drink
                  */}
                {idPrefix !== 'slot' && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gi-border/20">
                        {['weapon', 'armor', 'food', 'drink'].map(slot => {
                            const itemId = hero.equipment?.[slot];
                            const item = itemId ? getItem(itemId) : null;
                            return (
                                <div key={slot} className="flex items-center gap-2 p-1.5 rounded bg-gi-base/30 border border-gi-border/20 group/slot relative">
                                    <div className="w-6 h-6 flex items-center justify-center rounded bg-black/20 text-xs grayscale group-hover/slot:grayscale-0">
                                        {item ? (
                                            <ItemIcon item={item} size={20} />
                                        ) : (
                                            <span className="opacity-20">{SLOT_INFO[slot]?.icon}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] text-gi-muted uppercase tracking-tighter leading-none">{slot}</div>
                                        <div className="text-[11px] font-bold text-gi-text truncate leading-tight">
                                            {item?.name || 'Empty'}
                                        </div>
                                    </div>
                                    {item && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                engine.EquipmentManager.unequipItem(hero.id, slot);
                                            }}
                                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gi-danger text-white flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity scale-75 hover:scale-100"
                                            title="Unequip"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 
                  * 🎓 PHASE 5: HERO SKILL UI 
                  * Redesigned: Vertical list with names and percentages
                  */}
                {idPrefix !== 'slot' && hero.skills && (
                    <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-gi-border/20">
                        {Object.entries(hero.skills).map(([skillId, skillData]) => {
                            const skillDef = getSkill(skillId);
                            if (!skillDef) return null;
                            
                            // Support both { xp: N, level: N } and legacy { level: N } formats
                            const xp = typeof skillData === 'object' ? (skillData.xp || 0) : 0;
                            const level = typeof skillData === 'object' ? (skillData.level || 0) : (skillData || 0);
                            
                            const progress = getXpProgress(xp);
                            // PROGRESS FIX: Multiply by 100 for percentage display
                            const percent = (progress && !isNaN(progress.progress)) ? Math.floor(progress.progress * 100) : 0;

                            return (
                                <div key={skillId} className="flex items-center justify-between group/skill" title={`${skillDef.name}: ${level}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm grayscale group-hover/skill:grayscale-0 transition-all w-5 text-center">
                                            {skillDef.icon}
                                        </span>
                                        <span className="text-[11px] font-bold text-gi-text/80 group-hover/skill:text-gi-text transition-colors">
                                            {skillDef.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-gi-primary/60">
                                            Lvl {level}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-gi-accent w-8 text-right">
                                            {percent}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                </div>
            </EntityDraggable>
        </div>
    );
};
HeroIdentityStrip.displayName = 'HeroIdentityStrip';

export default HeroIdentityStrip;
