import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { CollectionManager } from '../../../systems/progression/CollectionManager.js';
import { BinderManager } from '../../../systems/progression/BinderManager.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { FullScreenDrawer } from './FullScreenDrawer.jsx';
import { Package, Coins, CheckCircle2 } from 'lucide-react';

/**
 * PackShopScreen — the collection SUMMARY across every unlocked area.
 *
 * This used to be the shop: one global pack, bought here. Packs are per-area
 * now (D-32) and are bought at the banner beside the binder they fill (D-48),
 * so everything about one area happens in one place. What survives is the
 * overview the banner can't give — every area's progress and next price side
 * by side, which is where you decide *where* to spend.
 *
 * Deliberately read-only: adding a buy button here would re-split the thing
 * D-48 just brought together.
 */
export const PackShopScreen = ({ onClose }) => {
    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed', 'state_changed']);

    // Re-derives on unlocks, purchases and claims.
    const areaIds = useGameState(
        state => (state.collection?.unlockedAreaSets || []).join(','),
        ['collection_updated', 'state_changed', 'area_unlocked']
    );
    const areas = (areaIds ? areaIds.split(',') : []).filter(Boolean);

    return (
        <FullScreenDrawer icon={Package} title="Collection" onClose={onClose}>
            <div className="max-w-2xl mx-auto p-6 flex flex-col gap-4">
                <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-bold text-gi-primary gi-caps tracking-widest">
                        Binders by area
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-gi-gold tabular-nums">
                        <Coins size={12} /> {gold.toLocaleString()}
                    </span>
                </div>

                <p className="text-[10px] text-gi-muted italic -mt-2">
                    Packs are bought at each area's banner, beside its binder.
                </p>

                {areas.length === 0 && (
                    <div className="text-[11px] text-gi-muted italic">No areas unlocked yet.</div>
                )}

                {areas.map(areaId => (
                    <AreaSummaryRow key={areaId} areaId={areaId} gold={gold} />
                ))}
            </div>
        </FullScreenDrawer>
    );
};

/** One area: collection progress, and what the next pack there would cost. */
const AreaSummaryRow = ({ areaId, gold }) => {
    const { owned, total, complete, cardsOwned, cardsTotal } = BinderManager.getCompletion(areaId);
    if (total === 0) return null;

    const cost = CollectionManager.getPackCost(areaId);
    const bought = CollectionManager.getPacksBought(areaId);
    const pct = Math.min(100, (owned / Math.max(1, total)) * 100);

    return (
        <div className="flex items-center gap-4 rounded-lg border border-gi-border bg-gi-surface/60 px-4 py-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-gi-text truncate">
                        {getAreaSet(areaId)?.name || areaId}
                    </span>
                    <span className="text-[10px] text-gi-muted tabular-nums">
                        {cardsOwned}/{cardsTotal} cards · {owned}/{total} copies
                    </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-black/50 overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all duration-300',
                            complete ? 'bg-gi-success' : 'bg-gi-primary')}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <span className="text-[9px] text-gi-muted tabular-nums">
                    {bought} pack{bought === 1 ? '' : 's'} opened here
                </span>
            </div>

            {complete ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold gi-caps text-gi-success shrink-0">
                    <CheckCircle2 size={12} /> Complete
                </span>
            ) : (
                <span
                    title={`The next pack at this area's banner costs ${cost.toLocaleString()} gold`}
                    className={cn(
                        'flex items-center gap-1 text-[11px] font-bold tabular-nums shrink-0',
                        gold >= cost ? 'text-gi-gold' : 'text-gi-muted/60'
                    )}
                >
                    <Coins size={11} /> {cost.toLocaleString()}
                </span>
            )}
        </div>
    );
};

export default PackShopScreen;
