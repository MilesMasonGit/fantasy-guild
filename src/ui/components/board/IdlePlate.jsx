import { memo, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAT_Z } from './matLayers.js';
import { useMatFit } from './MatFitContext.jsx';
import { WorkPlateView } from './WorkPlateLayer.jsx';
import { platePlace } from './workPlate.js';
import { timerCellOf } from './idlePlate.js';
import { TURN_COUNTDOWN_REFRESH_MS } from './ringRow.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { useMatSize } from '../../hooks/useMatSize.js';

const sameTimer = (a, b) => a === b || (!!a && !!b && a.text === b.text && a.tip === b.tip && a.glyph === b.glyph);

/**
 * The idle plate's host: one node over the loot, as the work plates are (`MAT_Z.WORK_PLATE`),
 * that the rested Token draws its plate into. It always takes the pointer: the mat finds the
 * hovered Token by its circle first, so the plate never takes a Token from under the pointer, and
 * off every circle it keeps its own Token hovered (`data-work-plate`) for its tooltips.
 */
export const IdlePlateHost = memo(function IdlePlateHost({ hostRef }) {
    return (
        <div
            ref={hostRef}
            data-idle-plates
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.WORK_PLATE }}
        />
    );
});

/**
 * One Token's idle plate (`idlePlate.js`), under the Token, drawn into `host`. `cells` are what
 * it shows besides its timer; `readTimer` (or null) is read every {@link TURN_COUNTDOWN_REFRESH_MS}
 * while it shows, as the clock runs on game time. Mounted only while the pointer rests on the
 * Token, so a Token at rest polls nothing. Pressing it grabs the Token (`dragProps`).
 * ⚠️ A bridge spans the gap between the Token's circle and the plate's top, so the pointer going
 * down onto the plate never passes over bare mat and loses the Token's hover (and the plate).
 */
export const IdlePlate = memo(function IdlePlate({ host, tokenId, typeId, x, y, cells, readTimer = null, tip, tone = null, dragProps = null }) {
    const fit = useMatFit() || 1;
    const mat = useMatSize();
    const [timer, setTimer] = useState(() => (readTimer ? timerCellOf(readTimer() ?? null) : null));
    useEffect(() => {
        if (!readTimer) { setTimer(null); return undefined; }
        const refresh = () => {
            const next = timerCellOf(readTimer() ?? null);
            setTimer(prev => (sameTimer(prev, next) ? prev : next));
        };
        refresh();
        const id = setInterval(refresh, TURN_COUNTDOWN_REFRESH_MS);
        return () => clearInterval(id);
    }, [readTimer]);
    const cellTip = useCallback((cell) => (cell.tip ?? tip?.(cell) ?? null), [tip]);

    const all = timer ? [...cells, timer] : cells;
    if (!host || x == null || !all.length) return null;
    const place = platePlace({ x, y, typeId, side: 0, fit, matH: mat.h });
    const u = place.unit;
    const above = place.top < y;
    const bridgeFrom = y + artRadiusOf(typeId) * 0.7;
    const bridge = above ? 0 : Math.max(0, place.top - bridgeFrom);
    return createPortal(
        <div
            data-idle-plate-slot={tokenId}
            className="absolute flex justify-center pointer-events-none"
            style={{ left: place.left, top: place.top, width: place.width }}
        >
            {bridge > 0 && (
                <div
                    data-work-plate={tokenId}
                    aria-hidden="true"
                    className="absolute pointer-events-auto"
                    style={{ top: -bridge, height: bridge, left: place.width / 2 - artRadiusOf(typeId), width: 2 * artRadiusOf(typeId) }}
                />
            )}
            <WorkPlateView
                cells={all}
                tone={tone}
                u={u}
                tip={cellTip}
                plateProps={{ ...dragProps, 'data-work-plate': tokenId, 'data-idle-plate': tokenId }}
            />
        </div>,
        host
    );
});

export default IdlePlate;
