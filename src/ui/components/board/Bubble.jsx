import { RING_D_U } from './ringRow.js';

/**
 * Bubble: one bubble's place on a Token. The Token's overlay lets the pointer through; a bubble
 * does not, so `dragProps` (the Token's own drag handle) makes pressing it grab the Token like
 * pressing its art. It has no tooltip: nothing on the mat has one.
 * `of` is the Token's instance id.
 * `style` is the bubble's `left`/`top` inside the Token's box; `inline` puts it in a flex row
 * (the middle row) instead, where it takes its size from its content.
 */
export const Bubble = ({ kind, of = null, style, dragProps, inline = false, children }) => (
    <div
        data-bubble={kind}
        data-bubble-of={of || undefined}
        {...dragProps}
        className={`${inline ? 'relative shrink-0' : 'absolute z-20'} pointer-events-auto cursor-grab active:cursor-grabbing select-none`}
        style={inline ? undefined : { width: RING_D_U, height: RING_D_U, ...style }}
    >
        {children}
    </div>
);
