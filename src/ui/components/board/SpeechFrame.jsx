import { cn } from '../../utils/cn.js';
import { SPEECH_TONE, SPEECH_LINE, SPEECH_FILL } from './speechTone.js';

/** The frame's edition per tone (`tailwind.css`). */
const TONE_CLASS = Object.freeze({
    [SPEECH_TONE.PLAIN]: '',
    [SPEECH_TONE.ATTENTION]: ' ui-frame-chamfer-gold',
    [SPEECH_TONE.CANT]: ' ui-frame-chamfer-red'
});

/** The tail in frame pixels: 7 across where it leaves the frame's foot, 4 down to its point. */
const TAIL_W = 7;
const TAIL_H = 4;
/** Its hard shadow, like the frame's: 2 frame pixels down-right. */
const TAIL_SHADOW = 2;

/** How far the tail (and its shadow) hangs below the frame's foot, in the units `u` is in. */
export const speechTailDrop = (u = 1) => ((TAIL_H + TAIL_SHADOW) * 2 - 2) * u;

const px = (x, y, w = 1) => `M${x} ${y}h${w}v1h-${w}z`;

/**
 * The tail as a picture, its first row laid over the frame's foot line so the bubble opens into
 * it: a stepped point, one frame pixel a step, with its black shadow behind.
 */
const tailUri = (tone) => {
    const line = (SPEECH_LINE[tone] || SPEECH_LINE[SPEECH_TONE.PLAIN]).replace('#', '%23');
    const rows = [[0, 7], [1, 5], [2, 3], [3, 1]];
    const shadow = rows.map(([x, w], y) => px(x + TAIL_SHADOW, y + TAIL_SHADOW, w)).join('');
    const edge = rows.map(([x, w], y) => (w === 1 ? px(x, y) : px(x, y) + px(x + w - 1, y))).join('');
    const fill = rows.filter(([, w]) => w > 2).map(([x, w], y) => px(x + 1, y, w - 2)).join('');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TAIL_W + TAIL_SHADOW}' height='${TAIL_H + TAIL_SHADOW}' shape-rendering='crispEdges'>`
        + `<path fill='%23000' d='${shadow}'/><path fill='${line}' d='${edge}'/><path fill='${SPEECH_FILL.replace('#', '%23')}' d='${fill}'/></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
};
const TAIL_URI = Object.freeze(Object.fromEntries(Object.values(SPEECH_TONE).map(t => [t, tailUri(t)])));

/** How far from the frame's sides the tail's middle may go: past the chamfered corner. */
export const tailInset = (u = 1) => (3 + TAIL_W / 2) * 2 * u;

/**
 * One line of speech in the pixel family, beside the work plate: the chamfer frame with its hard
 * shadow, in its bronze, or gold (`ATTENTION`) or red (`CANT`), and with `tail` a stepped pixel
 * point under it at `tailLeft` (a CSS length from the frame's left). `u` is one screen pixel in
 * the units it is drawn in (`plateUnit` on the mat, 1 off it), so the frame's art pixels land on
 * whole screen pixels. Props, `className` and `style` go on the outer box; the text sits inside
 * the band.
 */
export function SpeechFrame({ tone = SPEECH_TONE.PLAIN, u = 1, tail = false, tailLeft = '50%', className, style, children, ...rest }) {
    const band = 6 * u;
    const frame = { borderWidth: band, borderImageWidth: `${band}px` };
    const art = 2 * u;
    return (
        <div
            data-speech-tone={tone}
            {...rest}
            className={cn('relative text-white', className)}
            style={{ padding: `${band}px ${band + art}px`, ...style }}
        >
            <span
                aria-hidden="true"
                className="ui-frame-shadow-chamfer absolute inset-0 pointer-events-none"
                style={{ ...frame, transform: `translate(${4 * u}px, ${4 * u}px)` }}
            />
            <span
                aria-hidden="true"
                className={`ui-frame-chamfer${TONE_CLASS[tone] || ''} absolute inset-0 pointer-events-none`}
                style={frame}
            />
            <span className="relative">{children}</span>
            {tail && (
                <span
                    aria-hidden="true"
                    data-speech-tail
                    className="absolute pointer-events-none"
                    style={{
                        left: tailLeft,
                        top: `calc(100% - ${art}px)`,
                        width: (TAIL_W + TAIL_SHADOW) * art,
                        height: (TAIL_H + TAIL_SHADOW) * art,
                        marginLeft: -(TAIL_W / 2) * art,
                        backgroundImage: TAIL_URI[tone] || TAIL_URI[SPEECH_TONE.PLAIN],
                        backgroundSize: '100% 100%',
                        imageRendering: 'pixelated'
                    }}
                />
            )}
        </div>
    );
}

export default SpeechFrame;
