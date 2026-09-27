import { RING_D_U, RING_COLOUR, RING_GREY } from './ringRow.js';

/**
 * RingBadge — one ring of a Token's ring row (TL-22, B1.2): a faint track, an
 * arc that fills or empties, the number inside, on its own small dark disc
 * (the owner picked bare rings — no tray behind the row).
 *
 * Drawn in a 28 × 28 viewBox scaled to {@link RING_D_U} mat units, so the
 * stroke is 3/28 of the diameter at any size.
 *
 * ## Two ways to drive it
 * * **Controlled** — pass `fraction` (0–1) and `text`; React draws them. The
 *   charges and HP rings, which change a few times a second at most.
 * * **Imperative** — leave `fraction` undefined and paint it with
 *   {@link paintRing} through `rootRef`. The cycle ring, which moves every
 *   animation frame and must not re-render React to do it (CR2-168). React
 *   sets the empty arc once at mount and never touches it again, because the
 *   props it compares do not change.
 *
 * `greyed` draws the arc grey and hides the number: a worked Token that is
 * blocked (its problem is the centre mark, B1.1).
 */

const VIEW = 28;
const STROKE = 3;
const R = (VIEW - STROKE) / 2;
/** The arc's full length, for `stroke-dasharray`. */
export const RING_CIRCUMFERENCE = 2 * Math.PI * R;

const dash = (fraction) => {
    const f = Math.max(0, Math.min(1, Number(fraction) || 0));
    return `${(f * RING_CIRCUMFERENCE).toFixed(3)} ${RING_CIRCUMFERENCE.toFixed(3)}`;
};

/** How big the number is, by how many characters it has. */
const fontFor = (text) => {
    const n = String(text ?? '').length;
    if (n <= 2) return 15;
    if (n === 3) return 12.5;
    return 10.5;
};

/**
 * Paint an imperative ring (`fraction` left undefined) without React.
 * Writes only what changed.
 */
export function paintRing(root, fraction, text) {
    if (!root) return;
    const arc = root.querySelector('[data-ring-arc]');
    const f = Math.max(0, Math.min(1, Number(fraction) || 0));
    if (arc) arc.setAttribute('stroke-dasharray', dash(f));
    root.setAttribute('data-ring-fraction', f.toFixed(3));
    if (text != null) {
        const t = String(text);
        if (root.getAttribute('data-ring-text') !== t) {
            root.setAttribute('data-ring-text', t);
            const span = root.querySelector('[data-ring-label]');
            if (span) {
                span.textContent = t;
                span.style.fontSize = `${fontFor(t)}px`;
            }
        }
    }
}

export const RingBadge = ({ kind, fraction, text, greyed = false, title, rootRef, children }) => {
    const colour = RING_COLOUR[kind] || RING_COLOUR.cycle;
    const controlled = fraction !== undefined;
    const shown = controlled ? (text ?? '') : '';
    return (
        <div
            ref={rootRef}
            data-ring={kind}
            data-ring-text={shown}
            data-ring-fraction={controlled ? Math.max(0, Math.min(1, Number(fraction) || 0)).toFixed(3) : '0.000'}
            data-ring-greyed={greyed ? 'true' : undefined}
            aria-label={title}
            className="relative shrink-0 select-none pointer-events-none"
            style={{ width: RING_D_U, height: RING_D_U }}
        >
            <svg
                viewBox={`0 0 ${VIEW} ${VIEW}`}
                width={RING_D_U}
                height={RING_D_U}
                className="absolute inset-0"
                aria-hidden="true"
            >
                {/* The ring's own dark backing. */}
                <circle cx={VIEW / 2} cy={VIEW / 2} r={VIEW / 2} fill="rgba(10,8,6,0.82)" />
                {/* The track. */}
                <circle cx={VIEW / 2} cy={VIEW / 2} r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={STROKE} />
                {/* The arc, from twelve o'clock, clockwise. */}
                <circle
                    data-ring-arc="true"
                    cx={VIEW / 2}
                    cy={VIEW / 2}
                    r={R}
                    fill="none"
                    stroke={greyed ? RING_GREY : colour}
                    strokeWidth={STROKE}
                    strokeLinecap="butt"
                    strokeDasharray={dash(controlled ? fraction : 0)}
                    transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
                />
            </svg>
            <span
                data-ring-label="true"
                className="absolute inset-0 flex items-center justify-center font-mono font-bold tabular-nums leading-none tracking-tight"
                style={{
                    color: colour,
                    fontSize: fontFor(shown),
                    visibility: greyed ? 'hidden' : 'visible',
                    textShadow: '0 1px 2px #000, 0 0 3px #000, 0 0 1px #000'
                }}
            >
                {controlled ? shown : null}
            </span>
            {children}
        </div>
    );
};

export default RingBadge;
