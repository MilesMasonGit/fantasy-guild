import React from 'react';
import { useGameState } from '../hooks/useGameState.js';
import HeroIdentityStrip from './HeroIdentityStrip.jsx';
import { Users } from 'lucide-react';

/**
 * HeroView: The Left Panel rendering the roster of hired Heroes.
 * Reactively subscribes to `state.heroes`.
 */
export const HeroView = () => {
    // Only re-render when the hero array changes
    const heroes = useGameState(state => state.heroes || []);

    // For now, filter out dead heroes if that ever becomes a status
    const activeHeroes = heroes.filter(h => h.status !== 'dead');

    return (
        <div className="w-80 h-full bg-gi-surface/90 backdrop-blur-md border-r border-gi-border flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-[90]">

            {/* Header */}
            <div className="p-4 border-b border-gi-border/50 bg-gi-base/50 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gi-primary/20 rounded border border-gi-primary/30">
                        <Users className="w-5 h-5 text-gi-primary" />
                    </div>
                    <h2 className="font-display font-bold text-lg text-gi-text tracking-wider text-shadow-neon">ROSTER</h2>
                </div>
                <div className="text-xs font-bold text-gi-muted bg-gi-surface px-2 py-1 rounded border border-gi-border">
                    {activeHeroes.length} / 10
                </div>
            </div>

            {/* Scrollable Hero List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {activeHeroes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gi-muted/50 p-6 text-center border-2 border-dashed border-gi-border/30 rounded-xl">
                        <Users className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-display text-sm">No Heroes Hired</p>
                        <p className="text-xs mt-2">Recruit heroes from the Tavern or specialized Events.</p>
                    </div>
                ) : (
                    activeHeroes.map(hero => (
                        <HeroIdentityStrip key={hero.id} hero={hero} />
                    ))
                )}
            </div>

            {/* Footer / Info */}
            <div className="p-3 border-t border-gi-border/50 bg-gi-base/30 text-[10px] text-center text-gi-muted uppercase tracking-widest font-bold">
                Deploy heroes via drag-and-drop
            </div>
        </div>
    );
};

export default HeroView;
