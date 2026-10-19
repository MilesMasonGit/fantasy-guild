import { formatCompact } from '../../../utils/Formatters.js';

/** A stub's colour: green for a net gain, red for a net loss, the normal text colour for even. */
export function toneOf(net) {
    if (net > 0) return 'gain';
    if (net < 0) return 'loss';
    return 'even';
}

export const TONE_COLOUR = Object.freeze({
    gain: 'var(--color-ui-green)',
    loss: 'var(--color-ui-red)',
    even: 'inherit'
});

/** "+12", "-4", "0"; thousands compacted ("+1.2K"). */
export function signedAmount(n) {
    const v = Math.round(Number(n) || 0);
    if (v === 0) return '0';
    const body = Math.abs(v) < 1000 ? Math.abs(v).toLocaleString('en-US') : formatCompact(Math.abs(v), 1);
    return `${v > 0 ? '+' : '-'}${body}`;
}

/** "+80 / hr". */
export function rateText(perHour) {
    return `${signedAmount(perHour)} / hr`;
}
