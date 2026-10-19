import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import * as ItemStubs from '../../../systems/notifications/itemStubs.js';
import { pins } from '../../../systems/notifications/routing.js';
import { ItemRateTracker } from '../../../systems/inventory/ItemRateTracker.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { cn } from '../../utils/cn.js';
import { PinGlyph, ResetGlyph } from './pixelIcons.jsx';
import { TONE_COLOUR, rateText, signedAmount, toneOf } from './stubText.js';

/**
 * The item stubs: a column at the top right of the mat, under the top bar. One stub per item,
 * the amount then the sprite (`+12 [oak]`), green for a net gain and red for a loss. Pinned stubs
 * are held at the top; the rest scroll with the arrow bars once they no longer fit.
 *
 * Hovering a stub opens its panel out to the left over the mat (the name, gained and spent, the
 * net per hour); nothing else moves, so the pointer can run down the column. Only the panel's pin
 * and reset are clickable: a stray click on a stub does nothing.
 *
 * The stubs are merged in `itemStubs.js`; this column draws what it is handed, at most once per
 * {@link ItemStubs.EMIT_MS}. No backdrop blur: every stub is a solid frame.
 */

/** The column's width, and one stub's height plus the gap below it. */
export const COLUMN_PX = 136;
export const STUB_PX = 44;
const GAP_PX = 6;
const PITCH_PX = STUB_PX + GAP_PX;
/** The Clear all row's height. */
const HEADER_PX = 24;
/** How long the panel waits before closing, so the pointer can cross from a stub onto it. */
const PANEL_CLOSE_MS = 120;

function useSetting(path) {
    const [value, setValue] = useState(() => SettingsManager.get(path));
    useEffect(() => EventBus.subscribe(ENGINE_EVENTS.SETTINGS_UPDATED, () => setValue(SettingsManager.get(path)), UI_LISTENER), [path]);
    return value;
}

/** One stub at rest. Exported for the style sheet page. */
export const Stub = memo(function Stub({ stub, onHover, onLeave }) {
    const net = ItemStubs.netOf(stub);
    const tone = toneOf(net);
    return (
        <div
            data-item-stub={stub.itemId}
            data-stub-net={net}
            data-stub-new={stub.isNew ? 'true' : undefined}
            data-stub-pinned={stub.pinned ? 'true' : undefined}
            data-stub-fading={stub.fading ? 'true' : undefined}
            className="gi-stub pointer-events-auto shrink-0"
            style={{ width: COLUMN_PX - 4, height: STUB_PX, marginBottom: GAP_PX }}
            onMouseEnter={(e) => { if (e.buttons === 0) onHover(stub.itemId, e.currentTarget); }}
            onMouseLeave={onLeave}
        >
            <PixelFrame
                kind={FRAME_KIND.CHAMFER}
                className="h-full"
                frameClassName={cn(
                    'h-full flex items-center justify-end gap-1.5 pr-0.5 font-pixel ui-text-body text-amber-100 overflow-hidden',
                    stub.isNew && 'ui-frame-chamfer-gold gi-stub-new'
                )}
            >
                {stub.isNew && <span className="ui-text-small font-bold" style={{ color: 'var(--color-ui-gold)' }}>New!</span>}
                <span className="tabular-nums font-bold" style={{ color: TONE_COLOUR[tone] }}>{signedAmount(net)}</span>
                <ItemIcon item={stub.itemId} size={32} title={null} className="shrink-0" />
            </PixelFrame>
        </div>
    );
});

/** The hover panel, beside the stub it belongs to. Live while open: the rate moves on its own. */
export function StubPanel({ itemId, top, onEnter, onLeave }) {
    const stub = ItemStubs.getStub(itemId);
    const [, tick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => tick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);
    if (!stub) return null;
    const net = ItemStubs.netOf(stub);
    const { perHour } = ItemRateTracker.getFlow(itemId);
    const iconBtn = 'pointer-events-auto p-0.5 text-gi-muted hover:text-white cursor-pointer';
    return (
        <PixelFrame
            kind={FRAME_KIND.CHAMFER}
            data-stub-panel={itemId}
            className="absolute pointer-events-auto"
            style={{ top, right: COLUMN_PX, minWidth: 210 }}
            frameClassName="flex flex-col gap-0.5 px-1.5 py-0.5 font-pixel text-amber-100"
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
        >
            <div className="flex items-start gap-2">
                <span className="ui-text-body font-bold flex-1">{getItem(itemId)?.name || itemId}</span>
                {stub.pinned && (
                    <button type="button" data-stub-reset title="Back to +0" className={iconBtn} onClick={() => pins.reset(itemId)}>
                        <ResetGlyph />
                    </button>
                )}
                <button
                    type="button"
                    data-stub-pin
                    title={stub.pinned ? 'Unpin' : 'Pin: keep counting, never fade'}
                    className={cn(iconBtn, stub.pinned && 'text-gi-gold')}
                    onClick={() => (stub.pinned ? pins.unpin(itemId) : pins.pin(itemId))}
                >
                    <PinGlyph />
                </button>
            </div>
            <div className="ui-text-small flex gap-3 tabular-nums">
                <span style={{ color: TONE_COLOUR.gain }}>{signedAmount(stub.added)} gained</span>
                <span style={{ color: stub.removed ? TONE_COLOUR.loss : undefined }}>
                    {signedAmount(-stub.removed)} spent
                </span>
            </div>
            <div className="ui-text-body tabular-nums" data-stub-rate>
                <span style={{ color: TONE_COLOUR[toneOf(perHour)] }}>{rateText(perHour)}</span>
                {stub.pinned && <span className="ui-text-small text-gi-muted"> &middot; {signedAmount(net)} since pinned</span>}
            </div>
        </PixelFrame>
    );
}

/** How many unpinned stubs fit under the pinned ones, given the column's height. */
export function stubsThatFit(columnPx, pinnedCount) {
    const room = columnPx - HEADER_PX - pinnedCount * PITCH_PX - (pinnedCount ? GAP_PX : 0);
    return Math.max(0, Math.floor((room + GAP_PX) / PITCH_PX));
}

export const ItemStubColumn = memo(function ItemStubColumn() {
    const on = useSetting('notifications.itemStubs') !== false;
    const drawn = useDrawn('notifications');
    useSyncExternalStore(ItemStubs.subscribe, ItemStubs.getVersion);
    const boxRef = useRef(null);
    const [boxH, setBoxH] = useState(0);
    const [hover, setHover] = useState(null);
    const closeTimer = useRef(null);

    const measure = useCallback(() => {
        const h = boxRef.current?.clientHeight || 0;
        setBoxH(prev => (prev === h ? prev : h));
    }, []);
    useLayoutEffect(measure);
    useEffect(() => {
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [measure]);
    useEffect(() => () => clearTimeout(closeTimer.current), []);

    const keepOpen = useCallback(() => clearTimeout(closeTimer.current), []);
    const closeSoon = useCallback(() => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setHover(null), PANEL_CLOSE_MS);
    }, []);
    const openFor = useCallback((itemId, el) => {
        clearTimeout(closeTimer.current);
        const box = boxRef.current?.getBoundingClientRect();
        const row = el.getBoundingClientRect();
        setHover({ itemId, top: box ? row.top - box.top : 0 });
    }, []);

    if (!on || !drawn) return null;

    const stubs = ItemStubs.getStubs();
    const pinned = stubs.filter(s => s.pinned);
    const rest = stubs.filter(s => !s.pinned);
    const scrolls = boxH > 0 && rest.length > stubsThatFit(boxH, pinned.length);
    const row = (s) => <Stub key={s.itemId} stub={s} onHover={openFor} onLeave={closeSoon} />;

    return (
        <div
            ref={boxRef}
            data-item-stubs
            className="absolute top-2 right-2 bottom-2 flex flex-col items-end pointer-events-none select-none z-30"
            style={{ width: COLUMN_PX }}
        >
            <div className="shrink-0 flex justify-end items-center" style={{ height: HEADER_PX }}>
                {rest.length > 0 && (
                    <button
                        type="button"
                        data-stubs-clear
                        onClick={() => { setHover(null); ItemStubs.clearUnpinned(); }}
                        className="pointer-events-auto font-pixel ui-text-small text-gi-muted hover:text-white cursor-pointer px-1"
                    >
                        Clear all
                    </button>
                )}
            </div>
            {pinned.length > 0 && (
                <div data-stubs-pinned className="shrink-0 flex flex-col items-end">
                    {pinned.map(row)}
                </div>
            )}
            {pinned.length > 0 && rest.length > 0 && (
                <div className="shrink-0 w-full h-px mb-1.5 bg-[var(--color-ui-gold)] opacity-40" />
            )}
            {scrolls ? (
                <div className="flex-1 min-h-0 w-full flex flex-col pointer-events-auto">
                    <ArrowScrollList
                        compact
                        step={PITCH_PX * 2}
                        className="flex-1 min-h-0 flex flex-col items-end"
                        listProps={{ 'data-stubs-scroll': true }}
                    >
                        {rest.map(row)}
                    </ArrowScrollList>
                </div>
            ) : (
                <div className="flex flex-col items-end">{rest.map(row)}</div>
            )}
            {hover && (
                <StubPanel key={hover.itemId} itemId={hover.itemId} top={hover.top} onEnter={keepOpen} onLeave={closeSoon} />
            )}
        </div>
    );
});

export default ItemStubColumn;
