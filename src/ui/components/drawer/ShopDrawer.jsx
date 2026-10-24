import { memo, startTransition, useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import * as Shop from '../../../systems/board/Shop.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { useEntityDrag, useActiveDrag, useDragSurface } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { PanelHeader } from '../base/CloseX.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';

/**
 * The Shop drawer.
 * - **A drawer from the left edge**, a third of the screen wide, beside the nav when the nav
 * is on the left. Opened and closed by the nav's Shop bubble (`ui.nav.toggle('shop')`)
 * or its own Close.
 * - **Drag a row onto the mat to buy.** The row's payload is a `TOKEN` with `from.shop`;
 * `dropOnMat` hands it to `Shop.buyAt`, which pays on drop and places the Token at the drop
 * point. There are no Buy buttons.
 * - **While a Shop row is carried, the drawer slides away to a lip** ({@link SHOP_LIP_PX}
 * wide) whenever the pointer is over the playmat, and slides back open the moment it comes
 * back over the drawer, not just when the drag ends. A Shop Token let go over the lip (or the
 * reopened drawer) is a plain cancel ({@link pointerOverShopDrawer}).
 * - **Rows that cannot be bought are dimmed, say why in red, and cannot be picked up.** They
 * re-read on every Bank or cap change, and on a Mat Tuner cap change.
 * No inspect panel. Prices use the standard `EntityRibbon` item row, have / need, short in
 * red.
 */

/** How much of the drawer stays on screen while a Shop Token is carried. */
export const SHOP_LIP_PX = 28;

/**
 * Whether a viewport pointer is over the Shop drawer (or its lip), read from
 * the drawer's live box. The mat's drop handler asks this before buying: a
 * Shop Token let go over the drawer is a plain cancel even where the drawer
 * covers the mat.
 *
 * ⚠️ Deliberately NOT a droppable: dnd-kit measures droppables when a drag
 * starts, when the drawer is still fully open, so a droppable drawer would
 * swallow drops on the third of the mat it has since slid off.
 */
export function pointerOverShopDrawer(pointer) {
    if (!pointer || typeof document === 'undefined') return false;
    const el = document.querySelector('[data-shop-drawer]');
    if (!el || el.getAttribute('data-shop-drawer-state') === 'closed') return false;
    const r = el.getBoundingClientRect();
    return pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
}

export const isShopPayload = (p) => p?.kind === DRAG_KIND.TOKEN && !!p.from?.shop;

/**
 * `'closed' | 'open' | 'lip'`: shut, open, or slid away during a Shop drag.
 * The slide tracks WHERE the Shop row is being carried, not just that it is being carried: a
 * lip while the pointer is over the playmat, and open again the moment it is back over the
 * drawer, so the player can change their mind mid-drag. The default for `surface` reproduces
 * 'always a lip' for any caller that does not track position (e.g. a test driving this
 * directly).
 */
export function shopDrawerState(isOpen, activePayload, surface = DND_SURFACE.BOARD) {
    if (!isOpen) return 'closed';
    if (!isShopPayload(activePayload)) return 'open';
    return surface === DND_SURFACE.DRAWER ? 'open' : 'lip';
}

/** The lip stays beside the nav, not under it: `--nav-inset-l` is how far the nav reaches into the drawer. */
export function shopDrawerTransform(state) {
    if (state === 'open') return 'translateX(0)';
    if (state === 'lip') return `translateX(calc(-100% + var(--nav-inset-l, 0px) + ${SHOP_LIP_PX}px))`;
    return 'translateX(-100%)';
}

export const shopRowPayload = (typeId) => ({ typeId, from: { shop: typeId } });

/** What re-reads the catalogue: the Bank and the cap. */
const SHOP_EVENTS = Object.freeze([
    ENGINE_EVENTS.TOKEN_PURCHASED, ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GAME_RESET, ENGINE_EVENTS.GAME_LOADED,
    BOARD_EVENTS.TOKEN_PLACED, BOARD_EVENTS.TOKEN_DEPLETED,
    // A price is paid from the floor too (`InputAllocator.availableOf`); an upgrade raises the cap.
    BOARD_EVENTS.SPRITES_CHANGED, ENGINE_EVENTS.GUILD_UPGRADES_UPDATED
]);

function useShopRefresh(active) {
    const [, bump] = useState(0);
    useEffect(() => {
        if (!active) return undefined;
        // A transition: a purchase is a drop, and the whole catalogue redrawn in the drop's own
        // frame made it the drag's longest. The prices follow a frame later at most.
        const refresh = () => startTransition(() => bump(n => n + 1));
        const unsubs = SHOP_EVENTS.map(e => EventBus.subscribe(e, refresh, UI_LISTENER));
        // Spawns and depletions change the Token count too; only a changed count re-renders.
        let count = Shop.capStatus().count;
        unsubs.push(EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, () => {
            const next = Shop.capStatus().count;
            if (next !== count) { count = next; refresh(); }
        }, UI_LISTENER));
        // The cap is a Mat Tuner setting, which publishes no game event ().
        unsubs.push(onMatTuningChanged(refresh));
        return () => unsubs.forEach(u => u?.());
    }, [active]);
}

export const ShopDrawer = ({ isOpen, onClose, menuRight = false }) => {
    const { activePayload } = useActiveDrag();
    const surface = useDragSurface();
    const state = shopDrawerState(isOpen, activePayload, surface);

    return (
        <aside
            data-dnd-region="drawer"
            data-shop-drawer
            data-shop-drawer-state={state}
            aria-hidden={state === 'closed'}
            className={cn(
                'absolute inset-y-0 z-(--z-drawer)',
                // From the screen's edge, under the nav when it is on the left, as one panel: its
                // rows pad for the nav (`.gi-drawer-pad-x`, 84 / 152 px as the Bank drawer), and
                // what is left beside the nav is a third of the screen.
                'left-0 w-[calc(33.333vw+var(--nav-inset-l,0px))] min-w-[calc(300px+var(--nav-inset-l,0px))]',
                !menuRight && '[--nav-inset-l:84px] md:[--nav-inset-l:152px]',
                state === 'closed' ? 'pointer-events-none' : 'pointer-events-auto'
            )}
            style={{
                transform: shopDrawerTransform(state),
                opacity: state === 'closed' ? 0 : 1,
                visibility: state === 'closed' ? 'hidden' : 'visible',
                transition: state === 'closed'
                    ? 'transform 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms, visibility 0s linear 250ms'
                    : 'transform 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms'
            }}
        >
            <PixelFrame kind={FRAME_KIND.STUDS} className="h-full" frameClassName="flex flex-col">
                <ShopContents isOpen={isOpen} onClose={onClose} />
            </PixelFrame>

            {/* The lip: the strip left showing while a Shop Token is carried. */}
            <div
                aria-hidden
                className={cn(
                    'absolute inset-y-0 right-0 border-l-2 border-gi-gold/60 bg-gi-base/90 transition-opacity duration-200 pointer-events-none',
                    state === 'lip' ? 'opacity-100' : 'opacity-0'
                )}
                style={{ width: SHOP_LIP_PX }}
            />
        </aside>
    );
};

/**
 * What the drawer shows: its header and the rows for sale.
 * ⚠️ Apart from the drawer on purpose: the drawer redraws at every drag start, end and crossing
 * between the mat and a drawer (it slides to a lip for a Shop row), and the catalogue is worked
 * out afresh each time this draws.
 */
const ShopContents = memo(function ShopContents({ isOpen, onClose }) {
    useShopRefresh(isOpen);
    const shop = isOpen ? Shop.catalogue() : [];
    const cap = Shop.capStatus();

    return (
        <>
            <PanelHeader
                title="Shop"
                onClose={onClose}
                closeLabel="Close Shop"
                className="gi-drawer-pad-x py-1.5 border-b border-gi-border/40 bg-gi-base/80 min-h-[44px]"
            >
                <span data-shop-cap className="text-xs font-semibold text-gi-muted tabular-nums">
                    Tokens {cap.count} / {cap.cap}
                </span>
            </PanelHeader>

            <ArrowScrollList step={SHOP_SCROLL_STEP_PX} barClassName="gi-drawer-pad-x" className="flex-1 min-h-0 gi-drawer-pad-x py-3 flex flex-col gap-3">
                <p className="text-(length:--font-size-sm) text-gi-muted">Drag a Token onto the mat to buy it.</p>
                {shop.length === 0 && (
                    <p className="text-xs text-gi-muted">Nothing is for sale yet.</p>
                )}
                {shop.map(group => (
                    <section key={group.section} data-shop-section={group.section} className="flex flex-col gap-1.5">
                        <h3 className="text-(length:--font-size-sm) font-bold gi-caps tracking-wider text-gi-muted">{group.name}</h3>
                        {group.items.map(item => <ShopRow key={item.group ? `group:${item.group}` : item.typeId} item={item} />)}
                    </section>
                ))}
            </ArrowScrollList>
        </>
    );
});

/** Every Shop row is exactly this tall: the 128 px sprite plus the row's padding. */
export const SHOP_ART_PX = 128;
export const SHOP_ROW_PX = SHOP_ART_PX + 18;
/** How far an arrow press scrolls the list: two rows and their gaps. */
const SHOP_SCROLL_STEP_PX = (SHOP_ROW_PX + 6) * 2;

/**
 * One Token for sale, a fixed-height row: the name (a dropdown when the entry is a group), the
 * price in a 2 x 2 grid and, on the right, the Token at 128 px, the thing to drag out onto the
 * mat. The whole row is the drag handle. A row that cannot be bought is dimmed, names what is
 * missing in red, and does not start a drag. A group row buys the option picked in its dropdown.
 */
export const ShopRow = ({ item }) => {
    const options = item.options || null;
    const [picked, setPicked] = useState(null);
    const chosen = options ? (options.find(o => o.typeId === picked) || options[0]) : item;
    const ok = !!chosen.affordability?.success;
    const drag = useEntityDrag({
        id: `shop-row-${chosen.typeId}`,
        kind: DRAG_KIND.TOKEN,
        payload: shopRowPayload(chosen.typeId),
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !ok
    });
    return (
        <ShopRowBody
            item={item}
            chosen={chosen}
            ok={ok}
            onPick={setPicked}
            held={drag.isDragging}
            dragRef={drag.setNodeRef}
            dragProps={ok ? drag.handleProps : NO_HANDLE}
        />
    );
};

const NO_HANDLE = Object.freeze({});

// ⚠️ Apart from its drag hook on purpose: dnd-kit redraws the hook's holder at every drag start,
// end and change of target; the row is memoised on what it draws.
const ShopRowBody = memo(function ShopRowBody({ item, chosen, ok, onPick, held, dragRef, dragProps }) {
    const options = item.options || null;
    return (
        <Tooltip lines={[ok ? `Drag ${chosen.name} onto the mat to buy it` : chosen.affordability?.reason]}>
        <div
            ref={dragRef}
            {...dragProps}
            data-shop-item={chosen.typeId}
            data-shop-row={chosen.typeId}
            data-shop-group={item.group || undefined}
            data-shop-affordable={ok ? 'true' : 'false'}
            style={{ height: SHOP_ROW_PX }}
            className={cn(
                'shrink-0 overflow-hidden p-2 flex items-stretch gap-2 select-none transition-opacity',
                ok ? 'cursor-grab touch-none hover:outline-2 hover:outline-solid hover:-outline-offset-2 hover:outline-[var(--color-ui-white)]' : 'opacity-50 cursor-not-allowed',
                held && 'opacity-30'
            )}
        >
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2 min-w-0 h-6 shrink-0">
                    {options ? (
                        <select
                            data-shop-select
                            value={chosen.typeId}
                            onChange={e => onPick(e.target.value)}
                            onPointerDown={e => e.stopPropagation()}
                            onKeyDown={e => e.stopPropagation()}
                            aria-label={`${item.name}: pick one`}
                            className="ui-pixel-edge min-w-0 max-w-full text-sm font-bold text-gi-text bg-gi-base px-1 cursor-pointer"
                        >
                            {options.map(o => <option key={o.typeId} value={o.typeId}>{o.name}</option>)}
                        </select>
                    ) : (
                        <span className="text-sm font-bold text-gi-text truncate">{chosen.name}</span>
                    )}
                    {!ok && (
                        <span data-shop-missing className="text-xs font-semibold text-gi-danger truncate">
                            {chosen.affordability?.reason}
                        </span>
                    )}
                </div>
                {chosen.price.length > 0 && (
                    <div data-shop-price className="grid grid-cols-2 gap-1 content-start min-h-0">
                        {chosen.price.map(p => (
                            <EntityRibbon
                                key={p.itemId}
                                kind="item"
                                id={p.itemId}
                                name={p.name}
                                have={p.have}
                                required={p.need}
                                size="sm"
                                variant="cost"
                                title={null}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div
                data-shop-art
                className="shrink-0 flex items-center justify-center pointer-events-none"
                style={{ width: SHOP_ART_PX, height: SHOP_ART_PX }}
            >
                <TokenSprite typeId={chosen.typeId} surface={TOKEN_SURFACE.CARRY} size={SHOP_ART_PX} alt={chosen.name} />
            </div>
        </div>
        </Tooltip>
    );
});

export default ShopDrawer;
