import { useCallback, useEffect, useState } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { MAT_Z } from './matLayers.js';
import { useEventAlert, EventAlertMark } from './TokenEventAlert.jsx';

/**
 * ⭐ **Alerts that belong to a place rather than to a Token.**
 *
 * Most board news is about a Token, and `MatToken` draws it by instance id. But
 * some of it has no Token left to sit on:
 *
 * * a Token that has just **run dry** — the event names the spot it stood on;
 * * a **refused drop**, which names the point the player aimed at;
 * * a hero's **level-up** where the hero is working nothing.
 *
 * The grid drew these on whichever tile the point fell in. There are no tiles,
 * so they are drawn at the point itself, in a 128 u box centred on it — the
 * same size the Token that left was.
 *
 * One alert per point: a spot that reports twice replaces its own note rather
 * than stacking two icons on one another.
 */

/** The box an alert is drawn in, centred on its point — one Token wide. */
const ALERT_BOX_PX = 128;

const keyOf = (p) => `${Math.round(p.x)}_${Math.round(p.y)}`;

/** Whether this payload is about a place rather than a drawn Token. */
export function isPointAlert(payload) {
    if (!payload) return false;
    if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return false;
    // A hero's level-up is said by the hero, in a speech bubble (SB-2).
    if (payload.type === 'hero_level_up') return false;
    // A Token still on the mat draws its own alert (`MatToken`).
    if (payload.instanceId && BoardState.getTokenById(payload.instanceId)) return false;
    return true;
}

export const MatPointAlerts = () => {
    const [alerts, setAlerts] = useState([]);
    const mat = useMatSize();

    useEffect(() => {
        const unsub = EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => {
            if (!isPointAlert(p)) return;
            const key = keyOf(p);
            setAlerts(prev => [
                ...prev.filter(a => a.key !== key),
                { key, x: p.x, y: p.y, payload: p, seq: (prev.find(a => a.key === key)?.seq ?? 0) + 1 }
            ]);
        });
        return () => unsub();
    }, []);

    const forget = useCallback((key) => {
        setAlerts(prev => prev.filter(a => a.key !== key));
    }, []);

    if (!alerts.length) return null;

    return (
        <div
            data-mat-point-alerts
            className="absolute left-0 top-0 pointer-events-none"
            style={{ width: mat.w, height: mat.h, zIndex: MAT_Z.POINT_ALERT }}
        >
            {alerts.map(a => (
                <PointAlert key={`${a.key}:${a.seq}`} alert={a} onGone={forget} />
            ))}
        </div>
    );
};

/** One alert standing at a mat point. */
const PointAlert = ({ alert, onGone }) => {
    const life = useEventAlert(useCallback(() => onGone(alert.key), [onGone, alert.key]));
    const { show } = life;

    useEffect(() => { show(alert.payload); }, [show, alert.payload]);

    return (
        <div
            data-mat-point-alert={alert.key}
            className="absolute pointer-events-auto"
            style={{
                left: alert.x - ALERT_BOX_PX / 2,
                top: alert.y - ALERT_BOX_PX / 2,
                width: ALERT_BOX_PX,
                height: ALERT_BOX_PX
            }}
        >
            <EventAlertMark alert={life} />
        </div>
    );
};

export default MatPointAlerts;
