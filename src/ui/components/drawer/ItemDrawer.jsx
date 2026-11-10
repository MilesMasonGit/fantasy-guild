import { t } from '../../../i18n/index.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { SideDrawer } from '../base/SideDrawer.jsx';
import { itemTintName, itemTintStyle } from '../base/itemTint.js';
import { itemTipFacts, ItemToolLines, ItemDetailLines } from './ItemTip.jsx';
import { itemTagPills } from './itemTags.js';
import { useShownBankEntry } from './bankInspection.js';
import { lifetimeOf } from '../../../systems/progression/collectionLog.js';
import { itemKey } from '../../../systems/progression/ledger/engine.js';
import { lookUpItem } from '../encyclopedia/encyclopediaLink.js';

/** Item art is 32 px; the drawer shows it at 4×, a whole multiple, so it can be examined closely. */
export const DRAWER_SPRITE_PX = 128;

/**
 * The Item drawer: the side drawer (`SideDrawer`) in the Bank's gold, opened and closed with the
 * Bank, so it has no X. It shows the item last clicked in the Bank this session, else the open
 * tab's first item, else a calm empty line (`bankInspection.js` picks). Top to bottom: the name
 * with the book to its Encyclopedia page, the sprite at 4×, the count, the tags as pills (each
 * explains itself on hover), what it does (tool, break chance, weapon stats, resists, what it
 * restores, the description), then the actions and, at the foot, how many were collected this
 * run.
 * @param {{ open: boolean, menuRight?: boolean }} props
 */
export const ItemDrawer = ({ open, menuRight = false }) => {
    const entry = useShownBankEntry();
    return (
        <SideDrawer open={open} menuRight={menuRight} backdrop="bank" label={t('bank.drawer.label')} data-item-drawer={entry?.id || ''}>
            {entry ? <ItemDrawerBody entry={entry} /> : <ItemDrawerEmpty />}
        </SideDrawer>
    );
};

const ItemDrawerBody = ({ entry }) => {
    const { template, count } = entry;
    const facts = itemTipFacts(template);
    const pills = itemTagPills(template);
    const collected = lifetimeOf(itemKey(entry.id)).collected || 0;
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
                            <ItemDetailLines facts={facts} />
                        </div>
                    </div>
                </ArrowScrollList>
            </div>
            {/* 6. The actions (Use, and later Sell and Discard) and, at the very foot, collected this run. */}
            <footer className="shrink-0 flex flex-col gap-2 px-3 pt-2 pb-3 border-t border-gi-border/40">
                <div data-item-drawer-actions className="flex flex-wrap gap-2 empty:hidden" />
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
