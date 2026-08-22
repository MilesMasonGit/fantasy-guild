import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import {
    getUpgradeCost, isTileAccessible, getLockReason, toRoman, getUpgradeDef
} from '../../../config/guildUpgrades.js';
import { Coins, CheckCircle, XCircle, ArrowRight, Lock, TrendingUp, Sparkles } from 'lucide-react';

/**
 * GuildUpgradeInspection — detail view in the inspection panel for a selected upgrade tile.
 */
export const GuildUpgradeInspection = ({ upgradeDef: propDef, upgradeId, tileIndex, onClose }) => {
    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed', 'state_changed']);
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        ['guild_upgrades_updated', 'state_changed']
    );

    const upgradeDef = propDef || (upgradeId ? getUpgradeDef(upgradeId) : null);
    if (!upgradeDef) return null;

    const rank = ranks[upgradeDef.id] || 0;
    const isMax = rank >= upgradeDef.maxRank;
    const accessible = tileIndex != null ? isTileAccessible(tileIndex, ranks) : true;
    const lockReason = !accessible && tileIndex != null ? getLockReason(tileIndex, ranks) : null;
    const cost = !isMax ? getUpgradeCost(upgradeDef, rank) : null;
    const canAfford = cost != null && gold >= cost;

    const handleUpgrade = () => {
        if (!accessible || isMax || !canAfford) return;
        EventBus.publish('audio:play', { clip: 'button_click' });
        GuildUpgradeManager.purchase(upgradeDef.id);
    };

    return (
        <div className="flex flex-col h-full bg-gi-base/90 text-gi-text select-none overflow-y-auto custom-scrollbar">
            {/* Header / Title */}
            <div className="p-4 border-b border-gi-border/40 flex items-center justify-between bg-gi-base/80 shrink-0">
                <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-gi-primary" />
                    <h2 className="text-sm font-bold gi-caps tracking-wider text-gi-text">
                        Guild Upgrade
                    </h2>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-gi-gold/40 text-xs font-bold text-gi-gold tabular-nums">
                    <Coins size={12} />
                    {gold.toLocaleString()}g
                </div>
            </div>

            <div className="p-4 flex flex-col gap-4 flex-1">
                {/* Sprite & Identity */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-gi-surface/50 border border-gi-border/40 relative shrink-0">
                    <div className="relative">
                        <img
                            src={upgradeDef.sprite}
                            alt={upgradeDef.name}
                            className={cn(
                                "w-24 h-24 object-contain drop-shadow-md",
                                !accessible && "grayscale opacity-40"
                            )}
                            style={{ imageRendering: 'pixelated' }}
                        />
                        {!accessible && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="p-2 rounded-full bg-black/85 border border-gi-border text-gi-danger shadow-lg">
                                    <Lock size={20} />
                                </div>
                            </div>
                        )}
                    </div>

                    <h3 className="mt-2 text-base font-bold text-gi-text tracking-wide text-center">
                        {upgradeDef.name}
                    </h3>

                    {/* Level Progress in Silkscreen Roman Numerals */}
                    <div className="mt-1 flex items-center gap-2">
                        <span
                            className={cn(
                                "px-2.5 py-0.5 rounded text-xs font-bold tracking-tight",
                                isMax
                                    ? "bg-gi-gold/20 border border-gi-gold text-gi-gold"
                                    : rank > 0
                                        ? "bg-gi-primary/20 border border-gi-primary/50 text-gi-primary"
                                        : "bg-gi-muted/20 border border-gi-muted/40 text-gi-muted"
                            )}
                            style={{ fontFamily: "'Silkscreen', cursive, monospace" }}
                        >
                            {isMax ? 'MAX LEVEL' : `Rank ${toRoman(rank)} / ${toRoman(upgradeDef.maxRank)}`}
                        </span>
                    </div>
                </div>

                {/* Description */}
                <div className="p-3 rounded-lg bg-black/40 border border-gi-border/30 text-xs text-gi-muted leading-relaxed">
                    {upgradeDef.description}
                </div>

                {/* Stat Progression (Current -> Next) */}
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-gi-surface/40 border border-gi-border/40">
                    <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                        Progression Benefit
                    </span>
                    <div className="flex items-center justify-between text-xs mt-0.5">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gi-muted">Current</span>
                            <span className="font-bold text-gi-text">
                                {upgradeDef.statLabel(rank)}
                            </span>
                        </div>

                        {!isMax && (
                            <>
                                <ArrowRight size={15} className="text-gi-gold mx-2 shrink-0" />
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] text-gi-gold">Next Rank</span>
                                    <span className="font-bold text-gi-gold">
                                        {upgradeDef.nextStatLabel ? upgradeDef.nextStatLabel(rank) : upgradeDef.statLabel(rank + 1)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {upgradeDef.id === 'roster_size' && (
                        <div className="mt-1.5 pt-1.5 border-t border-gi-border/20 flex items-center gap-1.5 text-[11px] text-gi-gold font-medium">
                            <Sparkles size={12} className="shrink-0" />
                            <span>Recruits 1 new Adventurer into the dock!</span>
                        </div>
                    )}
                </div>

                {/* Unlock Requirements (if locked) */}
                {!accessible && (
                    <div className="p-3 rounded-lg bg-gi-danger/10 border border-gi-danger/40 flex items-start gap-2.5 text-xs text-gi-danger">
                        <XCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold block">Locked</span>
                            <span className="text-[11px] opacity-90">{lockReason}</span>
                        </div>
                    </div>
                )}

                {/* Action / Upgrade Button */}
                <div className="mt-auto pt-3 border-t border-gi-border/40 flex flex-col gap-2 shrink-0">
                    {isMax ? (
                        <div className="w-full py-2.5 rounded-xl bg-gi-gold/10 border border-gi-gold/40 text-center text-xs font-bold text-gi-gold flex items-center justify-center gap-2">
                            <CheckCircle size={16} /> Maximum Level Reached
                        </div>
                    ) : !accessible ? (
                        <button
                            disabled
                            className="w-full py-2.5 rounded-xl bg-gi-surface/30 border border-gi-border/30 text-xs font-bold text-gi-muted cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Lock size={14} /> Upgrade Locked
                        </button>
                    ) : (
                        <button
                            onClick={handleUpgrade}
                            disabled={!canAfford}
                            className={cn(
                                "w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-2",
                                canAfford
                                    ? "bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-extrabold cursor-pointer shadow-[0_0_16px_rgba(234,179,8,0.4)] active:scale-[0.98]"
                                    : "bg-gi-surface/40 border border-gi-border/40 text-gi-muted cursor-not-allowed opacity-60"
                            )}
                        >
                            {cost === 0 ? (
                                <span>Claim Starter Hero (Free)</span>
                            ) : (
                                <>
                                    <span>Upgrade to Rank {toRoman(rank + 1)}</span>
                                    <span className="px-2 py-0.5 rounded bg-black/30 text-black font-mono">
                                        {cost.toLocaleString()}g
                                    </span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GuildUpgradeInspection;
