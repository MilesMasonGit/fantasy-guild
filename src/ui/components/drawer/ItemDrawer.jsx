import { useEffect, useState } from 'react';
import { t } from '../../../i18n/index.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { SideDrawer } from '../base/SideDrawer.jsx';
import { itemTintName, itemTintStyle } from '../base/itemTint.js';
import { itemTipFacts, ItemToolLines, ItemEffectLines, ItemDetailLines } from './ItemTip.jsx';
import { itemTagPills } from './itemTags.js';
import { useShownBankEntry } from './bankInspection.js';
import { lifetimeOf } from '../../../systems/progression/collectionLog.js';
import { itemKey } from '../../../systems/progression/ledger/engine.js';
import { bankStackWorth, sellBankStack } from '../../../systems/inventory/Coins.js';
import { useItem } from '../../../systems/inventory/ItemUse.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { hasUse } from '../../../config/registries/itemUse.js';
import { ItemUseAmounts, ItemUseResult } from './ItemUseControl.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { lookUpItem } from '../encyclopedia/encyclopediaLink.js';
import { coinsText } from '../base/coinsText.js';

/** Item art is 32 px; the drawer shows it at 4×, a whole multiple, so it can be examined closely. */
export const DRAWER_SPRITE_PX = 128;

/**
 * The Item drawer: the side drawer (`SideDrawer`) in the Bank's gold, opened and closed with the
 * Bank, so it has no X. It shows the item last clicked in the Bank this session, else the open
 * tab's first item, else a calm empty line (`bankInspection.js` picks). Top to bottom: the name
 * with the book to its Encyclopedia page, the sprite at 4×, the count, the tags as pills (each
 * explains itself on hover), what it does (tool, break chance, weapon stats, resists, what it
 * restores, the description), then the actions (Use, for an item that has one, and Sell) and, at
 * the foot, how many were collected this run.
 *
 * The last Use's result stays under the actions while its item is shown, and after a Use that took
 * the whole stack on whatever the drawer shows next, until another item is picked or the Bank closes.
 * @param {{ open: boolean, menuRight?: boolean }} props
 */
export const ItemDrawer = ({ open, menuRight = false }) => {
    const entry = useShownBankEntry();
    const [lastUse, setLastUse] = useState(null);
    useEffect(() => {
        if (!open) setLastUse(null);
    }, [open]);
    const shownUse = lastUse && entry && (lastUse.itemId === entry.id || !InventoryManager.hasItem(lastUse.itemId)) ? lastUse : null;
    return (
        <SideDrawer open={open} menuRight={menuRight} backdrop="bank" label={t('bank.drawer.label')} data-item-drawer={entry?.id || ''}>
            {entry ? <ItemDrawerBody key={entry.id} entry={entry} lastUse={shownUse} onUsed={setLastUse} /> : <ItemDrawerEmpty />}
        </SideDrawer>
    );
};

/** The drawer's six parts for one Bank entry `{ id, count, template }`. */
export const ItemDrawerBody = ({ entry, lastUse = null, onUsed = null }) => {
    const { template, count } = entry;
    const facts = itemTipFacts(template);
    const pills = itemTagPills(template);
    const collected = lifetimeOf(itemKey(entry.id)).collected || 0;
    const [confirming, setConfirming] = useState(false);
    const usable = hasUse(template);
    const [amount, setAmount] = useState(1);
    // The stack shrinks as it is used: the amount follows it down.
    const useCount = Math.max(1, Math.min(count, amount));
    const use = () => {
        const result = useItem(entry.id, useCount);
        if (result) onUsed?.(result);
    };
    // Only the Bank's stack is sold: worn copies stay worn, and a carried consumable reads the Bank's count.
    const sell = () => {
        sellBankStack(entry.id);
        setConfirming(false);
    };
    const pay = bankStackWorth(entry.id).coins;
    return (
        <>
            {/* 1. The name, and the book in the top corner. */}
            <header data-item-drawer-header className="shrink-0 flex items-start gap-2 px-3 pt-3">
                <h3 className="flex-1 min-w-0 ui-text-title font-bold text-gi-gold break-words leading-tight">{template.name}</h3>
                <button
                    type="button"
                    data-item-drawer-look-up
                    title={t('encyclopedia.lookUp')}
                    aria-label={t('encyclopedia.lookUp')}
                    onClick={() => lookUpItem(entry.id)}
                    className="ui-icon-button shrink-0 w-8 h-8 flex items-center justify-center text-gi-muted hover:text-white cursor-pointer"
                >
                    <PixelGlyph name="book" />
                </button>
            </header>
            {/* The arrow bars are siblings of the list: this column holds all three. */}
            <div className="flex-1 min-h-0 flex flex-col">
                <ArrowScrollList step={60} compact className="flex-1 min-h-0">
                    <div className="flex flex-col items-center gap-2 px-3 py-2 ui-text-body leading-snug">
                        {/* 2. The sprite at 4×, on its kind's tile surface. */}
                        <div
                            data-item-drawer-sprite
                            data-item-tint={itemTintName(template)}
                            style={itemTintStyle(template)}
                            className="ui-item-tile shrink-0 flex items-center justify-center p-2"
                        >
                            <ItemIcon item={template} size={DRAWER_SPRITE_PX} title={null} />
                        </div>
                        {/* 3. How many the Bank holds. */}
                        <div data-item-drawer-count className="tabular-nums font-bold text-white">
                            {t('itemTip.count', { count: count.toLocaleString('en-US') })}
                        </div>
                        {/* 4. The tags, as pills that explain themselves. */}
                        <div data-item-drawer-tags className="flex flex-wrap justify-center gap-1.5">
                            {pills.map(({ tag, explanation }) => (
                                <TagPill key={tag} tag={tag} explanation={explanation} />
                            ))}
                        </div>
                        {/* 5. What it does and its rules. */}
                        <div data-item-drawer-stats className="self-stretch flex flex-col gap-1 pt-2 border-t border-gi-border/40">
                            <ItemToolLines facts={facts} />
                            <ItemEffectLines facts={facts} />
                            <ItemDetailLines facts={facts} />
                        </div>
                    </div>
                </ArrowScrollList>
            </div>
            {/* 6. The actions (Use, Sell) and, at the very foot, collected this run. */}
            <footer className="shrink-0 flex flex-col gap-2 px-3 pt-2 pb-3 border-t border-gi-border/40">
                {usable && !confirming && <ItemUseAmounts count={count} amount={useCount} onAmount={setAmount} />}
                <div data-item-drawer-actions className="flex flex-wrap items-center gap-2">
                    {confirming ? (
                        <>
                            <p data-item-drawer-sell-confirm className="w-full ui-text-small text-amber-200 leading-snug">
                                {t('bank.drawer.sellConfirm', { count: count.toLocaleString('en-US'), item: template.name, pay: coinsText(pay) })}
                            </p>
                            <KitButton tone={KIT_BUTTON_TONE.MAIN} onClick={sell} buttonClassName="py-1 px-3 text-xs" data-item-drawer-sell-yes>
                                {t('common.confirm')}
                            </KitButton>
                            <KitButton tone={KIT_BUTTON_TONE.PLAIN} onClick={() => setConfirming(false)} buttonClassName="py-1 px-3 text-xs" data-item-drawer-sell-no>
                                {t('common.cancel')}
                            </KitButton>
                        </>
                    ) : (
                        <>
                            {usable && (
                                <KitButton
                                    tone={KIT_BUTTON_TONE.MAIN}
                                    onClick={use}
                                    buttonClassName="py-1 px-3 text-xs"
                                    title={t('bank.drawer.useTip', { count: useCount.toLocaleString('en-US'), item: template.name })}
                                    data-item-drawer-use
                                >
                                    {t('bank.drawer.use', { count: useCount.toLocaleString('en-US') })}
                                </KitButton>
                            )}
                            <KitButton tone={KIT_BUTTON_TONE.MAIN} onClick={() => setConfirming(true)} buttonClassName="py-1 px-3 text-xs" data-item-drawer-sell>
                                {t('bank.drawer.sell')}
                            </KitButton>
                        </>
                    )}
                </div>
                {lastUse && !confirming && <ItemUseResult result={lastUse} />}
                <div data-item-drawer-collected className="ui-text-small text-gi-muted tabular-nums">
                    {t('bank.drawer.collected', { count: collected.toLocaleString('en-US') })}
                </div>
            </footer>
        </>
    );
};

/** One tag as a pill; hovering it gives its one line, where one is written. */
const TagPill = ({ tag, explanation }) => {
    const pill = (
        <span
            data-item-tag={tag}
            className="ui-pixel-edge px-1.5 py-0.5 bg-black/40 ui-text-small font-bold text-white cursor-help"
        >
            {tag}
        </span>
    );
    return explanation ? <Tooltip title={tag} lines={[explanation]} maxWidth={240}>{pill}</Tooltip> : pill;
};

const ItemDrawerEmpty = () => (
    <div data-item-drawer-empty className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="ui-text-body font-bold text-gi-muted">{t('bank.drawer.empty')}</span>
        <span className="ui-text-small text-gi-muted/70">{t('bank.drawer.emptyHint')}</span>
    </div>
);

export default ItemDrawer;
