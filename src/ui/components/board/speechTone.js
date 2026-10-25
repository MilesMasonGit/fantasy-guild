/**
 * The speech family's tones (UI_STYLE "Colours"): the frames' bronze for a plain line, gold for
 * one asking to be looked at, red for a "can't". Pure, so the choice of tone is tested without a
 * screen.
 */
export const SPEECH_TONE = Object.freeze({ PLAIN: 'plain', ATTENTION: 'attention', CANT: 'cant' });

/** The drawn line's colour per tone: the chamfer picture's bronze and its gold and red editions. */
export const SPEECH_LINE = Object.freeze({
    [SPEECH_TONE.PLAIN]: '#977316',
    [SPEECH_TONE.ATTENTION]: '#facc15',
    [SPEECH_TONE.CANT]: '#dc2626'
});

/** The frames' fill, the chamfer picture's centre. */
export const SPEECH_FILL = '#0d0a08';

/**
 * A hero's moment by its key (`heroSpeech.js`): going idle (or waiting for a fight) asks the player
 * to give them work; a refused flag is a "can't"; the rest are plain news.
 */
export function momentTone(key) {
    if (key === 'idle') return SPEECH_TONE.ATTENTION;
    if (key === 'pinRefused') return SPEECH_TONE.CANT;
    return SPEECH_TONE.PLAIN;
}
