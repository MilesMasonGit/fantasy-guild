import { HEALTH_BAR_H_U, HP_COLOUR, healthFraction, healthText } from './healthBar.js';

/**
 * HealthBar: a bar over a fighter, full when healthy and emptying toward the right, with the
 * exact number (`34/50`) drawn on it. `style` places it
 * (`left`/`top`/`width`) inside whatever it hangs from; `dragProps` (a Token's drag handle)
 * makes pressing it grab the Token like pressing its art.
 * `who` is `enemy` or `hero`, `of` the Token's or hero's id.
 */
export const HealthBar = ({ who, of = null, cur, max, style, dragProps = null }) => {
    const text = healthText(cur, max);
    const fraction = healthFraction(cur, max);
    return (
        <div
            data-health-bar={who}
            data-health-of={of || undefined}
            data-health-fraction={fraction.toFixed(3)}
            data-health-text={text}
            {...dragProps}
            className="absolute z-20 pointer-events-auto select-none flex items-center"
            style={{ height: HEALTH_BAR_H_U, ...style }}
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
            <span
                data-health-label
                className="absolute inset-0 flex items-center justify-center whitespace-nowrap font-bold leading-none"
                style={{ fontSize: HEALTH_BAR_H_U - 2, color: '#fff', textShadow: '0 0 2px #000, 0 0 2px #000, 0 0 3px #000' }}
            >
                {text}
            </span>
        </div>
    );
};

export default HealthBar;
