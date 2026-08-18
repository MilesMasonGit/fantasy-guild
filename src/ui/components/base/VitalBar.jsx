import { cn } from '../../utils/cn.js';

/**
 * VitalBar — a labelled HP/Energy bar with the raw number beside it.
 *
 * Rescued from the deleted `banner/bannerCards.jsx` in the 7×7 playmat rework
 * (Phase 1). It is generic and the Hero Dock — a survivor — is its only
 * remaining consumer, so it belongs in `base/` rather than in a feature folder.
 *
 * @param {string} label     short tag, e.g. "HP"
 * @param {number} value     current value, already rounded by the caller
 * @param {number} max       maximum; guarded against 0 so the bar can't divide by zero
 * @param {string} barClass  fill colour class
 */
export const VitalBar = ({ label, value, max, barClass }) => (
    <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-gi-muted w-5">{label}</span>
        <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div
                className={cn('h-full transition-all duration-300', barClass)}
                style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }}
            />
        </div>
        <span className="text-[9px] text-gi-muted tabular-nums">{value}</span>
    </div>
);

export default VitalBar;
