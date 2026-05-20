import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import EntityDraggable from './base/EntityDraggable.jsx';
import { Skull, ChevronDown, ChevronUp } from 'lucide-react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import { getClass } from '../../config/registries/index.js';
import { ItemIcon } from './base/ItemIcon.jsx';
import { Badge } from './base/Badge.jsx';
import { formatCompact } from '../../utils/Formatters.js';

// Import New Modular Components
import HeaderModule from './hero/HeaderModule.jsx';
import StatBarsModule from './hero/StatBarsModule.jsx';
import EquipmentListModule from './hero/EquipmentListModule.jsx';
import SkillsModule from './hero/SkillsModule.jsx';

export const HeroIdentityStrip = ({ heroId, idPrefix = 'roster', slotIndex, isTavernOpen = false }) => {
    const engine = useEngine();
    const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);
    const [isEquipmentExpanded, setIsEquipmentExpanded] = useState(true);
    
    // DROPPABLE: Allow items to be dropped on the hero card for equipping
    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `droppable-hero-${heroId}`,
        data: {
            type: 'hero',
            id: heroId
        }
    });

    const hero = useGameState(
        state => engine.HeroManager.getHero(heroId),
        ['heroes_updated', 'state_changed'],
        null,
        { deps: [heroId] }
    );

    if (!hero) return null;

    const heroClass = getClass(hero.classId);
    const isWounded = hero.status === 'wounded';
    const isAssigned = !!hero.assignedCardId;

    const handleContextMenu = React.useCallback((e) => {
        e.preventDefault();
        // ONLY move to bench if the Tavern is open
        if (idPrefix === 'roster' && isTavernOpen) {
            engine.HeroManager.moveHeroToBench(heroId);
        } else if (idPrefix === 'bench') {
            const result = engine.HeroManager.moveHeroToActive(heroId);
            if (result && !result.success && result.error === 'ROSTER_FULL') {
                engine.EventBus.publish('ui:notify', { 
                    message: 'Active Roster is Full!', 
                    type: 'error' 
                });
            }
        }
    }, [engine, heroId, idPrefix, isTavernOpen]);

    // Handle standard 'Slot' mode for Heroes placed inside cards
    if (idPrefix === 'slot') {
        return (
            <div 
                ref={setDroppableRef}
                data-type="hero"
                data-id={hero.id}
                className="w-full bg-gi-surface cursor-grab active:cursor-grabbing overflow-hidden h-full rounded flex items-center gap-3 border border-gi-border/20"
            >
                <div className="w-[72px] h-[72px] flex items-center justify-center bg-black/40 border-r border-white/10 flex-shrink-0 relative">
                    {isWounded ? (
                        <Skull className="w-10 h-10 text-gi-danger" />
                    ) : (
                        <ItemIcon item={hero} size={64} />
                    )}
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between pr-3">
                    <div className="gi-text-16 font-bold text-gi-text truncate mr-2 uppercase tracking-wide">{hero.name}</div>
                    {hero.energy?.current !== undefined && (
                        <Badge
                            value={formatCompact(Math.floor(hero.energy.current), 1)}
                            variant="energy"
                            size="base"
                        />
                    )}
                </div>
            </div>
        );
    }

    // Standard Detailed Roster/Bench View
    return (
        <div 
            ref={setDroppableRef}
            data-droppable-id={`droppable-hero-${hero.id}`}
            data-type="hero"
            data-id={hero.id}
            className="rounded-lg transition-all duration-300 relative overflow-hidden group"
            onContextMenu={handleContextMenu}
        >
            <div className="absolute inset-0 bg-gi-primary/5 ring-1 ring-gi-primary/30 z-0 pointer-events-none opacity-0 [[data-drag-over='true']_&]:opacity-100 transition-opacity" />
            
            <EntityDraggable
                id={`${idPrefix}-${hero.id}`}
                data={{
                    type: 'hero',
                    id: hero.id,
                    idPrefix,
                    classId: hero.classId,
                    name: hero.name, // Matches ItemIcon expectation
                    icon: hero.icon,
                    // New unified ID for sprite resolution
                    spriteId: hero.spriteId || hero.classId
                }}
                disabled={isWounded}
                className="w-full"
            >
                <div className={cn(
                    "flex flex-col rounded-lg border transition-all duration-300 shadow-lg",
                    isWounded
                        ? 'bg-gi-danger/5 border-gi-danger/30 opacity-70 cursor-not-allowed'
                        : isAssigned
                            ? 'bg-gi-surface-hover border-gi-primary/30 opacity-90 cursor-grab active:cursor-grabbing shadow-gi-primary/10'
                            : 'bg-gi-surface border-gi-border hover:border-gi-primary/50 hover:bg-gi-surface-hover hover:shadow-gi-shadow-deep cursor-grab active:cursor-grabbing'
                )}>
                    {/* 1. Header (Portrait, Identity) */}
                    <HeaderModule 
                        hero={hero} 
                        onCustomize={() => engine.EventBus.publish('ui:open_hero_customize', { heroId })} 
                    />

                    {/* 2. Vital Stats (HP/Energy) */}
                    <StatBarsModule hero={hero} />

                    {/* 4. Equipment Section (Expandable) */}
                    <div className="flex flex-col border-t border-gi-border/20">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEquipmentExpanded(!isEquipmentExpanded);
                            }}
                            className="flex items-center justify-between px-3 py-2 bg-black/10 hover:bg-black/20 transition-all group/toggle text-gi-muted hover:text-gi-text"
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest">Equipment</span>
                            {isEquipmentExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {isEquipmentExpanded && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <EquipmentListModule hero={hero} />
                            </div>
                        )}
                    </div>

                    {/* 5. Skills Section (Expandable) */}
                    <div className="flex flex-col border-t border-gi-border/20">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSkillsExpanded(!isSkillsExpanded);
                            }}
                            className="flex items-center justify-between px-3 py-2 bg-black/10 hover:bg-black/20 transition-all group/toggle text-gi-muted hover:text-gi-text"
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest">Skills</span>
                            {isSkillsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {isSkillsExpanded && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <SkillsModule hero={hero} />
                            </div>
                        )}
                    </div>

                </div>
            </EntityDraggable>
        </div>
    );
};

HeroIdentityStrip.displayName = 'HeroIdentityStrip';
export default HeroIdentityStrip;
