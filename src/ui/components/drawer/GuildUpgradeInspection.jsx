import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import {
    getUpgradePrice, getLockDetail, LOCK_KIND, toRoman
} from '../../../config/guildUpgrades.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import {
    CheckCircle, Lock, Zap, Check, ChevronUp, ChevronDown, X
} from 'lucide-react';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

const itemName = (itemId) => getItem(itemId)?.name || itemId;

/** A price as plain text: "20 Oak Wood", or "FREE". */
const priceText = (price) =>
    !price || price.length === 0
        ? 'FREE'
        : price.map(p => `${p.quantity.toLocaleString()} ${itemName(p.itemId)}`).join(' + ');

/**
 * GuildUpgradeInspection: clean, focused upgrade inspection panel: a large central sprite, a
 * distinct upgrade button, simple non-redundant details, and a progression list with wide flat
 * scroll arrows.
 */
export const GuildUpgradeInspection = ({ upgradeDef, onClose }) => {
    const scrollRef = useRef(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    // Hall upgrades are paid in Bank items. The selector returns a flat signature string of
    // 'itemId:have' for the next rank's price, so the panel re-renders when any of those
    // counts changes (see `useGameState`'s selector contract).
    const haveSignature = useGameState(
        () => {
            if (!upgradeDef) return '';
            const price = GuildUpgradeManager.getNextCost(upgradeDef.id) || [];
            return price.map(p => `${p.itemId}:${InventoryManager.getItemCount(p.itemId)}`).join(',');
        },
        [ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.STATE_CHANGED]
    );
    const haveCounts = Object.fromEntries(
        (haveSignature || '').split(',').filter(Boolean).map(pair => {
            const i = pair.lastIndexOf(':');
            return [pair.slice(0, i), Number(pair.slice(i + 1))];
        })
    );
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.STATE_CHANGED]
    );

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
    // Read by upgrade id: the web has no tiles.
    const lock = getLockDetail(upgradeDef.id, ranks);
    const accessible = lock === null;
    // The link lock is deliberately NOT spelled out here: the web already shows which nodes
    // are joined to a bought one, so repeating it is noise. The slot below is for the lock
    // kinds the player cannot read off the web, skill gates such as 'Requires Blacksmithing 5'
    // (`LOCK_KIND.SKILL`, set through an upgrade's `gate`).
    const lockReason = lock && lock.kind !== LOCK_KIND.LINK ? lock.text : null;
    const price = !isMax ? getUpgradePrice(upgradeDef, rank) : null;
    const canAfford = price != null
        && price.every(p => (haveCounts[p.itemId] || 0) >= p.quantity);

    const handleUpgrade = () => {
        if (!accessible || isMax || !canAfford) return;
        EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
        GuildUpgradeManager.purchase(upgradeDef.id);
    };

    const scrollUp = () => {
        scrollRef.current?.scrollBy({ top: -120, behavior: 'smooth' });
    };

    const scrollDown = () => {
        scrollRef.current?.scrollBy({ top: 120, behavior: 'smooth' });
    };

    const allRanks = Array.from({ length: upgradeDef.maxRank }, (_, i) => {
        const r = i + 1;
        const tierPrice = getUpgradePrice(upgradeDef, i);
        const isUnlocked = r <= rank;
        const isNext = r === rank + 1;
        const isFuture = r > rank + 1;
        const label = upgradeDef.statLabel(r);
        return {
            rankNumber: r,
            roman: toRoman(r),
            price: tierPrice,
            isUnlocked,
            isNext,
            isFuture,
            label
        };
    });

    return (
        <div className="flex flex-col h-full bg-[#14100c] text-gi-text select-none p-3.5 gap-3 overflow-hidden">
            <div className="p-4 rounded-xl bg-black/40 border border-gi-border/40 flex flex-col items-center justify-center text-center relative shrink-0 shadow-inner">
                {/**
                 * Way out of the panel. Without this the only exit was picking a different
                 * node or closing the whole drawer.
                 */}
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close"
                        aria-label="Close"
                        className="absolute top-2 right-2 z-10 p-1 rounded-md text-gi-muted hover:text-gi-danger hover:bg-gi-danger/10 transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                )}
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

                <h2 className="text-base font-bold text-gi-text">
                    {upgradeDef.name}
                </h2>
                <div
                    className="text-xs font-semibold text-gi-gold mt-0.5 tracking-wide"
                    style={{ fontFamily: "'Silkscreen', cursive, monospace" }}
                >
                    {isMax ? 'MAX LEVEL' : `Rank ${toRoman(rank)} / ${toRoman(upgradeDef.maxRank)}`}
                </div>

                <p className="text-xs text-gi-muted mt-2 leading-relaxed max-w-[280px]">
                    {upgradeDef.description}
                </p>

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
                    ) : null}
                    {/**
                     * The display slot described above: silent for the link lock, used by
                     * future skill-gate reasons.
                     */}
                    {lockReason && (
                        <p className="mt-2 text-[11px] leading-snug text-red-300/90 text-center">
                            {lockReason}
                        </p>
                    )}
                    {!isMax && accessible && (
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
                                {price.length === 0 ? (
                                    <span>FREE</span>
                                ) : (
                                    price.map(p => (
                                        <span key={p.itemId} className="flex items-center gap-1" data-upgrade-price-item={p.itemId}>
                                            <ItemIcon item={p.itemId} size={16} />
                                            <span>{p.quantity.toLocaleString()}</span>
                                        </span>
                                    ))
                                )}
                            </div>
                        </button>
                    )}
                    {/**
                     * What the Bank holds against the price, so a greyed-out button says what
                     * is missing.
                     */}
                    {!isMax && accessible && price && price.length > 0 && (
                        <div className="mt-2 flex flex-col gap-0.5 text-[11px]" data-upgrade-bank-check>
                            {price.map(p => {
                                const have = haveCounts[p.itemId] || 0;
                                const ok = have >= p.quantity;
                                return (
                                    <div key={p.itemId} className={cn('flex items-center justify-center gap-1.5', ok ? 'text-emerald-400' : 'text-red-300')}>
                                        <ItemIcon item={p.itemId} size={16} />
                                        <span>{itemName(p.itemId)}: {have.toLocaleString()} / {p.quantity.toLocaleString()} in Bank</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative">
                <div className="flex items-center justify-between pb-1.5 px-1 shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gi-muted">
                        Progression
                    </span>
                    <span className="text-[11px] font-mono text-gi-gold">
                        {rank} / {upgradeDef.maxRank}
                    </span>
                </div>

                {canScrollUp && (
                    <button
                        onClick={scrollUp}
                        className="w-full py-1 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gi-gold/40 rounded-lg flex items-center justify-center text-gi-gold transition-colors shrink-0 mb-1 shadow active:scale-[0.99] cursor-pointer"
                        title="Scroll up"
                    >
                        <ChevronUp size={14} />
                    </button>
                )}

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
                                            {priceText(tier.price)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

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
