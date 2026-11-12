import { memo, useMemo, useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import * as EquipmentManager from '../../../systems/equipment/EquipmentManager.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { SLOT_ORDER, categoryOfItem, getCategoryInfo, CATEGORY_KINDS } from '../../../config/registries/equipmentConstants.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { equipOrAnnounce, unequipOrAnnounce } from './dockEquip.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { slotIconOf } from '../base/slotIcons.js';
import { itemTintStyle } from '../base/itemTint.js';
import { EffectChip } from '../board/EffectBadges.jsx';
import { onPoll } from '../board/frameClock.js';
import { carriedPreservation } from '../../../systems/board/EffectBreakdown.js';

/** How often a slot's Preservation badge looks again: a building placed or a hero arriving changes it. */
const BADGE_REFRESH_MS = 1000;

/** The Preservation badge of a carried item (`carriedPreservation`), or null; redrawn only when it changes. */
function useCarriedBadge(heroId, itemId) {
    const [badge, setBadge] = useState(() => (itemId ? carriedPreservation(heroId, itemId) : null));
    useEffect(() => {
        if (!itemId) {
            setBadge(null);
            return undefined;
        }
        const look = () => {
            const next = carriedPreservation(heroId, itemId);
            setBadge(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        };
        look();
        return onPoll(look, BADGE_REFRESH_MS);
    }, [heroId, itemId]);
    return badge;
}

/** How long a slot keeps its shine layer after an item lands: the sweep plus a little slack. */
export const EQUIP_SHINE_MS = 400;

/**
 * DockEquipmentGrid: the pinned card's loadout grid: NINE flexible slots in 3 rows of 3, as
 * 64px item sprites. Gear and consumables share the grid, and any item may sit in any slot.
 * Supports drag-to-equip directly onto any slot, right-click to unequip back to bank, and drag
 * to another slot (moves or swaps), another hero or the Bank.
 */
export const DockEquipmentGrid = ({ heroId }) => {
    // The slot an item just landed in, and a count so a second landing in the same slot plays again.
    const [shine, setShine] = useState(null);

    useEffect(() => {
        // EventBus ignores a handler's return value, so the shine timers are cleared here.
        const timers = new Set();
        let count = 0;
        const handleEquipped = (data) => {
            if ((data?.action === 'equip' || data?.action === 'move') && data?.heroId === heroId && data?.slot != null) {
                count += 1;
                const mine = count;
                setShine({ slot: data.slot, n: mine });
                const timer = setTimeout(() => {
                    timers.delete(timer);
                    setShine(prev => (prev?.n === mine ? null : prev));
                }, EQUIP_SHINE_MS);
                timers.add(timer);
            }
        };

        const unsubscribe = EventBus.subscribe(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, handleEquipped, UI_LISTENER);
        // A shine cut short ends now, so a switch to another hero does not inherit it.
        return () => {
            unsubscribe();
            timers.forEach(clearTimeout);
            if (timers.size > 0) setShine(null);
        };
    }, [heroId]);

    // Flat projection of the grid (see the useGameState selector contract): returning
    // `hero.equipment` itself would share the live object and this would silently stop
    // updating. Bank quantity rides along in the same signature (rather than a second
    // useGameState call) so a slot's badge updates the moment a Consumable/Food/Drink is spent
    // from the bank. That is a supply-chain mechanic (ConsumptionSystem.js), not a hero stat,
    // so it lives in `inventory`, not on the equipped item itself.
    const gridState = useGameState(
        state => {
            const hero = (state.heroes || []).find(h => h.id === heroId);
            if (!hero) return null;
            const grid = SLOT_ORDER.map(slot => hero.equipment?.[slot] || null);
            const ids = grid.map(id => id || '').join('|');
            const qty = grid.map(id => (id ? (state.inventory?.items?.[id]?.quantity ?? 0) : '')).join('|');
            return `${ids}::${qty}`;
        },
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [heroId] }
    );

    if (gridState === null) return null;
    const [idsPart, qtyPart] = gridState.split('::');
    const itemIds = idsPart.split('|').map(id => (id === '' ? null : id));
    const quantities = qtyPart.split('|').map(q => (q === '' ? null : Number(q)));

    return (
        <div className="grid grid-cols-[repeat(3,minmax(0,70px))] gap-1">
            {SLOT_ORDER.map((slot, i) => (
                <EquipSlotCell
                    key={slot}
                    heroId={heroId}
                    slot={slot}
                    itemId={itemIds[i]}
                    quantity={quantities[i]}
                    shineKey={shine?.slot === slot ? shine.n : null}
                />
            ))}
        </div>
    );
};

/**
 * ⚠️ dnd-kit's boxes know nothing of clipping: a slot the sheet has scrolled out of sight still has
 * its box, over the sheet's header or arrows, and being small it wins the drop. A release outside
 * the list holding the slot is not on the slot.
 */
export function pointerOutsideList(droppableId, pointer) {
    const list = document.querySelector(`[data-dnd-droppable-id="${droppableId}"]`)?.closest('[data-scroll-list]');
    if (!list || !pointer) return false;
    const r = list.getBoundingClientRect();
    return pointer.x < r.left || pointer.x > r.right || pointer.y < r.top || pointer.y > r.bottom;
}

/** One slot: right-click to unequip, drag to another slot, another hero or the Bank, drop to equip. */
const EquipSlotCell = ({ heroId, slot, itemId, quantity, shineKey = null }) => {
    const drag = useEntityDrag({
        id: `dock-equip-${heroId}-${slot}`,
        kind: DRAG_KIND.ITEM,
        payload: { itemId, fromHeroId: heroId, fromSlot: slot },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !itemId
    });

    const dropId = `dock-slot-drop-${heroId}-${slot}`;
    const drop = useEntityDrop({
        id: dropId,
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.ITEM && !(p.fromHeroId === heroId && p.fromSlot === slot),
        onDrop: (p, at) => {
            if (pointerOutsideList(dropId, at?.pointer)) return false;
            if (p.itemId) return equipOrAnnounce(EquipmentManager, heroId, p.itemId, slot, p);
        }
    });
    const nodeRef = useMemo(() => mergeRefs(drag.setNodeRef, drop.setNodeRef), [drag.setNodeRef, drop.setNodeRef]);

    return (
        <EquipSlotBody
            heroId={heroId}
            slot={slot}
            itemId={itemId}
            quantity={quantity}
            shineKey={shineKey}
            cue={drop.valid}
            held={drag.isDragging}
            nodeRef={nodeRef}
            handleProps={drag.handleProps}
            droppableProps={drop.droppableProps}
        />
    );
};

// ⚠️ Apart from its drag hooks on purpose: dnd-kit redraws their holder at every drag start, end
// and change of target; the slot is memoised on what it draws.
const EquipSlotBody = memo(function EquipSlotBody({ heroId, slot, itemId, quantity, shineKey, cue, held, nodeRef, handleProps, droppableProps }) {
    const item = itemId ? getItem(itemId) : null;
    const category = itemId ? categoryOfItem(itemId) : null;
    const info = getCategoryInfo(category);
    const showQuantity = item && info.kind && info.kind !== CATEGORY_KINDS.GEAR;
    const badge = useCarriedBadge(heroId, itemId);

    return (
        <div
            ref={nodeRef}
            data-equip-slot={slot}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (itemId) {
                    unequipOrAnnounce(EquipmentManager, heroId, slot);
                }
            }}
            style={item ? itemTintStyle(item) : undefined}
            className={cn(
                'relative aspect-square flex items-center justify-center overflow-visible transition-colors select-none',
                item
                    ? 'ui-item-tile cursor-grab active:cursor-grabbing'
                    : 'ui-slot-empty',
                cue && 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-950/40',
                held && 'opacity-40'
            )}
            {...handleProps}
            {...droppableProps}
        >
            {item ? (
                <span style={{ imageRendering: 'pixelated' }} className="ui-loadout-item flex items-center justify-center pointer-events-none">
                    <ItemIcon item={item} size={64} />
                </span>
            ) : (
                <span className="text-sm opacity-20 text-gi-muted pointer-events-none">+</span>
            )}
            {/* An item just landed: the button shine passes over the slot once. */}
            {shineKey != null && <span key={shineKey} data-equip-shine className="ui-shine ui-shine-once" />}
            {category && (
                <SlotMark category={category} />
            )}
            {badge && (
                <span className="absolute top-0.5 left-0.5" data-slot-badge>
                    <EffectChip badge={badge} small />
                </span>
            )}
            {showQuantity && (
                <span className={cn(
                    'absolute -bottom-1 -left-1 min-w-[18px] h-[18px] px-1 pointer-events-none',
                    'bg-gi-label-bg text-gi-label-text border-2 border-black',
                    'ui-text-body font-bold leading-none tabular-nums flex items-center justify-center',
                    quantity === 0 && 'bg-gi-danger text-white'
                )}>
                    {formatCompact(quantity, 1)}
                </span>
            )}
        </div>
    );
});

/** A filled slot's kind mark in its corner (Lucide, the icon rule's gear slot icons). */
function SlotMark({ category }) {
    const Icon = slotIconOf(category);
    return (
        <Icon
            size={16}
            strokeWidth={2.5}
            data-slot-kind={category}
            aria-hidden="true"
            className="absolute bottom-0.5 right-0.5 pointer-events-none text-white/80"
            style={{ filter: 'drop-shadow(2px 2px 0 #000)' }}
        />
    );
}
