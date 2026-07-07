import React from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import ProgressBar from '../base/ProgressBar.jsx';
import { Cloud, AlertTriangle, Zap, Skull } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * ChaosTracker
 * Displays the regional chaos meter (0-1000) with milestone markers.
 */
export const ChaosTracker = () => {
    const activeAreaId = useGameState(state => state?.ui?.activeAreaId, ['area_switched']);
    const chaosPoints = useGameState(
        state => (state?.areaStates && activeAreaId) ? (state.areaStates[activeAreaId]?.chaosPoints || 0) : 0,
        ['chaos_updated', 'area_switched'],
        (data) => !data || data.areaId === activeAreaId
    );
    const chaosStage = useGameState(
        state => (state?.areaStates && activeAreaId) ? (state.areaStates[activeAreaId]?.chaosStage || 0) : 0,
        ['chaos_updated', 'area_switched']
    );

    const maxPoints = 1000;
    const percentage = (chaosPoints / maxPoints) * 100;

    // Milestone thresholds
    const milestones = [250, 500, 750];

    // Status mapping
    const statusMap = [
        { label: 'Stable', color: 'text-gi-success', icon: Cloud },
        { label: 'Unstable', color: 'text-yellow-400', icon: Cloud },
        { label: 'Disturbed', color: 'text-orange-400', icon: AlertTriangle },
        { label: 'Hostile', color: 'text-gi-danger', icon: Zap },
        { label: 'CRITICAL', color: 'text-red-600 font-bold animate-pulse', icon: Skull }
    ];

    const currentStatus = statusMap[chaosStage] || statusMap[0];
    const StatusIcon = currentStatus.icon;

    return (
        <div className="flex flex-col gap-1 w-48 group">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <StatusIcon className={cn("w-3.5 h-3.5 transition-colors", currentStatus.color)} />
                    <span className={cn("text-[10px] uppercase font-bold tracking-widest truncate transition-colors", currentStatus.color)}>
                        {currentStatus.label}
                    </span>
                </div>
                <span className="text-[10px] font-mono opacity-50 font-bold group-hover:opacity-100 transition-opacity">
                    {Math.floor(chaosPoints)}
                </span>
            </div>

            <div className="relative h-2 bg-black/20 rounded-full border border-gi-border overflow-hidden">
                {/* Milestone Markers */}
                {milestones.map(m => (
                    <div 
                        key={m}
                        className="absolute top-0 bottom-0 w-px bg-white/10 z-10"
                        style={{ left: `${(m / maxPoints) * 100}%` }}
                    />
                ))}

                {/* Progress Fill */}
                <div 
                    className={cn(
                        "h-full transition-all duration-300 relative",
                        chaosStage >= 4 ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]" :
                        chaosStage >= 3 ? "bg-orange-500" :
                        chaosStage >= 2 ? "bg-yellow-400" :
                        "bg-gi-primary/60"
                    )}
                    style={{ width: `${Number.isFinite(percentage) ? percentage : 0}%` }}
                >
                    {/* Animated sheen for high chaos */}
                    {chaosStage >= 3 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChaosTracker;
