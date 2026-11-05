import { HP_BAR_LOOK, useHpBarLook } from './hpBarLook.js';
import { hpPercent, hpTone } from '../dock/dockHeroView.js';
import { SPEECH_FILL } from '../board/speechTone.js';

/** Each tone's fill and the one-art-pixel lighter and darker rows along its top and foot. */
const TONE_FILL = Object.freeze({
    green: { fill: '#3fa34d', light: '#7fd36b', dark: '#256b33' },
    amber: { fill: '#d9962b', light: '#f2c14e', dark: '#9a6618' },
    red: { fill: '#c8322b', light: '#ee6a55', dark: '#8a1f1b' }
});

const EDGE = { [HP_BAR_LOOK.PLATE]: '#000', [HP_BAR_LOOK.TICKS]: '#000', [HP_BAR_LOOK.HEART]: 'var(--color-ui-frame)' };

/** One art pixel off each corner, so the bar has the frames' stepped corners and no rounding. */
const STEPPED = 'polygon(2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px), 0 2px, 2px 2px)';

/** A hard outline, so the numbers read over any fill and over the empty trough. */
const NUMBER_EDGE = '1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000';

const HEART_ROWS = ['.BBB.BBB.', 'BRRRBRRRB', 'BRWRRRRRB', 'BRRRRRRRB', '.BRRRRRB.', '..BRRRB..', '...BRB...', '....B....'];
const HEART_FILL = { B: '#000', R: '#dc2626', W: '#fecaca' };
const HEART_PX = { w: HEART_ROWS[0].length * 2, h: HEART_ROWS.length * 2 };

const PixelHeart = () => (
    <svg
        aria-hidden="true"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
        width={HEART_PX.w}
        height={HEART_PX.h}
        viewBox={`0 0 ${HEART_ROWS[0].length} ${HEART_ROWS.length}`}
        shapeRendering="crispEdges"
    >
        {HEART_ROWS.flatMap((row, y) => [...row].map((c, x) => (
            HEART_FILL[c] ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={HEART_FILL[c]} /> : null
        )))}
    </svg>
);

/**
 * VitalBar: a hero's HP on the hero bar and the sheet (UI_STYLE "Numbers"), the numbers over a
 * stepped pixel bar. Heroes only: fighters on the mat have their own thin bar.
 * @param {number} value     current value, already rounded by the caller
 * @param {number} max       maximum; guarded against 0 so the bar can't divide by zero
 * @param {number} height    in screen px
 * @param {string} textClass the kit's text size for the numbers
 * Other props go on the outer box.
 */
export const VitalBar = ({ value, max, height = 16, textClass = 'ui-text-small', look: lookProp, style, ...rest }) => {
    const chosen = useHpBarLook();
    const look = lookProp || chosen;
    const pct = hpPercent({ current: value, max });
    const tone = TONE_FILL[hpTone(pct)];
    const heart = look === HP_BAR_LOOK.HEART;
    return (
        <div {...rest} data-hp-look={look} className="relative" style={{ height, ...style }}>
            {heart && <PixelHeart />}
            <div
                className="absolute inset-y-0 right-0"
                style={{ left: heart ? HEART_PX.w / 2 : 0, background: EDGE[look], clipPath: STEPPED }}
            >
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
                    {look === HP_BAR_LOOK.TICKS && (
                        <div
                            aria-hidden="true"
                            className="absolute inset-0"
                            style={{ background: `repeating-linear-gradient(90deg, transparent 0, transparent calc(10% - 2px), ${SPEECH_FILL} calc(10% - 2px), ${SPEECH_FILL} 10%)` }}
                        />
                    )}
                </div>
            </div>
            <span
                data-hp-numbers
                className={`absolute inset-0 flex items-center justify-center font-bold leading-none tabular-nums text-white ${textClass}`}
                style={{ textShadow: NUMBER_EDGE, paddingLeft: heart ? HEART_PX.w / 2 : 0 }}
            >
                {`${value.toLocaleString('en-US')}/${max.toLocaleString('en-US')}`}
            </span>
        </div>
    );
};

export default VitalBar;
