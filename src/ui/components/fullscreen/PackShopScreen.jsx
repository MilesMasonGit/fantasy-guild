import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { CollectionManager } from '../../../systems/progression/CollectionManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { FullScreenDrawer } from './FullScreenDrawer.jsx';
import { Package, Coins, Sparkles } from 'lucide-react';

/**
 * PackShopScreen — full-screen Pack Purchasing (overhaul Phase 4, spec
 * §COMP-PACK). Deliberately rudimentary per the spec: one shop card with
 * the price and a buy button; buying triggers the existing pick-1-of-N
 * reveal overlay. Replaces the Phase 1 interim direct-buy on the bubble.
 */
export const PackShopScreen = ({ onClose }) => {
    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed', 'state_changed']);
    // Folds pack counter + owned copies so cost/counters stay live (same
    // subscription trick as the retired TopBar).
    const stats = useGameState(state => {
        const playsets = state.collection?.playsets || {};
        return {
            packsBought: state.collection?.globalPacksBought || 0,
            uniqueOwned: Object.values(playsets).filter(n => n > 0).length
        };
    }, ['collection_updated', 'state_changed']);

    const packCost = CollectionManager.getUnifiedPackCost();
    const soldOut = CollectionManager.checkUnifiedExhaustion();
    const canAfford = gold >= packCost;

    const handleBuy = () => {
        const result = CollectionManager.buyUnifiedPack();
        if (result.success) {
            EventBus.publish('ui:open_pack_overlay', { options: result.options, unified: true });
        }
    };

    return (
        <FullScreenDrawer icon={Package} title="Pack Shop" onClose={onClose}>
            <div className="h-full flex flex-col items-center justify-center gap-6 p-6">
                {/* The one shop card (rudimentary by design) */}
                <div className="w-72 rounded-2xl border-2 border-gi-primary/40 bg-gi-surface/80 shadow-2xl p-6 flex flex-col items-center gap-4">
                    <div className="w-28 h-36 rounded-xl border border-gi-gold/50 bg-gradient-to-b from-gi-primary/20 to-black/50 flex items-center justify-center">
                        <Package size={44} className="text-gi-gold" />
                    </div>
                    <div className="text-center">
                        <div className="font-display font-bold text-base gi-caps tracking-widest text-gi-text">Booster Pack</div>
                        <div className="text-[10px] text-gi-muted mt-1">Pick 1 of 4 revealed cards for your collection.</div>
                    </div>
                    <button
                        onClick={handleBuy}
                        disabled={soldOut || !canAfford}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-bold gi-caps tracking-widest transition-colors tabular-nums',
                            soldOut || !canAfford
                                ? 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                                : 'border-gi-gold/60 bg-gi-gold/15 text-gi-text hover:bg-gi-gold/25'
                        )}
                    >
                        {soldOut
                            ? 'Sold Out'
                            : <><Coins size={14} className="text-gi-gold" /> {packCost.toLocaleString()}</>}
                    </button>
                    {!soldOut && !canAfford && (
                        <span className="text-[9px] text-gi-danger">Not enough gold ({gold.toLocaleString()} on hand)</span>
                    )}
                </div>

                {/* Counters */}
                <div className="flex items-center gap-6 text-[10px] text-gi-muted gi-description tracking-wide">
                    <span className="flex items-center gap-1.5"><Package size={11} /> Packs opened: <b className="text-gi-text tabular-nums">{stats.packsBought}</b></span>
                    <span className="flex items-center gap-1.5"><Sparkles size={11} /> Unique cards owned: <b className="text-gi-text tabular-nums">{stats.uniqueOwned}</b></span>
                </div>
            </div>
        </FullScreenDrawer>
    );
};

export default PackShopScreen;
