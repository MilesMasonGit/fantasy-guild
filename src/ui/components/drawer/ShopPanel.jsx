import { memo, startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import * as Shop from '../../../systems/board/Shop.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { t } from '../../../i18n/index.js';
import { useEntityDrag, useActiveDrag, interceptDrops } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE, DRAG_SFX } from '../../dnd/dragConstants.js';
import { dropOnShop } from '../board/dropOnMat.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { PanelHeader } from '../base/CloseX.jsx';
import { LimesBlurb } from '../limes/LimesBlurb.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { DOCK_STRIP_PX, dockArtPx, dockLabelOverhangPx } from '../dock/dockHeroView.js';

/**
 * The Shop: a panel that rises from behind the hero bar, down to the screen's bottom edge, beside the
 * nav on whichever side the nav is; the bar stays in front, its strip, names and HP bars over the
 * panel's foot, which is kept clear for them. One bottom panel at a time: it and a hero's panel
 * close each other (`useOneBottomDrawer`). Opened and closed by the nav's Shop bubble
 * (`ui.nav.toggle('shop')`) or its own Close.
 * - **A row of cards**, each the same size: the name (a dropdown for a group), the Token large,
 * its skill icons, and the price as up to four pills under them. Arrow bars left and right, no
 * scroll bar. Across the whole screen, the cards from the nav's side.
 * - **Drag a card onto the mat to buy.** The card's payload is a `TOKEN` with `from.shop`;
 * `dropOnMat` hands it to `Shop.buyAt`, which pays on drop and places the Token at the drop
 * point. The panel stays open after a purchase.
 * - **While a card is carried off the panel, the Shop lowers** (`'lip'`): only its header row stays
 * up at the screen's bottom edge (its `peek`, {@link lowerPeekOf}), the bar drawn over it as ever,
 * so the whole mat is free. Coming down onto that edge raises the Shop again; leaving the risen
 * panel upward lowers it again ({@link stripHoverAt}). A Shop Token let go over the lowered edge (or
 * the risen panel) is a plain cancel ({@link pointerOverShopPanel}).
 * - **An unbuilt Foundation picked up off the mat lowers the Shop the same way**, open or not:
 * let go over its edge or the risen panel, it goes back to the Shop for its price
 * (`dropOnShop`, `Shop.refund`). Any other Token from the mat let go over the open Shop lands
 * on the mat under it, as before.
 * - **A card that cannot be bought** keeps its look but for a dimmed Token; the short counts are
 * red, and it cannot be picked up. A full Token cap says so on the card, since no price shows it.
 * Cards re-read on every Bank or cap change, and on a Mat Tuner cap change.
 *
 * ⚠️ `data-shop-drawer`, `data-shop-drawer-state`, `data-shop-row`, `data-shop-affordable` and a
 * held card's `opacity-30` are read by the benches (`bench/browser/scenes.mjs`, `dragKit.mjs`):
 * keep them.
 */

/**
 * How much of the lowered Shop stays up, in px: its frame's top and its header row, measured from
 * the live panel (a slide moves both alike). Falls back to the panel's foot when there is no layout
 * to measure (tests) or no header.
 */
export function lowerPeekOf(panel) {
    const header = panel.querySelector('[data-panel-header]');
    const peek = header ? header.getBoundingClientRect().bottom - panel.getBoundingClientRect().top : 0;
    if (peek > 0) return Math.round(peek);
    return panel.querySelector('[data-shop-foot]')?.offsetHeight || 0;
}

/**
 * Where the lowered Shop's top edge stands, in viewport px: its container's bottom (the screen's
 * bottom edge) less its peek. From the live layout, which a slide does not move, so a drop
 * mid-slide is judged where the edge comes to rest.
 */
export function loweredTopOf(panel) {
    const bottom = (panel.offsetParent || document.documentElement).getBoundingClientRect().bottom;
    return bottom - lowerPeekOf(panel);
}

/**
 * Whether a viewport pointer is over the Shop as it is drawn now: from the lowered Shop's top edge
 * down to the screen's bottom edge (the hero bar too), or the risen panel's own box. Read from the
 * live layout at the drop, never from the drag-start snapshot, which was taken with the panel
 * fully up.
 * The mat's drop handler asks this before buying (a Shop Token let go here is a plain cancel),
 * and the Shop's own drop check before a refund.
 *
 * ⚠️ Deliberately NOT a droppable: dnd-kit measures droppables when a drag starts, when the
 * panel is still fully up, so a droppable panel would swallow drops on the strip of mat it has
 * since dropped off.
 */
export function pointerOverShopPanel(pointer) {
    if (!pointer || typeof document === 'undefined') return false;
    const el = document.querySelector('[data-shop-drawer]');
    const state = el?.getAttribute('data-shop-drawer-state');
    if (!el || state === 'closed') return false;
    const r = el.getBoundingClientRect();
    if (pointer.x >= r.left && pointer.x <= r.right && pointer.y >= loweredTopOf(el)) return true;
    if (state !== 'open') return false;
    return pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
}

export const isShopPayload = (p) => p?.kind === DRAG_KIND.TOKEN && !!p.from?.shop;

/** A Token picked up off the mat. */
export const isMatTokenPayload = (p) => p?.kind === DRAG_KIND.TOKEN && p.from?.instanceId != null;

/** Whether the Token in the hand could go back to the Shop: an unbuilt Foundation on the mat (`Shop.canRefund`). */
export const isRefundablePayload = (p) => isMatTokenPayload(p) && !!Shop.canRefund(p.from.instanceId).ok;

/**
 * Whether this drag lowers the Shop: a Shop card carried from the open Shop, or a
 * Token that can go back to the Shop (`refundable`, worked out once at pickup), whether the Shop
 * is open or not, so there is always somewhere to hand it back.
 */
export function isStripDrag(isOpen, activePayload, refundable = false) {
    return (isOpen && isShopPayload(activePayload)) || (refundable && isMatTokenPayload(activePayload));
}

/**
 * `'closed' | 'open' | 'lip'`: shut, up, or lowered to the hero bar during a drag (`'lip'`).
 * During a strip drag ({@link isStripDrag}) the Shop is up only while `raised`, which
 * {@link stripHoverAt} works out from where the Token is carried; otherwise it is as the player
 * left it. After the drop it is as the player left it again: a Shop raised by a refund drag
 * closes.
 */
export function shopPanelState(isOpen, activePayload, { raised = false, refundable = false } = {}) {
    if (!isStripDrag(isOpen, activePayload, refundable)) return isOpen ? 'open' : 'closed';
    return raised ? 'open' : 'lip';
}

/**
 * Where a strip drag starts: a Shop card is picked up off the risen panel; a Token off the mat
 * starts with the Shop lowered, and not yet armed: a Token picked up where the lowered edge then
 * appears must be carried above it once before the edge raises the Shop or takes a drop, so a
 * pickup there let go on the spot is a plain put-down, not a refund.
 */
export const stripHoverStart = (activePayload) => (isShopPayload(activePayload)
    ? { raised: true, armed: true }
    : { raised: false, armed: false });

/**
 * The lowered Shop's hover, one pointer move on: the pointer at viewport `y`, the lowered top edge
 * at `stripTop`, the risen panel's top at `openTop`. Lowered, the Shop rises when the pointer comes
 * down onto its edge (or the bar under it); risen, it lowers again once the pointer leaves the
 * panel upward. Returns `prev` itself when nothing changed.
 */
export function stripHoverAt(prev, y, { stripTop, openTop }) {
    const armed = prev.armed || y < stripTop;
    const raised = prev.raised ? y >= openTop : armed && y >= stripTop;
    return raised === prev.raised && armed === prev.armed ? prev : { raised, armed };
}

/**
 * Where the panel is moved to for `state`. `under`: how far above the screen's bottom the panel
 * stands, so a closed panel goes all the way down out of sight. Lowered (`'lip'`), only its `peek`
 * stays up: its header row at the screen's bottom edge, the bar over it.
 */
export function shopPanelTransform(state, { under = 0, peek = 0 } = {}) {
    if (state === 'open') return 'translateY(0)';
    if (state === 'lip') return `translateY(calc(100% - ${peek}px))`;
    return under ? `translateY(calc(100% + ${under}px))` : 'translateY(100%)';
}

export const shopCardPayload = (typeId) => ({ typeId, from: { shop: typeId } });

/** What re-reads the catalogue: the Bank and the cap. */
const SHOP_EVENTS = Object.freeze([
    ENGINE_EVENTS.TOKEN_PURCHASED, ENGINE_EVENTS.TOKEN_REFUNDED, ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GAME_RESET, ENGINE_EVENTS.GAME_LOADED,
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
        // The cap is a Mat Tuner setting, which publishes no game event.
        unsubs.push(onMatTuningChanged(refresh));
        return () => unsubs.forEach(u => u?.());
    }, [active]);
}

/**
 * The lowered Shop's hover during a strip drag: whether the Shop is raised, from the pointer's
 * height alone. ⚠️ No layout read per pointer move: the lowered edge and the risen panel's top are
 * measured from the live elements when the strip drag starts and again at each rise and drop (a
 * Shop raised by a refund drag fills with its cards only then), and a move is two comparisons;
 * the panel redraws only when the Shop rises or drops.
 */
function useStripHover(strip, activePayload, asideRef) {
    // Kept with the drag it belongs to, so a new drag starts where it starts (`stripHoverStart`).
    const [hover, setHover] = useState({ payload: null, raised: false });
    const hoverRef = useRef(null);
    const geoRef = useRef(null);
    const up = strip && (hover.payload === activePayload ? hover.raised : stripHoverStart(activePayload).raised);

    useLayoutEffect(() => {
        hoverRef.current = strip ? stripHoverStart(activePayload) : null;
    }, [strip, activePayload]);

    useLayoutEffect(() => {
        if (!strip) { geoRef.current = null; return; }
        const aside = asideRef.current;
        if (!aside) return;
        const bottom = (aside.offsetParent || document.documentElement).getBoundingClientRect().bottom;
        geoRef.current = { stripTop: loweredTopOf(aside), openTop: bottom - aside.offsetHeight };
    }, [strip, up, asideRef]);

    useEffect(() => {
        if (!strip) return undefined;
        const onMove = (e) => {
            const geo = geoRef.current;
            const prev = hoverRef.current;
            if (!geo || !prev) return;
            const next = stripHoverAt(prev, e.clientY, geo);
            if (next === prev) return;
            hoverRef.current = next;
            if (next.raised !== prev.raised) setHover({ payload: activePayload, raised: next.raised });
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => window.removeEventListener('pointermove', onMove);
    }, [strip, activePayload]);

    return { raised: up, hoverRef };
}

/** The lowered Shop's peek ({@link lowerPeekOf}), measured once laid out and again on a resize. */
function useLowerPeek(asideRef, foot) {
    const [peek, setPeek] = useState(foot);
    useLayoutEffect(() => {
        const measure = () => { if (asideRef.current) setPeek(lowerPeekOf(asideRef.current)); };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [asideRef, foot]);
    return peek;
}

export const ShopPanel = ({ isOpen, onClose, menuRight = false }) => {
    const { activePayload } = useActiveDrag();
    // Once per pickup: whether the Token in the hand could go back to the Shop.
    const refundable = useMemo(() => isRefundablePayload(activePayload), [activePayload]);
    const strip = isStripDrag(isOpen, activePayload, refundable);
    const asideRef = useRef(null);
    const { raised, hoverRef } = useStripHover(strip, activePayload, asideRef);
    const state = shopPanelState(isOpen, activePayload, { raised, refundable });
    // The band at the panel's foot the bar stands over: its strip, and the names and HP bars above it.
    const foot = DOCK_STRIP_PX + dockLabelOverhangPx(dockArtPx(useLiveMatFit()));
    const peek = useLowerPeek(asideRef, foot);

    // A Foundation from the mat let go over the Shop goes back to it. Taken before any drop target
    // is asked: the mat would otherwise move it to that spot under the Shop. Only a refund drag
    // (one that lowered the Shop): any other Token let go over the Shop lands on the mat under
    // it, as it always has (GDD, "Drops over a drawer").
    useEffect(() => interceptDrops((payload, { pointer } = {}) => {
        if (!isMatTokenPayload(payload)) return null;
        const hover = hoverRef.current;
        // A Token picked up where the lowered edge then appeared, not yet carried above it, is put down.
        if (!hover?.armed) return null;
        if (!pointerOverShopPanel(pointer)) return null;
        const result = dropOnShop(payload);
        if (!result) return null;
        return result.success ? { success: true, sfx: DRAG_SFX.refund } : { success: false };
    }), [hoverRef]);

    return (
        <aside
            ref={asideRef}
            data-dnd-region="drawer"
            data-shop-drawer
            data-shop-drawer-state={state}
            data-shop-side={menuRight ? 'right' : 'left'}
            aria-hidden={state === 'closed'}
            className={cn(
                // Edge to edge, under the nav as one panel: its rows pad for the nav
                // (`.gi-drawer-pad-x`, 84 / 152 px as the Bank drawer), the cards from the nav's side.
                'absolute inset-x-0 z-(--z-drawer)',
                menuRight
                    ? '[--nav-inset-r:84px] md:[--nav-inset-r:152px]'
                    : '[--nav-inset-l:84px] md:[--nav-inset-l:152px]',
                state === 'open' ? 'pointer-events-auto' : 'pointer-events-none'
            )}
            style={{
                // To the screen's bottom edge, behind the bar: no gap under the panel.
                bottom: 0,
                transform: shopPanelTransform(state, { peek }),
                opacity: state === 'closed' ? 0 : 1,
                visibility: state === 'closed' ? 'hidden' : 'visible',
                transition: state === 'closed'
                    ? 'transform 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms, visibility 0s linear 250ms'
                    : 'transform 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms'
            }}
        >
            <PixelFrame kind={FRAME_KIND.STUDS} backdrop="shop" frameClassName="flex flex-col">
                {/* A Shop raised by a refund drag fills with its cards once it is up. */}
                <ShopContents isOpen={isOpen || state === 'open'} onClose={onClose} menuRight={menuRight} />
                <div aria-hidden data-shop-foot className="shrink-0" style={{ height: foot }} />
            </PixelFrame>
        </aside>
    );
};

/**
 * What the panel shows: its header and the cards.
 * ⚠️ Apart from the panel on purpose: the panel redraws at every drag start, end, rise and drop
 * (it lowers for a Shop card), and the catalogue is worked out afresh each time this
 * draws.
 */
const ShopContents = memo(function ShopContents({ isOpen, onClose, menuRight }) {
    useShopRefresh(isOpen);
    const shop = isOpen ? Shop.catalogue() : [];
    const cap = Shop.capStatus();
    // One small Limes on the first Foundation for sale, not on every one.
    const limesOn = shop.find(item => Shop.buildsOf(item.typeId).length > 0);

    return (
        <>
            <PanelHeader
                title={t('shop.title')}
                onClose={onClose}
                closeLabel={t('shop.close')}
                className="gi-drawer-pad-x py-1.5 border-b border-gi-border/40 min-h-[44px] gap-4"
            >
                <LimesBlurb spot="shop" />
                <span className="ui-text-small text-gi-muted">{t('shop.hint')}</span>
                <span data-shop-cap className="ui-text-small font-semibold text-gi-muted tabular-nums">
                    {t('shop.tokens', { count: cap.count, cap: cap.cap })}
                </span>
            </PanelHeader>

            <div className="flex min-w-0 gi-drawer-pad-x">
                <ArrowScrollList
                    axis="x"
                    step={SHOP_SCROLL_STEP_PX}
                    // ⚠️ The nav's side on the right by the first card's auto margin, not `justify-end`:
                    // an auto margin drops to nothing once the row overflows, so its start stays
                    // reachable by scrolling.
                    className={cn('flex-1 min-w-0 py-2 flex gap-2', menuRight && '[&>:first-child]:ms-auto')}
                    listProps={{ 'data-shop-cards': menuRight ? 'right' : 'left' }}
                >
                    {/* A closed Shop lowered by a refund drag lists nothing, and does not say "nothing for sale". */}
                    {isOpen && shop.length === 0 && (
                        <p className="ui-text-small text-gi-muted py-2">{t('shop.empty')}</p>
                    )}
                    {shop.map(item => <ShopCard key={item.group ? `group:${item.group}` : item.typeId} item={item} limes={item === limesOn} />)}
                </ArrowScrollList>
            </div>
        </>
    );
});

/** The Token on a card: 128 px, the card's centre. */
export const SHOP_ART_PX = 128;
/** Skill icons and price pills: 16 px art at 2×. */
const ICON_PX = 32;
/** Every card is exactly this size: five skill icons wide; name, Token, icons and two rows of pills tall. */
export const SHOP_CARD_W = ICON_PX * 5 + 4 * 2 + 16;
export const SHOP_CARD_H = 24 + SHOP_ART_PX + ICON_PX + (ICON_PX * 2 + 4) + 3 * 4 + 16;
/** How far an arrow press scrolls the row: two cards and their gaps. */
const SHOP_SCROLL_STEP_PX = (SHOP_CARD_W + 8) * 2;
/** At most four price lines, two by two. */
const MAX_PRICE_LINES = 4;

/**
 * One Token for sale, a fixed-size card. The whole card is the drag handle. A card that cannot be
 * bought dims its Token, shows its short counts in red, and does not start a drag. A group card
 * buys the option picked in its dropdown.
 */
export const ShopCard = ({ item, limes = false }) => {
    const options = item.options || null;
    const [picked, setPicked] = useState(null);
    const chosen = options ? (options.find(o => o.typeId === picked) || options[0]) : item;
    const ok = !!chosen.affordability?.success;
    const drag = useEntityDrag({
        id: `shop-row-${chosen.typeId}`,
        kind: DRAG_KIND.TOKEN,
        payload: shopCardPayload(chosen.typeId),
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !ok
    });
    return (
        <ShopCardBody
            item={item}
            chosen={chosen}
            ok={ok}
            onPick={setPicked}
            held={drag.isDragging}
            dragRef={drag.setNodeRef}
            dragProps={ok ? drag.handleProps : NO_HANDLE}
            limes={limes}
        />
    );
};

const NO_HANDLE = Object.freeze({});

// ⚠️ Apart from its drag hook on purpose: dnd-kit redraws the hook's holder at every drag start,
// end and change of target; the card is memoised on what it draws.
const ShopCardBody = memo(function ShopCardBody({ item, chosen, ok, onPick, held, dragRef, dragProps, limes }) {
    const options = item.options || null;
    const builds = useMemo(() => Shop.buildsOf(chosen.typeId), [chosen.typeId]);
    const capFull = !!chosen.affordability?.capFull;
    const skills = chosen.skills || [];
    return (
        <div
            ref={dragRef}
            {...dragProps}
            data-shop-item={chosen.typeId}
            data-shop-row={chosen.typeId}
            data-shop-group={item.group || undefined}
            data-shop-affordable={ok ? 'true' : 'false'}
            style={{ width: SHOP_CARD_W, height: SHOP_CARD_H }}
            className={cn(
                'relative shrink-0 overflow-hidden p-2 flex flex-col gap-1 select-none transition-opacity',
                ok ? 'cursor-grab touch-none hover:outline-2 hover:outline-solid hover:-outline-offset-2 hover:outline-[var(--color-ui-white)]' : 'cursor-not-allowed',
                held && 'opacity-30'
            )}
        >
            <Tooltip title={chosen.name} lines={builds.length ? [t('shop.builds', { list: builds.join(', ') })] : []}>
                <div data-shop-face className="shrink-0 flex flex-col gap-1">
                    <div className="h-6 shrink-0 flex items-center min-w-0">
                        {options ? (
                            <select
                                data-shop-select
                                value={chosen.typeId}
                                onChange={e => onPick(e.target.value)}
                                onPointerDown={e => e.stopPropagation()}
                                onKeyDown={e => e.stopPropagation()}
                                aria-label={t('shop.pick', { name: item.name })}
                                className="ui-pixel-edge min-w-0 max-w-full ui-text-body font-bold text-gi-text bg-gi-base px-1 cursor-pointer"
                            >
                                {options.map(o => <option key={o.typeId} value={o.typeId}>{o.name}</option>)}
                            </select>
                        ) : (
                            <span className="ui-text-body font-bold text-gi-text truncate">{chosen.name}</span>
                        )}
                    </div>
                    <div
                        data-shop-art
                        className={cn('relative shrink-0 self-center flex items-center justify-center pointer-events-none', !ok && 'opacity-40')}
                        style={{ width: SHOP_ART_PX, height: SHOP_ART_PX }}
                    >
                        <TokenSprite typeId={chosen.typeId} surface={TOKEN_SURFACE.CARRY} size={SHOP_ART_PX} alt={chosen.name} />
                    </div>
                </div>
            </Tooltip>
            <div data-shop-skills className="shrink-0 flex items-center gap-0.5" style={{ height: ICON_PX }}>
                {skills.map(id => (
                    <Tooltip key={id} title={getSkill(id)?.name || id}>
                        <span data-shop-skill={id} className="shrink-0 inline-flex">
                            <SkillIcon skill={id} size={ICON_PX} />
                        </span>
                    </Tooltip>
                ))}
            </div>
            {capFull ? (
                <p data-shop-missing className="ui-text-small font-semibold text-gi-danger">{chosen.affordability.reason}</p>
            ) : chosen.price.length > 0 && (
                <div data-shop-price className="grid grid-cols-2 gap-1 content-start min-h-0">
                    {chosen.price.slice(0, MAX_PRICE_LINES).map(p => <PricePill key={p.itemId} line={p} />)}
                </div>
            )}
            {limes && (
                // Beside the card's Token, outside its tooltip; a press on Limes does not pick up the card.
                <span className="absolute right-1 z-10 inline-flex" style={{ top: 8 + 24 + 4 }} onPointerDown={e => e.stopPropagation()}>
                    <LimesBlurb spot="foundation" />
                </span>
            )}
        </div>
    );
});

/** One price line as a pill (UI_STYLE "Item references"): the item and have / need in the shorthand counts, red when short; the name on hover. */
const PricePill = ({ line }) => (
    <Tooltip title={line.name}>
        <span
            data-shop-pill={line.itemId}
            data-short={line.enough ? undefined : 'true'}
            className="min-w-0 inline-flex items-center gap-1 tabular-nums"
        >
            <ItemIcon item={line.itemId} size={ICON_PX} />
            <span className={cn('ui-text-small font-bold whitespace-nowrap', line.enough ? 'text-gi-text' : 'text-gi-danger')}>
                {formatCompact(line.have, 1)}/{formatCompact(line.need, 1)}
            </span>
        </span>
    </Tooltip>
);

export default ShopPanel;
