import React, { useMemo } from 'react';
import { Map, Compass, Trophy, Package, AlertTriangle } from 'lucide-react';
import { useGameState } from '../hooks/useGameState.js';
import { useEngine } from '../hooks/useEngine.js';
import { getAreaSet, getSetTotal } from '../../config/registries/areaSetRegistry.js';
import { getAreaQuests } from '../../config/registries/questRegistry.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import GICard from './base/GICard.jsx';
import { cn } from '../utils/cn.js';
import BadgeGutter from './hud/BadgeGutter.jsx';

/**
 * AreaDeckHub — The central anchor card for the active biome board.
 * Now shows Set Mastery progress for the current area.
 *
 * @param {Object} props
 * @param {Function} props.onOpenWorldMap — Callback to open the WorldMapDrawer
 */
const AreaDeckHub = ({ onOpenWorldMap }) => {
    const engine = useEngine();
    // 1. Which biome are we on?
    const activeAreaId = useGameState(
        state => state.ui?.activeAreaId || 'area_guild_hall',
        ['area_switched']
    );

    console.log('AreaDeckHub Render', { activeAreaId, engine: !!engine });

    // 2. Subscription to ownership for mastery progress
    const playsets = useGameState(state => state.collection?.playsets || {}, ['collection_updated']);
    const areaState = useGameState(
        state => state.areaStates?.[activeAreaId] || { explorationCount: 0, completedQuestIds: [] },
        ['area_switched', 'quest_state_changed']
    );
    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed']);
    const activeCardsCount = useGameState(state => state.cards?.active?.length || 0, ['cards_updated']);
    const maxCards = useGameState(state => state.cards?.limits?.max || 12, ['cards_updated']);
    const cardLimits = useGameState(state => state.cards?.limits || { max: 12 }, ['cards_updated']);
    
    // Explicitly re-read max from limits if present
    const resolvedMax = cardLimits.max || maxCards;

    // 3. Look up the biome's display data from the registry
    const areaSet = getAreaSet(activeAreaId);
    const biomeName = areaSet?.name || 'Unknown';
    const biomeIcon = areaSet?.icon || '🏰';
    const bgSprite = resolveSpritePath(areaSet?.areaArt || 'bg_guild_hall');

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

    const areaQuests = getAreaQuests(activeAreaId);
    const totalQuests = areaQuests.length;
    const completedQuests = areaState.completedQuestIds?.length || 0;

    const questMasteryPercent = useMemo(() => {
        if (totalQuests === 0) return 0;
        const val = (completedQuests / totalQuests) * 100;
        return Number.isFinite(val) ? Math.min(100, val) : 0;
    }, [completedQuests, totalQuests]);

    const masteryPercent = useMemo(() => {
        if (setTotal === 0) return 0;
        const val = (foundInSet / setTotal) * 100;
        return Number.isFinite(val) ? Math.min(100, val) : 0;
    }, [foundInSet, setTotal]);

    const explorationCount = areaState.explorationCount || 0;

    // --- Safe Initialization Checks ---
    const isReady = !!(engine && engine.CollectionManager && engine.ExplorationManager);
    
    // 6. Pack Purchase Data (With Safe Fallbacks)
    const rawCost = isReady ? engine.CollectionManager.getPackCost(activeAreaId) : 0;
    
    // Hardening: Ensure cost is never zero or suspiciously low (like 5g) for the starting area
    const cost = Math.max(rawCost || areaSet?.packBaseGoldCost || 50, 50);
    
    const isExhausted = isReady ? engine.CollectionManager.checkAreaExhaustion(activeAreaId) : false;
    const isBoardFull = activeCardsCount >= resolvedMax;
    const canAfford = gold >= cost;

    // Force a re-render when engine becomes available
    React.useEffect(() => {
        if (isReady) {
            engine.EventBus.publish('state_changed');
        }
    }, [isReady]);

    const handleOpenQuestModal = () => {
        engine.ExplorationManager.spawnExploreCard(activeAreaId);
    };

    const handleBuyPack = () => {
        console.log('AreaDeckHub: Purchase Attempt', {
            isReady,
            activeAreaId,
            gold,
            cost,
            canAfford,
            isBoardFull,
            isExhausted,
            activeCardsCount,
            maxCards
        });

        if (!isReady) {
            console.warn('AreaDeckHub: CollectionManager not ready');
            return;
        }

        if (isExhausted || isBoardFull || !canAfford) {
            console.warn('AreaDeckHub: Purchase Blocked', { isExhausted, isBoardFull, canAfford });
            return;
        }

        const result = engine.CollectionManager.buyPack(activeAreaId);
        console.log('AreaDeckHub: Purchase Result', result);
    };

    return (
        <div className="relative pointer-events-auto">
            <GICard
                intent="area"
                interactive={false}
                imageSrc={bgSprite}
                className="!p-0 select-none flex flex-col"
            >
                {/* ... existing card content ... */}
                <GICard.Header className="!p-0">
                    <div className="flex items-center gap-2 px-3 py-2
                                    bg-black/60 border-b border-white/10">
                        <span className="text-xl">{biomeIcon}</span>
                        <h3 className="font-display font-bold text-sm text-gi-text
                                       tracking-wider uppercase truncate">
                            {biomeName}
                        </h3>
                    </div>
                </GICard.Header>

                <GICard.Main className="!p-0">
                    <div className="p-4 bg-black/30 border-b border-white/5 flex flex-col gap-3">
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
                            <div className="w-full h-1.5 bg-gi-base rounded-full overflow-hidden border border-white/5">
                                <div
                                    className="h-full bg-gi-primary shadow-[0_0_8px_rgba(6,182,212,0.6)] transition-all duration-700"
                                    style={{ width: `${Number.isFinite(masteryPercent) ? masteryPercent : 0}%` }}
                                />
                            </div>
                        </div>

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
                            <div className="w-full h-1.5 bg-gi-base rounded-full overflow-hidden border border-white/5">
                                <div
                                    className="h-full bg-gi-success shadow-[0_0_8px_rgba(34,197,94,0.6)] transition-all duration-700"
                                    style={{ width: `${Number.isFinite(questMasteryPercent) ? questMasteryPercent : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 p-4 flex flex-col justify-center items-center text-center">
                        <div className="text-xl opacity-30 mb-2">🔭</div>
                        <div className="text-gi-muted mb-1 font-display text-[10px] uppercase tracking-widest">Exploration Phase</div>
                        <div className="text- shadow-neon text-5xl font-display font-bold text-gi-text text-shadow-neon">{explorationCount}</div>
                    </div>
                </GICard.Main>

                <GICard.Footer className="!bg-black/40 !border-t !border-white/5 !p-3">
                    <button
                        onClick={handleBuyPack}
                        className={cn(
                            "w-full flex items-center justify-center gap-2",
                            "px-4 py-3 rounded-lg relative overflow-hidden group",
                            "transition-all font-display text-sm font-bold tracking-[0.2em] uppercase",
                            isExhausted
                                ? "bg-gi-muted/20 border border-gi-muted/30 text-gi-muted cursor-not-allowed"
                                : isBoardFull || !canAfford
                                    ? "bg-black/40 border border-gi-border/40 text-gi-muted/60 grayscale cursor-not-allowed"
                                    : "bg-gi-primary/20 border border-gi-primary/40 text-gi-primary hover:bg-gi-primary/40 hover:border-gi-primary shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                        )}
                    >
                        {isExhausted ? (
                            <>
                                <Trophy size={16} className="text-gi-muted" />
                                <span>Set Complete</span>
                            </>
                        ) : isBoardFull ? (
                            <>
                                <AlertTriangle size={16} className="text-gi-warning" />
                                <span>Board Full</span>
                            </>
                        ) : (
                            <>
                                <Package size={16} className={cn(!canAfford ? "text-gi-muted" : "text-gi-primary")} />
                                <span className={cn(!canAfford && "text-gi-danger")}>{cost}g</span>
                                <span className="opacity-60 ml-1">Purchase Pack</span>
                            </>
                        )}
                        
                        {!isExhausted && !isBoardFull && canAfford && (
                            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                        )}
                    </button>
                </GICard.Footer>
            </GICard>

            <div className="absolute top-0 left-0 pointer-events-none">
                <BadgeGutter template={{ cardType: 'area' }} isLocked={true} />
            </div>
        </div>
    );
};

export default AreaDeckHub;
