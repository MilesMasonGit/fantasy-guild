import React, { useState } from 'react';
import { useGameState } from '../hooks/useGameState.js';
import { Map, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../utils/cn.js';
import { getQuestDefinition } from '../../config/registries/questRegistry.js';
import { QuestTracker } from '../../systems/progression/QuestTracker.js';
import Button from './base/Button.jsx';
import { logger } from '../../utils/Logger.js';

export const QuestPanel = () => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Subscribe to global quests array
    const globalQuests = useGameState(
        state => state.globalQuests || [],
        ['state_changed', 'quest_state_changed'] // Need quest_state_changed event from QuestTracker
    );

    const handleClaim = (instanceId) => {
        const success = QuestTracker.claimQuest(instanceId);
        if (!success) {
            logger.warn('QuestPanel', `Failed to claim quest ${instanceId}`);
        }
    };

    const handleCancel = (instanceId) => {
        const success = QuestTracker.cancelQuest(instanceId);
        if (!success) {
            logger.warn('QuestPanel', `Failed to cancel quest ${instanceId}`);
        }
    };


    return (
        <div className="flex flex-col w-full pointer-events-auto bg-gi-surface">
            {/* Header / Toggle */}
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gi-base/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Map className="w-5 h-5 text-gi-primary" />
                    <span className="font-display font-bold text-gi-text tracking-wide uppercase text-sm">
                        Quests
                        <span className="text-gi-muted ml-1">
                            ({globalQuests.length}/{QuestTracker.MAX_ACTIVE_QUESTS})
                        </span>
                    </span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gi-muted" /> : <ChevronDown className="w-4 h-4 text-gi-muted" />}
            </div>

            {/* Expanded List */}
            {isExpanded && (
                <div className="flex flex-col gap-2 p-3 pt-0 w-full bg-gi-base/20 border-t border-gi-border/30 min-h-[60px]">
                    {globalQuests.length === 0 ? (
                        <div className="text-center text-gi-muted italic py-4 text-sm font-pixel">
                            No active quests.
                        </div>
                    ) : (
                        globalQuests.map(quest => {
                            const template = getQuestDefinition(quest.templateId);
                            if (!template) return null;

                            const isCompleted = quest.status === 'completed';
                            const rawProgress = (quest.progress / (quest.max || 1)) * 100;
                            const progressPercent = (Number.isFinite(rawProgress) && !isNaN(rawProgress)) ? Math.min(100, Math.max(0, rawProgress)) : 0;

                            return (
                                <div
                                    key={quest.id}
                                    className={cn(
                                        "bg-gi-base/90 border rounded-lg p-3 flex flex-col gap-2 relative overflow-hidden transition-all",
                                        isCompleted ? "border-gi-success" : "border-gi-border shadow-sm"
                                    )}
                                >
                                    {/* Background progress bar */}
                                    {!isCompleted && (
                                        <div
                                            className="absolute top-0 left-0 h-full bg-gi-primary/10 -z-10 transition-all duration-300"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    )}
                                    {isCompleted && (
                                        <div className="absolute top-0 left-0 h-full w-full bg-gi-success/10 -z-10" />
                                    )}

                                    {/* Top Row */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{template.icon || '📜'}</span>
                                            <div>
                                                <h4 className="font-bold text-gi-text text-sm">{template.name}</h4>
                                            </div>
                                        </div>

                                        {/* Progress Text */}
                                        {!isCompleted && (
                                            <div className="text-xs font-pixel font-bold text-gi-primary whitespace-nowrap">
                                                {quest.progress} / {quest.max}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gi-muted leading-tight mt-1">{template.description}</p>

                                    {/* Actions */}
                                    <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                                        <button
                                            onClick={() => handleCancel(quest.id)}
                                            className="text-[10px] text-white/40 hover:text-gi-danger uppercase font-bold tracking-wider transition-colors"
                                        >
                                            Drop Quest
                                        </button>

                                        {isCompleted && (
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                className="px-4 py-1 flex items-center gap-1 border-gi-success hover:bg-gi-success hover:text-white"
                                                onClick={() => handleClaim(quest.id)}
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                CLAIM
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default QuestPanel;
