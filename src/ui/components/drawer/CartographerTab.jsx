import { useCallback, useRef, useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { useEntityDrag, useActiveDrag, useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as Shop from '../../../systems/board/Shop.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { ShoppingCart, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * CartographerTab — the Shop (Token Lifecycle slice 5.1, SP-12).
 *
 * Top: every Token type with a `shop` block, grouped by section, with its item
 * price, what the Bank holds against it, and a Buy button that names what is
 * missing (`Shop.js`). Header: placed Tokens against the mat cap (SP-67).
 *
 * Below: the old Map shop, kept until Map bursts retire (slice 9.1).
 *
 * Each Map card displays its details, cost, and item pool on the left,
 * and a full 128px Map Token on the right which can be dragged directly
 * into the Tray to purchase.
 */
export const CartographerTab = ({ onInspect }) => {
    const scrollRef = useRef(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    // `Cartographer.catalogue()` runs `canBuy()` per Map, which reads the Bank
    // (Maps cost items since slice 2.2, SP-65), so `inventory_updated` has to
    // re-run the catalogue or the Buy buttons keep stale affordability.
    // The cap is a Mat Tuner setting, and a tuner change publishes no game
    // event of its own (slice 8.3): re-read the header when it moves.
    const [tuningRev, setTuningRev] = useState(0);
    useEffect(() => onMatTuningChanged(() => setTuningRev(n => n + 1)), []);

    const { maps, shop, cap } = useGameState(
        () => ({
            maps: Cartographer.catalogue(),
            shop: Shop.catalogue(),
            cap: Shop.capStatus()
        }),
        ['map_purchased', 'map_opened', 'token_purchased', 'inventory_updated', 'state_changed'],
        null,
        { deps: [tuningRev] }
    );

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollUp(el.scrollTop > 6);
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 6);
    }, []);

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => {
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll, maps]);

    const scrollUp = () => {
        scrollRef.current?.scrollBy({ top: -180, behavior: 'smooth' });
    };

    const scrollDown = () => {
        scrollRef.current?.scrollBy({ top: 180, behavior: 'smooth' });
    };

    const buy = useCallback((mapId, name, sourceRect = null) => {
        const result = Cartographer.buyMap(mapId, { sourceRect });
        // Single click, not double (owner ruling 2026-08-24, CR2-158): both
        // `Tray.TrayToken` and `Board.BoardMapToken` burst on the first click.
        if (result.success) NotificationSystem.success(`${name} — it's in your Tray. Click to open it.`);
        else NotificationSystem.warning(result.reason);
    }, []);

    const buyToken = useCallback((typeId, name) => {
        const result = Shop.buy(typeId);
        if (result.success) NotificationSystem.success(`${name} placed beside the Guild Hall.`);
        else NotificationSystem.warning(result.reason);
    }, []);

    return (
        <div className="h-full flex flex-col min-h-0 relative">
            {/* Flat Scroll Arrow: Top */}
            {canScrollUp && (
                <button
                    onClick={scrollUp}
                    className="w-full py-1 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gi-gold/40 rounded-lg flex items-center justify-center text-gi-gold transition-colors shrink-0 mb-1.5 shadow active:scale-[0.99] cursor-pointer"
                    title="Scroll up"
                >
                    <ChevronUp size={14} />
                </button>
            )}

            {/* Scrollable Body (Scrollbar hidden) */}
            <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gi-text">Shop</h2>
                    <span data-shop-cap className="text-xs font-semibold text-gi-muted tabular-nums">
                        Placed Tokens {cap.placed} / {cap.cap}
                    </span>
                </div>

                {shop.length === 0 && (
                    <p className="text-xs text-gi-muted">Nothing is for sale yet.</p>
                )}
                {shop.map(group => (
                    <section key={group.section} data-shop-section={group.section} className="flex flex-col gap-1.5">
                        <h3 className="text-[11px] font-bold gi-caps tracking-wider text-gi-muted">{group.name}</h3>
                        {group.items.map(item => (
                            <ShopRow
                                key={item.typeId}
                                item={item}
                                onBuy={() => buyToken(item.typeId, item.name)}
                                onInspect={onInspect}
                            />
                        ))}
                    </section>
                ))}

                <h2 className="text-lg font-bold text-gi-text mt-2">Maps</h2>
                {maps.map(map => (
                    <MapCard
                        key={map.id}
                        map={map}
                        onBuy={(sourceRect) => buy(map.id, map.name, sourceRect)}
                        onInspect={onInspect}
                    />
                ))}
            </div>

            {/* Flat Scroll Arrow: Bottom */}
            {canScrollDown && (
                <button
                    onClick={scrollDown}
                    className="w-full py-1 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gi-gold/40 rounded-lg flex items-center justify-center text-gi-gold transition-colors shrink-0 mt-1.5 shadow active:scale-[0.99] cursor-pointer"
                    title="Scroll down"
                >
                    <ChevronDown size={14} />
                </button>
            )}
        </div>
    );
};

/**
 * One Token for sale: sprite, name, price lines (have / need) and a Buy button
 * whose label says what is missing when it cannot be bought. Plain on purpose
 * (TL-4).
 */
const ShopRow = ({ item, onBuy, onInspect }) => {
    const ok = item.affordability.success;
    return (
        <div data-shop-item={item.typeId} className="rounded-lg border border-gi-border/50 bg-gi-base/50 p-2 flex items-center gap-3">
            <button
                onClick={() => onInspect?.('token', item.typeId)}
                className="w-12 h-12 shrink-0 flex items-center justify-center cursor-pointer"
                title={item.name}
            >
                <TokenSprite typeId={item.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt={item.name} />
            </button>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gi-text">{item.name}</div>
                <div className="flex flex-wrap gap-x-3 text-[11px] tabular-nums">
                    {item.price.map(p => (
                        <span key={p.itemId} className={p.enough ? 'text-gi-muted' : 'text-gi-danger'}>
                            {p.name} {p.have}/{p.need}
                        </span>
                    ))}
                </div>
            </div>
            <button
                onClick={onBuy}
                disabled={!ok}
                title={ok ? 'Buy' : item.affordability.reason}
                className={cn(
                    'px-3 py-1 rounded-lg font-bold text-xs border shrink-0 max-w-[45%] text-right',
                    ok
                        ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-gold hover:bg-gi-gold/25 cursor-pointer'
                        : 'border-gi-border/40 bg-black/20 text-gi-danger cursor-not-allowed'
                )}
            >
                {ok ? 'Buy' : item.affordability.reason}
            </button>
        </div>
    );
};

/**
 * Map Card featuring details & pool on the left, costs & Buy button in the middle, and 128px draggable Map Token on the right.
 */
const MapCard = ({ map, onBuy, onInspect }) => {
    const stageRef = useRef(null);
    const affordable = map.affordability.success;
    const discoveredCount = map.pool.filter(p => p.known).length;
    const { activePayload } = useActiveDrag();

    const drag = useEntityDrag({
        id: `buy-map-${map.id}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: map.tokenId, from: { buyMapId: map.id } },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: !affordable
    });

    const isThisDragging = drag.isDragging || (activePayload?.from?.buyMapId === map.id);

    const drop = useEntityDrop({
        id: `cartographer-slot-${map.id}`,
        surface: DND_SURFACE.DRAWER,
        accepts: (p) => p.kind === DRAG_KIND.TOKEN && p.from?.buyMapId != null,
        onDrop: () => {
            // Drop back on shop shelf cancels purchase cleanly
        }
    });

    const setStageNodeRef = (node) => {
        stageRef.current = node;
        drop.setNodeRef(node);
    };

    const handleBuyClick = (e) => {
        e.stopPropagation();
        const stageEl = stageRef.current;
        const rect = stageEl ? stageEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
        onBuy?.(rect);
    };

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
                    onClick={handleBuyClick}
                    disabled={!affordable}
                    className={cn(
                        'px-5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-all tabular-nums shrink-0',
                        affordable
                            ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-gold hover:bg-gi-gold/25 cursor-pointer shadow-sm active:scale-95'
                            : 'border-gi-border/40 bg-black/20 text-gi-muted/50 cursor-not-allowed'
                    )}
                >
                    <ShoppingCart size={12} /> Buy
                </button>

                {/* Costs Section starting below the Buy button */}
                <div className="flex flex-col items-start md:items-end gap-1.5 w-full md:w-44">
                    <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">
                        Costs
                    </span>
                    {/* The price is items, not gold (SP-65, slice 2.2). */}
                    {map.priceItems.map(p => (
                        <EntityRibbon
                            key={`price-${p.itemId}`}
                            kind="item"
                            id={p.itemId}
                            name={p.name}
                            quantity={p.quantity}
                            size="sm"
                            variant="cost"
                            className="w-full"
                        />
                    ))}

                    {/* `itemId` is the field the catalogue projection carries;
                        `m.id` has never existed on it, so the ribbon got no id
                        and every row shared one undefined React key (CR2-196). */}
                    {map.materials.map(m => (
                        <EntityRibbon
                            key={m.itemId}
                            kind="item"
                            id={m.itemId}
                            name={m.name}
                            quantity={m.quantity}
                            size="sm"
                            variant="cost"
                            className="w-full"
                        />
                    ))}

                    {!affordable && (
                        <div className="text-[10px] font-semibold text-gi-danger max-w-[170px] text-left md:text-right mt-0.5">
                            {map.affordability.reason}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: 128px Draggable Map Stage */}
            <div
                ref={setStageNodeRef}
                onClick={(e) => {
                    e.stopPropagation();
                    onInspect?.('map', map.id);
                }}
                className={cn(
                    "shrink-0 flex items-center justify-center rounded-lg bg-black/30 border border-gi-border/30 self-center hover:border-gi-primary/50 transition-colors",
                    drop.valid && "ring-2 ring-gi-success/80 bg-gi-success/15"
                )}
            >
                <div
                    ref={affordable ? drag.setNodeRef : undefined}
                    {...(affordable ? drag.handleProps : {})}
                    className={cn(
                        "w-32 h-32 flex items-center justify-center transition-opacity select-none",
                        affordable
                            ? "cursor-grab active:cursor-grabbing filter drop-shadow(0 4px 8px rgba(0,0,0,0.5))"
                            : "opacity-60 grayscale-[30%] cursor-not-allowed",
                        isThisDragging && "opacity-0 pointer-events-none"
                    )}
                    style={{
                        opacity: isThisDragging ? 0 : 1,
                        visibility: isThisDragging ? 'hidden' : 'visible'
                    }}
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
                // An item gets its sprite, exactly as `MapInspection` draws it
                // (CR2-175). This used to print `entry.name.slice(0, 2)` — "Oak
                // Log" reached the player as "Oa". The full name is still on the
                // chip's tooltip above.
                <ItemIcon item={entry.refId} size={32} />
            )}
        </button>
    );
};

export default CartographerTab;
