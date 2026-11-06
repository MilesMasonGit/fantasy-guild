import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a hover popover stays after the pointer leaves its badge or itself, so the pointer can
 * cross the gap between them (`placeUnder` leaves 8 px) and keep it open.
 */
export const HOVER_HIDE_DELAY_MS = 150;

/**
 * Open while the pointer is on the badge or on its popover. `show` goes on both elements'
 * mouse-enter, `hide` on both mouse-leaves: leaving one for the other cancels the pending close.
 * `close` shuts it at once (Esc, a click elsewhere).
 * @returns {{ open: boolean, show: () => void, hide: () => void, close: () => void }}
 */
export function useHoverOpen(delayMs = HOVER_HIDE_DELAY_MS) {
    const [open, setOpen] = useState(false);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const show = useCallback(() => { clearTimeout(timer.current); setOpen(true); }, []);
    const hide = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setOpen(false), delayMs);
    }, [delayMs]);
    const close = useCallback(() => { clearTimeout(timer.current); setOpen(false); }, []);
    return { open, show, hide, close };
}
