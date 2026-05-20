import React from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { Compass, CheckCircle2 } from 'lucide-react';
import Button from '../base/Button.jsx';
import { cn } from '../../utils/cn.js';
import { getAreaQuests } from '../../../config/registries/questRegistry.js';
import { ExplorationManager } from '../../../systems/progression/ExplorationManager.js';

/**
 * QuestSelectionModule
 * Displayed on an Explore Card when its work cycle is completed.
 * Allows the player to select one of 3 random Area Quests.
 */
export const QuestSelectionModule = React.memo(({ card, trait }) => {
    // Only show quest selection if the work cycle is completed
    if (card.status !== 'completed') {
        return null; // The workcycle progress bar renders instead while exploring
    }

    // Identify which area we are exploring for
    const targetAreaId = card.areaId || card.config?.areaId || card.selectedBiomeId || 'guild_hall_v1';

    // Use pre-generated stable options from the engine
    const availableOptions = card.questOptions || [];

    const handleSelectQuest = (questId) => {
        ExplorationManager.onQuestSelected(targetAreaId, card, questId);
    };

    if (availableOptions.length === 0) {
        return (
            <div className="flex flex-col gap-2 w-full mt-2">
                <div className="text-center p-3 text-xs font-display text-gi-success border border-gi-success/30 rounded bg-gi-success/10">
                    All currently known quests for this region have been discovered, or you are at the global quest limit.
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-[10px]"
                    onClick={() => ExplorationManager.onQuestSelected(targetAreaId, card, null)}
                >
                    Conclude Exploration
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 w-full mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-1.5 justify-center mb-1 text-gi-primary">
                <Compass className="w-4 h-4" />
                <span className="font-display font-bold uppercase text-[10px] tracking-wider">
                    Select a Request
                </span>
            </div>

            <div className="flex flex-col gap-2">
                {availableOptions.map(quest => (
                    <button
                        key={quest.id}
                        onClick={() => handleSelectQuest(quest.id)}
                        className="flex flex-col gap-1 p-2 rounded border border-gi-border hover:border-gi-primary bg-black/40 hover:bg-gi-primary/10 transition-colors text-left group"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{quest.icon || '📜'}</span>
                            <span className="font-bold text-gi-text text-sm group-hover:text-gi-primary transition-colors">
                                {quest.name}
                            </span>
                        </div>
                        <p className="text-[10px] text-gi-muted leading-tight">
                            {quest.description}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
});
