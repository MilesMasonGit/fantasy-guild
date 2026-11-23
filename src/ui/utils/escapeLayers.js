import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * One Escape, one layer (owner ruling, T-029): Escape closes only the top-most open thing.
 * Every surface Escape can close registers a layer while it is open; the one registered last is
 * on top. A single capturing listener on the window hears Escape before anything else and hands
 * it to that layer alone, so nothing underneath also closes.
 * ⚠️ While a drag is live, Escape belongs to the drag (dnd-kit cancels it): the listener lets
 * it through untouched. The Atlas's own drag-ending Escape (`travelFromScreen.endDrag`) is let
 * through the same way.
 * A layer that must not close on Escape (a window with no X, such as the slot screen) still
 * registers, with no handler, so Escape closes nothing beneath it.
 */

const layers = [];

const DRAG_ESCAPE_MARK = 'atlasEndDrag';

function onKeyDown(e) {
    if (e.key !== 'Escape' || layers.length === 0) return;
    if (e[DRAG_ESCAPE_MARK]) return;
    if (typeof document !== 'undefined' && document.body.classList.contains('gi-dnd-active')) return;
    const top = layers[layers.length - 1];
    e.stopPropagation();
    e.preventDefault();
    top.onEscape?.(e);
}

/**
 * Put a layer on top. Returns its removal.
 * @param {((e: KeyboardEvent) => void) | null} onEscape
 */
export function pushEscapeLayer(onEscape) {
    const layer = { onEscape };
    if (layers.length === 0 && typeof window !== 'undefined') {
        window.addEventListener('keydown', onKeyDown, true);
    }
    layers.push(layer);
    return () => {
        const i = layers.indexOf(layer);
        if (i !== -1) layers.splice(i, 1);
        if (layers.length === 0 && typeof window !== 'undefined') {
            window.removeEventListener('keydown', onKeyDown, true);
        }
    };
}

/** How many layers are open (for tests). */
export function escapeLayerCount() {
    return layers.length;
}

/**
 * Hold an Escape layer while `active`. The handler may change between renders without moving
 * the layer; a change of `key` re-registers it on top (a nav view switching to another).
 * @param {boolean} active
 * @param {((e: KeyboardEvent) => void) | null} onEscape
 * @param {unknown} [key]
 */
export function useEscapeLayer(active, onEscape, key = null) {
    const handler = useRef(onEscape);
    useLayoutEffect(() => { handler.current = onEscape; });
    useEffect(() => {
        if (!active) return undefined;
        return pushEscapeLayer((e) => handler.current?.(e));
    }, [active, key]);
}
