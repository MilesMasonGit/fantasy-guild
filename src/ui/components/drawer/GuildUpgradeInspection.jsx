import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { getUpgradePrice, getLockDetail, LOCK_KIND } from '../../../config/guildUpgrades.js';
import { starSentence, starAmount } from '../../../systems/progression/hallStarText.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { StatCell } from '../base/StatCell.jsx';
import { KitButton } from '../base/KitButton.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { outlineSrc } from '../board/hallStarOutline.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { t } from '../../../i18n/index.js';

/** How far an arrow press scrolls the sheet. */
const SHEET_SCROLL_STEP_PX = 120;

/** `u_upgrade.png` is 16 art pixels; UI sprites draw at 2×. */
const UPGRADE_ICON_PX = 32;

/** One section of the sheet; a rule parts it from the one above, as on the Token card. */
const Section = ({ children, className, ...rest }) => (
    <section className={cn('px-2 py-1.5 flex flex-col gap-1 border-t-2 border-white/15 first:border-t-0', className)} {...rest}>
        {children}
    </section>
);

const Heading = ({ children }) => (
    <span className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{children}</span>
);

/**
 * GuildUpgradeInspection: a Guild Hall star's sheet, laid out like the Token card: its name as a
 * header band (with the close X), one sentence saying what it does, a stat block (rank, now, next)
 * with a line for its top rank, the price as ribbons with what the Bank holds against it, and the
 * Upgrade button. Sits inside the Inspect panel's frame, so it draws no box of its own.
 */
export const GuildUpgradeInspection = ({ upgradeDef, onClose = null }) => {
    // Hall upgrades are paid in Bank items. The selector returns a flat signature string of
    // 'itemId:have' for the next rank's price, so the sheet re-renders when any of those counts
    // changes (see `useGameState`'s selector contract).
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
    const top = upgradeDef.maxRank;
    const isMax = rank >= top;
    const lock = getLockDetail(upgradeDef.id, ranks);
    const accessible = lock === null;
    // The link lock is not spelled out: the sky shows which stars are joined to a lit one. Only a
    // lock the player cannot read off the sky (a skill gate, `LOCK_KIND.SKILL`) is said here.
    const lockReason = lock && lock.kind !== LOCK_KIND.LINK ? lock.text : null;
    const price = !isMax ? getUpgradePrice(upgradeDef, rank) : null;
    const canAfford = price != null && GuildUpgradeManager.canAfford(upgradeDef.id);

    const now = starAmount(upgradeDef, rank);
    const next = !isMax ? starAmount(upgradeDef, rank + 1) : null;
    // The top rank's line is worth its room only when the next rank is not already the top one.
    const showTop = !isMax && rank + 1 < top;
    const icon = upgradeDef.star?.sprite || outlineSrc(upgradeDef) || upgradeDef.sprite;

    const handleUpgrade = () => {
        if (!accessible || isMax || !canAfford) return;
        EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
        const result = GuildUpgradeManager.purchase(upgradeDef.id);
        if (!result?.success) {
            EventBus.publish(UI_EVENTS.UI_SCREEN_CALLOUT, { text: result?.error || t('guildHall.couldNotBuy') });
        }
    };

    return (
        <div data-hall-star-sheet={upgradeDef.id} className="flex flex-col h-full min-h-0 text-gi-text select-none">
            <header data-card-block="name" className="shrink-0 flex items-center gap-2 pl-2 pr-1 py-1 bg-black/80 border-b-2 border-white/30">
                {icon && (
                    <img
                        src={icon}
                        alt=""
                        draggable={false}
                        className={cn('shrink-0', !accessible && 'grayscale opacity-50')}
                        style={{ imageRendering: 'pixelated' }}
                    />
                )}
                <h3 className="flex-1 min-w-0 ui-text-title font-bold text-white leading-tight">{upgradeDef.name}</h3>
                {onClose && <CloseX data-hall-sheet-close onClick={onClose} />}
            </header>

            <ArrowScrollList step={SHEET_SCROLL_STEP_PX} compact className="flex-1 min-h-0 flex flex-col">
                <Section>
                    <p data-star-sentence title={upgradeDef.description || undefined} className="ui-text-body leading-snug">{starSentence(upgradeDef)}</p>
                </Section>

                <Section data-card-block="stats">
                    <div className="grid gap-x-2 gap-y-1 grid-cols-[auto_1fr_1fr]">
                        <StatCell caption={t('guildHall.rank')}>
                            <span data-star-rank className="tabular-nums font-bold" style={isMax ? { color: 'var(--color-ui-gold)' } : undefined}>
                                {`${rank}/${top}`}
                            </span>
                        </StatCell>
                        <StatCell caption={t('guildHall.now')}>
                            <span data-star-now className={cn('font-bold', !now && 'text-gi-muted')}>{now || t('guildHall.nothingYet')}</span>
                        </StatCell>
                        <StatCell caption={t('guildHall.next')}>
                            <span data-star-next className={cn('font-bold', isMax && 'text-gi-muted')} style={isMax ? undefined : { color: 'var(--color-ui-gold)' }}>
                                {isMax ? t('guildHall.topRank') : next}
                            </span>
                        </StatCell>
                    </div>
                    {showTop && (
                        <div data-star-top className="ui-text-small text-gi-muted">
                            {t('guildHall.atTopRank', { rank: top, amount: starAmount(upgradeDef, top) })}
                        </div>
                    )}
                </Section>

                {!isMax && accessible && (
                    <Section data-card-block="price">
                        <Heading>{t('guildHall.price')}</Heading>
                        {price.length === 0 ? (
                            <span className="ui-text-body font-bold" style={{ color: 'var(--color-ui-green)' }}>{t('guildHall.free')}</span>
                        ) : (
                            <div className="flex flex-col gap-1" data-upgrade-bank-check>
                                {price.map(p => (
                                    <EntityRibbon
                                        key={p.itemId}
                                        kind="item"
                                        id={p.itemId}
                                        have={haveCounts[p.itemId] || 0}
                                        required={p.quantity}
                                        size="md"
                                        wrap
                                        data-upgrade-price-item={p.itemId}
                                    />
                                ))}
                            </div>
                        )}
                    </Section>
                )}

                {lockReason && (
                    <Section>
                        <p className="ui-text-body leading-snug" style={{ color: 'var(--color-ui-red)' }}>{lockReason}</p>
                    </Section>
                )}
            </ArrowScrollList>

            <div className="shrink-0 px-2 pt-2 pb-1 flex flex-col gap-1">
                {isMax ? (
                    <div data-star-maxed className="ui-text-body font-bold text-center" style={{ color: 'var(--color-ui-gold)' }}>
                        {t('guildHall.topRankReached')}
                    </div>
                ) : !accessible ? (
                    <div className="ui-text-body font-bold text-center text-gi-muted">{t('guildHall.locked')}</div>
                ) : (
                    <>
                        <KitButton
                            id="guild-upgrade-button"
                            data-guild-upgrade-button={upgradeDef.id === 'roster_size' || upgradeDef.id === 'wishing_well' ? 'true' : undefined}
                            data-guild-roster-upgrade-button={upgradeDef.id === 'roster_size' ? 'true' : undefined}
                            data-guild-well-upgrade-button={upgradeDef.id === 'wishing_well' ? 'true' : undefined}
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
                            <span className="ui-text-title tracking-wide uppercase">{t('guildHall.upgrade')}</span>
                        </KitButton>
                        {!canAfford && (
                            <div data-upgrade-short className="ui-text-small text-center" style={{ color: 'var(--color-ui-red)' }}>
                                {t('guildHall.shortOfPrice')}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default GuildUpgradeInspection;
