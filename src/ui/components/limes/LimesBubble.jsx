import { SpeechFrame } from '../board/SpeechFrame.jsx';
import { SPEECH_TONE } from '../board/speechTone.js';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { LIMES_TEXT } from '../../../systems/quests/limesText.js';
import { limesNext, limesClose, collapseLimesStep } from './limesStore.js';

/** The open bubble's width, in screen pixels. */
export const LIMES_BUBBLE_PX = 300;

const BUTTON = 'py-0.5 px-3 ui-text-small uppercase tracking-wider';

/**
 * Limes's speech bubble, in Limes's own green (`SPEECH_TONE.LIMES`): one line of a conversation
 * with Next (while there is more) and Close, or, collapsed, a small "…" that opens it again.
 * `talk` is `{ kind: 'talk'|'step', lines, index, collapsed }` (`limesStore.matConversation`).
 */
export function LimesBubble({ talk, tail = true, tailLeft = '50%' }) {
    if (talk.collapsed) {
        return (
            <SpeechFrame tone={SPEECH_TONE.LIMES} tail={tail} tailLeft={tailLeft} data-limes-bubble="collapsed" className="w-max">
                <button
                    type="button"
                    data-limes-more
                    aria-label={LIMES_TEXT.name}
                    className="block px-1 ui-text-title font-bold leading-none cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); collapseLimesStep(false); }}
                >
                    {LIMES_TEXT.buttons.more}
                </button>
            </SpeechFrame>
        );
    }
    const last = talk.index >= talk.lines.length - 1;
    return (
        <SpeechFrame tone={SPEECH_TONE.LIMES} tail={tail} tailLeft={tailLeft} data-limes-bubble={talk.kind}>
            <span className="flex flex-col gap-2">
                <span data-limes-words className="block ui-text-body font-bold leading-snug whitespace-normal">
                    {talk.lines[talk.index]}
                </span>
                <span className="flex items-center justify-end gap-2">
                    {!last && (
                        <KitButton buttonClassName={BUTTON} data-limes-next onClick={(e) => { e.stopPropagation(); limesNext(talk.kind); }}>
                            {LIMES_TEXT.buttons.next}
                        </KitButton>
                    )}
                    <KitButton tone={KIT_BUTTON_TONE.PLAIN} buttonClassName={BUTTON} data-limes-close onClick={(e) => { e.stopPropagation(); limesClose(talk.kind); }}>
                        {LIMES_TEXT.buttons.close}
                    </KitButton>
                </span>
            </span>
        </SpeechFrame>
    );
}
