import { cn } from '../../utils/cn.js';

/**
 * VitalBar: the hero panel's HP bar, its numbers beside it (UI_STYLE "Numbers": in the hero
 * panel the bar shows its numbers).
 * @param {number} value     current value, already rounded by the caller
 * @param {number} max       maximum; guarded against 0 so the bar can't divide by zero
 * @param {string} barClass  fill colour class
 */
export const VitalBar = ({ value, max, barClass }) => {
    const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
    return (
        <div className="flex items-center gap-2">
            <div data-hero-panel-hp className="h-1.5 flex-1 bg-black/60 rounded-full overflow-hidden">
                <div className={cn('h-full transition-all duration-300', barClass)} style={{ width: `${pct}%` }} />
            </div>
            <span data-hero-panel-hp-text className="shrink-0 text-(length:--font-size-sm) tabular-nums text-white/80">
                {`${value.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`}
            </span>
        </div>
    );
};

/** The bar's fill colour for a share of the maximum: green, amber below half, red below a fifth. */
export const vitalTone = (value, max) => {
    const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
    return pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';
};

export default VitalBar;
