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
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';

const itemName = (itemId) => getItem(itemId)?.name || itemId;

/** A price as plain text: "20 Oak Wood", or "FREE". */
const priceText = (price) =>
    !price || price.length === 0
        ? 'FREE'
        : price.map(p => `${p.quantity.toLocaleString()} ${itemName(p.itemId)}`).join(' + ');

/** How far an arrow press scrolls the rank list: two rank rows (42 px at the default text size) and their gaps. */
const RANK_SCROLL_STEP_PX = 96;

/** `u_upgrade.png` is 16 art pixels; UI sprites draw at 2×. */
const UPGRADE_ICON_PX = 32;

/**
 * GuildUpgradeInspection: an upgrade's sheet: its sprite, name, rank and description, the
 * Upgrade button (the kit's main action) with what the Bank holds against its price, and the
 * rank list. Sits inside the Inspect panel's frame, so it draws no box of its own.
 */
export const GuildUpgradeInspection = ({ upgradeDef }) => {
    // Hall upgrades are paid in Bank items. The selector returns a flat signature string of
    // 'itemId:have' for the next rank's price, so the panel re-renders when any of those
    // counts changes (see `useGameState`'s selector contract).
    const haveSignature = useGameState(
        () => {
            if (!upgradeDef) return '';
            const price = GuildUpgradeManager.getNextCost(upgradeDef.id) || [];
            return price.map(p => `${p.itemId}:${InventoryManager.getItemCount(p.itemId)}`).join(',');
        },
        [ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    );
    const haveCounts = Object.fromEntries(
        (haveSignature || '').split(',').filter(Boolean).map(pair => {
            const i = pair.lastIndexOf(':');
            return [pair.slice(0, i), Number(pair.slice(i + 1))];
        })
    );
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    );

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
    const canAfford = price != null && GuildUpgradeManager.canAfford(upgradeDef.id);

    const handleUpgrade = () => {
        if (!accessible || isMax || !canAfford) return;
        EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
        const result = GuildUpgradeManager.purchase(upgradeDef.id);
        if (!result?.success) {
            EventBus.publish(UI_EVENTS.UI_SCREEN_CALLOUT, { text: result?.error || 'Could not buy that upgrade' });
        }
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
        <div className="flex flex-col h-full text-gi-text select-none px-1 gap-3 overflow-hidden">
            <div className="flex flex-col items-center text-center shrink-0">
                <div className="w-32 h-32 flex items-center justify-center relative shrink-0 mb-2">
                    <img
                        src={upgradeDef.sprite}
                        alt={upgradeDef.name}
                        className={cn('w-32 h-32 object-contain', !accessible && 'grayscale opacity-35')}
                        style={{ imageRendering: 'pixelated' }}
                    />
                    {!accessible && (
                        <img
                            src="/assets/ui/u_lock.png"
                            alt="Locked"
                            className="absolute w-16 h-16"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    )}
                </div>

                <h2 className="ui-text-title font-bold text-gi-text">
                    {upgradeDef.name}
                </h2>
                <div className="ui-text-body font-semibold mt-0.5 tracking-wide" style={{ color: 'var(--color-ui-gold)' }}>
                    {isMax ? 'MAX LEVEL' : `Rank ${toRoman(rank)} / ${toRoman(upgradeDef.maxRank)}`}
                </div>

                <p className="ui-text-body text-gi-muted mt-2 leading-relaxed">
                    {upgradeDef.description}
                </p>

                <div className="w-full mt-3">
                    {isMax ? (
                        <div className="ui-text-body font-bold text-center" style={{ color: 'var(--color-ui-gold)' }}>
                            Maximum Rank Reached
                        </div>
                    ) : !accessible ? (
                        <div className="ui-text-body font-bold text-center" style={{ color: 'var(--color-ui-red)' }}>
                            Upgrade Locked
                        </div>
                    ) : null}
                    {/**
                     * The display slot described above: silent for the link lock, used by
                     * future skill-gate reasons.
                     */}
                    {lockReason && (
                        <p className="mt-2 ui-text-title leading-snug text-center" style={{ color: 'var(--color-ui-red)' }}>
                            {lockReason}
                        </p>
                    )}
                    {!isMax && accessible && (
                        <PixelFrame kind={FRAME_KIND.CHAMFER} className={cn('w-full', !canAfford && 'opacity-50 grayscale')}>
                            <button
                                id="guild-upgrade-button"
                                data-guild-upgrade-button={upgradeDef.id === 'roster_size' || upgradeDef.id === 'wishing_well' ? 'true' : undefined}
                                data-guild-roster-upgrade-button={upgradeDef.id === 'roster_size' ? 'true' : undefined}
                                data-guild-well-upgrade-button={upgradeDef.id === 'wishing_well' ? 'true' : undefined}
                                onClick={handleUpgrade}
                                disabled={!canAfford}
                                className={cn(
                                    "ui-shine w-full px-2 py-0.5 flex items-center justify-between gap-2 font-bold",
                                    canAfford ? 'cursor-pointer' : 'cursor-not-allowed'
                                )}
                                style={{ color: canAfford ? 'var(--color-ui-gold)' : 'var(--color-ui-muted)' }}
                            >
                                <span className="flex items-center gap-1.5">
                                    <img
                                        src="/assets/ui/u_upgrade.png"
                                        alt=""
                                        draggable={false}
                                        style={{ width: UPGRADE_ICON_PX, height: UPGRADE_ICON_PX, imageRendering: 'pixelated' }}
                                    />
                                    <span className="ui-text-title tracking-wide uppercase">Upgrade</span>
                                </span>
                                <span className="flex items-center gap-2 ui-text-title tabular-nums">
                                    {price.length === 0 ? (
                                        <span>FREE</span>
                                    ) : (
                                        price.map(p => (
                                            <span
                                                key={p.itemId}
                                                className="flex items-center gap-1"
                                                data-upgrade-price-item={p.itemId}
                                                style={canAfford ? undefined : { color: 'var(--color-ui-red)' }}
                                            >
                                                <ItemIcon item={p.itemId} size={16} />
                                                <span>{p.quantity.toLocaleString()}</span>
                                            </span>
                                        ))
                                    )}
                                </span>
                            </button>
                        </PixelFrame>
                    )}
                    {/**
                     * What the Bank holds against the price, so a greyed-out button says what
                     * is missing.
                     */}
                    {!isMax && accessible && price && price.length > 0 && (
                        <div className="mt-2 flex flex-col gap-0.5 ui-text-title" data-upgrade-bank-check>
                            {price.map(p => {
                                const have = haveCounts[p.itemId] || 0;
                                const ok = have >= p.quantity;
                                return (
                                    <div
                                        key={p.itemId}
                                        className="flex items-center justify-center gap-1.5"
                                        style={{ color: ok ? 'var(--color-ui-green)' : 'var(--color-ui-red)' }}
                                    >
                                        <ItemIcon item={p.itemId} size={16} />
                                        <span>{itemName(p.itemId)}: {have.toLocaleString()} / {p.quantity.toLocaleString()} in Bank</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative border-t border-white/10 pt-2">
                <div className="flex items-center justify-between pb-1 shrink-0">
                    <span className="ui-text-title font-bold uppercase tracking-wider text-gi-muted">
                        Progression
                    </span>
                    <span className="ui-text-title" style={{ color: 'var(--color-ui-gold)' }}>
                        {rank} / {upgradeDef.maxRank}
                    </span>
                </div>

                <ArrowScrollList
                    step={RANK_SCROLL_STEP_PX}
                    compact
                    className="flex-1 min-h-0 flex flex-col"
                >
                    {allRanks.map(tier => {
                        const isCurrent = tier.isNext;
                        const isOwned = tier.isUnlocked;
                        const colour = isCurrent ? 'var(--color-ui-gold)' : isOwned ? undefined : 'var(--color-ui-muted)';

                        return (
                            <div
                                key={tier.rankNumber}
                                data-rank-row={tier.rankNumber}
                                data-rank-current={isCurrent ? 'true' : undefined}
                                className={cn(
                                    'py-1.5 ui-text-body flex items-start justify-between gap-2 border-b border-white/5 last:border-b-0',
                                    isCurrent && 'font-bold'
                                )}
                                style={{ color: colour }}
                            >
                                <div className="flex items-baseline gap-2 min-w-0">
                                    <span className="ui-text-title font-bold tracking-tight shrink-0">
                                        Rank {tier.roman}
                                    </span>
                                    <span className="min-w-0 break-words">
                                        {tier.label}
                                    </span>
                                </div>

                                <div className="text-right shrink-0">
                                    {isOwned ? (
                                        <span className="font-bold" style={{ color: 'var(--color-ui-green)' }}>
                                            Active
                                        </span>
                                    ) : (
                                        <span
                                            className="font-bold"
                                            style={isCurrent ? { color: canAfford ? 'var(--color-ui-gold)' : 'var(--color-ui-red)' } : undefined}
                                        >
                                            {priceText(tier.price)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </ArrowScrollList>
            </div>
        </div>
    );
};

export default GuildUpgradeInspection;
