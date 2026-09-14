import { Flag } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * A flag's pennant mark (Free Playmat slice 1.5, FPP-15): a gold lucide `Flag`.
 * **Grey when idle** (FP-29); the "…" chip is the caller's. A flag has no skill
 * since slice 1.5b (FP-71), so there is no skill disc; slice 1.5b-ii replaces
 * this with the owner's flag sprites (FP-77).
 *
 * Drawn by the board's `FlagLayer` and by the drag ghost, so a pennant in the
 * hand looks like the one on the mat.
 */
export const FlagMark = ({ size = 24, idle = false, className }) => {
    return (
        <span
            className={cn('relative inline-block pointer-events-none select-none', className)}
            style={{ width: size, height: size }}
        >
            <Flag
                size={size}
                strokeWidth={2.4}
                className={cn(
                    'absolute left-0 top-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]',
                    idle ? 'text-stone-400' : 'text-gi-gold'
                )}
                fill={idle ? 'rgba(120, 113, 108, 0.55)' : 'rgba(251, 191, 36, 0.45)'}
            />
        </span>
    );
};

export default FlagMark;
