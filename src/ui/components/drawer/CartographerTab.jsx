import { useCallback, useRef, useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import * as Shop from '../../../systems/board/Shop.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * CartographerTab — the Shop (Token Lifecycle slice 5.1, SP-12).
 *
 * Top: every Token type with a `shop` block, grouped by section, with its item
 * price, what the Bank holds against it, and a Buy button that names what is
 * missing (`Shop.js`). Header: placed Tokens against the mat cap (SP-67).
 *
 * The old Map shop below it (Map cards, bursts, the Oak-Wood-priced Map
 * purchase) was deleted with the Map bursts (Token Lifecycle 9.1): a Map is an
 * ordinary Explore producer now, sold here like any other Token (slice 7.6).
 */
export const CartographerTab = ({ onInspect }) => {
    const scrollRef = useRef(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    // `Shop.catalogue()` checks each price against the Bank, so
    // `inventory_updated` has to re-run it or the Buy buttons keep stale
    // affordability.
    // The cap is a Mat Tuner setting, and a tuner change publishes no game
    // event of its own (slice 8.3): re-read the header when it moves.
    const [tuningRev, setTuningRev] = useState(0);
    useEffect(() => onMatTuningChanged(() => setTuningRev(n => n + 1)), []);

    const { shop, cap } = useGameState(
        () => ({
            shop: Shop.catalogue(),
            cap: Shop.capStatus()
        }),
        ['token_purchased', 'inventory_updated', 'state_changed'],
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
    }, [checkScroll, shop]);

    const scrollUp = () => {
        scrollRef.current?.scrollBy({ top: -180, behavior: 'smooth' });
    };

    const scrollDown = () => {
        scrollRef.current?.scrollBy({ top: 180, behavior: 'smooth' });
    };

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

export default CartographerTab;
