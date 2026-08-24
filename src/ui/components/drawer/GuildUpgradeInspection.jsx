import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import {
    getUpgradeCost, isTileAccessible, getLockReason, toRoman, getUpgradeDef
} from '../../../config/guildUpgrades.js';
import {
    Coins, CheckCircle, Lock, Zap, Check, ChevronUp, ChevronDown
} from 'lucide-react';

/**
 * GuildUpgradeInspection — clean, focused upgrade inspection panel.
 * - Large, central, present sprite.
 * - Distinct, prominent upgrade button.
 * - Simple, non-redundant details.
 * - Progression list with wide flat scroll arrows matching Cartographer and Hero Inspection.
 */
export const GuildUpgradeInspection = ({ upgradeDef: propDef, upgradeId, tileIndex }) => {
    const scrollRef = useRef(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed', 'state_changed']);
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        ['guild_upgrades_updated', 'state_changed']
    );

    const upgradeDef = propDef || (upgradeId ? getUpgradeDef(upgradeId) : null);

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollUp(el.scrollTop > 4);
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    }, []);

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => {
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll, upgradeDef, ranks]);

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

    const scrollUp = () => {
        scrollRef.current?.scrollBy({ top: -120, behavior: 'smooth' });
    };

    const scrollDown = () => {
        scrollRef.current?.scrollBy({ top: 120, behavior: 'smooth' });
    };

    // Progression tiers for the roadmap
    const allRanks = Array.from({ length: upgradeDef.maxRank }, (_, i) => {
        const r = i + 1;
        const tierCost = getUpgradeCost(upgradeDef, i);
        const isUnlocked = r <= rank;
        const isNext = r === rank + 1;
        const isFuture = r > rank + 1;
        const label = upgradeDef.statLabel(r);
        return {
            rankNumber: r,
            roman: toRoman(r),
            cost: tierCost,
            isUnlocked,
            isNext,
            isFuture,
            label
        };
    });

    return (
        <div className="flex flex-col h-full bg-[#14100c] text-gi-text select-none p-3.5 gap-3 overflow-hidden">
            {/* 1. Large Central Hero Box with Distinct Upgrade Button */}
            <div className="p-4 rounded-xl bg-black/40 border border-gi-border/40 flex flex-col items-center justify-center text-center relative shrink-0 shadow-inner">
                {/* Large Central Sprite (128px) */}
                <div className="w-36 h-36 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center relative overflow-hidden shadow-lg mb-2.5 shrink-0">
                    <img
                        src={upgradeDef.sprite}
                        alt={upgradeDef.name}
                        className={cn(
                            "w-32 h-32 object-contain drop-shadow-md",
                            !accessible && "grayscale opacity-35"
                        )}
                        style={{ imageRendering: 'pixelated' }}
                    />
                    {!accessible && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <img
                                src="/assets/ui/ui_lock.png"
                                alt="Locked"
                                className="w-16 h-16 object-contain drop-shadow-lg"
                                style={{ imageRendering: 'pixelated' }}
                            />
                        </div>
                    )}
                </div>

                {/* Title & Silkscreen Rank */}
                <h2 className="text-base font-bold text-gi-text">
                    {upgradeDef.name}
                </h2>
                <div
                    className="text-xs font-semibold text-gi-gold mt-0.5 tracking-wide"
                    style={{ fontFamily: "'Silkscreen', cursive, monospace" }}
                >
                    {isMax ? 'MAX LEVEL' : `Rank ${toRoman(rank)} / ${toRoman(upgradeDef.maxRank)}`}
                </div>

                {/* Simple 1-sentence description */}
                <p className="text-xs text-gi-muted mt-2 leading-relaxed max-w-[280px]">
                    {upgradeDef.description}
                </p>

                {/* 2. Very Distinct Upgrade Button */}
                <div className="w-full mt-3.5">
                    {isMax ? (
                        <div className="w-full py-2.5 rounded-lg bg-gi-gold/15 border border-gi-gold/40 text-center text-xs font-bold text-gi-gold flex items-center justify-center gap-2">
                            <CheckCircle size={15} /> Maximum Rank Reached
                        </div>
                    ) : !accessible ? (
                        <div className="w-full py-2.5 rounded-lg bg-red-950/20 border border-red-500/30 text-xs font-bold text-red-300 flex items-center justify-center gap-2">
                            <img
                                src="/assets/ui/ui_lock.png"
                                alt="Locked"
                                className="w-4 h-4 object-contain"
                                style={{ imageRendering: 'pixelated' }}
                            />
                            <span>Upgrade Locked</span>
                        </div>
                    ) : (
                        <button
                            id="guild-upgrade-button"
                            data-guild-upgrade-button={upgradeDef.id === 'roster_size' || upgradeDef.id === 'wishing_well' ? "true" : undefined}
                            data-guild-roster-upgrade-button={upgradeDef.id === 'roster_size' ? "true" : undefined}
                            data-guild-well-upgrade-button={upgradeDef.id === 'wishing_well' ? "true" : undefined}
                            onClick={handleUpgrade}
                            disabled={!canAfford}
                            style={canAfford ? {
                                textShadow: '0 1px 0 #000, 1px 0 0 #000, 0 -1px 0 #000, -1px 0 0 #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 2px rgba(0,0,0,0.9)'
                            } : undefined}
                            className={cn(
                                "w-full py-2.5 px-4 rounded-lg font-bold transition-all shadow-lg flex items-center justify-between gap-2 cursor-pointer",
                                canAfford
                                    ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500 text-white font-extrabold shadow-[0_0_18px_rgba(245,158,11,0.4)] active:scale-[0.98] border border-amber-300/40"
                                    : "bg-white/5 border border-white/10 text-stone-500 cursor-not-allowed opacity-60"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Zap size={16} className={canAfford ? "text-amber-200 fill-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" : "text-stone-500"} />
                                <span className="text-sm font-extrabold tracking-wide uppercase">
                                    Upgrade
                                </span>
                            </div>

                            <div className={cn(
                                "flex items-center gap-1.5 px-2.5 py-0.5 rounded text-sm font-bold tabular-nums",
                                canAfford ? "bg-black/40 text-white border border-black/40 shadow-inner" : "text-red-400"
                            )}>
                                {cost === 0 ? (
                                    <span>FREE</span>
                                ) : (
                                    <>
                                        <Coins size={14} className="text-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                                        <span>{cost.toLocaleString()}g</span>
                                    </>
                                )}
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* 3. Progression Roadmap with Wide Flat Scroll Arrows */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                <div className="flex items-center justify-between pb-1.5 px-1 shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gi-muted">
                        Progression
                    </span>
                    <span className="text-[11px] font-mono text-gi-gold">
                        {rank} / {upgradeDef.maxRank}
                    </span>
                </div>

                {/* Flat Scroll Arrow: Top */}
                {canScrollUp && (
                    <button
                        onClick={scrollUp}
                        className="w-full py-1 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gi-gold/40 rounded-lg flex items-center justify-center text-gi-gold transition-colors shrink-0 mb-1 shadow active:scale-[0.99] cursor-pointer"
                        title="Scroll up"
                    >
                        <ChevronUp size={14} />
                    </button>
                )}

                {/* Scrollable list of ranks */}
                <div
                    ref={scrollRef}
                    className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                    {allRanks.map(tier => {
                        const isCurrent = tier.isNext;
                        const isOwned = tier.isUnlocked;

                        return (
                            <div
                                key={tier.rankNumber}
                                className={cn(
                                    "px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors",
                                    isCurrent
                                        ? "bg-gi-gold/15 border-gi-gold/50 text-gi-gold font-bold shadow"
                                        : isOwned
                                            ? "bg-emerald-950/20 border-emerald-500/25 text-gi-text"
                                            : "bg-black/30 border-white/5 text-gi-muted opacity-70"
                                )}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="text-[11px] font-bold tracking-tight shrink-0"
                                        style={{ fontFamily: "'Silkscreen', cursive, monospace" }}
                                    >
                                        Rank {tier.roman}
                                    </span>
                                    <span className="text-xs truncate">
                                        {tier.label}
                                    </span>
                                </div>

                                <div className="text-right shrink-0 font-mono text-xs">
                                    {isOwned ? (
                                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                                            <Check size={12} /> Active
                                        </span>
                                    ) : (
                                        <span className={cn(
                                            "font-bold flex items-center gap-1",
                                            isCurrent ? (canAfford ? "text-gi-gold" : "text-gi-danger") : "text-gi-muted"
                                        )}>
                                            {tier.cost === 0 ? 'FREE' : `${tier.cost.toLocaleString()}g`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Flat Scroll Arrow: Bottom */}
                {canScrollDown && (
                    <button
                        onClick={scrollDown}
                        className="w-full py-1 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gi-gold/40 rounded-lg flex items-center justify-center text-gi-gold transition-colors shrink-0 mt-1 shadow active:scale-[0.99] cursor-pointer"
                        title="Scroll down"
                    >
                        <ChevronDown size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default GuildUpgradeInspection;
