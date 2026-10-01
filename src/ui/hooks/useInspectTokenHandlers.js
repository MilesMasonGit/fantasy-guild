import { useCallback } from 'react';

/**
 * The mat's two inspect handlers, stable across renders (CR3-302).
 *
 * They were inline arrows in `ReactRoot`, so every `ReactRoot` render (a hero
 * inspected, a drawer opened) handed `Board` new functions, which it forwards
 * to every `MatToken` — defeating `MatToken`'s `React.memo` and redrawing the
 * whole mat on one click (R5 measured 108 renders, 33.8 ms). `inspect.set`
 * and `inspect.clear` are already stable (`useUIModals`), so these are too.
 */
export function useInspectTokenHandlers(inspect) {
    const { set, clear } = inspect;
    const onInspectToken = useCallback(
        (typeId, rect, instanceId) => set('token', typeId, { rect, instanceId }),
        [set]
    );
    const onClearInspect = useCallback(() => clear(), [clear]);
    return { onInspectToken, onClearInspect };
}
