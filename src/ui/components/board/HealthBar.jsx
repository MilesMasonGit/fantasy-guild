import { HP_BAR, HP_COLOUR, HP_TRACK, HP_EDGE, healthFraction, healthFillPx, healthText } from './healthBar.js';

/** A hard outline of `e` units around text: eight unblurred copies, no soft shadow. */
const edge = (e) => [[e, 0], [-e, 0], [0, e], [0, -e], [e, e], [-e, e], [e, -e], [-e, -e]]
    .map(([x, y]) => `${x}px ${y}px 0 #000`).join(', ');

/**
 * HealthBar: a thin bar over a fighter with the number and the percentage written above it,
 * `17 · 57%` (owner, 2026-10-25). The fill empties toward the right in whole art pixels. `style`
 * places the bar (`left`/`top`/`width`) inside whatever it hangs from; `u` is mat units a plate
 * pixel (`workPlate.plateUnit`). `outward` is the side the number may grow to when it is wider
 * than the bar (-1 left, 1 right, 0 both): away from the other fighter, so two fighters' numbers
 * never meet. `dragProps` (a Token's drag handle) makes pressing it grab the Token like its art.
 * `who` is `enemy` or `hero`, `of` the Token's or hero's id.
 */
export const HealthBar = ({ who, of = null, cur, max, style, u = 1, outward = 0, dragProps = null }) => {
    const text = healthText(cur, max);
    const fraction = healthFraction(cur, max);
    // The bar's width in plate pixels: the fill steps in whole art pixels of it.
    const wide = Number.isFinite(style?.width) && u > 0 ? Math.round(style.width / u) : HP_BAR.W;
    return (
        <div
            data-health-bar={who}
            data-health-of={of || undefined}
            data-health-fraction={fraction.toFixed(3)}
            data-health-text={text}
            {...dragProps}
            className="absolute z-20 pointer-events-auto select-none"
            style={{ height: HP_BAR.H * u, ...style }}
        >
            <span
                data-health-label
                className="absolute left-0 right-0 flex whitespace-nowrap font-bold leading-none tabular-nums text-white"
                style={{
                    bottom: `calc(100% + ${(HP_BAR.LABEL_GAP + HP_BAR.EDGE) * u}px)`,
                    // Centred while it fits; wider than the bar, it grows outward only.
                    justifyContent: 'safe center',
                    flexDirection: outward < 0 ? 'row-reverse' : 'row',
                    fontSize: `calc(var(--font-size-xxs, 14px) * ${u})`,
                    textShadow: edge(HP_BAR.EDGE * u)
                }}
            >
                {text}
            </span>
            <div
                className="absolute inset-0"
                style={{ background: HP_TRACK, boxShadow: `0 0 0 ${HP_BAR.EDGE * u}px ${HP_EDGE}` }}
            >
                <div
                    data-health-fill
                    className="absolute left-0 top-0 bottom-0"
                    style={{ width: healthFillPx(cur, max, wide) * u, background: HP_COLOUR }}
                />
            </div>
        </div>
    );
};

export default HealthBar;
