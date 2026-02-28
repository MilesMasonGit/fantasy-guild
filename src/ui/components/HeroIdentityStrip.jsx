import React from 'react';
import GIDraggable from './base/GIDraggable.jsx';
import ContextMenu from './base/ContextMenu.jsx';
import { MoreVertical, Swords, Skull } from 'lucide-react';
import { useEngine } from '../hooks/useEngine.js';

export const HeroIdentityStrip = ({ hero }) => {
    const engine = useEngine();

    // Helper to calculate level from skill sums
    const calculateLevel = (skills) => {
        if (!skills) return 1;
        const total = Object.values(skills).reduce((sum, s) => sum + s.level, 0);
        return Math.max(1, Math.floor(total / 11));
    };

    const isWounded = hero.status === 'wounded';
    const isAssigned = !!hero.assignedCardId;
    const currentLevel = calculateLevel(hero.skills);

    const handleRetire = () => {
        if (!engine?.heroManager) return;
        if (confirm(`Are you sure you want to retire ${hero.name}?`)) {
            engine.heroManager.dismissHero(hero.id);
        }
    };

    return (
        <GIDraggable
            id={`drag-${hero.id}`}
            data={{
                type: 'hero',
                heroId: hero.id,
                title: hero.name,
                subtitle: `${hero.className} - Lvl ${currentLevel}`,
                icon: hero.icon
            }}
            disabled={isWounded || isAssigned}
            className="w-full relative group"
        >
            <div className={`
                flex items-center gap-3 p-2 rounded-lg border transition-all
                ${isWounded
                    ? 'bg-gi-danger/10 border-gi-danger/30 opacity-70 cursor-not-allowed'
                    : isAssigned
                        ? 'bg-gi-surface-hover border-gi-accent/30 opacity-80 cursor-default'
                        : 'bg-gi-surface border-gi-border hover:border-gi-primary/50 hover:bg-gi-surface-hover hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-grab active:cursor-grabbing'
                }
            `}>

                {/* Avatar */}
                <div className={`
                    w-12 h-12 rounded-md flex items-center justify-center text-2xl border flex-shrink-0
                    ${isWounded ? 'bg-gi-danger/20 border-gi-danger/50' : 'bg-gi-base border-gi-border/50'}
                `}>
                    {isWounded ? <Skull className="w-6 h-6 text-gi-danger" /> : hero.icon}
                </div>

                {/* Identity Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold font-display text-gi-text truncate">{hero.name}</h4>
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
            </div>
        </GIDraggable>
    );
};

export default HeroIdentityStrip;
