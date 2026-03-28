import React from 'react';
import { Sword, Users, Shield } from 'lucide-react';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';

/**
 * HordeModule
 * Displays the remaining enemy count and a progress bar for Invasion cards.
 */
export const HordeModule = ({ trait, card }) => {
    const count = card.hordeCount || 0;
    const total = card.hordeTotal || 1;
    const progress = (count / total) * 100;
    
    // Resolve enemy name
    const enemyDef = getEnemy(card.enemyId);
    const enemyName = enemyDef?.name || 'Enemies';
    
    return (
        <div className="flex flex-col gap-2 px-3 py-2 bg-gi-danger/5 border-t border-gi-danger/10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gi-danger/80">
                    <Shield className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest font-display">
                        Horde: {enemyName}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-gi-text">
                    <span className="text-gi-danger">{count}</span>
                    <span className="text-gi-muted">/</span>
                    <span>{total}</span>
                    <span className="text-[9px] text-gi-muted ml-0.5 uppercase tracking-tighter">Left</span>
                </div>
            </div>
            
            {/* Horde Progress Bar */}
            <div className="h-2.5 bg-black/40 rounded-full p-[1px] border border-gi-danger/20 relative group">
                <div 
                    className="h-full bg-gradient-to-r from-gi-danger to-gi-danger/60 rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                    style={{ width: `${progress}%` }}
                />
                
                {/* Visual milestone ticks */}
                <div className="absolute inset-0 flex justify-evenly pointer-events-none opacity-20">
                    <div className="w-px h-full bg-white" />
                    <div className="w-px h-full bg-white" />
                    <div className="w-px h-full bg-white" />
                </div>
            </div>
            
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <Sword className="w-2.5 h-2.5 text-gi-danger/60" />
                    <span className="text-[9px] text-gi-muted uppercase font-bold tracking-tighter">
                        {count <= 0 ? 'Horde Broken' : 'Defeat Group to Reduce'}
                    </span>
                </div>
                <span className="text-[9px] text-gi-danger font-bold tabular-nums">
                    {Math.ceil(progress)}% Strength
                </span>
            </div>
        </div>
    );
};

export default HordeModule;
