import { useRef, useState } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { FloatingTip } from '../base/Tooltip.jsx';
import { RING_D_U } from './ringRow.js';

const TIP_WIDTH = 220;

/** The tooltip itself: the shared one, outside the mat so the mat's scale does not shrink the text. */
export const BubbleTip = ({ anchor, text }) => {
    const { isDragging } = useActiveDrag();
    if (isDragging || !text) return null;
    return <FloatingTip anchor={anchor} lines={[text]} maxWidth={TIP_WIDTH} tipProps={{ 'data-bubble-tip': 'true' }} />;
};

/**
 * Bubble: one bubble's place on a Token, with its tooltip. The Token's overlay lets the pointer
 * through; a bubble does not, so hovering it shows `tip` (what it means), and `dragProps` (the
 * Token's own drag handle) makes pressing it grab the Token like pressing its art.
 * `of` is the Token's instance id.
 * `style` is the bubble's `left`/`top` inside the Token's box; `inline` puts it in a flex row
 * (the middle row) instead, where it takes its size from its content.
 */
export const Bubble = ({ kind, of = null, style, tip, dragProps, inline = false, children }) => {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    return (
        <div
            ref={ref}
            data-bubble={kind}
            data-bubble-of={of || undefined}
            {...dragProps}
            onPointerDown={(e) => { setOpen(false); dragProps?.onPointerDown?.(e); }}
            onPointerEnter={() => setOpen(true)}
            onPointerLeave={() => setOpen(false)}
            className={`${inline ? 'relative shrink-0' : 'absolute z-20'} pointer-events-auto cursor-grab active:cursor-grabbing select-none`}
            style={inline ? undefined : { width: RING_D_U, height: RING_D_U, ...style }}
        >
            {children}
            {open && tip && <BubbleTip anchor={ref.current} text={tip} />}
        </div>
    );
};

export default Bubble;
