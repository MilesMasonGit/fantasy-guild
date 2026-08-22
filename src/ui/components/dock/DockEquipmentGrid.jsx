import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { SLOT_ORDER, categoryOfItem, getCategoryInfo, CATEGORY_KINDS } from '../../../config/registries/equipmentConstants.js';
import { formatCompact } from '../../../utils/Formatters.js';

/**
 * DockEquipmentGrid — the pinned card's loadout grid: NINE flexible slots in
 * 3 rows of 3 (D-7), as 64px item sprites. Gear and consumables share the
 * grid, and any item may sit in any slot.
 *
 * Supports drag-to-equip directly onto any slot, right-click to unequip back
 * to bank, and drag to transfer / bank.
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
        <div className="grid grid-cols-3 gap-2 p-1">
            {SLOT_ORDER.map((slot, i) => (
                <EquipSlotCell key={slot} heroId={heroId} slot={slot} itemId={itemIds[i]} quantity={quantities[i]} />
            ))}
        </div>
    );
};

/** One slot: right-click to unequip, drag to hand the item to another hero or bank, drop to equip. */
const EquipSlotCell = ({ heroId, slot, itemId, quantity }) => {
    const engine = useEngine();
    const item = itemId ? getItem(itemId) : null;
    const category = itemId ? categoryOfItem(itemId) : null;
    const info = getCategoryInfo(category);
    const slotLabel = category ? info.label : 'Empty';
    const showQuantity = item && info.kind && info.kind !== CATEGORY_KINDS.GEAR;

    const drag = useEntityDrag({
        id: `dock-equip-${heroId}-${slot}`,
        kind: DRAG_KIND.ITEM,
        payload: { itemId, fromHeroId: heroId, fromSlot: slot },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !itemId
    });

    const drop = useEntityDrop({
        id: `dock-slot-drop-${heroId}-${slot}`,
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.ITEM,
        onDrop: p => {
            if (p.itemId) {
                engine.EquipmentManager.equipItem(heroId, p.itemId, slot);
            }
        }
    });

    return (
        <div
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (itemId) {
                    engine.EquipmentManager.unequipItem(heroId, slot);
                }
            }}
            className={cn(
                'relative aspect-square rounded-lg border-2 flex items-center justify-center transition-all p-1 select-none',
                item
                    ? 'border-gi-primary/50 bg-gi-primary/10 cursor-grab active:cursor-grabbing hover:border-gi-danger hover:bg-red-950/30'
                    : 'border-dashed border-gi-border/50 bg-black/40 hover:border-gi-gold/40',
                drop.valid && 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-950/40',
                drag.isDragging && 'opacity-40'
            )}
            {...drag.handleProps}
            {...drop.droppableProps}
        >
            {item ? (
                <span style={{ imageRendering: 'pixelated' }} className="flex items-center justify-center pointer-events-none">
                    <ItemIcon item={item} size={64} />
                </span>
            ) : (
                <span className="text-sm font-mono opacity-20 text-gi-muted pointer-events-none">+</span>
            )}
            {showQuantity && (
                <span className={cn(
                    'absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full pointer-events-none',
                    'bg-gi-label-bg text-gi-label-text border border-black/60 shadow',
                    'text-[10px] font-bold leading-none tabular-nums flex items-center justify-center',
                    quantity === 0 && 'bg-gi-danger text-white'
                )}>
                    {formatCompact(quantity, 1)}
                </span>
            )}
        </div>
    );
};

export default DockEquipmentGrid;
