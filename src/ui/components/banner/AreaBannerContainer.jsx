import React, { useState, useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAllAreaSets, getAreaSet, getRequiredFragments } from '../../../config/registries/areaSetRegistry.js';
import { getQuestDefinition } from '../../../config/registries/questRegistry.js';
import { AreaBannerRow, CollapsedRow } from './AreaBannerRow.jsx';
import { Lock } from 'lucide-react';

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
            <div className="flex flex-col gap-2 max-w-6xl mx-auto">
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
        </div>
    );
};

/**
 * A still-locked area: name + unlock-quest progress (§2G's deferred UI).
 * Progress data lives in areaStates[id].unlockQuestProgress / completedQuestIds.
 */
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
                const current = done ? maxProgress : Math.min(maxProgress, a?.unlockQuestProgress?.[questId] || 0);
                return { questId, name: template?.name || questId, current, maxProgress, done };
            });
        },
        ['state_changed', 'inventory_updated', 'collection_updated'],
        null,
        { deps: [areaId] }
    ) || [];

    const fragmentsDone = progress.filter(q => q.done).length;
    const fragmentsNeeded = getRequiredFragments(areaId);

    return (
        <div className={cn(
            'rounded-lg border border-gi-border/50 bg-gi-base/60 px-3 py-2 flex items-center gap-4 transition-opacity duration-300',
            dimmed && 'opacity-30'
        )}>
            <Lock size={14} className="text-gi-muted shrink-0" />
            <div className="flex flex-col">
                <span className="text-[11px] font-bold text-gi-muted uppercase tracking-wider">{areaSet?.name || areaId}</span>
                <span className="text-[9px] text-gi-muted">
                    {Number.isFinite(fragmentsNeeded)
                        ? `${Math.min(fragmentsDone, fragmentsNeeded)} / ${fragmentsNeeded} map fragments`
                        : 'Locked'}
                </span>
            </div>
            <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar">
                {progress.map(q => (
                    <div key={q.questId} className="flex items-center gap-1.5 shrink-0" title={q.name}>
                        <div className="w-16 h-1 bg-black/50 rounded-full overflow-hidden">
                            <div
                                className={cn('h-full transition-all duration-500', q.done ? 'bg-gi-success' : 'bg-gi-primary')}
                                style={{ width: `${(q.current / q.maxProgress) * 100}%` }}
                            />
                        </div>
                        <span className={cn('text-[9px] tabular-nums', q.done ? 'text-gi-success' : 'text-gi-muted')}>
                            {q.current}/{q.maxProgress}
                        </span>
                    </div>
                ))}
                {progress.length === 0 && (
                    <span className="text-[9px] text-gi-muted italic">No known route to this area yet.</span>
                )}
            </div>
        </div>
    );
};

export default AreaBannerContainer;
