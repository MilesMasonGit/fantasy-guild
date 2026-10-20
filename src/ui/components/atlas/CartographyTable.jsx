import { useEffect, useMemo, useRef, useState } from 'react';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { matCap } from '../../../systems/board/MatCap.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { cartographySlotsForRank } from '../../../config/guildUpgrades.js';
import { matW, matH } from '../../../config/matGeometry.js';
import { TEXT } from '../../../systems/atlas/regionNames.js';
import { cn } from '../../utils/cn.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { PixelFrame, FRAME_BAND_PX } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { BannerArt } from '../base/BannerArt.jsx';
import { TomeSpread, usePageRects } from './AtlasTome.jsx';
import { AtlasButton } from './AtlasButton.jsx';
import { bannerForPlan, bannerForRegion } from './regionBanner.js';
import { MapPreview } from './MapPreview.jsx';
import { PlanContents } from './PlanContents.jsx';
import { previewFit } from './mapPreview.js';
import { mapSpritePath, mapName, mapHoverLines, MAP_OUTLINE_POINTS } from './mapArt.js';
import { SCREEN_TEXT } from './atlasScreenText.js';

/** The pause after a reroll before the next (D-9): snappy, but no macro-spamming. */
export const REROLL_COOLDOWN_MS = 500;

/** How many slots the table has now: the Cartography Table upgrade's rank. */
export function slotCount() {
    return cartographySlotsForRank(GuildUpgradeManager.getRank('cartography_slots'));
}

/**
 * The slots after the holdings changed: a slot whose map the guild no longer holds enough of is
 * emptied, last first, so the table never shows more copies than the Bank has.
 */
export function fitSlots(slots, count, heldById) {
    const out = Array.from({ length: count }, (_, i) => slots[i] ?? null);
    const used = new Map();
    for (let i = 0; i < out.length; i++) {
        const id = out[i];
        if (id == null) continue;
        const n = (used.get(id) || 0) + 1;
        if (n > (heldById.get(id)?.count || 0)) out[i] = null;
        else used.set(id, n);
    }
    return out;
}

/**
 * The slots after a carried map is dropped on slot `index`, or null when it cannot go there. A
 * map lifted from a slot (`payload.fromSlot`) swaps with what is in the target, so dropping it
 * on a full slot trades their places; a map from the collection fills or replaces the slot, never
 * slotting more copies than the Bank holds.
 */
export function dropOnSlot(slots, payload, index, heldById) {
    const id = payload?.itemId;
    if (id == null || !Number.isInteger(index) || index < 0 || index >= slots.length) return null;
    const from = payload.fromSlot;
    if (from != null) {
        if (slots[from] !== id) return null;
        if (from === index) return slots;
        const next = [...slots];
        next[from] = slots[index];
        next[index] = id;
        return next;
    }
    const others = slots.filter((x, i) => x === id && i !== index).length;
    if (others >= (heldById.get(id)?.count || 0)) return null;
    const next = [...slots];
    next[index] = id;
    return next;
}

/** The slots after slot `index` is emptied, if it still holds `id`; unchanged otherwise. */
export function liftFromSlot(slots, index, id) {
    if (slots[index] == null || (id != null && slots[index] !== id)) return slots;
    return slots.map((x, i) => (i === index ? null : x));
}

/** A map sprite and a slot, in screen px: the 64 px art at 1×, as the Bank draws items. */
const MAP_PX = 64;
const SLOT_PX = 68;

/**
 * What the right page keeps besides the preview, in screen px: the slots, the contents with
 * their arrow bars, the buttons and a message line, the panel's frame and gaps.
 */
const RIGHT_PAGE_RESERVED_PX = 330;
/** The panel's frame and padding on each side, and the band of banner round the map. */
const PANEL_INSET_PX = FRAME_BAND_PX + 8;
const PREVIEW_MARGIN_PX = 4;

const headingCls = 'font-pixel ui-text-small uppercase tracking-wide text-white/60 mb-1';

/** A map's own picture at 1×. */
const MapSprite = ({ recipe, size = MAP_PX }) => (
    <img
        src={mapSpritePath(recipe)}
        alt=""
        draggable={false}
        className="pointer-events-none select-none"
        style={{ width: size, height: size, maxWidth: 'none', imageRendering: 'pixelated' }}
    />
);

/** An empty slot: a faint dashed outline of a map. */
const MapOutline = () => (
    <svg width={MAP_PX} height={MAP_PX} viewBox={`0 0 ${MAP_PX} ${MAP_PX}`} shapeRendering="crispEdges" aria-hidden="true" data-slot-outline>
        <polygon points={MAP_OUTLINE_POINTS} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="3 2" />
    </svg>
);

/** A map the guild holds, as a tile: click to slot it in the next free slot, or carry it onto a slot. */
const MapTile = ({ entry, left, canClick, onSlot, cap }) => {
    const { recipe } = entry;
    const out = left <= 0;
    const sprite = mapSpritePath(recipe);
    const { setNodeRef, isDragging, handleProps } = useEntityDrag({
        id: `atlas-map-${recipe.id}`,
        kind: DRAG_KIND.MAP,
        payload: { itemId: recipe.id, fromSlot: null, sprite },
        disabled: out,
        keyboardAccessible: false
    });
    const lines = useMemo(() => mapHoverLines(recipe, cap), [recipe, cap]);
    return (
        <Tooltip title={mapName(recipe)} lines={lines}>
            <button
                ref={setNodeRef}
                {...handleProps}
                type="button"
                role="listitem"
                data-map-item={recipe.id}
                data-slotted-out={out}
                aria-label={mapName(recipe)}
                disabled={out || !canClick}
                onClick={() => onSlot(recipe.id)}
                className={cn(
                    'flex flex-col items-center touch-none bg-black/30 hover:outline hover:outline-2 hover:outline-white/80 disabled:cursor-not-allowed disabled:hover:outline-none',
                    out && 'opacity-35 grayscale',
                    isDragging && 'opacity-50'
                )}
                style={{ width: MAP_PX }}
            >
                <MapSprite recipe={recipe} />
                <span className="font-pixel ui-text-small tabular-nums text-white/85 leading-none pb-0.5">×{Math.max(0, left)}</span>
            </button>
        </Tooltip>
    );
};

/** The trade a map offers (Upcycle), as a line under the collection. */
const TradeRow = ({ recipe, offer, onTrade }) => (
    <button
        type="button"
        data-map-upcycle={recipe.id}
        disabled={!!offer.reason}
        title={offer.reason || undefined}
        onClick={() => onTrade(recipe.id)}
        className="flex items-center gap-1 text-left font-pixel ui-text-small text-gi-gold/80 hover:text-white disabled:text-white/40 disabled:cursor-not-allowed"
    >
        <MapSprite recipe={recipe} size={MAP_PX / 2} />
        <span>{SCREEN_TEXT.upcycle(offer.ratio, offer.toName)}</span>
    </button>
);

/**
 * One Cartography slot: a drop target for a carried map, and, while it holds one, a drag source
 * (carry it to another slot to swap, or off the slots to empty it) and a click to empty it.
 */
const Slot = ({ index, id, recipe, accepts, onDrop, onUnslot, onLift }) => {
    const filled = !!recipe;
    const drag = useEntityDrag({
        id: `atlas-slot-${index}`,
        kind: DRAG_KIND.MAP,
        payload: { itemId: id, fromSlot: index, onMiss: onLift, sprite: filled ? mapSpritePath(recipe) : null },
        disabled: !filled,
        keyboardAccessible: false
    });
    const drop = useEntityDrop({ id: `atlas-slot-drop-${index}`, surface: DND_SURFACE.DRAWER, accepts, onDrop });
    const label = filled ? mapName(recipe) : SCREEN_TEXT.EMPTY_SLOT;
    return (
        <Tooltip title={label} lines={[filled ? SCREEN_TEXT.TAKE_OUT : SCREEN_TEXT.SLOTS_HINT]}>
            <button
                ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
                {...drag.handleProps}
                {...drop.droppableProps}
                type="button"
                data-cartography-slot={index}
                data-slot-item={id ?? ''}
                aria-label={label}
                aria-disabled={!filled}
                onClick={() => { if (filled) onUnslot(index); }}
                className={cn(
                    'flex items-center justify-center touch-none',
                    filled ? 'bg-black/40 hover:outline hover:outline-2 hover:outline-white/80' : 'bg-black/20 cursor-default',
                    drop.valid && 'outline outline-2 outline-[var(--color-ui-green)]',
                    drop.invalid && 'outline outline-2 outline-[var(--color-ui-red)]',
                    drag.isDragging && 'opacity-40'
                )}
                style={{ width: SLOT_PX, height: SLOT_PX }}
            >
                {filled ? <MapSprite recipe={recipe} /> : <MapOutline />}
            </button>
        </Tooltip>
    );
};

/** The preview's place before anything is slotted: the map's size, dashed, with one muted line. */
const EmptyPreview = ({ fit }) => (
    <div
        data-map-preview="empty"
        className="flex items-center justify-center border-2 border-dashed border-white/15 px-4 text-center font-pixel ui-text-small text-white/50"
        style={{ width: fit.width, height: fit.height }}
    >
        {SCREEN_TEXT.PREVIEW_EMPTY}
    </div>
);

/**
 * The Cartography table, a crafting table over both pages of the tome. On the left the maps the
 * guild holds, as tiles with counts (Base Maps and Modifiers together; any slot takes any map):
 * click one into the next free slot, or carry it onto a slot. On the right, top to bottom, the
 * slots, the preview (the Region as a tiny real map, `MapPreview`), what it will hold as Token
 * sprites with counts, and Reroll and Settle. Nothing leaves the Bank until Settle
 * (`Atlas.settle`); emptying the slots or closing the book just forgets them.
 *
 * @param {object} props
 * @param {number} props.version  moves on whenever the holdings or the cap may have changed
 * @param {(regionId: string) => void} props.onTravel  the Travel prompt after a Settle
 */
export const CartographyTable = ({ version, onTravel }) => {
    const held = useMemo(() => Atlas.held(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const heldById = useMemo(() => new Map(held.map(h => [h.recipe.id, h])), [held]);
    const count = useMemo(() => slotCount(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const cap = useMemo(() => matCap(), [version]); // eslint-disable-line react-hooks/exhaustive-deps

    const [slots, setSlots] = useState(() => Array(count).fill(null));
    const [plan, setPlan] = useState(null);
    const [cooling, setCooling] = useState(false);
    const [message, setMessage] = useState(null);
    const [settled, setSettled] = useState(null);
    const coolTimer = useRef(null);

    useEffect(() => {
        setSlots(prev => {
            const next = fitSlots(prev, count, heldById);
            return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
        });
    }, [count, heldById]);

    useEffect(() => () => clearTimeout(coolTimer.current), []);

    const filled = slots.filter(id => id != null);
    const slotKey = filled.join('|');
    // A new preview (and a new seed) only when what is slotted or the cap changes: the Bank
    // changing under an open table must not reshuffle the layout the player rerolled to.
    useEffect(() => {
        const recipes = filled.map(id => heldById.get(id)?.recipe).filter(Boolean);
        setPlan(recipes.length ? Atlas.preview(recipes) : null);
    }, [slotKey, cap]); // eslint-disable-line react-hooks/exhaustive-deps

    const slottedCount = (id) => filled.filter(x => x === id).length;
    const firstEmpty = slots.indexOf(null);

    const slot = (id) => {
        if (firstEmpty < 0 || slottedCount(id) >= (heldById.get(id)?.count || 0)) return;
        setMessage(null);
        setSettled(null);
        setSlots(prev => prev.map((x, i) => (i === firstEmpty ? id : x)));
    };
    const unslot = (index) => {
        setMessage(null);
        setSlots(prev => prev.map((x, i) => (i === index ? null : x)));
    };
    const reroll = () => {
        if (!plan || cooling) return;
        setPlan(Atlas.reroll(plan));
        setCooling(true);
        clearTimeout(coolTimer.current);
        coolTimer.current = setTimeout(() => setCooling(false), REROLL_COOLDOWN_MS);
    };
    const settle = () => {
        if (!plan) return;
        const result = Atlas.settle({ ingredients: plan.recipes, seed: plan.seed });
        if (!result.success) {
            setMessage(result.reason);
            return;
        }
        setMessage(null);
        setSlots(prev => prev.map(() => null));
        const { region } = result;
        setSettled({ id: region.id, flavour: region.flavourName, practical: region.practicalName, banner: bannerForRegion(region) });
    };

    const trade = (id) => {
        const result = Atlas.upcycle(id);
        setMessage(result.success ? null : result.reason);
    };

    // What a drop is checked against at release: the table as it is then, not as last drawn.
    const live = useRef(null);
    live.current = { slots, heldById };
    const acceptsAt = (index) => (payload) =>
        payload?.kind === DRAG_KIND.MAP && dropOnSlot(live.current.slots, payload, index, live.current.heldById) != null;
    const dropAt = (index) => (payload) => {
        const next = dropOnSlot(live.current.slots, payload, index, live.current.heldById);
        if (!next) return false;
        setMessage(null);
        if (payload.fromSlot == null) setSettled(null);
        setSlots(next);
        return true;
    };
    // A map carried off the slots and let go anywhere else goes back to its tile.
    const liftAt = (index) => (payload) => {
        setMessage(null);
        setSlots(prev => liftFromSlot(prev, index, payload?.itemId));
        const tile = typeof document !== 'undefined' ? document.querySelector(`[data-map-item="${payload?.itemId}"]`) : null;
        const r = tile?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
    };

    const noRoom = plan && !plan.fits;
    const banner = useMemo(() => (settled && !plan ? settled.banner : bannerForPlan(plan)), [plan, settled]);

    // The preview's size: the finest whole-pixel map that fits the page's parchment on screen.
    const rects = usePageRects();
    const boxW = Math.max(0, Math.floor(rects.right.width - 2 * PANEL_INSET_PX));
    const maxH = Math.max(0, Math.floor(rects.right.height - RIGHT_PAGE_RESERVED_PX));
    // The mat a travel lands the Region on: the mat as it is now (`mapPreview.js`).
    const wide = matW();
    const high = matH();
    const mat = useMemo(() => ({ w: wide, h: high }), [wide, high]);
    const fit = useMemo(
        () => previewFit(mat, boxW - 2 * PREVIEW_MARGIN_PX, maxH - 2 * PREVIEW_MARGIN_PX),
        [mat, boxW, maxH]
    );

    const offers = held
        .map(entry => ({ recipe: entry.recipe, offer: Atlas.upcycleOffer(entry.recipe.id) }))
        .filter(o => o.offer);

    const left = (
        <PixelFrame kind="studs" className="flex-1 min-h-0 flex flex-col" frameClassName="flex-1 min-h-0 flex flex-col p-2 bg-gi-surface/95">
            <h3 className={headingCls}>{SCREEN_TEXT.MAPS_HEADING}</h3>
            {held.length === 0 && <p className="text-white/50">{SCREEN_TEXT.NO_MAPS}</p>}
            <section data-cartography-inventory className="flex-1 min-h-0 flex flex-col">
                <ArrowScrollList step={2 * (MAP_PX + 20)} className="flex-1 min-h-0 py-1 px-0.5" compact>
                    <div role="list" className="grid gap-1" style={{ gridTemplateColumns: `repeat(auto-fill, ${MAP_PX}px)` }}>
                        {held.map(entry => (
                            <MapTile
                                key={entry.recipe.id}
                                entry={entry}
                                left={entry.count - slottedCount(entry.recipe.id)}
                                canClick={firstEmpty >= 0}
                                onSlot={slot}
                                cap={cap}
                            />
                        ))}
                    </div>
                    {offers.length > 0 && (
                        <div data-cartography-trades className="mt-2 pt-2 border-t border-white/10 flex flex-col items-start gap-1">
                            {offers.map(({ recipe, offer }) => (
                                <TradeRow key={recipe.id} recipe={recipe} offer={offer} onTrade={trade} />
                            ))}
                        </div>
                    )}
                </ArrowScrollList>
            </section>
        </PixelFrame>
    );

    const right = (
        <section data-cartography-bench className="flex-1 min-h-0 flex flex-col">
            <PixelFrame kind="studs" className="shrink min-h-0 flex flex-col" frameClassName="min-h-0 flex flex-col items-center gap-2 p-2 bg-gi-surface/95">
                <div data-cartography-slots className="shrink-0 flex flex-wrap justify-center gap-1.5">
                    {slots.map((id, i) => (
                        <Slot
                            key={i}
                            index={i}
                            id={id}
                            recipe={id != null ? heldById.get(id)?.recipe : null}
                            accepts={acceptsAt(i)}
                            onDrop={dropAt(i)}
                            onUnslot={unslot}
                            onLift={liftAt(i)}
                        />
                    ))}
                </div>
                <div
                    data-cartography-preview
                    className="relative shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ width: boxW, height: fit.height + 2 * PREVIEW_MARGIN_PX }}
                >
                    {banner && <BannerArt banner={banner} />}
                    <div className="relative">
                        {plan && <MapPreview plan={plan} mat={mat} fit={fit} />}
                        {!plan && !settled && <EmptyPreview fit={fit} />}
                        {!plan && settled && (
                            <PixelFrame kind="chamfer" frameClassName="px-3 py-2 bg-gi-surface/95">
                                <div data-cartography-settled className="flex flex-col items-center gap-2 text-center" style={{ maxWidth: fit.width }}>
                                    <span className="text-[var(--color-ui-green)]">{SCREEN_TEXT.settled(settled.flavour, settled.practical)}</span>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        <AtlasButton main data-settled-travel onClick={() => onTravel?.(settled.id)}>{SCREEN_TEXT.TRAVEL_THERE}</AtlasButton>
                                        <AtlasButton data-settled-stay onClick={() => setSettled(null)}>{SCREEN_TEXT.STAY}</AtlasButton>
                                    </div>
                                </div>
                            </PixelFrame>
                        )}
                    </div>
                </div>
                {plan && (
                    <div className="w-full min-h-0 flex flex-col">
                        <PlanContents summary={plan.summary} />
                    </div>
                )}
            </PixelFrame>
            <div className="mt-2 shrink-0 flex flex-col items-end gap-1">
                <div className="flex flex-wrap justify-end items-center gap-2">
                    <AtlasButton data-cartography-reroll disabled={!plan || cooling} onClick={reroll}>{SCREEN_TEXT.REROLL}</AtlasButton>
                    <AtlasButton main data-cartography-settle disabled={!plan || noRoom} onClick={settle}>{SCREEN_TEXT.SETTLE}</AtlasButton>
                </div>
                {(message || noRoom) && (
                    <p role="status" data-cartography-message className="font-pixel ui-text-small text-[var(--color-ui-red)] bg-black/70 px-2">{message || TEXT.REFUSE_NO_ROOM}</p>
                )}
            </div>
        </section>
    );

    return (
        <div data-cartography className="absolute inset-0">
            <TomeSpread left={left} right={right} />
        </div>
    );
};

export default CartographyTable;
