import { t } from '../../../i18n/index.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { itemTintName, itemTintStyle } from '../base/itemTint.js';
import { itemTipFacts, ItemKindLines, ItemDetailLines } from './ItemTip.jsx';
import { lifetimeOf } from '../../../systems/progression/collectionLog.js';
import { itemKey } from '../../../systems/progression/ledger/engine.js';
import { lookUpItem } from '../encyclopedia/encyclopediaLink.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';

/** Item art is 32 px; the window shows it at 4×, a whole multiple, so it can be examined closely. */
export const WINDOW_SPRITE_PX = 128;

/**
 * The Bank's inspection window, along the Bank's bottom edge: a click on a tile opens it. The
 * item's sprite large, its name, count, kind and tags as the tooltip has them, then what the
 * tooltip leaves out (a weapon's stats, resists, what it restores, the description), how many the
 * guild has collected this run, and the book to its Encyclopedia page. Escape or the X closes it.
 * A divider, not a frame: it is part of the Bank's panel.
 * @param {{ entry: { id: string, count: number, template: object }, onClose: () => void }} props
 */
export const BankItemWindow = ({ entry, onClose }) => {
    useEscapeLayer(true, onClose);
    const { template, count } = entry;
    const facts = itemTipFacts(template);
    const collected = lifetimeOf(itemKey(entry.id)).collected || 0;
    return (
        <section
            data-bank-item-window={entry.id}
            aria-label={template.name}
            className="shrink-0 flex items-start gap-4 gi-drawer-pad-x py-3 border-t-2 border-gi-border/60 max-h-[45%] min-h-0"
        >
            <div
                data-bank-item-window-sprite
                data-item-tint={itemTintName(template)}
                style={itemTintStyle(template)}
                className="ui-item-tile shrink-0 flex items-center justify-center p-2"
            >
                <ItemIcon item={template} size={WINDOW_SPRITE_PX} title={null} />
            </div>
            {/* The arrow bars are siblings of the list: this column holds all three. */}
            <div className="flex-1 min-w-0 min-h-0 self-stretch flex flex-col">
            <ArrowScrollList step={60} compact className="flex-1 min-h-0">
            <div className="ui-text-body leading-snug flex flex-col gap-1">
                <h3 className="ui-text-title font-bold text-gi-gold break-words">{template.name}</h3>
                <div data-bank-item-window-count className="tabular-nums font-bold text-white">
                    {t('itemTip.count', { count: count.toLocaleString('en-US') })}
                </div>
                <ItemKindLines facts={facts} />
                <ItemDetailLines facts={facts} />
                <div data-bank-item-window-collected className="text-white tabular-nums">
                    {t('bank.window.collected', { count: collected.toLocaleString('en-US') })}
                </div>
            </div>
            </ArrowScrollList>
            </div>
            <div className="shrink-0 flex items-center gap-1">
                <button
                    type="button"
                    data-bank-item-window-look-up
                    title={t('encyclopedia.lookUp')}
                    aria-label={t('encyclopedia.lookUp')}
                    onClick={() => lookUpItem(entry.id)}
                    className="ui-icon-button w-8 h-8 flex items-center justify-center text-gi-muted hover:text-white cursor-pointer"
                >
                    <PixelGlyph name="book" />
                </button>
                <CloseX onClick={onClose} label={t('bank.window.close')} />
            </div>
        </section>
    );
};
