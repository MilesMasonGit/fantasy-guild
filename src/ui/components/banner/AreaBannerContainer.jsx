import React, { useState, useMemo, useEffect } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAllAreaSets, getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { getQuestDefinition } from '../../../config/registries/questRegistry.js';
import { AreaBannerRow, CollapsedRow } from './AreaBannerRow.jsx';
import { BannerLayoutProvider } from './BannerLayout.jsx';
import { Lock, Hourglass, Coins, Trash2, RefreshCw, Scroll, Gift } from 'lucide-react';
import { GISurface } from '../base/GISurface.jsx';
import { Button } from '../base/Button.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { QuestTracker } from '../../../systems/progression/QuestTracker.js';
import { QuestBoardSystem } from '../../../systems/progression/QuestBoardSystem.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';

/**
 * AreaBannerContainer — the deck-loop center screen (Phase 6). One banner
 * row per unlocked area; below them the Quest System v2 block
 * (quest_system_concept.md): the global Quest Control Bar, then one locked
 * strip per still-locked area showing its quest board.
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

                {locked.length > 0 && <QuestControlBar dimmed={!!focus} />}

                {locked.map(areaId => (
                    <LockedAreaRow key={areaId} areaId={areaId} dimmed={!!focus} />
                ))}
              </div>
            </BannerLayoutProvider>
        </div>
    );
};

// ----------------------------------------------------------------------
// Quest Control Bar — ONE global strip between the unlocked rows and the
// locked rows (owner design 2026-07-14): refresh countdown, Abandon All,
// pay-gold Refresh Now.
// ----------------------------------------------------------------------

const formatCountdown = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const QuestControlBar = ({ dimmed }) => {
    const [, forceTick] = useState(0);
    const [confirmingAbandon, setConfirmingAbandon] = useState(false);

    // 1s countdown heartbeat; quest_board_updated re-renders via useGameState.
    useEffect(() => {
        const id = setInterval(() => forceTick(n => n + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed']);
    const refreshAt = useGameState(
        state => state.questBoard?.refreshAt || 0,
        ['quest_board_updated', 'state_changed']
    ) || 0;

    const cost = QuestBoardSystem.getInstantRefreshCost();
    const affordable = gold >= cost;

    const handleAbandon = () => {
        if (!confirmingAbandon) {
            setConfirmingAbandon(true);
            setTimeout(() => setConfirmingAbandon(false), 3000);
            return;
        }
        setConfirmingAbandon(false);
        QuestBoardSystem.abandonAll();
    };

    return (
        <GISurface className={cn(
            'flex items-center gap-4 px-4 py-3 transition-opacity duration-300',
            dimmed && 'opacity-30'
        )}>
            <div className="flex items-center gap-2 min-w-0">
                <Scroll size={16} className="text-gi-gold shrink-0" />
                <span className="font-display font-bold text-gi-text tracking-wide gi-caps text-sm truncate">
                    Quest Board
                </span>
            </div>

            <span className="flex items-center gap-1.5 text-xs text-gi-muted tabular-nums" title="Empty quest slots refill when this timer laps">
                <Hourglass size={12} />
                New quests in <span className="font-bold text-gi-text">{formatCountdown(refreshAt - Date.now())}</span>
            </span>

            <div className="ml-auto flex items-center gap-2">
                <button
                    onClick={handleAbandon}
                    title="Abandon every quest on every board (story quests stay). Slots refill on the next refresh."
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-bold gi-caps tracking-wide transition-colors',
                        confirmingAbandon
                            ? 'border-gi-danger bg-gi-danger/20 text-gi-danger'
                            : 'border-gi-border text-gi-muted hover:text-gi-danger hover:border-gi-danger/60'
                    )}
                >
                    <Trash2 size={11} /> {confirmingAbandon ? 'Click to confirm' : 'Abandon All'}
                </button>
                <button
                    onClick={() => QuestBoardSystem.instantRefresh()}
                    disabled={!affordable}
                    title="Fill every empty quest slot right now. Cost rises with each use and resets on the natural refresh."
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-bold gi-caps tracking-wide transition-colors tabular-nums',
                        affordable
                            ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text hover:bg-gi-gold/25'
                            : 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                    )}
                >
                    <RefreshCw size={11} /> Refresh Now <Coins size={11} className="text-gi-gold" /> {cost.toLocaleString()}
                </button>
            </div>
        </GISurface>
    );
};

// ----------------------------------------------------------------------
// Locked area row — the area's quest board (quest_system_concept.md §7):
// unlock progress bar, MSQs pinned first (gold trim), procedural quests,
// empty awaiting-refresh slots.
// ----------------------------------------------------------------------

const getMsqObjectiveText = (q) => {
    if (q.targetEvent === 'ON_ITEM_GAINED') {
        const itemDef = getItem(q.targetId);
        return `Collect ${q.maxProgress} ${itemDef?.name || q.targetId}`;
    }
    if (q.targetEvent === 'ON_ENEMY_KILLED') {
        const enemyDef = getEnemy(q.targetId);
        return `Defeat ${q.maxProgress} ${enemyDef?.name || q.targetId}`;
    }
    // Action quests read their authored name ("Deploy a Hero").
    return q.name;
};

const LockedAreaRow = ({ areaId, dimmed }) => {
    const areaSet = getAreaSet(areaId);

    // MSQ entries (authored unlockQuestIds, tracked by QuestTracker).
    const msqs = useGameState(
        state => {
            const a = state.areaStates?.[areaId];
            const questIds = areaSet?.unlockQuestIds || [];
            return questIds.map(questId => {
                const template = getQuestDefinition(questId);
                const maxProgress = Math.max(1, template?.maxProgress || 1);
                const done = a?.completedQuestIds?.includes(questId);
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

    // Procedural board (QuestBoardSystem). Live gather counts come via
    // inventory_updated; kill ticks via quest_board_updated.
    const board = useGameState(
        state => {
            const b = state.questBoard?.areas?.[areaId];
            return b ? { completed: b.completed || 0, slots: [...b.slots] } : { completed: 0, slots: [] };
        },
        ['quest_board_updated', 'inventory_updated', 'state_changed'],
        null,
        { deps: [areaId] }
    ) || { completed: 0, slots: [] };

    const { threshold } = QuestBoardSystem.getUnlockProgress(areaId);
    const unlockPct = Math.min(100, (board.completed / Math.max(1, threshold)) * 100);

    return (
        <GISurface className={cn(
            'flex flex-col p-4 gap-3 transition-opacity duration-300',
            dimmed && 'opacity-30'
        )}>
            {/* Header: name + unlock progress bar (fragments retired) */}
            <div className="flex items-center gap-4 border-b border-gi-border pb-2">
                <div className="flex items-center gap-2 shrink-0">
                    <Lock size={16} className="text-gi-muted" />
                    <span className="font-display font-bold text-gi-text tracking-wide gi-caps text-sm">
                        {areaSet?.name || areaId}
                    </span>
                </div>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all duration-300',
                                unlockPct >= 100 ? 'bg-gi-success' : 'bg-gi-primary'
                            )}
                            style={{ width: `${unlockPct}%` }}
                        />
                    </div>
                    <span className="text-xs font-mono tabular-nums font-bold text-gi-text shrink-0">
                        {board.completed}/{threshold} quests
                    </span>
                </div>
            </div>

            {/* Quest board: MSQs pinned first, then procedural slots */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {msqs.map(q => (
                    <MsqCard key={q.questId} q={q} onTurnIn={() => QuestTracker.completeUnlockQuestManual(areaId, q.questId)} />
                ))}
                {board.slots.map((quest, i) => (
                    quest
                        ? <ProceduralQuestCard key={quest.id} areaId={areaId} quest={quest} slotIndex={i} />
                        : <EmptyQuestSlot key={`empty-${i}`} />
                ))}
            </div>
        </GISurface>
    );
};

/** Shared quest tile chrome: icon + title/progress + action button. */
const QuestTile = ({ icon, title, sub, current, max, done, canTurnIn, onTurnIn, story = false, rewardChip = null }) => {
    const pct = Math.min(100, Math.max(0, (current / Math.max(1, max)) * 100));
    return (
        <div className={cn(
            'flex gap-4 p-4 rounded border transition-all duration-200 min-h-[96px]',
            done
                ? 'bg-gi-success/5 border-gi-success/20 opacity-70'
                : story
                    ? 'bg-gi-gold/5 border-gi-gold/40 hover:bg-gi-gold/10'
                    : 'bg-gi-surface/40 border-gi-border hover:bg-gi-surface/60'
        )}>
            <div className="shrink-0 flex flex-col items-center gap-1">
                {icon}
                {story && (
                    <span className="text-[8px] font-black tracking-widest gi-caps text-gi-gold border border-gi-gold/50 rounded px-1 py-px">
                        Story
                    </span>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="flex justify-between items-center gap-3">
                    <h4 className={cn(
                        'font-bold text-sm md:text-base leading-tight truncate',
                        done ? 'text-gi-success line-through' : 'text-gi-text'
                    )}>
                        {title}
                    </h4>
                    {done ? (
                        <Button variant="secondary" size="sm" disabled className="py-1 px-3 text-xs h-8 font-pixel opacity-40 cursor-not-allowed shrink-0">
                            Completed
                        </Button>
                    ) : canTurnIn ? (
                        <Button variant="primary" size="sm" className="py-1 px-3 text-xs h-8 font-pixel shrink-0" onClick={onTurnIn}>
                            Turn in
                        </Button>
                    ) : rewardChip}
                </div>
                {sub && <span className="text-[9px] text-gi-muted mt-0.5 truncate">{sub}</span>}
                <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                'h-full transition-all duration-300 rounded-full',
                                done ? 'bg-gi-success' : canTurnIn ? 'bg-gi-gold shadow-[0_0_8px_rgba(226,255,0,0.5)]' : 'bg-gi-intent-task'
                            )}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className={cn(
                        'text-xs font-mono tabular-nums font-bold shrink-0',
                        done ? 'text-gi-success' : canTurnIn ? 'text-gi-gold' : 'text-gi-text'
                    )}>
                        {current}/{max}
                    </span>
                </div>
            </div>
        </div>
    );
};

/** Main Story Quest — pinned, unabandonable, gold trim. */
const MsqCard = ({ q, onTurnIn }) => (
    <QuestTile
        icon={<ItemIcon item={q.targetId || 'quest'} size={64} className="shrink-0" />}
        title={getMsqObjectiveText(q)}
        sub={q.description}
        current={q.current}
        max={q.maxProgress}
        done={q.done}
        canTurnIn={!q.done && q.current >= q.maxProgress}
        onTurnIn={onTurnIn}
        story
    />
);

/** Procedural quest — gather/defeat with gold (and maybe bonus item) reward. */
const ProceduralQuestCard = ({ areaId, quest, slotIndex }) => {
    const isGather = quest.type === 'gather';
    const def = isGather ? getItem(quest.targetId) : getEnemy(quest.targetId);
    const current = QuestBoardSystem.getQuestProgress(quest);
    const canTurnIn = current >= quest.required;

    const rewardChip = (
        <span
            className="flex items-center gap-1 text-[10px] font-bold text-gi-gold tabular-nums shrink-0"
            title={quest.bonusItemId ? `Reward: ${quest.gold} gold + bonus ${getItem(quest.bonusItemId)?.name || 'item'}` : `Reward: ${quest.gold} gold`}
        >
            <Coins size={10} /> {quest.gold}
            {quest.bonusItemId && <Gift size={10} className="text-gi-primary" />}
        </span>
    );

    return (
        <QuestTile
            icon={<ItemIcon item={def || quest.targetId} size={64} className="shrink-0" />}
            title={`${isGather ? 'Collect' : 'Defeat'} ${quest.required} ${def?.name || quest.targetId}`}
            sub={null}
            current={current}
            max={quest.required}
            done={false}
            canTurnIn={canTurnIn}
            onTurnIn={() => QuestBoardSystem.turnIn(areaId, slotIndex)}
            rewardChip={rewardChip}
        />
    );
};

/** An empty slot awaiting the next refresh. */
const EmptyQuestSlot = () => (
    <div className="flex items-center justify-center gap-2 p-4 rounded border border-dashed border-gi-border/50 bg-black/20 min-h-[96px] text-gi-muted/50">
        <Hourglass size={14} />
        <span className="text-[10px] gi-caps tracking-widest font-bold">New quest with next refresh</span>
    </div>
);

export default AreaBannerContainer;
