// the client size of an element, kept current: on mount, on window resize and on the element's own resize

import { useLayoutEffect, useState } from 'react';

/**
 * `{ w, h }` of `ref`'s element, `{ 0, 0 }` until it is measured. The window event is there too
 * because `ResizeObserver` can be silent when only the pane around the element changes.
 */
export function useElementSize(ref) {
    const [size, setSize] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const measure = () => {
            const el = ref.current;
            if (!el) return;
            const w = el.clientWidth;
            const h = el.clientHeight;
            setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
        };
        measure();
        window.addEventListener('resize', measure);
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        if (ro && ref.current) ro.observe(ref.current);
        return () => {
            window.removeEventListener('resize', measure);
            ro?.disconnect();
        };
    }, [ref]);
    return size;
}
