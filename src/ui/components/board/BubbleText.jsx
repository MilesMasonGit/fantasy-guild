import { splitNumbers } from './heroSpeech.js';

/** The numbers' colour in a bubble: a touch warmer than the words. */
export const BUBBLE_NUMBER_CLASS = 'text-amber-300';

/** A bubble's line with its numbers in their own colour (`splitNumbers`). */
export const BubbleText = ({ text }) => (
    <>
        {splitNumbers(text).map((part, i) => (part.num
            ? <span key={i} data-bubble-num className={BUBBLE_NUMBER_CLASS}>{part.text}</span>
            : part.text))}
    </>
);

export default BubbleText;
