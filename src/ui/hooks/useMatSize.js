// Fantasy Guild — the mat's live size, for the screen (Free Playmat slice 1.6d-3)

import { useEffect, useState } from 'react';
import { matW, matH } from '../../config/matGeometry.js';
import { onMatTuningChanged } from '../../config/matTuning.js';

/**
 * ⭐ **How big the mat is, right now, in mat units** — and a re-render when that
 * changes.
 *
 * The mat's size follows the Mat Tuner's **Mat size** row (slice 1.6d-3), and
 * nothing on the board moves when it does, so no game event would ever tell
 * React to draw the mat at its new size. This hook subscribes to the tuner
 * itself: every layer that sizes itself to the mat — the surface, the ring and
 * flag overlays, the loot layer, the terrain canvas, the Tray's mini mat — reads
 * its width and height from here rather than from a module constant.
 *
 * ## ⚠️ Why a hook rather than an import
 * `matW()` / `matH()` are functions precisely so nothing caches the size (see
 * `matGeometry.js`). A component that called them once at module scope, or held
 * the answer in a `useMemo` with no dependency, would be the same stale-constant
 * bug in a different place — it would simply also be invisible until someone
 * moved the slider. Calling the hook keeps the value live AND makes the component
 * re-render, which the bare function cannot do.
 *
 * The returned object is stable while the size is unchanged, so it is safe in a
 * dependency array.
 *
 * @returns {{w: number, h: number}}
 */
export function useMatSize() {
    const [size, setSize] = useState(() => ({ w: matW(), h: matH() }));

    useEffect(() => onMatTuningChanged(() => {
        setSize(prev => {
            const w = matW();
            const h = matH();
            // Same size (another row moved): keep the old object so a dependency
            // array on it does not fire for a change that was not ours.
            return (prev.w === w && prev.h === h) ? prev : { w, h };
        });
    }), []);

    return size;
}

export default useMatSize;
