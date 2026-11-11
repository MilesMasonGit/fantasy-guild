import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { getUpgradePrice, getLockDetail, LOCK_KIND } from '../../../config/guildUpgrades.js';
import { starSentence, starAmount } from '../../../systems/progression/hallStarText.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { KitButton } from '../base/KitButton.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { LimesBlurb } from '../limes/LimesBlurb.jsx';
import { outlineSrc } from '../board/hallStarOutline.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { t } from '../../../i18n/index.js';

/** How far an arrow press scrolls the rank list: about two rows. */
const RANK_SCROLL_STEP_PX = 72;

/** `u_upgrade.png` is 16 art pixels; UI sprites draw at 2×. */
const UPGRADE_ICON_PX = 32;

/** The star's icon at the head of the drawer: the biggest whole multiple of its art that fits this. */
const DRAWER_ICON_MAX_PX = 96;

/**
 * The hero bar's height at the screen's foot: the hero bar lies over the side drawers, so the
 * drawer's last line stops above it.
 */
export const HERO_BAR_CLEAR_PX = 64;

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

/** A rank in Roman numerals: 1 → "I", 4 → "IV", 14 → "XIV". */
function toRoman(n) {
    let left = Math.floor(Number(n) || 0);
    if (left <= 0) return String(n);
    let out = '';
    for (const [value, letters] of ROMAN) {
        while (left >= value) {
            out += letters;
            left -= value;
        }
    }
    return out;
}

/** The whole-pixel scale at which art `w`×`h` px fits `max` px (at least 1×). */
function iconScale(w, h, max = DRAWER_ICON_MAX_PX) {
    const side = Math.max(w || 0, h || 0);
    return side > 0 ? Math.max(1, Math.floor(max / side)) : 1;
}

/** "3.6k/30": a Bank count against a price, both in the inventory's short numbers. */
const haveOfPrice = (have, needed) => `${formatCompact(have, 1)}/${formatCompact(needed, 1)}`;

/** A rank badge: its Roman numeral, the Arabic number while its row is under the pointer. */
const RankBadge = ({ rank }) => (
    <span data-rank-badge className="shrink-0 w-12 text-center tabular-nums font-bold">
        <span data-rank-roman className="group-hover:hidden">{toRoman(rank)}</span>
        <span data-rank-arabic className="hidden group-hover:inline">{rank}</span>
    </span>
);

/**
 * The Upgrade drawer's body: one Guild Hall star. Its icon large and grey, its title and what it
 * does; the list of every rank (Roman numerals, Arabic under the pointer), scrolled to the last
 * bought and the next one, each with what it gives; then the chosen rank's price in short numbers
 * and the Upgrade button. Choosing a later rank buys every rank up to it at once
 * (`GuildUpgradeManager.purchaseRanks`): the button says how many, and while it is under the
 * pointer the price shows their total. Greyed with what the Bank is short of when it cannot pay.
 * Its frame is the drawer's (`HallUpgradeDrawer`).
 */
export const GuildUpgradeInspection = ({ upgradeDef, onClose = null }) => {
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    );
    const id = upgradeDef?.id;
    const rank = id ? GuildUpgradeManager.getRank(id) : 0;
    const top = upgradeDef?.maxRank || 0;

    // Every rank left's items against the Bank, as one flat 'itemId:have' signature, so the
    // drawer re-renders when any of them changes (`useGameState`'s selector contract).
    useGameState(
        () => {
            if (!upgradeDef) return '';
            const left = GuildUpgradeManager.getRanksCost(upgradeDef.id, upgradeDef.maxRank - GuildUpgradeManager.getRank(upgradeDef.id)) || [];
            return left.map(p => `${p.itemId}:${InventoryManager.getItemCount(p.itemId)}`).join(',');
        },
        [ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    );

    // The chosen rank: the next one by default, again after a buy or on another star.
    const [choice, setChoice] = useState({ id: null, from: -1, target: 0 });
    const target = choice.id === id && choice.from === rank ? choice.target : rank + 1;
    const [totalShown, setTotalShown] = useState(false);

    // The list opens on the last bought rank, the next one under it.
    const listRef = useRef(null);
    useLayoutEffect(() => {
        const box = listRef.current?.closest('[data-scroll-list]');
        if (!box) return;
        const row = box.querySelector(`[data-rank-row="${Math.max(1, rank)}"]`);
        if (!row) return;
        box.scrollTop += row.getBoundingClientRect().top - box.getBoundingClientRect().top;
    }, [id, rank]);

    if (!upgradeDef) return null;

    const isMax = rank >= top;
    const lock = getLockDetail(id, ranks);
    const accessible = lock === null;
    // The link lock is not spelled out: the sky shows which stars are joined to a lit one. Only a
    // lock the player cannot read off the sky (a skill gate, `LOCK_KIND.SKILL`) is said here.
    const lockReason = lock && lock.kind !== LOCK_KIND.LINK ? lock.text : null;
    const buyable = accessible && !isMax;
    const count = buyable ? Math.max(1, Math.min(top, target) - rank) : 0;
    const total = buyable ? GuildUpgradeManager.getRanksCost(id, count) || [] : [];
    const canAfford = buyable && GuildUpgradeManager.canAffordRanks(id, count);
    const shortfall = buyable && !canAfford ? GuildUpgradeManager.getShortfall(total) : [];
    const showTotal = totalShown && count > 1;
    const shownRank = rank + count;
    const shownPrice = showTotal ? total : (buyable ? getUpgradePrice(upgradeDef, shownRank - 1) || [] : []);
    const icon = upgradeDef.star?.sprite || outlineSrc(upgradeDef) || upgradeDef.sprite;

    const choose = (r) => {
        if (!buyable || r <= rank) return;
        EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
        setChoice({ id, from: rank, target: r });
    };

    const handleUpgrade = () => {
        if (!buyable || !canAfford) return;
        EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
        const result = GuildUpgradeManager.purchaseRanks(id, count);
        if (!result?.success) {
            EventBus.publish(UI_EVENTS.UI_SCREEN_CALLOUT, { text: result?.error || t('guildHall.couldNotBuy') });
        }
    };

    return (
        <div
            data-hall-star-sheet={id}
            className="relative flex flex-col h-full min-h-0 text-gi-text select-none"
            style={{ paddingBottom: HERO_BAR_CLEAR_PX }}
        >
            {onClose && <CloseX data-hall-sheet-close onClick={onClose} className="absolute top-1 right-1 z-10" />}
            <div className="absolute top-1 left-1 z-10">
                <LimesBlurb spot="hallStar" />
            </div>

            <header data-card-block="name" className="shrink-0 flex flex-col items-center gap-1 px-3 pt-3 pb-2 text-center">
                {icon && <DrawerIcon src={icon} />}
                <h3 className="ui-text-display font-bold text-white leading-tight">{upgradeDef.name}</h3>
                <p data-star-sentence title={upgradeDef.description || undefined} className="ui-text-body leading-snug">{starSentence(upgradeDef)}</p>
                {lockReason && (
                    <p className="ui-text-body leading-snug" style={{ color: 'var(--color-ui-red)' }}>{lockReason}</p>
                )}
            </header>

            <div className="shrink-0 px-3 pt-1 border-t-2 border-white/15">
                <span className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{t('guildHall.ranks')}</span>
            </div>
            <ArrowScrollList step={RANK_SCROLL_STEP_PX} compact className="flex-1 min-h-0 flex flex-col px-2">
                <ol ref={listRef} data-rank-list className="flex flex-col gap-0.5 py-1">
                    {Array.from({ length: top }, (_, i) => i + 1).map(r => {
                        const bought = r <= rank;
                        const chosen = buyable && r === rank + count;
                        const inRange = buyable && r > rank && r < rank + count;
                        const pickable = buyable && r > rank;
                        const amount = starAmount(upgradeDef, r);
                        const Row = pickable ? 'button' : 'div';
                        return (
                            <li key={r}>
                                <Row
                                    {...(pickable ? { type: 'button', onClick: () => choose(r) } : {})}
                                    data-rank-row={r}
                                    data-rank-state={bought ? 'bought' : chosen ? 'chosen' : inRange ? 'in-range' : 'later'}
                                    aria-pressed={pickable ? chosen : undefined}
                                    className={cn(
                                        'group w-full flex items-center gap-2 px-1 py-1 text-left ui-text-body border-2',
                                        chosen ? 'border-[var(--color-ui-gold)] bg-white/10' : inRange ? 'border-white/25 bg-white/5' : 'border-transparent',
                                        pickable && 'cursor-pointer hover:bg-white/10',
                                        !bought && !chosen && !inRange && 'text-gi-muted'
                                    )}
                                    style={bought ? { color: 'var(--color-ui-gold)' } : undefined}
                                >
                                    <RankBadge rank={r} />
                                    <span data-rank-amount className="flex-1 min-w-0 leading-snug">{amount || t('guildHall.nothingYet')}</span>
                                </Row>
                            </li>
                        );
                    })}
                </ol>
            </ArrowScrollList>

            <div className="shrink-0 px-2 pt-2 pb-1 flex flex-col gap-1 border-t-2 border-white/15">
                {isMax ? (
                    <div data-star-maxed className="ui-text-body font-bold text-center" style={{ color: 'var(--color-ui-gold)' }}>
                        {t('guildHall.topRankReached')}
                    </div>
                ) : !accessible ? (
                    <div className="ui-text-body font-bold text-center text-gi-muted">{t('guildHall.locked')}</div>
                ) : (
                    <>
                        <div data-card-block="price" data-price-shows={showTotal ? 'total' : 'rank'} className="flex flex-col gap-1">
                            <span className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">
                                {showTotal
                                    ? t('guildHall.totalPrice', { from: toRoman(rank + 1), to: toRoman(rank + count) })
                                    : t('guildHall.rankPrice', { rank: toRoman(shownRank) })}
                            </span>
                            {shownPrice.length === 0 ? (
                                <span className="ui-text-body font-bold" style={{ color: 'var(--color-ui-green)' }}>{t('guildHall.free')}</span>
                            ) : (
                                <div className="flex flex-col gap-1" data-upgrade-bank-check>
                                    {shownPrice.map(p => {
                                        const have = InventoryManager.getItemCount(p.itemId);
                                        const short = have < p.quantity;
                                        // The ribbon's own have/required count is unshortened: the
                                        // count is given here in short numbers, with its short look.
                                        return (
                                            <EntityRibbon
                                                key={p.itemId}
                                                kind="item"
                                                id={p.itemId}
                                                countText={<span data-price-count className={short ? 'text-gi-danger font-semibold' : undefined}>{haveOfPrice(have, p.quantity)}</span>}
                                                className={short ? 'bg-[#221316] border-gi-danger/40' : undefined}
                                                size="md"
                                                wrap
                                                data-upgrade-price-item={p.itemId}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div
                            data-upgrade-hover
                            onMouseEnter={() => setTotalShown(true)}
                            onMouseLeave={() => setTotalShown(false)}
                            onFocus={() => setTotalShown(true)}
                            onBlur={() => setTotalShown(false)}
                        >
                            <KitButton
                                id="guild-upgrade-button"
                                data-guild-upgrade-button={id === 'roster_size' || id === 'wishing_well' ? 'true' : undefined}
                                data-guild-roster-upgrade-button={id === 'roster_size' ? 'true' : undefined}
                                data-guild-well-upgrade-button={id === 'wishing_well' ? 'true' : undefined}
                                data-upgrade-count={count}
                                disabled={!canAfford}
                                onClick={handleUpgrade}
                                className="w-full"
                                buttonClassName="py-1"
                            >
                                <img
                                    src="/assets/ui/u_upgrade.png"
                                    alt=""
                                    draggable={false}
                                    style={{ width: UPGRADE_ICON_PX, height: UPGRADE_ICON_PX, imageRendering: 'pixelated' }}
                                />
                                <span className="ui-text-title tracking-wide uppercase">
                                    {count > 1 ? t('guildHall.upgradeRanks', { n: count }) : t('guildHall.upgrade')}
                                </span>
                            </KitButton>
                        </div>
                        {shortfall.length > 0 && (
                            <div data-upgrade-short className="ui-text-small text-center" style={{ color: 'var(--color-ui-red)' }}>
                                {t('guildHall.shortBy', {
                                    items: shortfall.map(s => `${formatCompact(s.needed - s.have, 1)} ${s.name}`).join(', ')
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

/** The star's icon, always grey, at the biggest whole multiple of its art that fits. */
const DrawerIcon = ({ src }) => {
    const [size, setSize] = useState(null);
    return (
        <img
            src={src}
            alt=""
            draggable={false}
            data-drawer-icon
            onLoad={(e) => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                const k = iconScale(w, h);
                setSize({ w: w * k, h: h * k });
            }}
            className="shrink-0 grayscale"
            style={{ width: size?.w || 64, height: size?.h || 64, imageRendering: 'pixelated', visibility: size ? 'visible' : 'hidden' }}
        />
    );
};

