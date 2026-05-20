import React from 'react';
import { GICard } from '../base/GICard.jsx';
import ProgressBar from '../base/ProgressBar.jsx';
import { Check, XCircle, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';

/**
 * QuestProgressModule: The "Progress Hub" face for active Quest cards.
 * Features a chunked progress bar and dynamic action footer.
 */
export const QuestProgressModule = ({ cardId, cardState, template }) => {
    const engine = useEngine();
    
    // 1. Live Inventory Tracking (for Item-based quests)
    const inventoryCount = useGameState(
        state => {
            if (template.targetEvent !== 'ON_ITEM_GAINED') return null;
            return state.inventory?.items?.[template.targetId]?.quantity || 0;
        },
        ['inventory_updated']
    );

    const progress = inventoryCount !== null ? inventoryCount : (cardState.progress || 0);
    const maxProgress = Math.max(1, template.maxProgress || 1);
    const isCompleted = progress >= maxProgress;

    // 2. Requirement Resolution
    const requiredItem = template.targetEvent === 'ON_ITEM_GAINED' ? getItem(template.targetId) : null;

    const handleAbandon = () => {
        if (window.confirm('Are you sure you want to abandon this quest? It will be returned to the area pool.')) {
            engine.CardManager.discardCard(cardId);
        }
    };

    const handleComplete = () => {
        // NEW: Use the centralized QuestTracker logic to handle rewards and consumption
        const success = engine.QuestTracker.completeBoardQuest(cardId);
        if (!success) {
            console.error('Failed to complete board quest.');
        }
    };

    return (
        <>
            <GICard.Header className="flex justify-between items-center bg-black/20">
                <span className="gi-label-matte text-[10px] text-yellow-500/80">Active Quest</span>
                <span className="text-[10px] font-pixel text-gray-500 uppercase tracking-tighter">
                    {template.areaId || 'World'}
                </span>
            </GICard.Header>

            <GICard.Main className="px-3 py-4 gap-4">
                {/* Objective Icon & Text */}
                <div className="flex flex-col items-center gap-1 text-center">
                    <div className="text-4xl filter drop-shadow-[0_0_8px_rgba(255,215,0,0.3)] animate-pulse">
                        {template.icon || '📜'}
                    </div>
                    <h3 className="font-silkscreen text-base text-white gi-text-outline leading-tight uppercase">
                        {template.name}
                    </h3>
                    <p className="text-[10px] font-pixel text-gray-400 leading-tight max-w-[200px] mb-1">
                        {template.description}
                    </p>
                </div>

                {/* Requirement Slot */}
                {requiredItem && (
                    <div className="w-full flex items-center gap-3 p-2 bg-white/5 border border-white/5 rounded-lg">
                        <div className="text-2xl">{requiredItem.icon || '📦'}</div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-pixel text-gray-500 uppercase tracking-tighter">Requirement</span>
                            <span className="text-xs font-bold font-display text-white uppercase">{requiredItem.name}</span>
                        </div>
                    </div>
                )}

                {/* Pixelized Progress Hub */}
                <div className="w-full space-y-2">
                    <div className="flex justify-between items-end px-1">
                        <span className="text-[9px] font-pixel text-gray-500 uppercase tracking-widest">
                            {requiredItem ? `Collecting ${requiredItem.name}` : 'Progress'}
                        </span>
                        <span className="text-sm font-silkscreen text-white">
                            {progress}<span className="text-gray-500 mx-0.5">/</span>{maxProgress}
                        </span>
                    </div>
                    
                    <ProgressBar 
                        progress={progress} 
                        max={maxProgress}
                        height={10}
                        className="border-white/10 bg-black/40"
                        barClassName="bg-gradient-to-r from-yellow-600 to-yellow-400"
                    />
                </div>

                {/* Specific Map Fragment Reward Indicator */}
                {template.mapFragmentTarget && (
                    <div className="w-full p-2 bg-yellow-500/10 border border-yellow-500/20 rounded flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl filter drop-shadow-[0_0_5px_rgba(255,215,0,0.4)]">
                                {template.fragmentIcon || '📜'}
                            </span>
                            <div className="flex flex-col text-left">
                                <span className="text-[8px] font-pixel text-yellow-500/60 uppercase tracking-tighter">Discovery Progress</span>
                                <span className="text-[10px] font-silkscreen text-yellow-400 uppercase leading-none">
                                    {getAreaSet(template.mapFragmentTarget)?.name || 'Fragment'}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end text-right">
                            <span className="text-[8px] font-pixel text-yellow-500/60 uppercase">Path</span>
                            <span className="text-[9px] font-pixel text-white uppercase tracking-widest">
                                2 Needed
                            </span>
                        </div>
                    </div>
                )}
            </GICard.Main>

            <GICard.Footer className="p-0 border-t border-white/5 overflow-hidden">
                {isCompleted ? (
                    <button
                        onClick={handleComplete}
                        className="w-full py-3 bg-gi-success/20 hover:bg-gi-success/40 text-gi-success font-silkscreen text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-colors"
                    >
                        <Check size={14} />
                        Complete Quest
                    </button>
                ) : (
                    <button
                        onClick={handleAbandon}
                        className="w-full py-3 bg-black/40 hover:bg-gi-danger/20 text-gray-500 hover:text-gi-danger font-silkscreen text-[10px] tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-all"
                    >
                        <Trash2 size={12} />
                        Abandon Discovery
                    </button>
                )}
            </GICard.Footer>
        </>
    );
};
