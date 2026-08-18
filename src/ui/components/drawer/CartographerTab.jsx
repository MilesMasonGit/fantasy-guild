import { useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { Coins, HelpCircle } from 'lucide-react';

/**
 * CartographerTab — the Map shop.
 *
 * Each Map card displays its details, cost, and item pool on the left,
 * and a full 128px Map Token on the right which can be dragged directly
 * into the Tray to purchase.
 */
export const CartographerTab = ({ onInspect }) => {
    const { maps } = useGameState(
        state => ({
            maps: Cartographer.catalogue(),
            gold: state.currency?.gold || 0
        }),
        ['map_purchased', 'map_opened', 'currency_changed', 'inventory_updated', 'state_changed'],
        null
    );

    const buy = useCallback((mapId, name) => {
        const result = Cartographer.buyMap(mapId);
        if (result.success) NotificationSystem.success(`${name} — it's in your Tray. Double-click to open it.`);
        else NotificationSystem.warning(result.reason);
    }, []);

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
                {maps.map(map => (
                    <MapCard
                        key={map.id}
                        map={map}
                        onBuy={() => buy(map.id, map.name)}
                        onInspect={onInspect}
                    />
                ))}
            </div>
        </div>
    );
};

/**
 * Map Card featuring details & pool on the left, costs & Buy button in the middle, and 128px draggable Map Token on the right.
 */
const MapCard = ({ map, onBuy, onInspect }) => {
    const affordable = map.affordability.success;
    const discoveredCount = map.pool.filter(p => p.known).length;

    const drag = useEntityDrag({
        id: `buy-map-${map.id}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: map.tokenId, from: { buyMapId: map.id } },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !affordable
    });

    return (
        <div
            onClick={() => onInspect?.('map', map.id)}
            className={cn(
                'rounded-xl border border-gi-border/50 bg-gi-base/50 p-4 flex flex-col md:flex-row items-center gap-4 transition-colors cursor-pointer',
                affordable ? 'hover:border-gi-primary/50 hover:bg-gi-base/65' : 'opacity-90 hover:border-gi-border/70'
            )}
        >
            {/* Left Column: Details and Pool */}
            <div className="flex-1 min-w-0 flex flex-col justify-between gap-3 self-stretch">
                {/* Header */}
                <div>
                    <h3 className="text-base md:text-lg font-bold text-gi-text hover:text-gi-primary transition-colors">
                        {map.name}
                    </h3>
                    <p className="text-[11px] text-gi-muted mt-0.5 font-medium">
                        {discoveredCount}/{map.pool.length} discovered
                    </p>
                </div>

                {/* Pool Preview Grid */}
                <div className="flex flex-wrap gap-1.5">
                    {map.pool.map((entry, i) => (
                        <PoolEntry key={`${entry.refId}-${i}`} entry={entry} onInspect={onInspect} />
                    ))}
                </div>
            </div>

            {/* Middle Column: Buy button on top + Costs section starting below Buy button */}
            <div className="shrink-0 flex flex-col items-start md:items-end gap-3 self-stretch py-0.5">
                {/* Simple Buy Button at Top */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onBuy();
                    }}
                    disabled={!affordable}
                    className={cn(
                        'px-5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-all tabular-nums shrink-0',
                        affordable
                            ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-gold hover:bg-gi-gold/25 cursor-pointer shadow-sm'
                            : 'border-gi-border/40 bg-black/20 text-gi-muted/50 cursor-not-allowed'
                    )}
                >
                    <Coins size={12} /> Buy
                </button>

                {/* Costs Section starting below the Buy button */}
                <div className="flex flex-col items-start md:items-end gap-1">
                    <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">
                        Costs
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gi-gold tabular-nums">
                        <Coins size={13} className="text-gi-gold shrink-0" />
                        <span>{map.price.toLocaleString()} GP</span>
                    </div>

                    {map.materials.map(m => (
                        <div key={m.id || m.name} className="text-[11px] text-gi-text font-medium">
                            {m.quantity}× {m.name}
                        </div>
                    ))}

                    {!affordable && (
                        <div className="text-[10px] font-semibold text-gi-danger max-w-[150px] text-left md:text-right mt-0.5">
                            {map.affordability.reason}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: 128px Draggable Map Stage */}
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    onInspect?.('map', map.id);
                }}
                className="shrink-0 flex items-center justify-center rounded-lg bg-black/30 border border-gi-border/30 self-center hover:border-gi-primary/50 transition-colors"
            >
                <div
                    ref={affordable ? drag.setNodeRef : undefined}
                    {...(affordable ? drag.handleProps : {})}
                    className={cn(
                        "w-32 h-32 flex items-center justify-center transition-opacity select-none",
                        affordable
                            ? "cursor-grab active:cursor-grabbing filter drop-shadow(0 4px 8px rgba(0,0,0,0.5))"
                            : "opacity-60 grayscale-[30%] cursor-not-allowed",
                        drag.isDragging && "opacity-30"
                    )}
                    title={affordable ? "Drag this Map onto your Tray to buy!" : map.affordability.reason}
                >
                    <TokenSprite
                        typeId={map.tokenId}
                        surface={TOKEN_SURFACE.BOARD}
                        alt={map.name}
                    />
                </div>
            </div>
        </div>
    );
};

/**
 * Pool Entry chip with silhouette support for undiscovered drops
 */
const PoolEntry = ({ entry, onInspect }) => {
    if (!entry.known) {
        return (
            <span
                title="Undiscovered — open this map to reveal"
                className="w-8 h-8 rounded bg-black/60 border border-gi-border/40 flex items-center justify-center shrink-0"
            >
                <HelpCircle size={11} className="text-gi-muted/40" />
            </span>
        );
    }

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                if (entry.kind === 'token') onInspect?.('token', entry.refId);
            }}
            title={entry.kind === 'item' ? `${entry.name} ×${entry.quantity}` : entry.name}
            className="w-8 h-8 rounded bg-gi-surface/60 border border-gi-border/50 flex items-center justify-center hover:border-gi-primary/60 transition-colors shrink-0 cursor-pointer overflow-hidden"
        >
            {entry.kind === 'token' ? (
                <TokenSprite
                    typeId={entry.refId}
                    surface={TOKEN_SURFACE.CATALOGUE}
                    alt={entry.name}
                />
            ) : (
                <span className="text-[8px] font-bold text-gi-muted">{entry.name.slice(0, 2)}</span>
            )}
        </button>
    );
};

export default CartographerTab;
