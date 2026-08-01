/**
 * The three focus views (§11.D) — deck editing, hero equip, recipe picker.
 * Each replaces the whole row body and composes from FocusScaffold.
 * Extracted from AreaBannerRow (CR-001).
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import ProgressBar from '../base/ProgressBar.jsx';
import { TASK_VERBS } from '../card-modules/TaskStage.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { SLOT_ORDER, categoryOfItem, getCategoryInfo } from '../../../config/registries/equipmentConstants.js';
import { getRecipe, getRecipesBySubskill } from '../../../config/registries/recipeRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { useEntityDrag, useEntityDrop, mergeRefs, ACCEPT_CLS, REJECT_CLS } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import StatusPlacards from '../combat/StatusPlacards.jsx';
import { useCombatFeedback, DamageFloaters } from '../combat/combatFeedback.jsx';
import { RefProgressBar } from './RefProgressBar.jsx';
import { ActiveCardFace } from '../ActiveCardFace.jsx';
import { GICard } from '../base/GICard.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import CardFactory from '../../../systems/cards/logic/CardFactory.js';
import { useCardTier, BANNER_FOOTER_H, BANNER_BADGE_ROW_H } from './BannerLayout.jsx';
import { FocusScaffold } from './FocusScaffold.jsx';
import { AreaBinder } from './AreaBinder.jsx';
import { BinderManager } from '../../../systems/progression/BinderManager.js';
import { AreaMat } from './AreaMat.jsx';
import { BadgeRow, deriveCardBadgeIds, deriveHeroBadgeIds, deriveDeckBadgeIds } from '../card-modules/CardBadges.jsx';
import {
    Play, Pause, ChevronUp, ChevronDown, Sword, Hammer, Skull, User,
    Layers, AlertTriangle, Utensils, Hourglass, Infinity as InfinityIcon,
    X, Trash2, Plus, Lock, CheckCircle2, Shield, Package, Boxes, CupSoda
} from 'lucide-react';
import {
    CardTitle, RowTemplateCard, RowHeroCard, RowDeckCard, RowEmptyCard,
    SlotCard, StatRow, VitalBar, FocusDivider, STATUS_LABELS, isConsumableItem
} from './bannerCards.jsx';

// ----------------------------------------------------------------------
// Deck Focus (§11.D.1) — the whole row becomes the deck's slots as full cards,
// on the same mat, so it reads like regular mode (owner decision 2026-07-09).
// ----------------------------------------------------------------------

export const DeckFocusRow = ({ areaId, onClose }) => {
    const engine = useEngine();
    const areaSet = getAreaSet(areaId);
    const areaArt = areaSet?.areaArt ? resolveSpritePath(areaSet.areaArt) : null;

    // Re-render on deck changes for this area.
    useGameState(
        state => (state.areaStates?.[areaId]?.deckSlots || []).map(s => s.templateId || '_').join(','),
        [AREA_EVENTS.DECK_UPDATED, AREA_EVENTS.STATS_DIRTY],
        data => !data?.areaId || data.areaId === areaId
    );

    // Re-render when this area's binder or the player's gold changes, so the
    // pips, silhouettes, completion counter and pack button all stay live.
    // A VALUE projection, not a reference: the binder is mutated in place, so
    // a shallow subscription would never see the change.
    useGameState(
        state => {
            const binder = state.collection?.binders?.[areaId] || {};
            const owned = Object.keys(binder).sort().map(id => `${id}:${binder[id]}`).join(',');
            return `${owned}|${state.currency?.gold ?? 0}`;
        },
        ['collection_updated', 'currency_updated', 'state_changed']
    );
    const slots = engine.GameState.areaStates?.[areaId]?.deckSlots || [];
    const filledCount = slots.filter(s => s.templateId).length;

    const dropOnSlot = (index, payload) => {
        if (payload?.kind !== 'card' || payload.cardType === 'station') return;
        let r;
        if (payload.from) {
            // A card dragged from a deck slot: reorder within this area (swap),
            // or move it in from another area's deck.
            if (payload.from.areaId === areaId) {
                if (payload.from.slotIndex === index) return; // dropped on itself
                r = engine.DeckSlotManager.swapSlots(areaId, payload.from.slotIndex, index);
            } else {
                // Cards never move between areas (D-43) — they belong to the
                // binder they were found in.
                r = { success: false, error: 'Cards belong to their own area' };
            }
        } else {
            r = engine.DeckSlotManager.slotCard(areaId, index, payload.templateId);
        }
        if (r && !r.success) engine.EventBus.publish('ui:notify', { message: r.error || 'Card rejected', type: 'error' });
    };

    return (
        <FocusScaffold
            areaId={areaId}
            title={`${areaSet?.name || areaId} — Deck`}
            onClose={onClose}
            headerRight={<BinderHeader areaId={areaId} engine={engine} />}
        >
            {/* Anchor card — the Deck this view configures */}
            <RowDeckCard areaArt={areaArt} filled={filledCount} total={slots.length} />
            <FocusDivider />
            {slots.map((slot, i) => (
                <DeckFocusSlot key={i} areaId={areaId} slot={slot} index={i} engine={engine} onDropHere={payload => dropOnSlot(i, payload)} />
            ))}
            {/* The area's own binder, right beside the slots it feeds (D-42). */}
            <FocusDivider />
            <AreaBinder areaId={areaId} />
        </FocusScaffold>
    );
};


/**
 * Collection progress for this area, plus the button that advances it.
 *
 * The pack is bought HERE, beside the binder it fills (D-48): you see
 * "5 of 9 collected", buy, and watch the gap close in the same place. Once the
 * binder is complete the area's packs stop being sold (D-13) and the control
 * becomes a completion badge.
 */
const BinderHeader = ({ areaId, engine }) => {
    const { owned, total, complete, cardsOwned, cardsTotal } = BinderManager.getCompletion(areaId);
    const cost = engine.CollectionManager.getPackCost(areaId);
    const gold = engine.GameState.currency?.gold ?? 0;

    if (total === 0) return null;

    if (complete) {
        return (
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gi-primary">
                <CheckCircle2 size={13} /> Binder complete
            </span>
        );
    }

    const buy = () => {
        const r = engine.CollectionManager.buyAreaPack(areaId);
        if (!r.success) {
            const msg = r.error === 'INSUFFICIENT_GOLD' ? 'Not enough gold'
                : r.error === 'SOLD_OUT' ? 'Nothing left to collect here'
                : 'Could not buy a pack';
            engine.EventBus.publish('ui:notify', { message: msg, type: 'error' });
        }
    };

    return (
        <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-gi-muted">
                <span className="text-white font-bold">{cardsOwned}</span>/{cardsTotal} cards
                <span className="mx-1 opacity-40">·</span>
                <span className="text-white font-bold">{owned}</span>/{total} copies
            </span>
            <button
                onClick={buy}
                disabled={gold < cost}
                title={gold < cost ? `Costs ${cost} gold` : `Buy a pack for ${cost} gold`}
                className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-colors',
                    gold < cost
                        ? 'border-white/10 text-gi-muted cursor-not-allowed'
                        : 'border-gi-primary/60 text-gi-primary hover:bg-gi-primary/10'
                )}
            >
                <Package size={12} /> Pack · {cost}g
            </button>
        </div>
    );
};

const DeckFocusSlot = ({ areaId, slot, index, engine, onDropHere }) => {
    const template = slot.templateId ? getCard(slot.templateId) : null;

    // Drop target: a drawer card places/replaces here. Drag source: the filled
    // card can be dragged out (carries `from`) to reclaim it via the drawer.
    const drop = useEntityDrop({
        id: `deck-${areaId}-${index}`,
        surface: DND_SURFACE.BOARD,
        // A drawer card (no `from`) places here; a card from another deck slot
        // moves/swaps in — but not onto its own slot.
        accepts: p => p.kind === DRAG_KIND.CARD && p.cardType !== 'station'
            && !(p.from && p.from.areaId === areaId && p.from.slotIndex === index),
        onDrop: p => onDropHere(p)
    });
    const drag = useEntityDrag({
        id: `deck-src-${areaId}-${index}`,
        kind: DRAG_KIND.CARD,
        payload: template ? { templateId: slot.templateId, cardType: template.cardType, from: { areaId, slotIndex: index } } : {},
        sourceSurface: DND_SURFACE.BOARD,
        disabled: !template
    });

    // No locked or hazard-terrain slots any more (D-1): all four slots are
    // free and identical, and hazards live on cards as an effect (D-8).

    // Filled slot — the card, draggable out to reclaim, with a remove button.
    if (template) {
        return (
            <div
                ref={mergeRefs(drop.setNodeRef, drag.setNodeRef)}
                {...drag.handleProps}
                {...drop.droppableProps}
                className={cn(
                    'relative shrink-0 rounded-xl cursor-grab active:cursor-grabbing',
                    drop.valid && ACCEPT_CLS, drop.invalid && REJECT_CLS,
                    drag.isDragging && 'opacity-40'
                )}
            >
                <RowTemplateCard templateId={slot.templateId} areaId={areaId} slotIndex={index} />
                <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => engine.DeckSlotManager.unslotCard(areaId, index)}
                    title="Remove from deck"
                    className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/60 text-gi-muted hover:text-gi-danger hover:bg-black/80 transition-colors"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        );
    }

    // Empty slot — drop target + click to open the Cards drawer.
    return (
        <div
            ref={drop.setNodeRef}
            {...drop.droppableProps}
            className={cn('shrink-0 rounded-xl', drop.valid && ACCEPT_CLS, drop.invalid && REJECT_CLS)}
        >
            <RowEmptyCard
                icon={<Plus size={28} />}
                label={`Slot ${index + 1}`}
                sub="Add a card"
                onClick={() => engine.EventBus.publish('ui:open_drawer', { tab: 'cards', filter: { deckSlot: { areaId, index } } })}
            />
        </div>
    );
};

/** Generic card-sized frame (empty-slot styling) for focus-view content cards. */
/**
 * RecipeCard — visual-first recipe tile for the Station focus (owner design
 * 2026-07-14): output icon + name up top, then each ingredient as an icon
 * with a green/red bank-reserve bar (hover for name + have/need), and a
 * level/time footer. Sits on the shared card-tier frame like SlotCard.
 */
const RecipeCard = ({ recipe, selected, onClick }) => {
    const { width, height, size } = useCardTier();
    const output = recipe.outputs?.[0];
    const outputItem = output ? getItem(output.itemId || output.id) : null;
    // Inputs may carry itemId, id, or both — normalize once.
    const inputs = (recipe.inputs || [])
        .map(inp => ({ ...inp, itemId: inp.itemId || inp.id }))
        .filter(inp => inp.itemId);

    // Live bank counts drive the reserve bars.
    const counts = useGameState(
        state => Object.fromEntries(inputs.map(inp => [inp.itemId, state.inventory?.items?.[inp.itemId]?.quantity || 0])),
        ['inventory_updated'],
        null,
        { deps: [recipe.id] }
    ) || {};

    return (
        <div
            onClick={onClick}
            style={{ width, height }}
            className={cn(
                'shrink-0 rounded-xl border flex flex-col overflow-hidden transition-colors cursor-pointer',
                selected ? 'border-gi-gold bg-gi-gold/10' : 'border-dashed border-gi-border bg-black/60 hover:border-gi-primary/60'
            )}
        >
            <div className="px-2 py-1 bg-black/30 border-b border-white/5 shrink-0 flex items-center gap-1.5">
                <span className={cn('gi-card-title font-bold tracking-widest uppercase text-[10px] truncate flex-1', selected ? 'text-gi-gold' : 'text-white')}>
                    {outputItem?.name || recipe.name}
                </span>
                {selected && <CheckCircle2 size={12} className="text-gi-gold shrink-0" />}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-1 min-h-0">
                {outputItem && <ItemIcon item={outputItem} size={size === 'sm' ? 32 : 64} />}
            </div>

            {/* Ingredient reserves — green when the bank covers a craft, red when short */}
            {inputs.length > 0 && (
                <div className="shrink-0 px-2 pb-1 flex flex-col gap-1">
                    {inputs.map((inp, i) => {
                        const item = getItem(inp.itemId);
                        const have = counts[inp.itemId] || 0;
                        const need = inp.quantity || 1;
                        const ok = have >= need;
                        return (
                            <div
                                key={`${inp.itemId}-${i}`}
                                className="flex items-center gap-1.5"
                                title={`${item?.name || inp.itemId}: ${have}/${need} in bank`}
                            >
                                <ItemIcon item={item || inp.itemId} size={20} className="shrink-0" />
                                <div className="flex-1 h-1.5 bg-black/60 rounded-full overflow-hidden">
                                    <div
                                        className={cn('h-full rounded-full transition-all duration-300', ok ? 'bg-gi-success' : 'bg-gi-danger')}
                                        style={{ width: `${Math.min(100, (have / Math.max(1, need)) * 100)}%` }}
                                    />
                                </div>
                                <span className={cn('text-[8px] font-bold tabular-nums shrink-0', ok ? 'text-gi-success' : 'text-gi-danger')}>
                                    {have}/{need}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="shrink-0 px-2 pb-1 text-center">
                <span className="text-[8px] text-gi-muted">Lv {recipe.levelRequirement || 1} · {((recipe.baseTickTime || 10000) / 1000).toFixed(1)}s</span>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// Hero (Equip) Focus — anchor Hero card + Stats card + gear slots (§11.D.2),
// composed from the shared FocusScaffold so it matches Deck focus.
// ----------------------------------------------------------------------

// Six equip slots (Hero Dock Phase 1): two hands, hat, chest, two trinkets.
// Food/drink slots were retired earlier (owner design 2026-07-16): consumables
// go to deck card slots (food) or the station Drink slot (drink).
// Nine flexible loadout slots (D-7): gear and consumables share them.
const GEAR_SLOTS = SLOT_ORDER;

export const HeroFocusRow = ({ areaId, heroId, onClose }) => {
    const engine = useEngine();
    const { size } = useCardTier();
    // Flat projection, per the useGameState selector contract (CR-044):
    // returning the live hero object shares its nested hp/energy objects with
    // the store, so in-place vitals changes compared equal and this panel's
    // numbers froze while it was open.
    const hero = useGameState(
        state => {
            const h = state.heroes?.find(x => x.id === heroId);
            if (!h) return null;
            return {
                id: h.id,
                name: h.name,
                status: h.status,
                spriteId: h.spriteId,
                classId: h.classId,
                hp: Math.round(h.hp?.current ?? 0),
                hpMax: h.hp?.max ?? 100,
                energy: Math.round(h.energy?.current ?? 0),
                energyMax: h.energy?.max ?? 100,
                equipment: { ...(h.equipment || {}) },
                skills: Object.fromEntries(
                    Object.entries(h.skills || {}).map(([id, s]) => [id, s?.level ?? 1])
                )
            };
        },
        ['heroes_updated', 'hero_equipment_changed'],
        null,
        { deps: [heroId] }
    );
    if (!hero) {
        return <FocusScaffold areaId={areaId} title="Hero" onClose={onClose}><span className="text-[11px] text-gi-muted italic px-3">No hero assigned.</span></FocusScaffold>;
    }

    const skills = Object.entries(hero.skills).filter(([, level]) => level > 1).slice(0, 5);

    return (
        <FocusScaffold areaId={areaId} title={`${hero.name} — Hero`} onClose={onClose}>
            {/* Anchor: the hero card */}
            <RowHeroCard hero={hero} areaArt={null} injured={hero.status === 'wounded'} />
            <FocusDivider />
            {/* Stats card */}
            <SlotCard title="Stats">
                <StatRow label="Health" value={`${hero.hp}/${hero.hpMax}`} />
                <StatRow label="Energy" value={`${hero.energy}/${hero.energyMax}`} />
                {skills.map(([id, level]) => <StatRow key={id} label={id} value={`Lv ${level}`} />)}
                <button
                    onClick={() => { engine.HeroAssignmentManager.unassignHero(areaId); onClose(); }}
                    className="mt-1 px-2 py-0.5 rounded border border-gi-border text-[8px] font-bold uppercase text-gi-muted hover:text-gi-danger hover:border-gi-danger transition-colors"
                >
                    Unassign
                </button>
            </SlotCard>
            <FocusDivider />
            {/* Gear slots — click to unequip, drop items from the Bank drawer */}
            {GEAR_SLOTS.map(slot => (
                <GearSlot key={slot} heroId={heroId} slot={slot} hero={hero} size={size} engine={engine} />
            ))}
        </FocusScaffold>
    );
};

/** One equip slot in the Hero focus — an item drop target (equip); click to unequip. */
const GearSlot = ({ heroId, slot, hero, size, engine }) => {
    const itemId = hero.equipment?.[slot];
    const item = itemId ? getItem(itemId) : null;
    const drop = useEntityDrop({
        id: `gear-${heroId}-${slot}`,
        surface: DND_SURFACE.BOARD,
        // Any item fits any slot now — food and drink live on the hero again
        // (D-4/D-7), so consumables are no longer refused here.
        accepts: p => p.kind === DRAG_KIND.ITEM,
        onDrop: p => engine.EquipmentManager.equipItem(heroId, p.itemId)
    });
    return (
        <SlotCard
            title={slotTitle}
            onClick={itemId ? () => engine.EquipmentManager.unequipItem(heroId, slot) : undefined}
            innerRef={drop.setNodeRef}
            dropProps={drop.droppableProps}
            cueClass={cn(drop.valid && ACCEPT_CLS, drop.invalid && REJECT_CLS)}
        >
            {item ? (
                <>
                    <ItemIcon item={item} size={size === 'sm' ? 32 : 64} />
                    <span className="text-[9px] text-gi-text font-bold truncate max-w-full">{item.name}</span>
                    <span className="text-[8px] text-gi-muted">click to unequip</span>
                </>
            ) : (
                <>
                    <Plus size={size === 'sm' ? 18 : 26} className="text-gi-muted" />
                    <span className="text-[8px] text-gi-muted">empty</span>
                </>
            )}
        </SlotCard>
    );
};


// ----------------------------------------------------------------------
// Station (Recipe) Focus — anchor Station card + recipe cards (§11.D.3).
// ----------------------------------------------------------------------

export const StationFocusRow = ({ areaId, onClose }) => {
    const engine = useEngine();
    const { size } = useCardTier();
    // `areaId` is an OUTPOST id here (D-16) — stations only live on Outpost
    // banners now, so this focus view reads the outpost list.
    useGameState(
        state => (state.outposts || []).find(o => o.id === areaId)?.selectedRecipeId || null,
        [AREA_EVENTS.STATION_CHANGED, 'outposts_updated'],
        data => !data?.areaId || data.areaId === areaId
    );
    const outpost = engine.OutpostManager.getOutpost(areaId);
    const stationId = outpost?.activeStationCardId;
    const template = stationId ? getCard(stationId) : null;

    if (!template) {
        return <FocusScaffold areaId={areaId} title="Station" onClose={onClose}><span className="text-[11px] text-gi-muted italic px-3">No station built here — claim one from a Booster Pack and build it via the Collection Binder.</span></FocusScaffold>;
    }

    const skillCap = template.config?.skillCap || 90;
    const recipes = template.hasCraftingQueue
        ? getRecipesBySubskill(template.config?.recipeGroup).filter(r => (r.levelRequirement || 0) <= skillCap)
        : [];
    const selectedId = outpost?.selectedRecipeId;

    return (
        <FocusScaffold areaId={areaId} title={`${template.name} — Station`} onClose={onClose}>
            {/* Anchor: the station card */}
            <RowTemplateCard templateId={stationId} areaId={areaId} />
            <FocusDivider />
            {!template.hasCraftingQueue && (
                <span className="text-[10px] text-gi-muted italic self-center px-2 max-w-[12rem]">
                    No crafting queue{template.passiveBuff ? ' — its passive buff is always active while built.' : '.'}
                </span>
            )}
            {recipes.map(recipe => (
                <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    selected={recipe.id === selectedId}
                    onClick={() => engine.StationSlotManager.selectRecipe(areaId, recipe.id)}
                />
            ))}
            {template.hasCraftingQueue && recipes.length === 0 && (
                <span className="text-[10px] text-gi-muted italic self-center px-2">No recipes known for this station.</span>
            )}
        </FocusScaffold>
    );
};
