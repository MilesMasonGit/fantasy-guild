import { MAT_BAR, healthFraction, healthFillPx, matHealthText } from './healthBar.js';
import { TONE_FILL } from '../base/VitalBar.jsx';
import { hpTone } from '../dock/dockHeroView.js';
import { SPEECH_FILL } from './speechTone.js';

/** The frames' stepped corners, `s` mat units a step. */
const stepped = (s) => `polygon(${s}px 0, calc(100% - ${s}px) 0, calc(100% - ${s}px) ${s}px, 100% ${s}px, 100% calc(100% - ${s}px), calc(100% - ${s}px) calc(100% - ${s}px), calc(100% - ${s}px) 100%, ${s}px 100%, ${s}px calc(100% - ${s}px), 0 calc(100% - ${s}px), 0 ${s}px, ${s}px ${s}px)`;

/**
 * HealthBar: a fighter's health on the mat, a small edition of the hero bar's `VitalBar` (owner's
 * pick, 2026-11-05): the fill in the hero bar's tones on a stepped black edge, `19/24` written on
 * it. The fill steps in whole art pixels and never animates, so a bar redraws only when its number
 * moves. `style` places the bar (`left`/`top`/`width`) inside whatever it hangs from; `u` is mat
 * units a plate pixel (`workPlate.plateUnit`). `outward` is the side the number may grow to when
 * it is wider than the bar (-1 left, 1 right, 0 both): away from the other fighter. `dragProps`
 * (a Token's drag handle) makes pressing it grab the Token like its art. `who` is `enemy` or
 * `hero`, `of` the Token's or hero's id.
 */
export const HealthBar = ({ who, of = null, cur, max, style, u = 1, outward = 0, dragProps = null }) => {
    const text = matHealthText(cur, max);
    const fraction = healthFraction(cur, max);
    // The inside's width in plate pixels: the fill steps in whole art pixels of it.
    const wide = (Number.isFinite(style?.width) && u > 0 ? Math.round(style.width / u) : MAT_BAR.W) - 2 * MAT_BAR.EDGE;
    const tone = TONE_FILL[hpTone(Math.round(fraction * 100))];
    const e = MAT_BAR.EDGE * u;
    return (
        <div
            data-health-bar={who}
            data-health-of={of || undefined}
            data-health-fraction={fraction.toFixed(3)}
            data-health-text={text}
            {...dragProps}
            className="absolute z-20 pointer-events-auto select-none"
            style={{ height: MAT_BAR.H * u, ...style }}
        >
            <div className="absolute inset-0" style={{ background: '#000', clipPath: stepped(e) }}>
                <div className="absolute overflow-hidden" style={{ inset: e, background: SPEECH_FILL }}>
                    <div
                        data-health-fill
                        className="absolute left-0 top-0 bottom-0"
                        style={{
                            width: healthFillPx(cur, max, wide) * u,
                            background: tone.fill,
                            boxShadow: `inset 0 ${e}px 0 ${tone.light}, inset 0 -${e}px 0 ${tone.dark}`
                        }}
                    />
                </div>
            </div>
            <span
                data-health-label
                className="absolute left-0 right-0 top-0 bottom-0 flex items-center whitespace-nowrap font-bold leading-none tabular-nums text-white"
                style={{
                    // Centred while it fits; wider than the bar, it grows outward only.
                    justifyContent: 'safe center',
                    flexDirection: outward < 0 ? 'row-reverse' : 'row',
                    fontSize: `calc(var(--font-size-xxs, 14px) * ${u})`
                }}
            >
                {text}
            </span>
        </div>
    );
};
