import React from 'react';
import ProgressBar from '../base/ProgressBar.jsx';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { ItemIcon } from '../base/ItemIcon.jsx';

/**
 * QuestProgressModule: The "Progress Hub" face for active Quest cards.
 * Visual layout matches the centered theater style of gathering cards.
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
    const targetObj = template.targetEvent === 'ON_ITEM_GAINED'
        ? requiredItem
        : (template.targetEvent === 'ON_ENEMY_KILLED' ? getEnemy(template.targetId) : null);

    const handleComplete = () => {
        const success = engine.QuestTracker.completeBoardQuest(cardId);
        if (!success) {
            console.error('Failed to complete board quest.');
        }
    };

    return (
        <div className="flex flex-col flex-1 gap-3 w-full px-2 py-1">
            {/* Objective Icon - Centered Theater style */}
            <div className="flex flex-col items-center justify-center min-h-[90px] flex-1">
                {targetObj ? (
                    <ItemIcon 
                        item={targetObj} 
                        size={128} 
                        className="filter drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]" 
                    />
                ) : (
                    <div className="text-7xl filter drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
                        {template.icon || '📜'}
                    </div>
                )}
            </div>

            {/* Requirement Slot */}
            {requiredItem && (
                <div className="w-full flex items-center gap-3 p-2 bg-white/5 border border-white/5 rounded-lg shrink-0">
                    <div className="text-2xl">{requiredItem.icon || '📦'}</div>
                    <div className="flex flex-col text-left">
                        <span className="text-[9px] font-pixel text-gray-500 uppercase tracking-tighter">Requirement</span>
                        <span className="text-xs font-bold font-display text-white uppercase">{requiredItem.name}</span>
                    </div>
                </div>
            )}

            {/* Pixelized Progress Hub */}
            <div className="w-full space-y-2 shrink-0">
                <div className="flex justify-between items-end px-1">
                    <span className="text-[9px] font-pixel text-gray-500 uppercase tracking-widest">
                        {requiredItem ? `Collecting ${requiredItem.name}` : 'Progress'}
                    </span>
                    <span className="text-sm font-silkscreen text-white">
                        {progress}<span className="text-gray-500 mx-0.5">/</span>{maxProgress}
                    </span>
                </div>
                
                <ProgressBar 
                    cardId={cardId}
                    current={progress} 
                    max={maxProgress}
                    height={10}
                    className="border-white/10 bg-black/40"
                    barClassName="bg-gradient-to-r from-yellow-600 to-yellow-400"
                />
            </div>

            {/* Specific Map Fragment Reward Indicator */}
            {template.mapFragmentTarget && (
                <div className="w-full p-2 bg-yellow-500/10 border border-yellow-500/20 rounded flex items-center justify-between shrink-0 font-pixel">
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

            {/* Complete Quest Action Button */}
            {isCompleted && (
                <button
                    onClick={handleComplete}
                    className="w-full py-2.5 bg-gi-success/20 hover:bg-gi-success/45 border border-gi-success/35 text-gi-success font-silkscreen text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-colors rounded-lg font-bold pointer-events-auto"
                >
                    <Check size={14} />
                    Complete Quest
                </button>
            )}
        </div>
    );
};

export default QuestProgressModule;
