import { memo, startTransition, useEffect, useMemo, useState } from 'react';
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
import { useEntityDrag, useActiveDrag, useDragSurface } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { PanelHeader } from '../base/CloseX.jsx';
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
 * - **While a card is carried, the panel drops to a lip** ({@link SHOP_LIP_PX} tall) whenever
 * the pointer is over the playmat, and rises again the moment it comes back over the panel. A
 * Shop Token let go over the lip (or the risen panel) is a plain cancel ({@link pointerOverShopPanel}).
 * - **A card that cannot be bought** keeps its look but for a dimmed Token; the short counts are
 * red, and it cannot be picked up. A full Token cap says so on the card, since no price shows it.
 * Cards re-read on every Bank or cap change, and on a Mat Tuner cap change.
 *
 * ⚠️ `data-shop-drawer`, `data-shop-drawer-state`, `data-shop-row`, `data-shop-affordable` and a
 * held card's `opacity-30` are read by the benches (`bench/browser/scenes.mjs`, `dragKit.mjs`):
 * keep them.
 */

/** How much of the panel stays on screen while a Shop Token is carried. */
export const SHOP_LIP_PX = 28;

/**
 * Whether a viewport pointer is over the Shop panel (or its lip), read from the panel's live box.
 * The mat's drop handler asks this before buying: a Shop Token let go over the panel is a plain
 * cancel even where the panel covers the mat.
 *
 * ⚠️ Deliberately NOT a droppable: dnd-kit measures droppables when a drag starts, when the
 * panel is still fully up, so a droppable panel would swallow drops on the strip of mat it has
 * since dropped off.
 */
export function pointerOverShopPanel(pointer) {
    if (!pointer || typeof document === 'undefined') return false;
    const el = document.querySelector('[data-shop-drawer]');
    if (!el || el.getAttribute('data-shop-drawer-state') === 'closed') return false;
    const r = el.getBoundingClientRect();
    return pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
}

export const isShopPayload = (p) => p?.kind === DRAG_KIND.TOKEN && !!p.from?.shop;

/**
 * `'closed' | 'open' | 'lip'`: shut, up, or dropped to its lip during a Shop drag.
 * The drop tracks WHERE the card is being carried: a lip while the pointer is over the playmat,
 * up again the moment it is back over the panel, so the player can change their mind mid-drag.
 * The default for `surface` gives 'always a lip' for a caller that does not track position.
 */
export function shopPanelState(isOpen, activePayload, surface = DND_SURFACE.BOARD) {
    if (!isOpen) return 'closed';
    if (!isShopPayload(activePayload)) return 'open';
    return surface === DND_SURFACE.DRAWER ? 'open' : 'lip';
}

/**
 * Where the panel is moved to for `state`. `under`: how far above the screen's bottom the panel
 * stands (the bar's strip), so a closed panel goes all the way down out of sight; `foot`: the
 * clear band at its foot that the bar's names stand over, kept in sight with the lip.
 */
export function shopPanelTransform(state, { under = 0, foot = 0 } = {}) {
    if (state === 'open') return 'translateY(0)';
    if (state === 'lip') return `translateY(calc(100% - ${SHOP_LIP_PX + foot}px))`;
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

export const ShopPanel = ({ isOpen, onClose, menuRight = false }) => {
    const { activePayload } = useActiveDrag();
    const surface = useDragSurface();
    const state = shopPanelState(isOpen, activePayload, surface);
    // The band at the panel's foot the bar stands over: its strip, and the names and HP bars above it.
    const foot = DOCK_STRIP_PX + dockLabelOverhangPx(dockArtPx(useLiveMatFit()));

    return (
        <aside
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
                state === 'closed' ? 'pointer-events-none' : 'pointer-events-auto'
            )}
            style={{
                // To the screen's bottom edge, behind the bar: no gap under the panel.
                bottom: 0,
                transform: shopPanelTransform(state, { foot }),
                opacity: state === 'closed' ? 0 : 1,
                visibility: state === 'closed' ? 'hidden' : 'visible',
                transition: state === 'closed'
                    ? 'transform 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms, visibility 0s linear 250ms'
                    : 'transform 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms'
            }}
        >
            <PixelFrame kind={FRAME_KIND.STUDS} backdrop="shop" frameClassName="flex flex-col">
                <ShopContents isOpen={isOpen} onClose={onClose} menuRight={menuRight} />
                <div aria-hidden data-shop-foot className="shrink-0" style={{ height: foot }} />
            </PixelFrame>

            {/* The lip: the strip left showing while a Shop Token is carried. */}
            <div
                aria-hidden
                data-shop-lip
                className={cn(
                    'absolute inset-x-0 top-0 border-t-2 border-gi-gold/60 bg-gi-base/90 transition-opacity duration-200 pointer-events-none',
                    state === 'lip' ? 'opacity-100' : 'opacity-0'
                )}
                style={{ height: SHOP_LIP_PX }}
            />
        </aside>
    );
};

/**
 * What the panel shows: its header and the cards.
 * ⚠️ Apart from the panel on purpose: the panel redraws at every drag start, end and crossing
 * between the mat and a drawer (it drops to a lip for a Shop card), and the catalogue is worked
 * out afresh each time this draws.
 */
const ShopContents = memo(function ShopContents({ isOpen, onClose, menuRight }) {
    useShopRefresh(isOpen);
    const shop = isOpen ? Shop.catalogue() : [];
    const cap = Shop.capStatus();

    return (
        <>
            <PanelHeader
                title={t('shop.title')}
                onClose={onClose}
                closeLabel={t('shop.close')}
                className="gi-drawer-pad-x py-1.5 border-b border-gi-border/40 min-h-[44px] gap-4"
            >
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
                    {shop.length === 0 && (
                        <p className="ui-text-small text-gi-muted py-2">{t('shop.empty')}</p>
                    )}
                    {shop.map(item => <ShopCard key={item.group ? `group:${item.group}` : item.typeId} item={item} />)}
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
export const ShopCard = ({ item }) => {
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
        />
    );
};

const NO_HANDLE = Object.freeze({});

// ⚠️ Apart from its drag hook on purpose: dnd-kit redraws the hook's holder at every drag start,
// end and change of target; the card is memoised on what it draws.
const ShopCardBody = memo(function ShopCardBody({ item, chosen, ok, onPick, held, dragRef, dragProps }) {
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
                'shrink-0 overflow-hidden p-2 flex flex-col gap-1 select-none transition-opacity',
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
