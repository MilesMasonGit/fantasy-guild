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
        ['invasion_threat_updated']
    );

    const threatLevel = Math.floor(threat / 20);
    const multVal = 1.0 + (threatLevel * 0.2);
    const multStr = multVal % 1 === 0 ? multVal.toFixed(0) : multVal.toFixed(1);

    return (
        <div className="flex items-center justify-center py-2 px-3 bg-gi-warning/5 border-t border-gi-warning/10">
            <span className="gi-outline-2 text-[10px] font-bold uppercase tracking-widest text-gi-warning font-display">
                Threat {Math.floor(threat)}% - x{multStr} Task Time
            </span>
        </div>
    );
});

export default ThreatModule;
