import React, { useMemo } from 'react';
import { GICard } from '../base/GICard.jsx';
import { Check, Sparkles, Map } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { getAreaQuests } from '../../../config/registries/questRegistry.js';
import { useGameState } from '../../hooks/useGameState.js';

/**
 * QuestChoiceModule: The "Selection Phase" face for Quest Scrolls.
 * Presents 3 random available quests from the current area.
 */
export const QuestChoiceModule = ({ cardId, cardState }) => {
    const engine = useEngine();
    const areaId = cardState.areaId || 'area_guild_hall';

    // 1. Get available quests for this area
    const areaState = useGameState(state => state.areaStates?.[areaId] || { completedQuestIds: [] }, ['quest_state_changed', 'area_switched']);
    const activeCards = useGameState(state => state.cards?.active || [], ['cards_updated']);
    
    const availableOptions = useMemo(() => {
        const allQuests = getAreaQuests(areaId);
        const completedIds = areaState.completedQuestIds || [];
        
        return allQuests.filter(q => {
            const isCompleted = completedIds.includes(q.id);
            const isOnBoard = activeCards.some(c => c.templateId === q.id && c.id !== cardId);
            return !isCompleted && !isOnBoard;
        });
    }, [areaId, areaState.completedQuestIds, activeCards, cardId]);

    // 2. Select exactly 3 (or fewer if pool is small)
    const choices = useMemo(() => {
        const shuffled = [...availableOptions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3);
    }, [availableOptions]);

    const handleSelect = (questId) => {
        // Transform the scroll into the specific quest
        engine.EventBus.publish('quest_initialized', { cardId, questId });
        
        // This will update the state, which triggers a re-render in ActiveCard
        if (engine.CardManager.setCardTemplate) {
            engine.CardManager.setCardTemplate(cardId, questId);
        } else {
            // Fallback: manually update if managed differently
            engine.GameState.state.getCardById(cardId).templateId = questId;
            engine.EventBus.publish('cards_updated', { cardId });
        }
    };

    return (
        <>
            <GICard.Header className="flex flex-col items-center py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-yellow-500" />
                    <span className="font-base text-[11px] text-white tracking-widest uppercase gi-text-outline">
                        Mission Discovery
                    </span>
                    <Sparkles size={12} className="text-yellow-500" />
                </div>
                <p className="text-[9px] font-pixel text-gray-500 uppercase mt-0.5">Select your guild's focus</p>
            </GICard.Header>

            <GICard.Main className="p-0">
                <div className="flex flex-col w-full">
                    {choices.map((quest, index) => (
                        <button
                            key={quest.id}
                            onClick={() => handleSelect(quest.id)}
                            className={cn(
                                "flex flex-col items-start px-4 py-3 text-left w-full border-b border-white/5 transition-all group",
                                "hover:bg-white/5 active:bg-white/10",
                                index === choices.length - 1 && "border-b-0"
                            )}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className="text-2xl min-w-[32px] flex justify-center group-hover:scale-110 transition-transform">
                                    {quest.icon || '📜'}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-base text-[11px] text-white group-hover:text-yellow-400 transition-colors uppercase leading-none mb-1">
                                        {quest.name}
                                    </h4>
                                    <p className="text-[9px] font-pixel text-gray-500 line-clamp-1 opacity-80">
                                        {quest.description}
                                    </p>
                                </div>
                                <div className="flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Check size={14} className="text-yellow-500" />
                                </div>
                            </div>
                        </button>
                    ))}
                    
                    {choices.length === 0 && (
                        <div className="p-8 text-center flex flex-col items-center gap-2">
                            <Trash2 size={24} className="text-gray-700" />
                            <p className="font-pixel text-[10px] text-gray-600 uppercase">Pool Exhausted</p>
                        </div>
                    )}
                </div>
            </GICard.Main>

            <GICard.Footer className="bg-black/40 py-2 flex justify-center">
                <div className="flex items-center gap-1.5 opacity-40">
                    <Map size={10} className="text-gray-400" />
                    <span className="text-[9px] font-pixel text-gray-400 uppercase tracking-widest">
                        Standard Area Pool
                    </span>
                </div>
            </GICard.Footer>
        </>
    );
};
