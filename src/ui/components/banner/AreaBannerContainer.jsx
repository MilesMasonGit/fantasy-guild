import React, { useState, useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAllAreaSets, getAreaSet, getRequiredFragments } from '../../../config/registries/areaSetRegistry.js';
import { getQuestDefinition } from '../../../config/registries/questRegistry.js';
import { AreaBannerRow, CollapsedRow } from './AreaBannerRow.jsx';
import { BannerLayoutProvider } from './BannerLayout.jsx';
import { Lock } from 'lucide-react';
import { GISurface } from '../base/GISurface.jsx';
import { Badge } from '../base/Badge.jsx';
import { Button } from '../base/Button.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { QuestTracker } from '../../../systems/progression/QuestTracker.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';

/**
 * AreaBannerContainer — the deck-loop center screen (Phase 6). One banner
 * row per unlocked area, one locked strip per still-locked area (showing
 * its unlock-quest progress, the §2G presentation decision).
 *
 * Focus state lives here so that focusing one row dims all the others
 * (concept §11.D "Visual Focus"). Collapsed rows render a thin strip whose
 * internals are fully unmounted (§6E).
 */
export const AreaBannerContainer = () => {
    const [focus, setFocus] = useState(null);          // { areaId, mode: 'deck'|'equip'|'recipe' } | null
    const [collapsed, setCollapsed] = useState(() => new Set());

    const unlockedIds = useGameState(
        state => state.collection?.unlockedAreaSets || [],
        ['collection_updated', 'state_changed', 'area_unlocked']
    ) || [];

    const { unlocked, locked } = useMemo(() => {
        const all = Object.keys(getAllAreaSets());
        return {
            unlocked: all.filter(id => unlockedIds.includes(id)),
            locked: all.filter(id => !unlockedIds.includes(id))
        };
    }, [unlockedIds]);

    const toggleCollapsed = (areaId) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(areaId)) next.delete(areaId);
            else next.add(areaId);
            return next;
        });
        setFocus(f => (f?.areaId === areaId ? null : f));
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar px-4 py-3">
            <BannerLayoutProvider>
              <div className="flex flex-col gap-2">
                {unlocked.map(areaId =>
                    collapsed.has(areaId) ? (
                        <CollapsedRow key={areaId} areaId={areaId} onExpand={() => toggleCollapsed(areaId)} />
                    ) : (
                        <AreaBannerRow
                            key={areaId}
                            areaId={areaId}
                            focus={focus}
                            onFocus={setFocus}
                            onCollapse={() => toggleCollapsed(areaId)}
                        />
                    )
                )}

                {locked.map(areaId => (
                    <LockedAreaRow key={areaId} areaId={areaId} dimmed={!!focus} />
                ))}
              </div>
            </BannerLayoutProvider>
        </div>
    );
};

/**
 * A still-locked area: name + unlock-quest progress (§2G's deferred UI).
 * Progress data lives in areaStates[id].unlockQuestProgress / completedQuestIds.
 */
const getQuestObjectiveText = (q) => {
    const isItem = q.targetEvent === 'ON_ITEM_GAINED';
    let name = q.targetId;
    if (isItem) {
        const itemDef = getItem(q.targetId);
        name = itemDef?.name || q.targetId;
    } else {
        const enemyDef = getEnemy(q.targetId);
        name = enemyDef?.name || q.targetId;
    }
    return isItem ? `Collect ${q.maxProgress} ${name}` : `Defeat ${q.maxProgress} ${name}`;
};

const LockedAreaRow = ({ areaId, dimmed }) => {
    const areaSet = getAreaSet(areaId);

    const progress = useGameState(
        state => {
            const a = state.areaStates?.[areaId];
            const questIds = areaSet?.unlockQuestIds || [];
            return questIds.map(questId => {
                const template = getQuestDefinition(questId);
                const maxProgress = Math.max(1, template?.maxProgress || 1);
                const done = a?.completedQuestIds?.includes(questId);
                // Dynamically fetch item counts for item quests so they are always current
                let current = done ? maxProgress : Math.min(maxProgress, a?.unlockQuestProgress?.[questId] || 0);
                if (!done && template?.targetEvent === 'ON_ITEM_GAINED') {
                    current = Math.min(maxProgress, InventoryManager.getItemCount(template.targetId));
                }
                return {
                    questId,
                    name: template?.name || questId,
                    description: template?.description || '',
                    targetId: template?.targetId || '',
                    targetEvent: template?.targetEvent || '',
                    rewards: template?.rewards || [],
                    current,
                    maxProgress,
                    done
                };
            });
        },
        ['state_changed', 'inventory_updated', 'collection_updated', 'quest_state_changed', 'quest_completed'],
        null,
        { deps: [areaId] }
    ) || [];

    const fragmentsDone = progress.filter(q => q.done).length;
    const fragmentsNeeded = getRequiredFragments(areaId);

    const handleTurnIn = (questId) => {
        QuestTracker.completeUnlockQuestManual(areaId, questId);
    };

    return (
        <GISurface className={cn(
            'flex flex-col p-4 gap-3 transition-opacity duration-300',
            dimmed && 'opacity-30'
        )}>
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-gi-border pb-2">
                <div className="flex items-center gap-2">
                    <Lock size={16} className="text-gi-muted" />
                    <span className="font-display font-bold text-gi-text tracking-wide gi-caps text-sm">
                        {areaSet?.name || areaId}
                    </span>
                </div>
                <Badge variant={fragmentsDone >= fragmentsNeeded ? 'success' : 'warning'} size="sm">
                    {fragmentsDone} / {fragmentsNeeded} Fragments
                </Badge>
            </div>

            {/* Quests Stack in Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {progress.map(q => {
                    const progressPercent = Math.min(100, Math.max(0, (q.current / q.maxProgress) * 100));
                    const canTurnIn = !q.done && q.current >= q.maxProgress;

                    return (
                        <div
                            key={q.questId}
                            className={cn(
                                "flex gap-4 p-4 rounded border transition-all duration-200 min-h-[96px]",
                                q.done
                                    ? "bg-gi-success/5 border-gi-success/20 opacity-70"
                                    : "bg-gi-surface/40 border-gi-border hover:bg-gi-surface/60"
                            )}
                        >
                            {/* Left: 64px Icon (no background box, full color) */}
                            <ItemIcon
                                item={q.targetId}
                                size={64}
                                className="shrink-0"
                            />

                            {/* Right: Details & Actions */}
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                                {/* Title, Button, and Progress line */}
                                <div>
                                    <div className="flex justify-between items-center gap-3">
                                        <h4 className={cn("font-bold text-sm md:text-base leading-tight truncate", q.done ? "text-gi-success line-through" : "text-gi-text")}>
                                            {getQuestObjectiveText(q)}
                                        </h4>

                                        {/* Action Button on the same line as the Title */}
                                        {q.done ? (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled
                                                className="py-1 px-3 text-xs md:text-sm h-8 font-pixel opacity-40 cursor-not-allowed shrink-0"
                                            >
                                                Completed
                                            </Button>
                                        ) : canTurnIn ? (
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                className="py-1 px-3 text-xs md:text-sm h-8 font-pixel shrink-0"
                                                onClick={() => handleTurnIn(q.questId)}
                                            >
                                                Turn in Quest
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled
                                                className="py-1 px-3 text-xs md:text-sm h-8 font-pixel opacity-50 shrink-0 cursor-not-allowed"
                                            >
                                                Show Rewards
                                            </Button>
                                        )}
                                    </div>
                                    
                                    {/* Progress Bar (next to sprite, below title) */}
                                    <div className="flex items-center gap-3 mt-3">
                                        <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    'h-full transition-all duration-300 rounded-full',
                                                    q.done
                                                        ? 'bg-gi-success'
                                                        : canTurnIn
                                                            ? 'bg-gi-gold shadow-[0_0_8px_rgba(226,255,0,0.5)]'
                                                            : 'bg-gi-intent-task'
                                                )}
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                        <span className={cn(
                                            "text-xs md:text-sm font-mono tabular-nums font-bold shrink-0",
                                            q.done ? "text-gi-success" : canTurnIn ? "text-gi-gold" : "text-gi-text"
                                        )}>
                                            {q.current}/{q.maxProgress}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {progress.length === 0 && (
                    <span className="text-[10px] text-gi-muted italic text-center py-2">
                        No known route to this area yet.
                    </span>
                )}
            </div>
        </GISurface>
    );
};

export default AreaBannerContainer;
