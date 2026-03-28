import React, { useMemo } from 'react';
import { Map, Compass, Trophy } from 'lucide-react';
import { useGameState } from '../hooks/useGameState.js';
import { getAreaSet, getSetTotal } from '../../config/registries/areaSetRegistry.js';
import { getAreaQuests } from '../../config/registries/questRegistry.js';
import { ExplorationManager } from '../../systems/progression/ExplorationManager.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import GICard from './base/GICard.jsx';
import { cn } from '../utils/cn.js';

/**
 * AreaDeckHub — The central anchor card for the active biome board.
 * Now shows Set Mastery progress for the current area.
 *
 * @param {Object} props
 * @param {Function} props.onOpenWorldMap — Callback to open the WorldMapDrawer
 */
const AreaDeckHub = ({ onOpenWorldMap }) => {
    // 1. Which biome are we on?
    const activeAreaId = useGameState(
        state => state.ui?.activeAreaId || 'guild_hall_v1',
        ['area_switched']
    );

    // 2. Subscription to ownership for mastery progress
    const playsets = useGameState(state => state.collection?.playsets || {}, ['collection_updated']);
    const areaState = useGameState(
        state => state.areaStates?.[activeAreaId] || { explorationCount: 0, completedQuestIds: [] },
        ['area_switched', 'quest_state_changed', 'state_changed']
    );

    // 3. Look up the biome's display data from the registry
    const areaSet = getAreaSet(activeAreaId);
    const biomeName = areaSet?.name || 'Unknown';
    const biomeIcon = areaSet?.icon || '🏰';

    // 4. Calculate Mastery
    const setTotal = getSetTotal(activeAreaId);
    const foundInSet = useMemo(() => {
        if (!areaSet) return 0;
        let count = 0;
        Object.entries(areaSet.deckList || {}).forEach(([tid, max]) => {
            count += Math.min(playsets[tid] || 0, max);
        });
        return count;
    }, [areaSet, playsets]);

    const masteryPercent = setTotal > 0 ? Math.min(100, (foundInSet / setTotal) * 100) : 0;

    const areaQuests = getAreaQuests(activeAreaId);
    const totalQuests = areaQuests.length;
    const completedQuests = areaState.completedQuestIds?.length || 0;
    const questMasteryPercent = totalQuests > 0 ? Math.min(100, (completedQuests / totalQuests) * 100) : 0;
    const explorationCount = areaState.explorationCount || 0;

    // 5. Resolve background art
    const bgSprite = resolveSpritePath(areaSet?.areaArt || (activeAreaId === 'guild_hall_v1' ? 'bg_tavern' : `bg_${activeAreaId.split('_')[0]}`));

    const handleOpenQuestModal = () => {
        ExplorationManager.spawnExploreCard(activeAreaId);
    };

    return (
        <GICard
            intent="area"
            interactive={false}
            imageSrc={bgSprite}
            className="!p-0 select-none flex flex-col"
        >
            {/* Biome Title Bar */}
            <div className="flex items-center gap-2 px-3 py-2
                            bg-black/60 border-b border-white/10">
                <span className="text-xl">{biomeIcon}</span>
                <h3 className="font-display font-bold text-sm text-gi-text
                               tracking-wider uppercase truncate">
                    {biomeName}
                </h3>
            </div>

            {/* Mastery Progress */}
            <div className="p-4 bg-black/30 border-b border-white/5 flex flex-col gap-3">
                {/* Set Mastery */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-gi-primary">
                            <Trophy size={14} />
                            <span className="font-display font-bold text-[10px] uppercase tracking-wider">Set Mastery</span>
                        </div>
                        <span className="font-display font-bold text-[10px] text-gi-text">
                            {foundInSet} / {setTotal}
                        </span>
                    </div>
                    {/* Bar */}
                    <div className="w-full h-1.5 bg-gi-base rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-gi-primary shadow-[0_0_8px_rgba(6,182,212,0.6)] transition-all duration-700"
                            style={{ width: `${masteryPercent}%` }}
                        />
                    </div>
                </div>

                {/* Quest Mastery */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-gi-success">
                            <Compass size={14} />
                            <span className="font-display font-bold text-[10px] uppercase tracking-wider">Quest Mastery</span>
                        </div>
                        <span className="font-display font-bold text-[10px] text-gi-text">
                            {completedQuests} / {totalQuests}
                        </span>
                    </div>
                    {/* Bar */}
                    <div className="w-full h-1.5 bg-gi-base rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-gi-success shadow-[0_0_8px_rgba(34,197,94,0.6)] transition-all duration-700"
                            style={{ width: `${questMasteryPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 flex flex-col justify-center items-center text-center">
                <div className="text-xl opacity-30 mb-2">🔭</div>
                <div className="text-gi-muted mb-1 font-display text-[10px] uppercase tracking-widest">Exploration Phase</div>
                <div className="text-5xl font-display font-bold text-gi-text text-shadow-neon">{explorationCount}</div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 p-3 mt-auto bg-black/40 border-t border-white/5">
                {/* World Map Button */}
                <button
                    onClick={onOpenWorldMap}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2",
                        "px-3 py-2 rounded-lg",
                        "bg-gi-surface-hover/80 border border-gi-border",
                        "text-gi-text hover:bg-gi-primary/20",
                        "hover:border-gi-primary/40",
                        "transition-all font-display text-[10px]",
                        "font-bold tracking-wider uppercase"
                    )}
                >
                    <Map size={14} className="text-gi-primary" />
                    <span>World Map</span>
                </button>

                {/* Quest Button (Phase 2 UI Hook) */}
                <button
                    onClick={handleOpenQuestModal}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2",
                        "px-3 py-2 rounded-lg",
                        "bg-gi-success/10 border border-gi-success/30",
                        "text-gi-success hover:bg-gi-success/20",
                        "hover:border-gi-success/50",
                        "transition-all font-display text-[10px]",
                        "font-bold tracking-wider uppercase"
                    )}
                    title="Available Quests"
                >
                    <Compass size={14} />
                    <span>Quest</span>
                </button>
            </div>
        </GICard>
    );
};

export default AreaDeckHub;
