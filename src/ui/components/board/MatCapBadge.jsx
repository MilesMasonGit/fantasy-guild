import React, { useEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { createPortal } from 'react-dom';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as MatCap from '../../../systems/board/MatCap.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as Growth from '../../../systems/board/Growth.js';
import * as Shop from '../../../systems/board/Shop.js';
import { summariseMat, rowLabel, TOKEN_STATUS } from '../../../systems/board/MatSummary.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { tokenName, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { isGearOnlyAlert } from './centreAlert.js';
import { placeUnder } from './tooltipPlacement.js';
import { highlightType } from './tokenHighlight.js';
import { TopBarTip } from './TopBarTip.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { TOP_BAR_ICON, TopBarIcon } from './MatTopBar.jsx';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * What changes the badge's number. Every route a Token takes onto or off the mat publishes
 * `TILE_CHANGED`: a placement, a spawn (`EffectActions.spawn`), a Token that ran dry
 * (`Charges`), an enemy killed (`BoardCombat`), a lift back to the Bank (`Placement`). The
 * rest are belt and braces: `TOKEN_PLACED` and `TOKEN_DEPLETED` for the player's own actions,
 * `game_reset` and `game_loaded` for a load or a new game. The cap is the Token Cap upgrade's
 * (`GUILD_UPGRADES_UPDATED`), or a Mat Tuner override heard through `onMatTuningChanged`.
 */
export const CAP_EVENTS = Object.freeze([
    BOARD_EVENTS.TILE_CHANGED,
    BOARD_EVENTS.TOKEN_PLACED,
    BOARD_EVENTS.TOKEN_DEPLETED,
    ENGINE_EVENTS.GUILD_UPGRADES_UPDATED,
    ENGINE_EVENTS.GAME_RESET,
    ENGINE_EVENTS.GAME_LOADED
]);

/** Also redraw the open summary when a Token's problem comes or goes. */
const POPOVER_EVENTS = Object.freeze([
    ...CAP_EVENTS,
    BOARD_EVENTS.ALERT_CHANGED,
    BOARD_EVENTS.SPAWNER_ALERT_CHANGED,
    BOARD_EVENTS.GROWTH_ALERT_CHANGED
]);

/** The summary opens under the badge at this width, kept on screen by `placeUnder`. */
const PANEL_WIDTH = 300;
/** While open, the summary re-reads this often: a hero arriving or leaving raises no event. */
const PANEL_REFRESH_MS = 1000;

/**
 * Re-render whenever any of `events` fires (and the Mat Tuner changes), while `on`. With
 * `signatureOf`, only when that signature of what is drawn has changed: a bare event would
 * re-render the badge every time whether or not anything it shows had moved.
 */
export function useRefreshOn(events, on = true, signatureOf = null) {
    const [, bump] = useState(0);
    const sig = useRef(null);
    const live = useRef(signatureOf);
    live.current = signatureOf;
    sig.current = signatureOf ? signatureOf() : null;
    useEffect(() => {
        if (!on) return undefined;
        const refresh = () => {
            if (live.current) {
                const next = live.current();
                if (next === sig.current) return;
                sig.current = next;
            }
            bump(n => n + 1);
        };
        const unsubs = events.map(e => EventBus.subscribe(e, refresh, UI_LISTENER));
        unsubs.push(onMatTuningChanged(refresh));
        return () => unsubs.forEach(u => u?.());
    }, [events, on]);
}

/** What the badge itself draws. */
const capSignature = () => `${MatCap.tokenCount()}|${MatCap.matCap()}`;

/**
 * A Token's status for the summary, read live. Disallowed beats blocked; blocked beats working.
 * `missing` marks a block that is a lack of items (inputs, a spawner's upkeep, unpaid rule upkeep).
 */
export function liveStatusOf(instance) {
    if (Flags.isDisallowed(instance)) return { status: TOKEN_STATUS.OFF };
    const spawnerAlert = SpawnerSystem.spawnerAlertOf(instance.id);
    if (spawnerAlert) return { status: TOKEN_STATUS.BLOCKED, missing: spawnerAlert.alert === ALERT.SPAWN_NEEDS_ITEM };
    const growthAlert = Growth.growthAlertOf(instance.id);
    if (growthAlert) return { status: TOKEN_STATUS.BLOCKED, missing: growthAlert.alert === ALERT.GROW_NEEDS_ITEM };
    if (instance.alert && !isGearOnlyAlert(instance.alert)) {
        return { status: TOKEN_STATUS.BLOCKED, missing: instance.alert === ALERT.INPUTS };
    }
    if (Object.values(instance.blockUpkeep || {}).some(s => s?.paid === false)) {
        return { status: TOKEN_STATUS.BLOCKED, missing: true };
    }
    if (BoardState.workerOf(instance.id)) return { status: TOKEN_STATUS.WORKING };
    const counts = SpawnerSystem.spawnerCounts(instance.id);
    if (counts && counts.count < counts.cap) return { status: TOKEN_STATUS.WORKING };
    return { status: TOKEN_STATUS.IDLE };
}

/**
 * Where each type on the mat is listed: its Shop section (a spawned type that is not sold takes
 * its spawner's) and the name it sorts under (a spawned type sits under its spawner).
 */
function liveLayouts(tokens) {
    const layouts = new Map();
    const onMat = new Set(tokens.map(t => t.typeId));
    const sectionOf = (typeId) => {
        const shop = getTokenType(typeId)?.shop;
        return shop && Array.isArray(shop.price) && shop.section ? shop.section : null;
    };
    for (const typeId of [...onMat].sort()) {
        if (!SpawnerSystem.isSpawner(getTokenType(typeId))) continue;
        layouts.set(typeId, { section: sectionOf(typeId) || 'general', anchor: tokenName(typeId), rank: 0 });
    }
    for (const typeId of [...layouts.keys()]) {
        for (const member of SpawnerSystem.familyOf(typeId)) {
            if (!onMat.has(member) || layouts.has(member)) continue;
            layouts.set(member, { section: sectionOf(member) || layouts.get(typeId).section, anchor: tokenName(typeId), rank: 1 });
        }
    }
    return (typeId) => layouts.get(typeId) || { section: sectionOf(typeId) || 'general', anchor: tokenName(typeId), rank: 0 };
}

/** The mat's summary, read live. */
export function liveMatSummary() {
    const tokens = BoardState.tokens();
    return summariseMat(tokens, {
        nameOf: tokenName,
        isExcluded: (t) => !MatCap.countsTowardCap(t),
        statusOf: liveStatusOf,
        layoutOf: liveLayouts(tokens),
        sectionName: Shop.sectionName
    });
}

/** The small coloured status counts after a row's name; only the non-zero ones. */
const STATUS_PARTS = [
    ['working', 'working', 'text-emerald-300'],
    ['idle', 'idle', 'text-white/50'],
    ['blocked', 'blocked', 'text-red-400'],
    ['off', 'disallowed', 'text-white/40']
];

const SummaryRow = ({ row }) => (
    <li
        data-token-summary-row={row.typeId}
        onMouseEnter={() => highlightType(row.typeId)}
        onMouseLeave={() => highlightType(null)}
        className="flex items-baseline justify-between gap-3 px-1 py-0.5 hover:outline-2 hover:outline-solid hover:-outline-offset-2 hover:outline-[var(--color-ui-white)] cursor-default"
    >
        <span className="truncate">{rowLabel(row)}</span>
        <span className="shrink-0 flex gap-2 tabular-nums">
            {STATUS_PARTS.filter(([key]) => row[key] > 0).map(([key, word, tone]) => (
                <span key={key} data-status-count={key} className={tone}>{row[key]} {word}</span>
            ))}
        </span>
    </li>
);

const SummaryHeading = ({ children }) => (
    <div className="mt-2 pt-1.5 border-t border-white/10 mb-0.5 ui-text-body uppercase tracking-wide text-white/50">{children}</div>
);

/**
 * The Token Summary: one frame, one row per Token type with its status counts, the ones missing
 * items pinned on top, the rest under their skill section. Hovering a row lights that type on the
 * mat. It takes the pointer (rows hover, a long list scrolls); `MatCapBadge` closes it.
 */
export const TokenSummaryPanel = ({ anchor, summary, cap, panelRef }) => {
    useEffect(() => () => highlightType(null), []);
    if (typeof document === 'undefined') return null;
    const empty = !summary.pinned.length && !summary.sections.length;
    return createPortal(
        <div
            ref={panelRef}
            role="dialog"
            aria-label="Token Summary"
            data-token-summary
            className="fixed z-(--z-mat-tip)"
            style={{ width: PANEL_WIDTH, ...placeUnder(anchor, PANEL_WIDTH, 360) }}
        >
            <PixelFrame
                kind={FRAME_KIND.CHAMFER}
                frameClassName="flex flex-col overflow-y-auto custom-scrollbar p-0.5 ui-text-title leading-snug text-white"
                frameStyle={{ maxHeight: 'min(480px, 70vh)' }}
            >
                <div className="font-bold text-gi-gold">Tokens {summary.total}/{cap}</div>
                {empty && <div className="mt-1 text-white/60">Nothing placed yet.</div>}
                {summary.pinned.length > 0 && (
                    <div data-token-summary-pinned>
                        <SummaryHeading>Missing items</SummaryHeading>
                        <ul className="flex flex-col">{summary.pinned.map(r => <SummaryRow key={r.typeId} row={r} />)}</ul>
                    </div>
                )}
                {summary.sections.map(s => (
                    <div key={s.section} data-token-summary-section={s.section}>
                        <SummaryHeading>{s.name}</SummaryHeading>
                        <ul className="flex flex-col">{s.rows.map(r => <SummaryRow key={r.typeId} row={r} />)}</ul>
                    </div>
                ))}
            </PixelFrame>
        </div>,
        document.body
    );
};

/**
 * The Token cap badge: `Tokens 62/80` in the item bar style, every Token counting toward the
 * mat's cap (`MatCap`); the count turns red at the cap. Click opens the Token Summary; Esc or a click anywhere else closes it. Hovering while it is
 * shut gives a short tooltip. The number is read on the events in {@link CAP_EVENTS}, never per
 * frame; the summary is only worked out while it is open.
 * @param {{ readSummary?: () => object }} props  `readSummary` for tests
 */
export const MatCapBadge = ({ readSummary = liveMatSummary }) => {
    useRefreshOn(CAP_EVENTS, true, capSignature);
    const [open, setOpen] = useState(false);
    const [hover, setHover] = useState(false);
    useRefreshOn(POPOVER_EVENTS, open);
    const ref = useRef(null);
    const panelRef = useRef(null);
    const [, tickRefresh] = useState(0);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (panelRef.current?.contains(e.target) || ref.current?.contains(e.target)) return;
            setOpen(false);
        };
        const timer = setInterval(() => tickRefresh(n => n + 1), PANEL_REFRESH_MS);
        document.addEventListener('pointerdown', onDown, true);
        return () => {
            clearInterval(timer);
            document.removeEventListener('pointerdown', onDown, true);
        };
    }, [open]);
    useEscapeLayer(open, () => setOpen(false));

    const count = MatCap.tokenCount();
    const cap = MatCap.matCap();
    // Red at the cap and nothing else: the spawners it stops already show their own red mark.
    const atCap = count >= cap;

    return (
        <>
            <EntityRibbon
                ref={ref}
                data-mat-cap-badge
                data-at-cap={atCap ? 'true' : 'false'}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                size="xs"
                name="Tokens"
                title={null}
                icon={<TopBarIcon src={TOP_BAR_ICON.TOKENS} />}
                countText={(
                    <span data-mat-cap-count style={atCap ? { color: 'var(--color-ui-red)' } : undefined}>{count}/{cap}</span>
                )}
                onClick={() => { setHover(false); setOpen(o => !o); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHover(false); setOpen(o => !o); } }}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                className="whitespace-nowrap"
            />
            {hover && !open && (
                <TopBarTip
                    anchor={ref.current}
                    title="Token cap"
                    lines={['Placed and spawned Tokens all count.', 'The Guild Hall and quests do not.', 'Click for the list.']}
                />
            )}
            {open && <TokenSummaryPanel anchor={ref.current} summary={readSummary()} cap={cap} panelRef={panelRef} />}
        </>
    );
};

export default MatCapBadge;
