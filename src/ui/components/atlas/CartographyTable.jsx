import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { matCap } from '../../../systems/board/MatCap.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { cartographySlotsForRank } from '../../../config/guildUpgrades.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { TEXT } from '../../../systems/atlas/regionNames.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { cn } from '../../utils/cn.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { PixelFrame } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { TomeSpread } from './AtlasTome.jsx';
import { AtlasButton } from './AtlasButton.jsx';
import { BannerArt } from '../base/BannerArt.jsx';
import { bannerForPlan } from './regionBanner.js';
import { NodeSummary } from './NodeSummary.jsx';
import { LayoutPreview } from './LayoutPreview.jsx';
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

/** What an ingredient is called on the table: its item's name, else its recipe's. */
function nameOf(recipe) {
    return getItem(recipe.id)?.name || recipe.name || recipe.id;
}

/**
 * The slots after a carried map is dropped on slot `index`, or null when it cannot go there. A
 * map lifted from a slot (`payload.fromSlot`) swaps with what is in the target, so dropping it
 * on a full slot trades their places; a map from the list fills or replaces the slot, never
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

/** A map item's own art; a dev recipe has none. */
const IngredientIcon = ({ recipe, size = 32 }) => (getItem(recipe.id)
    ? <ItemIcon item={recipe.id} size={size} />
    : <MapIcon className="text-amber-200/80" style={{ width: size * 0.75, height: size * 0.75 }} />);

const headingCls = 'font-pixel ui-text-small uppercase tracking-wide text-white/60 mb-1';

/** How solid the layout's backing is over the Region's banner: the map reads first, the banner tints it. */
const PREVIEW_OVER_BANNER = 0.7;

/** A slot's box and the map art in it, in screen px: the art at 2×. */
const SLOT_PX = 68;
const SLOT_ART_PX = 64;

/** A map the guild holds: click to slot it in the next free slot, or carry it onto a slot. */
const MapRow = ({ entry, left, canClick, onSlot, offer, onTrade }) => {
    const { recipe } = entry;
    const out = left <= 0;
    const { setNodeRef, isDragging, handleProps } = useEntityDrag({
        id: `atlas-map-${recipe.id}`,
        kind: DRAG_KIND.MAP,
        payload: { itemId: recipe.id, fromSlot: null },
        disabled: out,
        keyboardAccessible: false
    });
    return (
        <div role="listitem" className="flex flex-col">
            <button
                ref={setNodeRef}
                {...handleProps}
                type="button"
                data-map-item={recipe.id}
                data-slotted-out={out}
                disabled={out || !canClick}
                onClick={() => onSlot(recipe.id)}
                className={cn(
                    'flex-1 min-w-0 flex items-center gap-2 px-1 py-0.5 text-left touch-none hover:bg-white/10 disabled:cursor-not-allowed',
                    out && 'opacity-35 grayscale',
                    isDragging && 'opacity-50'
                )}
            >
                <IngredientIcon recipe={recipe} />
                <span className="flex-1 min-w-0">{nameOf(recipe)}</span>
                <span className="tabular-nums text-white/70">×{Math.max(0, left)}</span>
            </button>
            {offer && (
                <button
                    type="button"
                    data-map-upcycle={recipe.id}
                    disabled={!!offer.reason}
                    title={offer.reason || undefined}
                    onClick={() => onTrade(recipe.id)}
                    className="self-start ml-10 mb-1 text-left font-pixel ui-text-small text-gi-gold/80 hover:text-white disabled:text-white/40 disabled:cursor-not-allowed"
                >
                    {SCREEN_TEXT.upcycle(offer.ratio, offer.toName)}
                </button>
            )}
        </div>
    );
};

/**
 * One Cartography slot: a drop target for a carried map, and, while it holds one, a drag source
 * (carry it to another slot to swap, or off the slots to empty it) and a click to empty it.
 */
const Slot = ({ index, id, recipe, accepts, onDrop, onUnslot, onLift }) => {
    const filled = !!recipe;
    const drag = useEntityDrag({
        id: `atlas-slot-${index}`,
        kind: DRAG_KIND.MAP,
        payload: { itemId: id, fromSlot: index, onMiss: onLift },
        disabled: !filled,
        keyboardAccessible: false
    });
    const drop = useEntityDrop({ id: `atlas-slot-drop-${index}`, surface: DND_SURFACE.DRAWER, accepts, onDrop });
    const label = recipe ? nameOf(recipe) : SCREEN_TEXT.EMPTY_SLOT;
    return (
        <button
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            {...drag.handleProps}
            {...drop.droppableProps}
            type="button"
            data-cartography-slot={index}
            data-slot-item={id ?? ''}
            title={label}
            aria-label={label}
            disabled={!filled}
            onClick={() => onUnslot(index)}
            className={cn(
                'flex items-center justify-center touch-none',
                filled ? 'bg-black/40 hover:bg-black/25' : 'bg-black/20 border-2 border-dashed border-white/25',
                drop.valid && 'outline outline-2 outline-[var(--color-ui-green)]',
                drop.invalid && 'outline outline-2 outline-[var(--color-ui-red)]',
                drag.isDragging && 'opacity-40'
            )}
            style={{ width: SLOT_PX, height: SLOT_PX }}
        >
            {recipe && <IngredientIcon recipe={recipe} size={SLOT_ART_PX} />}
        </button>
    );
};

/**
 * The Cartography table over both pages of the tome: on the left the slots and the maps the guild
 * holds (click one into the next free slot, or carry it onto a slot); on the right the big layout
 * preview, the Node Summary under it, and Reroll, Cancel and Settle. Nothing leaves the
 * Bank until Settle (`Atlas.settle`); Cancel or closing the screen just forgets the slots.
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
    const cancel = () => {
        setMessage(null);
        setSlots(prev => prev.map(() => null));
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
        setSettled({ id: result.region.id, flavour: result.region.flavourName, practical: result.region.practicalName });
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
    // A map carried off the slots and let go anywhere else goes back to the list.
    const liftAt = (index) => (payload) => {
        setMessage(null);
        setSlots(prev => liftFromSlot(prev, index, payload?.itemId));
        const row = typeof document !== 'undefined' ? document.querySelector(`[data-map-item="${payload?.itemId}"]`) : null;
        const r = row?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
    };

    const noRoom = plan && !plan.fits;
    const banner = useMemo(() => bannerForPlan(plan), [plan]);

    const left = (
        <>
            <PixelFrame kind="studs" className="shrink-0" frameClassName="p-2 bg-gi-surface/95">
                <h3 className={headingCls}>{SCREEN_TEXT.SLOTS_HEADING}</h3>
                <div data-cartography-slots className="flex flex-wrap gap-1.5">
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
                <p className="mt-1 font-pixel ui-text-small text-white/50">{SCREEN_TEXT.SLOTS_HINT}</p>
            </PixelFrame>
            <PixelFrame kind="studs" className="mt-2 flex-1 min-h-0 flex flex-col" frameClassName="flex-1 min-h-0 flex flex-col p-2 bg-gi-surface/95">
                <h3 className={headingCls}>{SCREEN_TEXT.MAPS_HEADING}</h3>
                {held.length === 0 && <p className="text-white/50">{SCREEN_TEXT.NO_MAPS}</p>}
                <section data-cartography-inventory className="flex-1 min-h-0 flex flex-col">
                    <ArrowScrollList step={80} className="flex-1 min-h-0" compact listProps={{ role: 'list' }}>
                        {held.map(entry => (
                            <MapRow
                                key={entry.recipe.id}
                                entry={entry}
                                left={entry.count - slottedCount(entry.recipe.id)}
                                canClick={firstEmpty >= 0}
                                onSlot={slot}
                                offer={Atlas.upcycleOffer(entry.recipe.id)}
                                onTrade={trade}
                            />
                        ))}
                    </ArrowScrollList>
                </section>
            </PixelFrame>
        </>
    );

    const right = (
        <section data-cartography-bench className="flex-1 min-h-0 flex flex-col">
            <PixelFrame kind="studs" className="flex-1 min-h-0 flex flex-col" frameClassName="flex-1 min-h-0 flex flex-col p-2 bg-gi-surface/95">
                <h3 className={headingCls}>{SCREEN_TEXT.PREVIEW_HEADING}</h3>
                <div data-cartography-preview className="relative flex-1 min-h-[120px] flex items-center justify-center">
                    {banner && <BannerArt banner={banner} />}
                    <LayoutPreview layout={plan?.layout ?? null} className="relative w-full h-full" backingOpacity={banner ? PREVIEW_OVER_BANNER : 1} />
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 shrink-0 max-h-[45%] min-h-0 flex flex-col">
                    <h3 className={headingCls}>{SCREEN_TEXT.SUMMARY_HEADING}</h3>
                    <ArrowScrollList step={48} compact className="min-h-0 flex-1">
                        <NodeSummary summary={plan?.summary ?? null} />
                    </ArrowScrollList>
                </div>
            </PixelFrame>
            <div className="mt-2 shrink-0 flex flex-col items-end gap-1">
                <div className="flex flex-wrap justify-end items-center gap-2">
                    <AtlasButton data-cartography-reroll disabled={!plan || cooling} onClick={reroll}>{SCREEN_TEXT.REROLL}</AtlasButton>
                    <AtlasButton data-cartography-cancel disabled={!filled.length} onClick={cancel}>{SCREEN_TEXT.CANCEL}</AtlasButton>
                    <AtlasButton main data-cartography-settle disabled={!plan || noRoom} onClick={settle}>{SCREEN_TEXT.SETTLE}</AtlasButton>
                </div>
                {(message || noRoom) && (
                    <p role="status" data-cartography-message className="font-pixel ui-text-small text-[var(--color-ui-red)] bg-black/70 px-2">{message || TEXT.REFUSE_NO_ROOM}</p>
                )}
                {settled && (
                    <PixelFrame kind="chamfer" frameClassName="px-2 py-1">
                        <div data-cartography-settled className="flex flex-wrap items-center justify-end gap-2">
                            <span className="text-[var(--color-ui-green)]">{SCREEN_TEXT.settled(settled.flavour, settled.practical)}</span>
                            <AtlasButton main data-settled-travel onClick={() => onTravel?.(settled.id)}>{SCREEN_TEXT.TRAVEL_THERE}</AtlasButton>
                            <AtlasButton data-settled-stay onClick={() => setSettled(null)}>{SCREEN_TEXT.STAY}</AtlasButton>
                        </div>
                    </PixelFrame>
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
