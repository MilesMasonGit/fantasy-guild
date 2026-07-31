import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * CardPips — the binder's copy indicator (D-45).
 *
 * One pip per copy the card can ever have, in three states:
 *
 *   ○ empty     not collected
 *   ● full      collected and free to slot
 *   ⬤ coloured  collected and currently in the deck
 *
 * One control answering the three questions copy-limited slotting (D-9) makes
 * a player ask constantly: how far through this area's collection am I, how
 * many copies do I own, and how many are still free to place.
 *
 * The pip COUNT is the card's own maximum (D-49), so a unique Boost shows a
 * single pip rather than one filled and three permanently empty — the row is
 * deliberately variable-width, and reads as "this is a one-of".
 */
export const CardPips = ({ owned = 0, deployed = 0, max = 4, size = 'md', className }) => {
    if (max < 1) return null;

    const px = size === 'sm' ? 5 : 7;
    const gap = size === 'sm' ? 'gap-[3px]' : 'gap-1';

    // Deployed copies fill first so the coloured pips group together and the
    // free ones read as "spare" on the right.
    const pips = Array.from({ length: max }, (_, i) => {
        if (i < deployed) return 'deployed';
        if (i < owned) return 'owned';
        return 'empty';
    });

    const title = `${owned} of ${max} collected${deployed ? ` · ${deployed} in deck` : ''}`;

    return (
        <div className={cn('flex items-center justify-center', gap, className)} title={title}>
            {pips.map((state, i) => (
                <span
                    key={i}
                    style={{ width: px, height: px }}
                    className={cn(
                        'rounded-full border transition-colors',
                        state === 'deployed' && 'bg-gi-primary border-gi-primary shadow-[0_0_4px_var(--color-gi-primary,#22d3ee)]',
                        state === 'owned' && 'bg-white/85 border-white/85',
                        state === 'empty' && 'bg-transparent border-white/30'
                    )}
                />
            ))}
        </div>
    );
};

export default CardPips;
