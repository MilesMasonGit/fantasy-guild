import { Flag, Swords } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { COMBAT_FLAG } from '../../../systems/board/Flags.js';

/**
 * A flag's pennant mark (Free Playmat slice 1.5, FPP-15): a gold lucide `Flag`
 * with the flag's skill in a small disc at its foot — crossed swords for a
 * combat flag. **Grey when idle** (FP-29); the "…" chip is the caller's.
 *
 * Drawn by the board's `FlagLayer` and by the drag ghost, so a pennant in the
 * hand looks like the one on the mat.
 */
export const FlagMark = ({ skill, size = 24, idle = false, className }) => {
    const disc = Math.round(size * 0.62);
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
            {skill && (
                <span
                    data-flag-skill={skill}
                    className={cn(
                        'absolute flex items-center justify-center rounded-full bg-black/85 border',
                        idle ? 'border-stone-500/60 grayscale opacity-80' : 'border-gi-gold/60'
                    )}
                    style={{ width: disc, height: disc, right: -Math.round(disc * 0.45), bottom: -Math.round(disc * 0.3) }}
                >
                    {skill === COMBAT_FLAG
                        ? <Swords size={Math.round(disc * 0.7)} className={idle ? 'text-stone-300' : 'text-red-300'} />
                        : <SkillIcon skill={skill} size={Math.round(disc * 0.8)} />}
                </span>
            )}
        </span>
    );
};

export default FlagMark;
