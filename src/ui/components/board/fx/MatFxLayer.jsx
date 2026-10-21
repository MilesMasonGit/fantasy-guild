import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { MAT_Z } from '../matLayers.js';
import { useMatFit } from '../MatFitContext.jsx';
import { boardScaleAt } from '../../base/TokenSprite.jsx';
import { attachFxHost, watchMatFx } from './matFx.js';

/**
 * The layer the mat's standing effects are drawn in (`matFx.js`): over the Tokens and the loot,
 * under the callouts. An empty box at rest; each effect puts its own elements in and takes them
 * away. `--fx-px` is one screen pixel in mat units, for the numbers' hard edge.
 */
export const MatFxLayer = memo(function MatFxLayer() {
    const fit = useMatFit();
    const ref = useRef(null);
    const unit = boardScaleAt(fit);
    useLayoutEffect(() => {
        attachFxHost(ref.current, unit);
        return () => attachFxHost(null);
    }, [unit]);
    useEffect(() => watchMatFx(), []);
    return (
        <div
            ref={ref}
            data-mat-fx
            aria-hidden="true"
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.FX, '--fx-px': `${fit > 0 ? 1 / fit : 1}px` }}
        />
    );
});

export default MatFxLayer;
