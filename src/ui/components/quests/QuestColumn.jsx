// Fantasy Guild - QuestColumn Component
// Floating quest notifications anchored at the bottom of the notification column

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { QuestManager } from '../../../systems/quests/QuestManager.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { cn } from '../../utils/cn.js';
import { Sparkles, Clock, Scroll, X, Ban, Map } from 'lucide-react';

const AbandonedQuestCard = ({ quest }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const update = () => {
            const diff = Math.max(0, (quest.readyAt || 0) - Date.now());
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            if (diff <= 0) {
                setTimeLeft('Searching...');
                QuestManager.ensureQuests();
            } else if (mins > 0) {
                setTimeLeft(`${mins}m ${secs}s`);
            } else {
                setTimeLeft(`${secs}s`);
            }
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [quest.readyAt]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className="relative flex flex-col gap-1 rounded-md border border-dashed border-red-500/30 bg-red-950/20 backdrop-blur-md px-3 py-2 pointer-events-auto select-none"
        >
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                <Ban size={12} className="text-red-400" />
                <span>Abandoned Quest</span>
            </div>
            <div className="flex flex-col text-[11px] text-red-300/80 font-mono pt-0.5">
                <span>Searching for new quest:</span>
                <div className="flex items-center gap-1 text-red-400 font-bold text-xs pt-0.5">
                    <Clock size={11} className="text-red-400/70 animate-spin" />
                    <span>{timeLeft}</span>
                </div>
            </div>
        </motion.div>
    );
};

export const QuestColumn = () => {
    // Called for its guard, not its value: `useEngine` throws if this renders
    // outside the EngineProvider. Nothing here uses the bus directly any more.
    useEngine();
    const [confirmingAbandonId, setConfirmingAbandonId] = useState(null);

    useEffect(() => {
        QuestManager.ensureQuests();
    }, []);

    const quests = useGameState(
        state => (state.quests?.active || []).map(q => ({ ...q })),
        [
            'quests_updated',
            'state_changed',
            'react:slot_selected',
            BOARD_EVENTS.TILE_CHANGED,
            'token_placed',
            'map_burst',
            'map_opened',
            'hero_deployed',
            'hero_recruited',
            BOARD_EVENTS.CYCLE_COMPLETE,
            BOARD_EVENTS.SPRITE_COLLECTED,
            'vault_withdrawn'
        ],
        null,
        { deepClone: true }
    );

    const totalMaps = useGameState(
        () => BoardState.getTotalMapCount(),
        ['state_changed', 'map_purchased', 'map_burst', 'map_reward_spawned']
    );

    const isMapCapReached = totalMaps >= BoardState.MAX_MAP_LIMIT;

    const handleClaim = (questId, targetEl = null) => {
        const rect = targetEl ? targetEl.getBoundingClientRect() : null;
        QuestManager.claimQuest(questId, rect);
    };

    const handleAbandon = (questId) => {
        QuestManager.abandonQuest(questId);
    };

    if (!quests || quests.length === 0) {
        return null;
    }

    // Ensure oldest / lowest-step tutorial quest is at the top, and new quests appear at the bottom
    const sortedQuests = [...quests].sort((a, b) => {
        if (a.isTutorial && b.isTutorial) {
            return (a.step ?? 0) - (b.step ?? 0);
        }
        if (a.isTutorial) return -1;
        if (b.isTutorial) return 1;
        return 0;
    });

    return (
        <div className="p-2 flex flex-col gap-1.5 pointer-events-auto w-full shrink-0 select-none">
            {/* Quest Cards Floating Stack */}
            <AnimatePresence mode="popLayout">
                {sortedQuests.map((quest) => {
                    if (quest.status === 'abandoned') {
                        return <AbandonedQuestCard key={quest.id} quest={quest} />;
                    }

                    const progress = quest.requiredCount > 0
                        ? Math.min(1, (quest.currentCount || 0) / quest.requiredCount)
                        : 0;
                    const isComplete = (quest.currentCount || 0) >= quest.requiredCount;
                    const isConfirming = confirmingAbandonId === quest.id;

                    return (
                        <motion.div
                            key={quest.id}
                            data-quest-id={quest.id}
                            data-card-id={quest.id}
                            layout
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                            className={cn(
                                'relative flex flex-col gap-1.5 rounded-md border shadow-xl pointer-events-auto backdrop-blur-md transition-all duration-200 px-3 py-2',
                                isConfirming
                                    ? 'bg-[#1a0f0f]/95 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                    : isComplete
                                        ? 'bg-[#181308]/95 border-yellow-400/60 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                        : 'bg-[#0f111a]/95 border-white/10 hover:border-white/20'
                            )}
                        >
                            {isConfirming ? (
                                <div className="flex flex-col justify-between gap-2.5 py-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Ban size={12} className="text-red-400 shrink-0" />
                                            <span className="text-xs font-bold text-red-300 truncate">
                                                Abandon Quest?
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-red-400/80 shrink-0">
                                            5m cooldown
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmingAbandonId(null);
                                            }}
                                            className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase bg-white/10 hover:bg-white/20 text-gray-200 cursor-pointer transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmingAbandonId(null);
                                                handleAbandon(quest.id);
                                            }}
                                            className="px-3 py-1 rounded text-[10px] font-mono font-bold uppercase bg-red-600 hover:bg-red-500 text-white cursor-pointer transition-colors shadow-[0_0_8px_rgba(239,68,68,0.4)] active:scale-95"
                                        >
                                            Abandon
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Card Header: Title & Abandon X (Non-Tutorial only) */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Scroll size={12} className={isComplete ? "text-yellow-400" : "text-gray-400"} />
                                            <span className="text-xs font-bold text-white tracking-wide truncate">
                                                {quest.title}
                                            </span>
                                        </div>
                                        {!quest.isTutorial && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConfirmingAbandonId(quest.id);
                                                }}
                                                className="text-white/30 hover:text-red-400 hover:bg-white/5 p-0.5 rounded transition-colors cursor-pointer"
                                                title="Abandon Quest"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Instruction (shown for Tutorial Quests) */}
                                    {quest.instruction && (
                                        <p className="text-[11px] text-gray-300 leading-snug">
                                            {quest.instruction}
                                        </p>
                                    )}

                                    {/* Mini Progress Bar */}
                                    <div className="relative w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10 mt-0.5">
                                        <div
                                            className={cn(
                                                'h-full rounded-full transition-all duration-300',
                                                isComplete
                                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.7)]'
                                                    : 'bg-gradient-to-r from-cyan-500 to-blue-400'
                                            )}
                                            style={{ width: `${progress * 100}%` }}
                                        />
                                    </div>

                                    {/* Footer: Map Reward Thumbnail with Tooltip & Claim Action */}
                                    <div className="flex items-center justify-between pt-1 border-t border-white/5 gap-2">
                                        <div className="relative group/reward flex items-center gap-1.5 cursor-help min-w-0 flex-1">
                                            <div className="w-4 h-4 rounded bg-amber-950/80 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-[0_0_5px_rgba(245,158,11,0.2)]">
                                                <Map size={10} className="text-amber-400" />
                                            </div>
                                            <span className="truncate text-amber-300/90 font-medium text-[10px] leading-tight">
                                                {quest.rewardMapName || 'Map'}
                                            </span>

                                            {/* Hover Tooltip */}
                                            <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/reward:flex flex-col gap-0.5 z-50 bg-[#0d0f18]/95 border border-amber-500/40 rounded px-2 py-1 shadow-2xl pointer-events-none min-w-[140px] backdrop-blur-md">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300">
                                                    <Map size={10} className="text-amber-400" />
                                                    <span>{quest.rewardMapName || 'Map Token'}</span>
                                                </div>
                                                <p className="text-[9px] text-gray-300 leading-tight">
                                                    Bursts on the playmat to reveal tokens & items.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] font-mono text-gray-400 tabular-nums">
                                                {quest.currentCount} / {quest.requiredCount}
                                            </span>

                                            {isComplete && (
                                                <button
                                                    type="button"
                                                    disabled={isMapCapReached}
                                                    onClick={(e) => handleClaim(quest.id, e.currentTarget.closest('[data-quest-id]') || e.currentTarget)}
                                                    title={isMapCapReached ? "Map limit reached (50/50) — burst existing maps to claim" : "Claim Map"}
                                                    className={cn(
                                                        "flex items-center gap-1 px-2.5 py-0.5 rounded font-bold font-mono text-[10px] uppercase transition-all shadow-[0_0_8px_rgba(234,179,8,0.4)] active:scale-95",
                                                        isMapCapReached
                                                            ? "bg-gray-700 text-gray-400 cursor-not-allowed opacity-60"
                                                            : "bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black animate-pulse cursor-pointer"
                                                    )}
                                                >
                                                    <Sparkles size={11} className={isMapCapReached ? "text-gray-400" : "text-black"} />
                                                    <span>Claim</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default QuestColumn;
