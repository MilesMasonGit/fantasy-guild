import { STEPPED } from './VitalBar.jsx';
import { SPEECH_FILL } from '../board/speechTone.js';

/** One art pixel at the UI's 2×. */
const ART = 2;

/** The gold fill and its one-art-pixel lighter top and darker foot, as the hero bar's tones. */
const GOLD = Object.freeze({ fill: '#fbbf24', light: '#fde68a', dark: '#b7791f' });

/**
 * How many screen pixels of a `width` px bar's inside are filled for `value` of `max`: whole art
 * pixels, at least one for anything above nothing, and the whole inside only when `value` reaches
 * `max` (144 of 145 never looks full).
 */
export function progressFillPx(value, max, width) {
    const inner = Math.max(0, width - 2 * ART);
    const v = Math.max(0, Number(value) || 0);
    const m = Math.max(0, Number(max) || 0);
    if (m === 0 || v === 0) return 0;
    if (v >= m) return inner;
    const steps = inner / ART;
    const filled = Math.min(steps - 1, Math.max(1, Math.round((v / m) * steps)));
    return filled * ART;
}

/**
 * ProgressBar: how much of something is done, as a hard-pixel bar: the hero bar's stepped black
 * edge and dark trough, a gold fill in whole art pixels. No numbers on it: the caller writes them.
 * @param {number} value
 * @param {number} max
 * @param {number} width   in screen px, so the fill lands on whole art pixels
 * @param {number} height  in screen px
 * Other props go on the outer box.
 */
export const ProgressBar = ({ value, max, width, height = 10, style, ...rest }) => (
    <div {...rest} className="relative shrink-0" style={{ width, height, ...style }}>
        <div className="absolute inset-0" style={{ background: '#000', clipPath: STEPPED }}>
            <div className="absolute overflow-hidden" style={{ inset: ART, background: SPEECH_FILL }}>
                <div
                    data-progress-fill
                    className="h-full"
                    style={{
                        width: progressFillPx(value, max, width),
                        background: GOLD.fill,
                        boxShadow: `inset 0 ${ART}px 0 ${GOLD.light}, inset 0 -${ART}px 0 ${GOLD.dark}`
                    }}
                />
            </div>
        </div>
    </div>
);
