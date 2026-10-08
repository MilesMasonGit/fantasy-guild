import { useRef, useState } from 'react';
import { BubbleTip } from './Bubble.jsx';
import { HEALTH_BAR_H_U, HP_COLOUR, healthFraction, healthText } from './healthBar.js';

/**
 * HealthBar: a thin bar over a fighter, full when healthy and emptying toward the right. The
 * exact number (`34/50`) shows in a tooltip while the bar is hovered. `style` places it
 * (`left`/`top`/`width`) inside whatever it hangs from; `dragProps` (a Token's drag handle)
 * makes pressing it grab the Token like pressing its art.
 * `who` is `enemy` or `hero`, `of` the Token's or hero's id.
 */
export const HealthBar = ({ who, of = null, cur, max, style, dragProps = null }) => {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    const text = healthText(cur, max);
    const fraction = healthFraction(cur, max);
    return (
        <div
            ref={ref}
            data-health-bar={who}
            data-health-of={of || undefined}
            data-health-fraction={fraction.toFixed(3)}
            data-health-text={text}
            {...dragProps}
            onPointerDown={(e) => { setOpen(false); dragProps?.onPointerDown?.(e); }}
            onPointerEnter={() => setOpen(true)}
            onPointerLeave={() => setOpen(false)}
            className="absolute z-20 pointer-events-auto select-none flex items-center"
            style={{ height: HEALTH_BAR_H_U + 6, ...style }}
        >
            <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: HEALTH_BAR_H_U, background: 'rgba(0,0,0,0.65)', boxShadow: '0 0 0 1px rgba(0,0,0,0.85)' }}
            >
                <div
                    style={{
                        width: `${fraction * 100}%`,
                        height: '100%',
                        background: HP_COLOUR,
                        transition: 'width 0.3s ease-out'
                    }}
                />
            </div>
            {open && <BubbleTip anchor={ref.current} text={text} />}
        </div>
    );
};

export default HealthBar;
