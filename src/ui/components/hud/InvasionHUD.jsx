import React from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { getInvasion } from '../../../config/registries/invasionRegistry.js';
import { ShieldAlert, Sword, Target } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * InvasionHUD
 * Displays active invasion status, threat level, and horde progress.
 */
export const InvasionHUD = () => {
    const activeAreaId = useGameState(state => state?.ui?.activeAreaId);
    const areaState = useGameState(
        state => (state?.areaStates && activeAreaId) ? state.areaStates[activeAreaId] : null, 
        ['invasion_threat_updated']
    );
    
    // Find the invasion card to get horde progress
    const activeCards = useGameState(state => state?.cards?.active || [], ['cards_updated', 'combat_victory']);

    if (!areaState || !areaState.activeInvasionId) return null;

    const invasion = getInvasion(areaState.activeInvasionId);
    if (!invasion) return null;

    const threat = areaState.invasionThreat || 0;
    
    const invasionCard = activeCards.find(c => c.cardType === 'invasion' && c.invasionId === areaState.activeInvasionId);

    return (
        <div className="absolute bottom-4 left-4 z-[50] flex flex-col gap-1 w-64 bg-gi-danger/5 border border-gi-danger/20 rounded-lg px-3 py-1.5 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-in fade-in slide-in-from-bottom-2 duration-500 backdrop-blur-md pointer-events-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-gi-danger animate-pulse" />
                    <span className="text-xs font-bold text-gi-danger uppercase tracking-tight truncate max-w-[120px]">
                        {invasion.name || 'Invasion Active'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-gi-danger/60" />
                    <span className="text-[10px] font-bold text-gi-danger">
                        {Math.floor(threat)}% THREAT
                    </span>
                </div>
            </div>

            {/* Threat Level Bar */}
            <div className="h-1 bg-black/30 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gi-danger transition-all duration-500"
                    style={{ width: `${threat}%` }}
                />
            </div>

            {/* Horde Progress (if card exists) */}
            {invasionCard && (
                <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1">
                        <Sword className="w-3 h-3 text-gi-text/40" />
                        <span className="text-[10px] font-medium text-gi-text/60 uppercase">Forces Remaining:</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-gi-text">
                        {invasionCard.hordeCount || 0} / {invasionCard.hordeTotal || invasion.count || '?'}
                    </span>
                </div>
            )}
            
            {!invasionCard && (
                <div className="text-[9px] text-gi-danger/60 italic mt-0.5 animate-pulse">
                    Locating Landing Party...
                </div>
            )}
        </div>
    );
};

export default InvasionHUD;
