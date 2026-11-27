import { t } from '../../../i18n/index.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { cn } from '../../utils/cn.js';

/** The Use amounts, as the old Sell control had them: one, half (rounded up), all but one, all. */
export const USE_PRESETS = Object.freeze(['one', 'half', 'allButOne', 'all']);

const PRESET_KEY = Object.freeze({ one: 'useOne', half: 'useHalf', allButOne: 'useAllButOne', all: 'useAll' });

/** How many a preset uses of a stack of `count`, at least 1. */
export function useAmountOf(preset, count) {
    const n = Math.max(1, Math.floor(Number(count) || 0));
    if (preset === 'half') return Math.max(1, Math.ceil(n / 2));
    if (preset === 'allButOne') return Math.max(1, n - 1);
    if (preset === 'all') return n;
    return 1;
}

/**
 * The amount a Use takes, above the drawer's actions: the four presets (the one matching the amount
 * in gold, as a selected tab is) and, for a stack of more than one, a slider over the whole stack.
 * Half and All −1 are greyed on a stack of one, where they would mean 1.
 * @param {{ count: number, amount: number, onAmount: (n: number) => void }} props
 */
export const ItemUseAmounts = ({ count, amount, onAmount }) => (
    <div data-item-use-amounts className="w-full flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
            {USE_PRESETS.map((preset) => {
                const n = useAmountOf(preset, count);
                const idle = count <= 1 && (preset === 'half' || preset === 'allButOne');
                const picked = !idle && n === amount;
                return (
                    <button
                        key={preset}
                        type="button"
                        data-item-use-preset={preset}
                        data-picked={picked ? 'true' : 'false'}
                        disabled={idle}
                        onClick={() => onAmount(n)}
                        className={cn(
                            'ui-pixel-edge flex-1 min-w-0 px-1 py-0.5 bg-black/40 ui-text-small font-bold transition-colors',
                            idle ? 'text-gi-muted/40 cursor-not-allowed'
                                : picked ? 'text-[var(--color-ui-gold)] cursor-pointer'
                                    : 'text-white/70 hover:text-[var(--color-ui-white)] cursor-pointer'
                        )}
                    >
                        {t(`bank.drawer.${PRESET_KEY[preset]}`)}
                    </button>
                );
            })}
        </div>
        {count > 1 && (
            <input
                type="range"
                data-item-use-slider
                aria-label={t('bank.drawer.useAmount')}
                min={1}
                max={count}
                step={1}
                value={amount}
                onChange={(e) => onAmount(Math.max(1, Math.min(count, Math.floor(Number(e.target.value) || 1))))}
                className="ui-range w-full"
            />
        )}
    </div>
);

/** What a Use gave, in words: "7 Wheat Seed, 2 Oak Seedling and 4 more", at most three named. */
function gotText(paid) {
    const named = paid.slice(0, 3).map(({ itemId, quantity }) => `${quantity.toLocaleString('en-US')} ${getItem(itemId)?.name || itemId}`);
    const list = named.join(', ');
    return paid.length > 3 ? t('bank.drawer.usedMore', { list, more: (paid.length - 3).toLocaleString('en-US') }) : list;
}

/**
 * The last Use's result, small, under the actions: what it gave, and what the Bank had no room
 * for, which waits on the mat as loot (the Bank Full banner says so too).
 * @param {{ result: { itemId: string, used: number, paid: object[], waiting: object[] } }} props
 */
export const ItemUseResult = ({ result }) => {
    const item = getItem(result.itemId)?.name || result.itemId;
    const count = result.used.toLocaleString('en-US');
    return (
        <div data-item-use-result={result.itemId} className="flex flex-col gap-0.5 ui-text-small leading-snug">
            <p className="text-white/85">
                {result.paid.length
                    ? t('bank.drawer.used', { count, item, got: gotText(result.paid) })
                    : t('bank.drawer.usedNothing', { count, item })}
            </p>
            {result.waiting.length > 0 && (
                <p data-item-use-waiting className="text-amber-200">
                    {t('bank.drawer.usedWaiting', { count: result.waiting.length })}
                </p>
            )}
        </div>
    );
};
