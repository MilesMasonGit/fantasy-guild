import React, { useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { tokenSpritePath } from '../../../config/registries/tokenRegistry.js';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { Coins, HelpCircle } from 'lucide-react';

/**
 * CartographerTab — the Map shop.
 *
 * ## Every Map, always, in price order (D-99, D-101)
 * **Nothing is ever locked.** Cost is the only gate, so a Map you cannot afford
 * is shown at its real price rather than hidden or greyed into meaninglessness.
 * Price order does the teaching by itself: one affordable option at the top,
 * and a descending ladder of ambitions beneath it. No tutorial, no
 * recommendations, no "come back later".
 *
 * ## The pool, with silhouettes (D-159)
 * Each Map shows its **full** pool; entries the player has never seen come out
 * are drawn as silhouettes. Two jobs at once:
 *
 * * **Restocking becomes deliberate** — someone who needs Forests can see which
 *   Map yields them and shop accordingly. This is the main answer to D-154's
 *   "bursts are random with no reliability guarantee", and it matters because
 *   D-153 made Maps the *supply* route as well as the discovery one. Blind
 *   shopping was fine for discovery; it is not fine for supply.
 * * **An unopened silhouette is something to want**, which restores the
 *   collection hook that D-52 removed when playsets were cut.
 *
 * ## Refusals always say why (D-150, D-160)
 * Short on gold, short on materials, or no room in the Tray — each states its
 * cause on the button itself. A silent "no" on a shop row is the worst
 * available outcome, and the Tray case in particular is not obviously the
 * shop's business unless it says so.
 */
export const CartographerTab = ({ onInspect }) => {
    const { maps, gold } = useGameState(
        state => ({
            maps: Cartographer.catalogue(),
            gold: state.currency?.gold || 0
        }),
        ['map_purchased', 'map_opened', 'currency_changed', 'inventory_updated', 'state_changed'],
        // ⚠️ `eventFilter`, not a default value — see the note in Board.jsx.
        null
    );

    const buy = useCallback((mapId, name) => {
        const result = Cartographer.buyMap(mapId);
        if (result.success) NotificationSystem.success(`${name} — it's in your Tray. Double-click to open it.`);
        else NotificationSystem.warning(result.reason);
    }, []);

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="shrink-0 flex items-center justify-between px-3 py-1 border-b border-gi-border/40">
                <span className="text-[9px] text-gi-muted italic normal-case">
                    Every map, always. Price is the only gate.
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-gi-gold tabular-nums">
                    <Coins size={11} /> {gold.toLocaleString()}
                </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
                {maps.map(map => (
                    <MapRow key={map.id} map={map} onBuy={() => buy(map.id, map.name)} onInspect={onInspect} />
                ))}
            </div>
        </div>
    );
};

const MapRow = ({ map, onBuy, onInspect }) => {
    const affordable = map.affordability.success;

    return (
        <div className="rounded border border-gi-border/50 bg-gi-base/40 p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-gi-text truncate">{map.name}</div>
                    <div className="text-[9px] text-gi-muted">
                        {/* The price never rises within a theme (D-166), which is
                            what makes restocking safe to rely on forever. Saying
                            so on the row is cheaper than the player discovering
                            it by watching the number not move. */}
                        Costs the same every time
                        {map.materials.length > 0 && (
                            <> · plus {map.materials.map(m => `${m.quantity}× ${m.name}`).join(', ')}</>
                        )}
                    </div>
                </div>

                <button
                    onClick={onBuy}
                    disabled={!affordable}
                    title={affordable ? `Buy for ${map.price}g` : map.affordability.reason}
                    className={cn(
                        'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold border transition-colors tabular-nums',
                        affordable
                            ? 'border-gi-gold/50 text-gi-gold hover:bg-gi-gold/15'
                            : 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                    )}
                >
                    <Coins size={11} /> {map.price.toLocaleString()}
                </button>
            </div>

            {/* The reason, in full, when it will not sell. */}
            {!affordable && (
                <div className="text-[9px] text-gi-danger/80">{map.affordability.reason}</div>
            )}

            {/* The pool. Silhouettes are the collection hook (D-159). */}
            <div className="flex flex-wrap gap-1">
                {map.pool.map((entry, i) => (
                    <PoolEntry key={`${entry.refId}-${i}`} entry={entry} onInspect={onInspect} />
                ))}
            </div>
        </div>
    );
};

/**
 * One thing a Map can yield.
 *
 * An undiscovered entry shows its **silhouette and no name** — the shape of
 * something to want, rather than a spoiler or a blank. A discovered one is
 * fully legible, because by then its job has changed from "want this" to
 * "this is where you restock it".
 */
const PoolEntry = ({ entry, onInspect }) => {
    const art = entry.kind === 'token' ? tokenSpritePath(entry.refId) : null;

    if (!entry.known) {
        return (
            <span
                title="You haven't seen this one yet"
                className="w-7 h-7 rounded bg-black/50 border border-gi-border/40 flex items-center justify-center"
            >
                <HelpCircle size={12} className="text-gi-muted/40" />
            </span>
        );
    }

    return (
        <button
            onClick={() => entry.kind === 'token' && onInspect?.('token', entry.refId)}
            title={entry.kind === 'item' ? `${entry.name} ×${entry.quantity}` : entry.name}
            className="w-7 h-7 rounded bg-gi-surface/60 border border-gi-border/50 flex items-center justify-center hover:border-gi-primary/60 transition-colors"
        >
            {art ? (
                <img
                    src={art}
                    alt={entry.name}
                    draggable={false}
                    style={{ width: 22, height: 22, imageRendering: 'pixelated' }}
                />
            ) : (
                <span className="text-[8px] font-bold text-gi-muted">{entry.name.slice(0, 2)}</span>
            )}
        </button>
    );
};

export default CartographerTab;
