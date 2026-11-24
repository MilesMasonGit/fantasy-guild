import { hpPercent } from '../dock/dockHeroView.js';
import { SPEECH_FILL } from '../board/speechTone.js';
import { hpToneName, healthFraction, HP_TONES } from '../board/healthBar.js';

/** One art pixel off each corner, so the bar has the frames' stepped corners and no rounding. */
export const STEPPED = 'polygon(2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px), 0 2px, 2px 2px)';

/**
 * VitalBar: HP on the hero bar, the sheet, the fight window and its tabs (UI_STYLE "Numbers"), the
 * numbers over a stepped pixel bar, green, amber or red by health (`hpToneName`). Fighters on the
 * mat have their own small bar (`HealthBar`).
 * @param {number} value     current value, already rounded by the caller
 * @param {number} max       maximum; guarded against 0 so the bar can't divide by zero
 * @param {number} height    in screen px
 * @param {string} textClass the kit's text size for the numbers
 * Other props go on the outer box.
 */
export const VitalBar = ({ value, max, height = 16, textClass = 'ui-text-small', style, ...rest }) => {
    const pct = hpPercent({ current: value, max });
    const toneName = hpToneName(healthFraction(value, max));
    const tone = HP_TONES[toneName];
    return (
        <div {...rest} data-hp-tone={toneName} className="relative" style={{ height, ...style }}>
            <div className="absolute inset-0" style={{ background: '#000', clipPath: STEPPED }}>
                <div className="absolute overflow-hidden" style={{ inset: 2, background: SPEECH_FILL }}>
                    <div
                        data-hp-fill
                        className="h-full transition-[width] duration-300"
                        style={{
                            width: `${pct}%`,
                            background: tone.fill,
                            boxShadow: `inset 0 2px 0 ${tone.light}, inset 0 -2px 0 ${tone.dark}`
                        }}
                    />
                </div>
            </div>
            <span
                data-hp-numbers
                className={`absolute inset-0 flex items-center justify-center font-bold leading-none tabular-nums text-white ${textClass}`}
            >
                {`${value.toLocaleString('en-US')}/${max.toLocaleString('en-US')}`}
            </span>
        </div>
    );
};
