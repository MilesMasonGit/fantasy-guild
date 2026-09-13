import { cn } from '../../utils/cn.js';

/**
 * What a promotion would do to a hero, rendered once.
 *
 * Ported from the unmerged `promotion-tokens` branch (Promotes rule P4).
 *
 * ## Why this is its own component
 * Two screens ask the same question. The **Change Job** screen browses the
 * whole tree and previews whichever job you point at; the **ceremony** on a
 * Token with a Promotes rule asks about exactly one, after the training is
 * done. Both have to say "you give up Fishing 23, you gain Leadership 1" and
 * mean identically the same thing by it — a trade display that existed twice
 * would eventually disagree with itself about what a promotion costs.
 *
 * Everything here comes from `PromotionSystem.previewPromotion`, the single
 * source of the numbers. This only draws them.
 *
 * ## "Set aside", not "lost" (D-71)
 * The wording is load-bearing. A removed skill goes dormant **at its level**
 * and returns intact if a later job wants it, so calling it a loss would
 * misdescribe the one property that makes promotion safe to engage with. A
 * skill arriving *back* from the bank says so, because "Cooking 30" appearing
 * from nowhere otherwise reads as a bug.
 */
export const PromotionTrade = ({ preview, size = 'sm' }) => {
    if (!preview) return null;

    const big = size === 'lg';

    return (
        <div className={cn('flex flex-col', big ? 'gap-3' : 'gap-2')} data-promotion-trade>
            <TradeList
                title="Sets aside"
                tone="loss"
                size={size}
                rows={preview.losing.map(l => `${l.name} ${l.level}`)}
                empty="nothing — this hero keeps everything they have"
            />
            <TradeList
                title="Takes up"
                tone="gain"
                size={size}
                rows={preview.arriving.map(a =>
                    `${a.name} ${a.level}${a.restored ? ' — back from set aside' : ''}`
                )}
                empty="nothing new"
            />
            {preview.cost?.skillLevel != null && (
                <span className={cn('text-gi-muted/70', big ? 'text-[11px]' : 'text-[9px]')}>
                    Requires the skills it carries forward at level {preview.cost.skillLevel}.
                </span>
            )}
            {!preview.ok && preview.detail && (
                <span className={cn('text-gi-danger', big ? 'text-[11px]' : 'text-[9px]')}>
                    {preview.detail}
                </span>
            )}
        </div>
    );
};

/**
 * One side of the trade.
 *
 * `empty` is a sentence rather than a dash. "nothing" in the Sets aside column
 * is genuinely good news — the hero loses nothing at all — and a bare dash
 * reads as missing data instead of as an answer.
 */
const TradeList = ({ title, tone, rows, empty, size }) => {
    const big = size === 'lg';
    return (
        <div className="flex flex-col gap-0.5">
            <span className={cn(
                'gi-caps tracking-wider text-gi-muted/60',
                big ? 'text-[10px]' : 'text-[9px]'
            )}>
                {title}
            </span>
            {rows.length === 0
                ? <span className={cn('text-gi-muted/50 italic', big ? 'text-[11px]' : 'text-[10px]')}>{empty}</span>
                : rows.map(r => (
                    <span
                        key={r}
                        className={cn(
                            big ? 'text-[13px]' : 'text-[10px]',
                            tone === 'loss' ? 'text-gi-danger/80' : 'text-gi-text'
                        )}
                    >
                        {tone === 'loss' ? '−' : '+'} {r}
                    </span>
                ))}
        </div>
    );
};

export default PromotionTrade;
