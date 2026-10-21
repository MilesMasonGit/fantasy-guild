import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { computeUpkeepSummary } from '../../../systems/board/UpkeepSummary.js';
import { UpkeepSummaryPanel, REFRESH_EVENTS, POLL_MS } from '../drawer/UpkeepSummaryPanel.jsx';
import { CAP_EVENTS } from './MatCapBadge.jsx';
import { placeUnder } from './tooltipPlacement.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { TOP_BAR_ICON, TopBarIcon } from './MatTopBar.jsx';

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
 * The hover popover: the whole Upkeep Summary, one item bar per item, in the chamfer pixel frame.
 * Unlike the cap popover it takes the pointer, so a long summary can be scrolled.
 */
export const MatUpkeepPopover = ({ anchor, onMouseEnter, onMouseLeave }) => {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <PixelFrame
            kind={FRAME_KIND.CHAMFER}
            role="tooltip"
            data-mat-upkeep-popover
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className="fixed z-(--z-mat-tip)"
            frameClassName="flex flex-col"
            frameStyle={{ maxHeight: POPOVER_MAX_HEIGHT }}
            style={{ width: POPOVER_WIDTH, ...placeUnder(anchor, POPOVER_WIDTH, 360) }}
        >
            <UpkeepSummaryPanel className="min-h-0" />
        </PixelFrame>,
        document.body
    );
};

/**
 * The Upkeep badge: `Upkeep 2/min` in the item bar style, the items per minute every ongoing
 * cost on the mat takes, summed. Hover opens the full Upkeep Summary.
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
        const unsubs = UPKEEP_EVENTS.map(e => EventBus.subscribe(e, refresh, UI_LISTENER));
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
            <EntityRibbon
                ref={ref}
                data-mat-upkeep-badge
                size="xs"
                name="Upkeep"
                title={null}
                icon={<TopBarIcon src={TOP_BAR_ICON.UPKEEP} />}
                countText={<span data-mat-upkeep-count>{formatTotal(total)}/min</span>}
                onMouseEnter={show}
                onMouseLeave={hide}
                className="whitespace-nowrap cursor-default"
            />
            {open && <MatUpkeepPopover anchor={ref.current} onMouseEnter={show} onMouseLeave={hide} />}
        </>
    );
};

export default MatUpkeepBadge;
