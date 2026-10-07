import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import * as Shop from '../../../systems/board/Shop.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { useEntityDrag, useActiveDrag, useDragSurface } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The Shop drawer.
 * - **A drawer from the left edge**, a third of the screen wide, beside the nav when the nav
 * is on the left. Opened and closed by the nav's Shop bubble (`ui.nav.toggle('cartographer')`)
 * or its own Close.
 * - **Drag a row onto the mat to buy.** The row's payload is a `TOKEN` with `from.shop`;
 * `dropOnMat` hands it to `Shop.buyAt`, which pays on drop and places the Token at the drop
 * point. There are no Buy buttons.
 * - **While a Shop row is carried, the drawer slides away to a lip** ({@link SHOP_LIP_PX}
 * wide) whenever the pointer is over the playmat, and slides back open the moment it comes
 * back over the drawer, not just when the drag ends. A Shop Token let go over the lip (or the
 * reopened drawer) is a plain cancel ({@link pointerOverShopDrawer}).
 * - **Rows that cannot be bought are dimmed, say why in red, and cannot be picked up.** They
 * re-read on every Bank, cap or bin change, and on a Mat Tuner cap change.
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

export function shopDrawerTransform(state) {
    if (state === 'open') return 'translateX(0)';
    if (state === 'lip') return `translateX(calc(-100% + ${SHOP_LIP_PX}px))`;
    return 'translateX(-100%)';
}

export const shopRowPayload = (typeId) => ({ typeId, from: { shop: typeId } });

/** What re-reads the catalogue: the Bank, the cap and the bin (binned Tokens count). */
const SHOP_EVENTS = Object.freeze([
    ENGINE_EVENTS.TOKEN_PURCHASED, ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.STATE_CHANGED, ENGINE_EVENTS.GAME_LOADED,
    BOARD_EVENTS.BIN_CHANGED, BOARD_EVENTS.TOKEN_PLACED, BOARD_EVENTS.TOKEN_DEPLETED
]);

function useShopRefresh(active) {
    const [, bump] = useState(0);
    useEffect(() => {
        if (!active) return undefined;
        const refresh = () => bump(n => n + 1);
        const unsubs = SHOP_EVENTS.map(e => EventBus.subscribe(e, refresh));
        // The cap is a Mat Tuner setting, which publishes no game event ().
        unsubs.push(onMatTuningChanged(refresh));
        return () => unsubs.forEach(u => u?.());
    }, [active]);
}

export const ShopDrawer = ({ isOpen, onClose, menuRight = false }) => {
    useShopRefresh(isOpen);
    const { activePayload } = useActiveDrag();
    const surface = useDragSurface();
    const state = shopDrawerState(isOpen, activePayload, surface);

    const shop = isOpen ? Shop.catalogue() : [];
    const cap = Shop.capStatus();

    return (
        <aside
            data-dnd-region="drawer"
            data-shop-drawer
            data-shop-drawer-state={state}
            aria-hidden={state === 'closed'}
            className={cn(
                'absolute inset-y-0 z-[90] flex flex-col bg-gi-surface border-r border-gi-primary/30 shadow-[0_0_40px_rgba(0,0,0,0.6)]',
                'w-[33.333vw] min-w-[300px]',
                // Beside the nav when it is on the left (84 / 152 px, as the
                // Bank drawer pads for it); at the screen's edge otherwise.
                menuRight ? 'left-0' : 'left-[84px] md:left-[152px]',
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
            <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 border-b border-gi-border/40 bg-gi-base/80 min-h-[44px]">
                <span className="text-sm md:text-base font-bold tracking-wide text-gi-text">Shop</span>
                <div className="flex items-center gap-2.5">
                    <span data-shop-cap className="text-xs font-semibold text-gi-muted tabular-nums">
                        Placed Tokens {cap.placed} / {cap.cap}
                    </span>
                    <button
                        onClick={onClose}
                        title="Close Shop"
                        className="p-0.5 rounded cursor-pointer flex items-center justify-center gi-hover-pulse"
                    >
                        <img
                            src="/assets/ui/ui_cancel_red.png"
                            alt="Close"
                            className="w-8 h-8 object-contain select-none pointer-events-none"
                            style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }}
                        />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto gi-scrollbar p-3 flex flex-col gap-3">
                <p className="text-[11px] text-gi-muted">Drag a Token onto the mat to buy it.</p>
                {shop.length === 0 && (
                    <p className="text-xs text-gi-muted">Nothing is for sale yet.</p>
                )}
                {shop.map(group => (
                    <section key={group.section} data-shop-section={group.section} className="flex flex-col gap-1.5">
                        <h3 className="text-[11px] font-bold gi-caps tracking-wider text-gi-muted">{group.name}</h3>
                        {group.items.map(item => <ShopRow key={item.typeId} item={item} />)}
                    </section>
                ))}
            </div>

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
 * One Token for sale: sprite, name, then one standard item row per price line
 * (have / need). The whole row is the drag handle. A row that cannot
 * be bought is dimmed, names what is missing in red, and does not start a drag.
 */
export const ShopRow = ({ item }) => {
    const ok = !!item.affordability?.success;
    const drag = useEntityDrag({
        id: `shop-row-${item.typeId}`,
        kind: DRAG_KIND.TOKEN,
        payload: shopRowPayload(item.typeId),
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !ok
    });
    return (
        <div
            ref={drag.setNodeRef}
            {...(ok ? drag.handleProps : {})}
            data-shop-item={item.typeId}
            data-shop-row={item.typeId}
            data-shop-affordable={ok ? 'true' : 'false'}
            title={ok ? `Drag ${item.name} onto the mat to buy it` : item.affordability?.reason}
            className={cn(
                'rounded-lg border border-gi-border/50 bg-gi-base/50 p-2 flex flex-col gap-2 select-none transition-opacity',
                ok ? 'cursor-grab touch-none hover:border-gi-gold/60' : 'opacity-50 cursor-not-allowed',
                drag.isDragging && 'opacity-30'
            )}
        >
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 flex items-center justify-center pointer-events-none">
                    <TokenSprite typeId={item.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt={item.name} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-sm font-bold text-gi-text">{item.name}</span>
                    {!ok && (
                        <span data-shop-missing className="text-xs font-semibold text-gi-danger">
                            {item.affordability?.reason}
                        </span>
                    )}
                </div>
            </div>
            {item.price.length > 0 && (
                <div data-shop-price className="flex flex-col gap-1">
                    {item.price.map(p => (
                        <EntityRibbon
                            key={p.itemId}
                            kind="item"
                            id={p.itemId}
                            name={p.name}
                            have={p.have}
                            required={p.need}
                            size="sm"
                            variant="cost"
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ShopDrawer;
