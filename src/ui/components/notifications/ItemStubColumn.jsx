import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import * as ItemStubs from '../../../systems/notifications/itemStubs.js';
import { pins } from '../../../systems/notifications/routing.js';
import { ItemRateTracker } from '../../../systems/inventory/ItemRateTracker.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { PixelFrame, FRAME_KIND, FRAME_BAND_PX } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { cn } from '../../utils/cn.js';
import { TONE_COLOUR, rateText, signedAmount, toneOf } from './stubText.js';
import { useStubGlide, glideShift } from './stubGlide.js';
import { getCopies, getCopiesVersion, subscribeCopies } from './stubLanding.js';
import { GAP_PX, HEADER_PX, PAD_LEFT_PX, PAD_RIGHT_PX, PITCH_PX, ROW_GAP_PX, SPRITE_PX, STUB_PX } from './stubGeometry.js';

/**
 * The item stubs: a column flush against the right edge of the mat, under the top bar, like tabs
 * pulled out of the side, each as wide as its content. One stub per item, the amount then the
 * sprite (`+12 [oak]`), green for a net gain and red for a loss. Pinned stubs are held at the top,
 * always open; the rest scroll with the arrow bars once they no longer fit. A new stub joins the
 * bottom; when a stub's place changes it glides there (`stubGlide.js`).
 *
 * Hovering a stub grows the same box left over the mat into one line: amount, sprite, name, net
 * per hour. It is drawn over the stub rather than inside the column so the scroll box cannot clip
 * it, and nothing else in the column moves. Left-click pins or unpins; right-click clears an
 * unpinned stub and sets a pinned one back to +0.
 *
 * Collected loot flies to its stub and the count ticks as it lands (`stubLanding.js`); a stub out
 * of view gets a copy popped out over the bottom stubs for the landing, drawn here.
 *
 * The stubs are merged in `itemStubs.js`; this column draws what it is handed, at most once per
 * {@link ItemStubs.EMIT_MS} and once per landing. No backdrop blur: every stub is a solid frame.
 */

/** How long the open stub waits before closing, so the pointer can cross onto it from its stub. */
const OPEN_CLOSE_MS = 120;

function useSetting(path) {
    const [value, setValue] = useState(() => SettingsManager.get(path));
    useEffect(() => EventBus.subscribe(ENGINE_EVENTS.SETTINGS_UPDATED, () => setValue(SettingsManager.get(path)), UI_LISTENER), [path]);
    return value;
}

/** Left-click pins or unpins; right-click clears or resets. The browser's menu never opens. */
const pressHandlers = (itemId, onCleared) => ({
    onClick: (e) => { if (e.button === 0) pins.toggle(itemId); },
    onContextMenu: (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasPinned = ItemStubs.getStub(itemId)?.pinned;
        pins.clear(itemId);
        if (!wasPinned) onCleared?.();
    }
});

/** The open stub's name and net per hour, after the sprite. */
const OpenTail = ({ itemId, perHour }) => (
    <>
        <span data-stub-name className="text-amber-100">{getItem(itemId)?.name || itemId}</span>
        <span data-stub-rate className="tabular-nums" style={{ color: TONE_COLOUR[toneOf(perHour)] }}>
            {rateText(perHour)}
        </span>
    </>
);

/** A stub's content, left to right: the amount (led by "New!"), the sprite, and when open the name and rate. */
function StubRow({ stub, net, children, rowRef }) {
    return (
        <div ref={rowRef} className="h-full w-max flex items-center whitespace-nowrap" style={{ gap: ROW_GAP_PX, paddingLeft: PAD_LEFT_PX, paddingRight: PAD_RIGHT_PX }}>
            <span className="shrink-0 flex items-baseline gap-1">
                {stub.isNew && <span className="ui-text-small font-bold" style={{ color: 'var(--color-ui-gold)' }}>New!</span>}
                <span className="tabular-nums font-bold" style={{ color: TONE_COLOUR[toneOf(net)] }}>{signedAmount(net)}</span>
            </span>
            <span data-stub-sprite className="shrink-0 flex">
                <ItemIcon item={stub.itemId} size={SPRITE_PX} title={null} />
            </span>
            {children}
        </div>
    );
}

const frameClass = (stub, shine = true) => cn(
    'gi-stub-frame h-full w-full overflow-hidden font-pixel ui-text-body text-amber-100',
    stub.isNew && 'ui-frame-chamfer-gold',
    stub.isNew && shine && 'gi-stub-new'
);

/**
 * One stub at rest. Exported for the style sheet page, which leaves out the handlers. With
 * `openRate` (the per-hour rate to show) it is drawn open: a pinned stub always is.
 */
export const Stub = memo(function Stub({ stub, onHover, onLeave, onCleared, interactive = true, openRate }) {
    const open = openRate !== undefined;
    const net = ItemStubs.shownNetOf(stub);
    return (
        <div
            data-item-stub={stub.itemId}
            data-stub-net={net}
            data-stub-new={stub.isNew ? 'true' : undefined}
            data-stub-pinned={stub.pinned ? 'true' : undefined}
            data-stub-fading={stub.fading ? 'true' : undefined}
            data-stub-leaving={stub.leaving ? 'true' : undefined}
            data-stub-arriving={ItemStubs.isFresh(stub) ? 'true' : undefined}
            className={cn('gi-stub shrink-0', interactive && 'pointer-events-auto cursor-pointer')}
            style={{ height: STUB_PX, marginBottom: GAP_PX }}
            onMouseEnter={onHover ? (e) => { if (e.buttons === 0) onHover(stub.itemId, e.currentTarget); } : undefined}
            onMouseLeave={onLeave}
            {...(interactive ? pressHandlers(stub.itemId, onCleared) : null)}
        >
            <PixelFrame kind={FRAME_KIND.CHAMFER} className="h-full" frameClassName={frameClass(stub)}>
                <StubRow stub={stub} net={net}>{open && <OpenTail itemId={stub.itemId} perHour={openRate} />}</StubRow>
            </PixelFrame>
        </div>
    );
});

/** A pinned stub: always open, its rate live. */
const PinnedStub = memo(function PinnedStub({ stub, onCleared }) {
    const [, tick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => tick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);
    return <Stub stub={stub} onCleared={onCleared} openRate={ItemRateTracker.getFlow(stub.itemId).perHour} />;
});

/**
 * The hovered stub, open: the same box, grown left over the mat. It opens from the stub's own
 * width, so the amount and sprite slide left as the name and rate come out from under them.
 * Live while open: the rate moves on its own.
 */
export function OpenStub({ itemId, top, startPx, onEnter, onLeave, onCleared, onWheel }) {
    const stub = ItemStubs.getStub(itemId);
    const boxRef = useRef(null);
    const rowRef = useRef(null);
    const opened = useRef(false);
    const [, tick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => tick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);
    // The width follows the line (the amount and rate change while open). The first time it
    // starts from the stub's width so the box visibly grows; the transition is in tailwind.css.
    useLayoutEffect(() => {
        const box = boxRef.current;
        const row = rowRef.current;
        if (!box || !row) return;
        const full = `${Math.max(startPx, FRAME_BAND_PX + row.offsetWidth)}px`;
        if (!opened.current) {
            opened.current = true;
            box.style.width = `${startPx}px`;
            box.getBoundingClientRect();
        }
        if (box.style.width !== full) box.style.width = full;
    });
    if (!stub) return null;
    const net = ItemStubs.shownNetOf(stub);
    const { perHour } = ItemRateTracker.getFlow(itemId);
    return (
        <div
            ref={boxRef}
            data-stub-open={itemId}
            className="gi-stub-open absolute right-0 pointer-events-auto cursor-pointer"
            style={{ top, height: STUB_PX, width: startPx }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onWheel={onWheel}
            {...pressHandlers(itemId, onCleared)}
        >
            <PixelFrame kind={FRAME_KIND.CHAMFER} className="h-full" frameClassName={frameClass(stub, false)}>
                <StubRow stub={stub} net={net} rowRef={rowRef}>
                    <OpenTail itemId={itemId} perHour={perHour} />
                </StubRow>
            </PixelFrame>
        </div>
    );
}

/**
 * A copy of a stub that is out of view, popped out of the edge over the bottom stubs to take
 * collected loot landing on it (`stubLanding.js`), then slid back. Clicked, it pins or clears its
 * own item like the stub it copies (it covers another stub, which must not take the click); it
 * opens nothing on hover, and nothing that looks for stubs finds it.
 */
const StubCopy = memo(function StubCopy({ copy, stub, onCleared }) {
    if (!stub) return null;
    const net = ItemStubs.shownNetOf(stub);
    return (
        <div
            data-stub-copy={copy.itemId}
            data-stub-net={net}
            data-stub-arriving="true"
            data-stub-leaving={copy.leaving ? 'true' : undefined}
            className="gi-stub absolute right-0 z-10 pointer-events-auto cursor-pointer"
            style={{ top: copy.top, height: STUB_PX }}
            {...pressHandlers(copy.itemId, onCleared)}
        >
            <PixelFrame kind={FRAME_KIND.CHAMFER} className="h-full" frameClassName={frameClass(stub, false)}>
                <StubRow stub={stub} net={net} />
            </PixelFrame>
        </div>
    );
});

/** How many unpinned stubs fit under the pinned ones, given the column's height. */
export function stubsThatFit(columnPx, pinnedCount) {
    const room = columnPx - HEADER_PX - pinnedCount * PITCH_PX;
    return Math.max(0, Math.floor((room + GAP_PX) / PITCH_PX));
}

export const ItemStubColumn = memo(function ItemStubColumn() {
    const on = useSetting('notifications.itemStubs') !== false;
    const drawn = useDrawn('notifications');
    useSyncExternalStore(ItemStubs.subscribe, ItemStubs.getVersion);
    useSyncExternalStore(subscribeCopies, getCopiesVersion);
    const boxRef = useRef(null);
    const [boxH, setBoxH] = useState(0);
    const [hover, setHover] = useState(null);
    const closeTimer = useRef(null);

    const measure = useCallback(() => {
        const h = boxRef.current?.clientHeight || 0;
        setBoxH(prev => (prev === h ? prev : h));
    }, []);
    useLayoutEffect(measure);
    useStubGlide(boxRef);
    // The open stub stays over its stub when the column moves under a still pointer (a new stub
    // pushes it down), and closes when its stub goes or is pinned (a pinned stub is always open). Every render,
    // since the stubs are not a dependency; it settles because it only moves a moved box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        if (!hover) return;
        const box = boxRef.current;
        const row = box && [...box.querySelectorAll('[data-item-stub]')].find(el => el.dataset.itemStub === hover.itemId);
        const stub = ItemStubs.getStub(hover.itemId);
        if (!row || !stub || stub.pinned || stub.leaving || stub.fading) { setHover(null); return; }
        // Where the stub rests, not where a glide has it this frame.
        const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top - glideShift(row);
        if (Math.abs(top - hover.top) > 0.5) setHover({ ...hover, top });
    });
    useEffect(() => {
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [measure]);
    useEffect(() => () => clearTimeout(closeTimer.current), []);

    const keepOpen = useCallback(() => clearTimeout(closeTimer.current), []);
    const closeSoon = useCallback(() => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setHover(null), OPEN_CLOSE_MS);
    }, []);
    const closeNow = useCallback(() => { clearTimeout(closeTimer.current); setHover(null); }, []);
    const openFor = useCallback((itemId, el) => {
        clearTimeout(closeTimer.current);
        ItemStubs.clearNew(itemId);
        const box = boxRef.current?.getBoundingClientRect();
        const row = el.getBoundingClientRect();
        setHover({ itemId, top: box ? row.top - box.top - glideShift(el) : 0, startPx: row.width });
    }, []);
    // The open stub sits over the scroll box: the wheel still scrolls the list beneath it.
    const scrollUnder = useCallback((e) => {
        boxRef.current?.querySelector('[data-stubs-scroll]')?.scrollBy({ top: e.deltaY });
    }, []);

    if (!on || !drawn) return null;

    const stubs = ItemStubs.getStubs();
    const pinned = stubs.filter(s => s.pinned);
    const rest = stubs.filter(s => !s.pinned);
    const scrolls = boxH > 0 && rest.length > stubsThatFit(boxH, pinned.length);
    const row = (s) => <Stub key={s.itemId} stub={s} onHover={openFor} onLeave={closeSoon} onCleared={closeNow} />;
    const pinnedRow = (s) => <PinnedStub key={s.itemId} stub={s} onCleared={closeNow} />;

    return (
        <div
            ref={boxRef}
            data-item-stubs
            className="absolute top-2 right-0 bottom-2 flex flex-col items-end pointer-events-none select-none z-30"
        >
            <div className="shrink-0 flex justify-end items-center" style={{ height: HEADER_PX }}>
                {rest.some(s => !s.leaving) && (
                    <button
                        type="button"
                        data-stubs-clear
                        onClick={() => { closeNow(); ItemStubs.clearUnpinned(); }}
                        className="pointer-events-auto font-pixel ui-text-small text-gi-muted hover:text-white cursor-pointer px-2"
                    >
                        Clear all
                    </button>
                )}
            </div>
            {pinned.length > 0 && (
                <div data-stubs-pinned className="shrink-0 flex flex-col items-end">
                    {pinned.map(pinnedRow)}
                </div>
            )}
            {scrolls ? (
                <div className="flex-1 min-h-0 flex flex-col pointer-events-auto">
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
            {getCopies().map(c => <StubCopy key={c.key} copy={c} stub={ItemStubs.getStub(c.itemId)} onCleared={closeNow} />)}
            {hover && (
                <OpenStub
                    key={hover.itemId}
                    itemId={hover.itemId}
                    top={hover.top}
                    startPx={hover.startPx}
                    onEnter={keepOpen}
                    onLeave={closeSoon}
                    onCleared={closeNow}
                    onWheel={scrollUnder}
                />
            )}
        </div>
    );
});

export default ItemStubColumn;
