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

/** A map item's own art; a dev recipe has none. */
const IngredientIcon = ({ recipe, size = 32 }) => (getItem(recipe.id)
    ? <ItemIcon item={recipe.id} size={size} />
    : <MapIcon className="text-amber-200/80" style={{ width: size * 0.75, height: size * 0.75 }} />);

const buttonCls = 'px-3 py-1 rounded border border-gi-gold/40 text-amber-100 hover:border-gi-gold hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gi-gold/40';

/**
 * The Cartography table: the maps the guild holds on the left (click one to slot it), then the
 * slots, the Node Summary and the layout preview; Reroll, Cancel and Settle. Nothing leaves the
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

    const noRoom = plan && !plan.fits;

    return (
        <div data-cartography className="grid grid-cols-[minmax(150px,200px)_1fr] gap-4 min-h-0">
            <section data-cartography-inventory className="min-h-0 overflow-y-auto custom-scrollbar pr-1">
                <h3 className="text-[10px] uppercase tracking-wide text-white/50 mb-1">{SCREEN_TEXT.MAPS_HEADING}</h3>
                {held.length === 0 && <p className="text-white/50">{SCREEN_TEXT.NO_MAPS}</p>}
                <ul className="flex flex-col">
                    {held.map(entry => {
                        const { recipe } = entry;
                        const left = entry.count - slottedCount(recipe.id);
                        const out = left <= 0;
                        const offer = Atlas.upcycleOffer(recipe.id);
                        return (
                            <li key={recipe.id} className="flex flex-col">
                                <button
                                    type="button"
                                    data-map-item={recipe.id}
                                    data-slotted-out={out}
                                    disabled={out || firstEmpty < 0}
                                    onClick={() => slot(recipe.id)}
                                    className={cn(
                                        'flex-1 min-w-0 flex items-center gap-2 px-1 py-0.5 rounded-sm text-left hover:bg-white/10 disabled:cursor-not-allowed',
                                        out && 'opacity-35 grayscale'
                                    )}
                                >
                                    <IngredientIcon recipe={recipe} />
                                    <span className="flex-1 min-w-0 truncate">{nameOf(recipe)}</span>
                                    <span className="tabular-nums text-white/70">×{Math.max(0, left)}</span>
                                </button>
                                {offer && (
                                    <button
                                        type="button"
                                        data-map-upcycle={recipe.id}
                                        disabled={!!offer.reason}
                                        title={offer.reason || undefined}
                                        onClick={() => trade(recipe.id)}
                                        className="self-start ml-2 mb-1 text-left text-[11px] text-gi-gold/80 hover:text-white disabled:text-white/40 disabled:cursor-not-allowed"
                                    >
                                        {SCREEN_TEXT.upcycle(offer.ratio, offer.toName)}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section data-cartography-bench className="min-w-0 flex flex-col gap-3">
                <div>
                    <h3 className="text-[10px] uppercase tracking-wide text-white/50 mb-1">{SCREEN_TEXT.SLOTS_HEADING}</h3>
                    <div className="flex flex-wrap gap-2">
                        {slots.map((id, i) => {
                            const recipe = id != null ? heldById.get(id)?.recipe : null;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    data-cartography-slot={i}
                                    data-slot-item={id ?? ''}
                                    title={recipe ? nameOf(recipe) : SCREEN_TEXT.EMPTY_SLOT}
                                    aria-label={recipe ? nameOf(recipe) : SCREEN_TEXT.EMPTY_SLOT}
                                    disabled={!recipe}
                                    onClick={() => unslot(i)}
                                    className={cn(
                                        'w-12 h-12 flex items-center justify-center rounded-sm',
                                        recipe ? 'bg-white/10 hover:bg-white/20' : 'border border-dashed border-white/20'
                                    )}
                                >
                                    {recipe && <IngredientIcon recipe={recipe} />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-[minmax(160px,1fr)_minmax(200px,1.4fr)] gap-4 pt-2 border-t border-white/10">
                    <div>
                        <h3 className="text-[10px] uppercase tracking-wide text-white/50 mb-1">{SCREEN_TEXT.SUMMARY_HEADING}</h3>
                        <NodeSummary summary={plan?.summary ?? null} />
                    </div>
                    <div>
                        <h3 className="text-[10px] uppercase tracking-wide text-white/50 mb-1">{SCREEN_TEXT.PREVIEW_HEADING}</h3>
                        <LayoutPreview layout={plan?.layout ?? null} />
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button type="button" data-cartography-reroll className={buttonCls} disabled={!plan || cooling} onClick={reroll}>{SCREEN_TEXT.REROLL}</button>
                    <button type="button" data-cartography-cancel className={buttonCls} disabled={!filled.length} onClick={cancel}>{SCREEN_TEXT.CANCEL}</button>
                    <div className="flex-1" />
                    <button type="button" data-cartography-settle className={`${buttonCls} ui-shine`} disabled={!plan || noRoom} onClick={settle}>{SCREEN_TEXT.SETTLE}</button>
                </div>
                {(message || noRoom) && (
                    <p role="status" data-cartography-message className="text-red-300">{message || TEXT.REFUSE_NO_ROOM}</p>
                )}
                {settled && (
                    <div data-cartography-settled className="flex items-center gap-2 text-emerald-200">
                        <span className="flex-1">{SCREEN_TEXT.settled(settled.flavour, settled.practical)}</span>
                        <button type="button" data-settled-travel className={buttonCls} onClick={() => onTravel?.(settled.id)}>{SCREEN_TEXT.TRAVEL_THERE}</button>
                        <button type="button" data-settled-stay className={buttonCls} onClick={() => setSettled(null)}>{SCREEN_TEXT.STAY}</button>
                    </div>
                )}
            </section>
        </div>
    );
};

export default CartographyTable;
