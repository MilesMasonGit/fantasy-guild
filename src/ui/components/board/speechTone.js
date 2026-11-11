/**
 * The speech family's tones (UI_STYLE "Colours"): the frames' bronze for a plain line, gold for
 * one asking to be looked at, red for a "can't". `LIMES` is Limes's own voice and nobody else's: a
 * green line on a lime gradient, with dark words. Pure, so the choice of tone is tested without a
 * screen.
 */
export const SPEECH_TONE = Object.freeze({ PLAIN: 'plain', ATTENTION: 'attention', CANT: 'cant', LIMES: 'limes' });

/** The drawn line's colour per tone: the chamfer picture's bronze and its gold and red editions. */
export const SPEECH_LINE = Object.freeze({
    [SPEECH_TONE.PLAIN]: '#977316',
    [SPEECH_TONE.ATTENTION]: '#facc15',
    [SPEECH_TONE.CANT]: '#dc2626',
    [SPEECH_TONE.LIMES]: '#166534'
});

/** The frames' fill, the chamfer picture's centre. */
export const SPEECH_FILL = '#0d0a08';

/**
 * Limes's bubble: the lime gradient inside its green line, top to bottom, and its words' colour.
 * ⚠️ The words are dark on a light fill: keep the contrast (about 10:1 at the gradient's foot).
 */
export const LIMES_FILL_TOP = '#ecfccb';
export const LIMES_FILL_FOOT = '#a3e635';
export const LIMES_INK = '#14290a';

/** The fill a tone's tail is drawn in: the frame's own, or the foot of Limes's gradient. */
export const speechFillOf = (tone) => (tone === SPEECH_TONE.LIMES ? LIMES_FILL_FOOT : SPEECH_FILL);

/**
 * A hero's moment by its key (`heroSpeech.js`): going idle (or waiting for a fight) and a broken
 * tool ask the player to give them work or a new tool; the rest are plain news.
 */
export function momentTone(key) {
    if (key === 'idle' || key === 'gearBroke') return SPEECH_TONE.ATTENTION;
    return SPEECH_TONE.PLAIN;
}
