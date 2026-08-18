import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { SLOT_ORDER, categoryOfItem, getCategoryInfo, CATEGORY_KINDS } from '../../../config/registries/equipmentConstants.js';
import { formatCompact } from '../../../utils/Formatters.js';

/**
 * DockEquipmentGrid — the pinned card's loadout grid: NINE flexible slots in
 * 3 rows of 3 (D-7), as 32px item sprites and nothing else. Gear and
 * consumables share the grid, and any item may sit in any slot — what a slot
 * shows is simply whatever the hero put there.
 *
 * The item's name and category live in the hover tooltip so the grid stays a
 * clean block of icons at this width.
 *
 * An occupied slot supports both transfer routes from concept §4.3: click it
 * to send the item back to the Bank, or drag it onto another hero's tab to
 * hand it over directly.
 */
export const DockEquipmentGrid = ({ heroId }) => {
    // Flat projection of the grid — see the useGameState selector contract;
    // returning `hero.equipment` itself would share the live object and this
    // would silently stop updating. Bank quantity rides along in the same
    // signature (rather than a second useGameState call) so a slot's badge
    // updates the moment a Consumable/Food/Drink is spent from the bank —
    // that's a supply-chain mechanic (ConsumptionSystem.js), not a hero stat,
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
        ['heroes_updated', 'hero_equipment_changed', 'inventory_updated', 'state_changed'],
        null,
        { deps: [heroId] }
    );

    if (gridState === null) return null;
    const [idsPart, qtyPart] = gridState.split('::');
    const itemIds = idsPart.split('|').map(id => (id === '' ? null : id));
    const quantities = qtyPart.split('|').map(q => (q === '' ? null : Number(q)));

    return (
        <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
            {SLOT_ORDER.map((slot, i) => (
                <EquipSlotCell key={slot} heroId={heroId} slot={slot} itemId={itemIds[i]} quantity={quantities[i]} />
            ))}
        </div>
    );
};

/** One slot: click to unequip, drag to hand the item to another hero. */
const EquipSlotCell = ({ heroId, slot, itemId, quantity }) => {
    const engine = useEngine();
    const item = itemId ? getItem(itemId) : null;
    // A slot has no identity of its own now (D-7) — it is described by
    // whatever occupies it.
    const category = itemId ? categoryOfItem(itemId) : null;
    const info = getCategoryInfo(category);
    const slotLabel = category ? info.label : 'Empty';
    // Gear (weapons/hats/chest/trinkets) is worn, not spent — only items that
    // draw from the bank each time they fire (Consumables, Food, Drink) have
    // a meaningful "how many are left" to show.
    const showQuantity = item && info.kind && info.kind !== CATEGORY_KINDS.GEAR;

    // Carries `fromHeroId`/`fromSlot` so the receiving tab knows to strip the
    // item off this hero first — without that the shared-reference model would
    // leave it equipped on both (roadmap F2).
    const drag = useEntityDrag({
        id: `dock-equip-${heroId}-${slot}`,
        kind: DRAG_KIND.ITEM,
        payload: { itemId, fromHeroId: heroId, fromSlot: slot },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !itemId
    });

    return (
        <div
            ref={drag.setNodeRef}
            onClick={itemId ? () => engine.EquipmentManager.unequipItem(heroId, slot) : undefined}
            title={item
                ? `${item.name} — ${slotLabel}${showQuantity ? ` (${quantity} in bank)` : ''}. Click to unequip, or drag onto another hero.`
                : 'Empty slot — any item fits here'}
            className={cn(
                'relative aspect-square rounded border flex items-center justify-center transition-colors',
                item
                    ? 'border-gi-primary/40 bg-gi-primary/5 cursor-grab active:cursor-grabbing hover:border-gi-danger'
                    : 'border-dashed border-gi-border/50 bg-black/20',
                drag.isDragging && 'opacity-40'
            )}
            {...drag.handleProps}
        >
            {item ? (
                <span style={{ imageRendering: 'pixelated' }}>
                    <ItemIcon item={item} size={32} />
                </span>
            ) : (
                <span className="text-[9px] leading-none opacity-20">+</span>
            )}
            {showQuantity && (
                <span className={cn(
                    'absolute -bottom-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full',
                    'bg-gi-label-bg text-gi-label-text border border-black/40',
                    'text-[8px] font-bold leading-none tabular-nums flex items-center justify-center',
                    quantity === 0 && 'bg-gi-danger text-white'
                )}>
                    {formatCompact(quantity, 1)}
                </span>
            )}
        </div>
    );
};

export default DockEquipmentGrid;
