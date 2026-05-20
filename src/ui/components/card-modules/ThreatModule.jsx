import React from 'react';
import { AlertTriangle, TrendingUp, Info } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState.js';
import { getInvasion } from '../../../config/registries/invasionRegistry.js';
import { getThreat } from '../../../config/registries/threatRegistry.js';
import { cn } from '../../utils/cn.js';

/**
 * ThreatModule
 * Displays escalating regional threat and active debuff milestones for Invasion cards.
 */
export const ThreatModule = React.memo(({ trait, card }) => {
    // Subscribe to threat updates for this area
    const activeAreaId = useGameState(state => state?.ui?.activeAreaId);
    const resolvedAreaId = card.areaId || activeAreaId || 'farmland';

    const threat = useGameState(
        state => state?.areaStates?.[resolvedAreaId]?.invasionThreat || 0,
        ['invasion_threat_updated', 'state_changed']
    );

    // Get invasion template for milestones
    const invasionId = card.invasionId || 'hostile_hens';
    const invasion = getInvasion(invasionId);
    
    if (!invasion) return null;

    // Get active/next debuffs based on milestones
    const milestones = invasion.milestones || [];
    const activeMilestones = milestones.filter(m => threat >= m.threat);
    const nextMilestone = milestones.find(m => threat < m.threat);

    return (
        <div className="flex flex-col gap-2 px-3 py-2 bg-gi-warning/5 border-t border-gi-warning/10">
            {/* Header: Label and Percentage */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gi-warning">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest font-display">
                        Regional Threat
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-gi-warning">
                    <span>{Math.floor(threat)}%</span>
                </div>
            </div>

            {/* Threat Progress Bar with Milestone Markers */}
            <div className="h-2 bg-black/40 rounded-full p-[1px] border border-gi-warning/20 relative">
                <div 
                    className="h-full bg-gradient-to-r from-gi-warning to-yellow-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                    style={{ width: `${Number.isFinite(threat) ? threat : 0}%` }}
                />
                
                {/* Milestone Tick Markers */}
                {milestones.map((m, i) => (
                    <div 
                        key={i}
                        className={cn(
                            "absolute top-0 bottom-0 w-[2.5px] z-10 transition-colors duration-500",
                            threat >= m.threat ? "bg-gi-warning" : "bg-white/10"
                        )}
                        style={{ left: `${m.threat}%` }}
                    />
                ))}
            </div>

            {/* Active Effects List (Escalating penalties) */}
            <div className="flex flex-col gap-1 mt-0.5 min-h-[16px]">
                {activeMilestones.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        {activeMilestones.map((m, i) => {
                            const debuff = getThreat(m.debuffId);
                            const totalStacks = m.stacks || 1;
                            const penaltyValue = debuff?.value ? Math.round(debuff.value * totalStacks * 100) : 0;
                            
                            return (
                                <div key={i} className="flex items-center justify-between group/debuff animate-in fade-in slide-in-from-left-1 duration-300">
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <AlertTriangle className="w-2.5 h-2.5 text-gi-danger flex-shrink-0" />
                                        <span className="text-[9px] text-white/90 font-bold truncate">
                                            {debuff?.name || m.debuffId} {totalStacks > 1 ? `(x${totalStacks})` : ''}
                                        </span>
                                    </div>
                                    <span className="text-[9px] text-gi-danger font-black whitespace-nowrap">
                                        {penaltyValue > 0 ? `+${penaltyValue}%` : `${penaltyValue}%`} {debuff?.effectType || 'EFFECT'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-[9px] text-gi-muted italic flex items-center gap-1 animate-pulse">
                        <Info className="w-2.5 h-2.5" />
                        Invasion building momentum...
                    </div>
                )}
            </div>

            {/* Technical Detail: Next Milestone Threshold */}
            {nextMilestone && (
                <div className="pt-1 border-t border-white/5 mt-0.5">
                    <div className="flex justify-between items-center opacity-40">
                        <span className="text-[8px] uppercase font-bold tracking-tighter">Next Escalation:</span>
                        <span className="text-[8px] font-mono">{nextMilestone.threat}%</span>
                    </div>
                </div>
            )}
        </div>
    );
});

export default ThreatModule;
