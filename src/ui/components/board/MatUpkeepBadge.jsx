import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { computeUpkeepSummary } from '../../../systems/board/UpkeepSummary.js';
import { UpkeepSummaryPanel, REFRESH_EVENTS, POLL_MS } from '../drawer/UpkeepSummaryPanel.jsx';
import { CAP_EVENTS } from './MatCapBadge.jsx';
import { placeUnder } from './tooltipPlacement.js';

/**
 * What changes the badge's total: the Upkeep Summary's own events, the Token cap badge's (a
 * Token placed, spawned, lifted or run dry, a load), and a spawner starting or stopping
 * waiting. Spawner clocks move without an event, so the badge also polls every {@link POLL_MS}
 * like the panel.
 */
export const UPKEEP_EVENTS = Object.freeze([...new Set([
    ...REFRESH_EVENTS,
    ...CAP_EVENTS,
    BOARD_EVENTS.SPAWNER_ALERT_CHANGED
])]);

/** The popover's width in px, fixed so `placeUnder` can keep it on screen before it is measured. */
export const POPOVER_WIDTH = 300;
/** The popover's tallest; past this the summary scrolls inside it. */
export const POPOVER_MAX_HEIGHT = 'min(420px, 70vh)';
/** How long the popover stays after the pointer leaves, so it can cross the gap into it to scroll. */
const HIDE_DELAY_MS = 150;

/** Every ongoing cost's items per minute, summed across items (idle spawners pay nothing, so add nothing). */
export function totalPerMinute(summary) {
    return (summary?.items || []).reduce((sum, row) => sum + (Number(row.perMinute) || 0), 0);
}

/**
 * The badge's number: one decimal, a trailing `.0` dropped (`2`, `2.5`, `6.7`),
 * so float noise never shows. A cost too small to round up reads `<0.1`, never `0`.
 */
export function formatTotal(perMinute) {
    if (!(perMinute > 0)) return '0';
    const rounded = Math.round(perMinute * 10) / 10;
    return rounded > 0 ? String(rounded) : '<0.1';
}

/** The live total. */
export function liveUpkeepTotal() {
    return totalPerMinute(computeUpkeepSummary());
}

/**
 * The hover popover: the whole Upkeep Summary, in a box styled like the Hall's trickle
 * tooltip. Unlike the cap popover it takes the pointer, so a long summary can be scrolled.
 */
export const MatUpkeepPopover = ({ anchor, onMouseEnter, onMouseLeave }) => {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div
            role="tooltip"
            data-mat-upkeep-popover
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className="fixed z-[90] flex flex-col rounded-lg bg-black/90 border border-gi-gold/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
            style={{ width: POPOVER_WIDTH, maxHeight: POPOVER_MAX_HEIGHT, ...placeUnder(anchor, POPOVER_WIDTH, 360) }}
        >
            <UpkeepSummaryPanel className="min-h-0" />
        </div>,
        document.body
    );
};

/**
 * The Upkeep badge: `Upkeep 2/min`, the items per minute every ongoing cost on the mat takes,
 * summed. Hover opens the full Upkeep Summary.
 * Always neutral, whatever the state: a Token waiting unpaid shows red in the summary and on
 * its own centre mark, never on this badge.
 * @param {{ readTotal?: () => number }} props  `readTotal` for tests
 */
export const MatUpkeepBadge = ({ readTotal = liveUpkeepTotal }) => {
    const [total, setTotal] = useState(() => readTotal());
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const hideTimer = useRef(null);

    useEffect(() => {
        const refresh = () => setTotal(readTotal());
        refresh();
        const unsubs = UPKEEP_EVENTS.map(e => EventBus.subscribe(e, refresh));
        const timer = setInterval(refresh, POLL_MS);
        return () => { unsubs.forEach(u => u?.()); clearInterval(timer); };
    }, [readTotal]);

    useEffect(() => () => clearTimeout(hideTimer.current), []);

    const show = useCallback(() => { clearTimeout(hideTimer.current); setOpen(true); }, []);
    const hide = useCallback(() => {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setOpen(false), HIDE_DELAY_MS);
    }, []);

    return (
        <>
            <div
                ref={ref}
                data-mat-upkeep-badge
                onMouseEnter={show}
                onMouseLeave={hide}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/30 border border-[#2a1d15] cursor-default whitespace-nowrap"
            >
                <span data-mat-upkeep-text className="text-white tabular-nums">
                    <span className="text-amber-200/80">Upkeep</span>{' '}{formatTotal(total)}/min
                </span>
            </div>
            {open && <MatUpkeepPopover anchor={ref.current} onMouseEnter={show} onMouseLeave={hide} />}
        </>
    );
};

export default MatUpkeepBadge;
