import { Children, cloneElement, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Gap between the pointer and the tooltip, so the tip never covers what is under the cursor. */
export const TIP_OFFSET_X = 16;
export const TIP_OFFSET_Y = 20;
/** Closest the tooltip comes to a window edge. */
export const TIP_EDGE = 8;

/**
 * Where the tooltip's top-left corner goes for a pointer at (x, y): below and right of it, or
 * flipped to the left and/or above when that would run past the window's right or bottom edge,
 * and never off the window.
 */
export function tipPosition(x, y, width, height, viewW, viewH) {
    let left = x + TIP_OFFSET_X;
    if (left + width > viewW - TIP_EDGE) left = x - TIP_OFFSET_X - width;
    let top = y + TIP_OFFSET_Y;
    if (top + height > viewH - TIP_EDGE) top = y - TIP_OFFSET_Y - height;
    left = Math.max(TIP_EDGE, Math.min(left, viewW - TIP_EDGE - width));
    top = Math.max(TIP_EDGE, Math.min(top, viewH - TIP_EDGE - height));
    return { left, top };
}

const place = (el, pointer) => {
    if (!el || !pointer) return;
    const { left, top } = tipPosition(pointer.x, pointer.y, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight);
    el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
};

/**
 * The game's one tooltip: a gold-edged dark box that follows the pointer. Wraps a single child
 * element and adds pointer handlers to it (the child's own handlers still run).
 *
 * Plain browser `title` tips are for icon buttons only; everything else uses this.
 *
 * ⚠️ Following the pointer moves the box directly (a transform on its own node), never through
 * React state, so the panel underneath does not re-render while the cursor moves. Only this
 * component re-renders, on show and hide. The tip stays hidden while a mouse button is held, so
 * it never shows over a drag.
 *
 * @param {{ title?: string, lines?: string[], content?: React.ReactNode, disabled?: boolean,
 *   maxWidth?: number, children: React.ReactElement }} props
 */
export const Tooltip = ({ title, lines, content, disabled = false, maxWidth = 280, children }) => {
    const [open, setOpen] = useState(false);
    const pointerRef = useRef(null);
    const tipRef = useRef(null);
    const child = Children.only(children);
    const ownRef = useRef(child.props);
    ownRef.current = child.props;

    const shownLines = lines ? lines.filter(Boolean) : [];
    const hasContent = !!(title || shownLines.length || content);
    const shown = open && hasContent && !disabled;

    useLayoutEffect(() => {
        if (shown) place(tipRef.current, pointerRef.current);
    }, [shown, title, lines, content]);

    const onPointerEnter = useCallback((e) => {
        ownRef.current.onPointerEnter?.(e);
        if (e.pointerType === 'touch' || e.buttons) return;
        pointerRef.current = { x: e.clientX, y: e.clientY };
        setOpen(true);
    }, []);
    const onPointerMove = useCallback((e) => {
        ownRef.current.onPointerMove?.(e);
        pointerRef.current = { x: e.clientX, y: e.clientY };
        if (e.buttons) { setOpen(false); return; }
        place(tipRef.current, pointerRef.current);
    }, []);
    const onPointerLeave = useCallback((e) => {
        ownRef.current.onPointerLeave?.(e);
        setOpen(false);
    }, []);
    const onPointerDown = useCallback((e) => {
        ownRef.current.onPointerDown?.(e);
        setOpen(false);
    }, []);

    const wrapped = cloneElement(child, { onPointerEnter, onPointerMove, onPointerLeave, onPointerDown });
    // ⚠️ The same shape shown or hidden, or React would remount the child on every hover.
    return (
        <>
            {wrapped}
            {shown && typeof document !== 'undefined' && createPortal(
                <div
                    ref={tipRef}
                    role="tooltip"
                    data-tooltip
                    className="fixed left-0 top-0 z-[100000] w-max p-2 rounded-lg pointer-events-none bg-black/90 border border-gi-gold/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] leading-snug text-white"
                    style={{ maxWidth, transform: 'translate3d(-9999px, -9999px, 0)' }}
                >
                    {title && <div className="ui-text-title font-bold text-gi-gold">{title}</div>}
                    {shownLines.map((line, i) => <div key={i} className="ui-text-body text-white/70">{line}</div>)}
                    {content && <div className="ui-text-body">{content}</div>}
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
