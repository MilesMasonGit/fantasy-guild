import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as MatCap from '../../../systems/board/MatCap.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import { summariseMat, groupNote, groupLabel } from '../../../systems/board/MatSummary.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { isGearOnlyAlert } from './centreAlert.js';
import { placeUnder } from './tooltipPlacement.js';

/**
 * What changes the badge's number (FB-31, SP-67). Every route a Token takes
 * onto or off the mat publishes `TILE_CHANGED` — a placement, a spawn
 * (`EffectActions.spawn`), a Token that ran dry (`Charges`), an enemy killed
 * (`BoardCombat`), a lift back to the Bank (`Placement`) — and the rest are
 * belt and braces: `TOKEN_PLACED` and `TOKEN_DEPLETED` for the player's own
 * actions, `state_changed` and `game_loaded` for a load or a new game. The cap
 * itself is a Mat Tuner number, heard through `onMatTuningChanged`.
 * `BIN_CHANGED` (B3.2): *Discard all* is what finally drops binned Tokens from
 * the count.
 */
export const CAP_EVENTS = Object.freeze([
    BOARD_EVENTS.TILE_CHANGED,
    BOARD_EVENTS.TOKEN_PLACED,
    BOARD_EVENTS.TOKEN_DEPLETED,
    BOARD_EVENTS.BIN_CHANGED,
    'state_changed',
    'game_loaded'
]);

/** Also redraw the open popover when a Token's problem comes or goes (its red notes). */
const POPOVER_EVENTS = Object.freeze([
    ...CAP_EVENTS,
    BOARD_EVENTS.ALERT_CHANGED,
    BOARD_EVENTS.SPAWNER_ALERT_CHANGED
]);

/** The popover's width, fixed so `placeUnder` can keep it on screen before it is measured. */
const POPOVER_WIDTH = 256;

/**
 * Whether a Token has a live problem, the same one its centre mark shows
 * (B1.1, TL-22): an engine alert the gear does not say instead, or a
 * spawner's waiting alert.
 */
export function hasLiveProblem(instance) {
    if (!instance) return false;
    if (instance.alert && !isGearOnlyAlert(instance.alert)) return true;
    return !!SpawnerSystem.spawnerAlertOf(instance.id);
}

/** The mat's summary, read live (FB-31). */
export function liveMatSummary() {
    return summariseMat(BoardState.tokens(), {
        nameOf: tokenName,
        isGuildHall: MatCap.isGuildHall,
        isBlocked: hasLiveProblem,
        isOff: Flags.isDisallowed,
        // B3.2 (TL-13): binned placed Tokens still count until discarded.
        binned: BoardState.binTokens()
    });
}

/** Re-render whenever any of `events` fires (and the Mat Tuner changes), while `on`. */
export function useRefreshOn(events, on = true) {
    const [, bump] = useState(0);
    useEffect(() => {
        if (!on) return undefined;
        const refresh = () => bump(n => n + 1);
        const unsubs = events.map(e => EventBus.subscribe(e, refresh));
        unsubs.push(onMatTuningChanged(refresh));
        return () => unsubs.forEach(u => u?.());
    }, [events, on]);
}

/**
 * The hover popover: `Placed n of cap`, the placed Tokens by type with a red
 * note where some are blocked or off, then the spawned ones "not counted".
 * Styled like the Hall's trickle tooltip, and like it never catches the pointer.
 */
export const MatCapPopover = ({ anchor, summary, cap }) => {
    if (typeof document === 'undefined') return null;
    const { placed, spawned } = summary;
    const binned = summary.binned?.count || 0;
    const height = 60 + placed.groups.length * 16 + (spawned.count ? 40 : 0) + (binned ? 24 : 0);
    return createPortal(
        <div
            role="tooltip"
            data-mat-cap-popover
            className="fixed z-[90] p-2 rounded-lg pointer-events-none bg-black/90 border border-gi-gold/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-[11px] leading-snug text-white"
            style={{ width: POPOVER_WIDTH, ...placeUnder(anchor, POPOVER_WIDTH, height) }}
        >
            {/* The total the badge shows: on the mat plus in the bin (B3.2). */}
            <div className="font-bold text-gi-gold">Placed {placed.count + binned} of {cap}</div>
            {placed.groups.length ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                    {placed.groups.map(g => {
                        const note = groupNote(g);
                        return (
                            <li key={g.typeId} data-mat-cap-group={g.typeId} className="flex justify-between gap-2">
                                <span className="truncate">{groupLabel(g)}</span>
                                {note && <span data-mat-cap-note className="shrink-0 text-red-400">{note}</span>}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="mt-1 text-white/60">Nothing placed yet.</div>
            )}
            {binned > 0 && (
                <div data-mat-cap-binned className="mt-1 pt-1 border-t border-white/10 text-white/80">
                    In the bin {binned} (counted until discarded)
                </div>
            )}
            {spawned.count > 0 && (
                <div data-mat-cap-spawned className="mt-1 pt-1 border-t border-white/10">
                    <div className="text-white/80">Spawned {spawned.count} (not counted)</div>
                    <div className="text-white/60">{spawned.groups.map(groupLabel).join(', ')}</div>
                </div>
            )}
        </div>,
        document.body
    );
};

/**
 * ⭐ **The Token cap badge** (B2.1, FB-31): `Tokens 7/12` — placed Tokens
 * against the mat cap (SP-67; the Guild Hall never counts). Hover opens the
 * by-type summary.
 *
 * The number is read on the events in {@link CAP_EVENTS}, never per frame; the
 * summary is only worked out while the popover is open.
 *
 * @param {{ readSummary?: () => object }} props  `readSummary` for tests
 */
export const MatCapBadge = ({ readSummary = liveMatSummary }) => {
    useRefreshOn(CAP_EVENTS);
    const [open, setOpen] = useState(false);
    useRefreshOn(POPOVER_EVENTS, open);
    const ref = useRef(null);
    const show = useCallback(() => setOpen(true), []);
    const hide = useCallback(() => setOpen(false), []);

    const placed = MatCap.placedCount();
    const cap = MatCap.matCap();

    return (
        <>
            <div
                ref={ref}
                data-mat-cap-badge
                onMouseEnter={show}
                onMouseLeave={hide}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/30 border border-[#2a1d15] cursor-default whitespace-nowrap"
            >
                <span data-mat-cap-text className="text-white tabular-nums">
                    <span className="text-amber-200/80">Tokens</span>{' '}{placed}/{cap}
                </span>
            </div>
            {open && <MatCapPopover anchor={ref.current} summary={readSummary()} cap={cap} />}
        </>
    );
};

export default MatCapBadge;
