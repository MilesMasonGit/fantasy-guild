import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState.js';
import { getAllAreaSets } from '../../../config/registries/areaSetRegistry.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getMaxCopies } from '../../../config/cards/cardEffects.js';
import { BinderManager } from '../../../systems/progression/BinderManager.js';

/**
 * DevUnlockCardsModal — QA tool: grant every card in an area's binder up to
 * its authored cap, bypassing packs entirely. Half of the old dead
 * "Spawn Cards/Items..." button (see ui_bugfix_tracker.md #11 — it published
 * `dev:open-spawn-item` and nothing ever subscribed); split into this and
 * DevSpawnItemModal since unlocking cards and spawning items are unrelated
 * QA needs with unrelated data sources.
 */
export const DevUnlockCardsModal = ({ engine, onClose }) => {
    const areas = useMemo(() => Object.values(getAllAreaSets()), []);
    const universalPool = useMemo(() => BinderManager.getUniversalPool(), []);

    // A flat signature, not the live `collection.binders` object — grantCopy
    // mutates that object in place, so a selector handing it back would never
    // read as "changed" (CR-044, see useGameState.js's selector contract).
    useGameState(
        () => areas.map(a => `${a.id}:${BinderManager.getCompletion(a.id).cardsOwned}`).join('|')
            + '|uni:' + universalPool.filter(id => BinderManager.getOwned(id) > 0).length,
        ['collection_updated', 'state_changed']
    );

    const announce = () => {
        engine.EventBus.publish('collection_updated', {});
        engine.EventBus.publish('state_changed');
    };

    const unlockArea = (areaId) => {
        const pool = BinderManager.getPool(areaId);
        pool.forEach(templateId => {
            const max = getMaxCopies(getCard(templateId));
            BinderManager.grantCopy(templateId, max, areaId);
        });
        console.log(`[Dev] Unlocked ${pool.length} card(s) for ${areaId}`);
        announce();
    };

    const unlockUniversals = () => {
        universalPool.forEach(templateId => {
            const max = getMaxCopies(getCard(templateId));
            BinderManager.grantCopy(templateId, max, null);
        });
        console.log(`[Dev] Unlocked ${universalPool.length} universal card(s)`);
        announce();
    };

    const unlockEverything = () => {
        areas.forEach(a => unlockArea(a.id));
        unlockUniversals();
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
            <div className="w-[420px] max-w-full bg-gi-surface border-2 border-gi-primary/50 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gi-border bg-gi-base/60">
                    <span className="font-display font-bold text-base text-gi-primary uppercase tracking-widest">
                        Unlock Area Cards
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gi-danger/20 hover:text-gi-danger rounded text-gi-muted transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar text-gi-text">
                    <p className="text-[10px] text-gi-muted normal-case tracking-normal mb-2">
                        Grants every card in a binder up to its authored cap — no packs needed.
                    </p>

                    <button
                        onClick={unlockEverything}
                        className="w-full text-left px-3 py-2 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-sm font-bold transition-colors"
                    >
                        🌍 Unlock Everything
                    </button>

                    {areas.map(area => {
                        const completion = BinderManager.getCompletion(area.id);
                        return (
                            <div
                                key={area.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-gi-base border border-gi-border"
                            >
                                <div className="min-w-0">
                                    <div className="text-sm font-bold truncate">{area.name}</div>
                                    <div className="text-[10px] text-gi-muted tabular-nums">
                                        {completion.cardsOwned}/{completion.cardsTotal} cards owned
                                    </div>
                                </div>
                                <button
                                    onClick={() => unlockArea(area.id)}
                                    className="shrink-0 px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors"
                                >
                                    Unlock All
                                </button>
                            </div>
                        );
                    })}

                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-gi-base border border-gi-border">
                        <div className="min-w-0">
                            <div className="text-sm font-bold truncate">Universal Cards</div>
                            <div className="text-[10px] text-gi-muted tabular-nums">
                                {universalPool.filter(id => BinderManager.getOwned(id) > 0).length}/{universalPool.length} cards owned
                            </div>
                        </div>
                        <button
                            onClick={unlockUniversals}
                            className="shrink-0 px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors"
                        >
                            Unlock All
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DevUnlockCardsModal;
