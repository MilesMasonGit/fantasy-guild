import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { MAT_Z } from '../matLayers.js';
import { useMatFit } from '../MatFitContext.jsx';
import { boardScaleAt } from '../../base/TokenSprite.jsx';
import { plateUnit } from '../workPlate.js';
import { attachFxHost, watchMatFx } from './matFx.js';
import { watchFightFloats } from './fightFloats.js';

/**
 * The layer the mat's standing effects are drawn in (`matFx.js`, a fight's numbers in
 * `fightFloats.js`): over the Tokens and the loot, under the callouts. An empty box at rest; each
 * effect puts its own elements in and takes them away. `--fx-px` is one screen pixel in mat units,
 * for the numbers' hard edge; `--fx-scale` the same as a plain number (one screen pixel at the
 * mat's 2× art), for sizes written as `calc(... * var(--fx-scale))`.
 */
export const MatFxLayer = memo(function MatFxLayer() {
    const fit = useMatFit();
    const ref = useRef(null);
    const unit = boardScaleAt(fit);
    useLayoutEffect(() => {
        attachFxHost(ref.current, unit, plateUnit(fit || 1));
        return () => attachFxHost(null);
    }, [unit, fit]);
    useEffect(() => watchMatFx(), []);
    useEffect(() => watchFightFloats(), []);
    return (
        <div
            ref={ref}
            data-mat-fx
            aria-hidden="true"
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.FX, '--fx-px': `${fit > 0 ? 1 / fit : 1}px`, '--fx-scale': plateUnit(fit || 1) }}
        />
    );
});

export default MatFxLayer;
