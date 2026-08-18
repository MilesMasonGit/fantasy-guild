import { cn } from '../../utils/cn.js';
import { getMap } from '../../../config/registries/mapRegistry.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { tokenForMap, isDiscovered } from '../../../systems/board/Cartographer.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { Coins, HelpCircle } from 'lucide-react';

/**
 * MapInspection — displays Map details, full token/item pool, and exact drop chances.
 */
export const MapInspection = ({ mapId, onInspect }) => {
    const map = getMap(mapId);
    if (!map) return null;

    const mapTokenId = tokenForMap(mapId);
    const pool = map.pool || [];
    const totalWeight = pool.reduce((sum, entry) => sum + (entry.weight || 0), 0);

    // Sort entries by drop chance (highest weight first)
    const sortedPool = [...pool].sort((a, b) => (b.weight || 0) - (a.weight || 0));

    return (
        <div className="flex flex-col gap-4 p-4 text-xs text-gi-text">
            {/* Header with Map Token */}
            <div className="flex items-center gap-3 pb-3 border-b border-gi-border/40">
                <div className="w-14 h-14 rounded-lg bg-black/40 border border-gi-border/40 flex items-center justify-center shrink-0">
                    <TokenSprite
                        typeId={mapTokenId}
                        surface={TOKEN_SURFACE.INSPECT}
                        alt={map.name}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gi-text truncate">{map.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-gi-gold font-bold tabular-nums">
                        <Coins size={13} /> {map.price.toLocaleString()} GP
                    </div>
                </div>
            </div>

            {/* Materials Breakdown (if any) */}
            {map.materials && map.materials.length > 0 && (
                <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-gi-base/40 border border-gi-border/30">
                    <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">
                        Required Materials
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {map.materials.map(m => (
                            <span key={m.id || m.name} className="px-2 py-0.5 rounded bg-black/30 border border-gi-border/40 text-[11px] font-medium text-gi-text">
                                {m.quantity}× {m.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Token Pool & Drop Chances */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center">
                    <span className="text-xs font-bold text-gi-text">
                        Drops:
                    </span>
                </div>

                <div className="flex flex-col gap-1.5">
                    {sortedPool.map((entry, index) => {
                        const weight = entry.weight || 0;
                        const percentage = totalWeight > 0 ? ((weight / totalWeight) * 100).toFixed(1) : '0.0';
                        const isKnown = isDiscovered(entry.refId);
                        const isToken = entry.kind === 'token';
                        const name = !isKnown
                            ? '???'
                            : (isToken ? tokenName(entry.refId) : (getItem(entry.refId)?.name || entry.refId));
                        const subLabel = !isKnown
                            ? 'Undiscovered'
                            : (isToken ? 'Token' : `Item ×${entry.quantity || 1}`);

                        return (
                            <div
                                key={`${entry.refId}-${index}`}
                                onClick={() => isKnown && isToken && onInspect?.('token', entry.refId)}
                                className={cn(
                                    "flex items-center justify-between gap-2 p-2 rounded-lg border border-gi-border/40 bg-gi-base/50 transition-colors",
                                    isKnown && isToken ? "cursor-pointer hover:border-gi-primary/60 hover:bg-gi-base/80" : ""
                                )}
                                title={isKnown ? (isToken ? `Click to inspect ${name}` : name) : 'Undiscovered Drop'}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded bg-black/40 border border-gi-border/30 flex items-center justify-center shrink-0 overflow-hidden">
                                        {isKnown ? (
                                            isToken ? (
                                                <TokenSprite
                                                    typeId={entry.refId}
                                                    surface={TOKEN_SURFACE.CATALOGUE}
                                                    alt={name}
                                                />
                                            ) : (
                                                <span className="text-[9px] font-bold text-gi-muted">{name.slice(0, 2)}</span>
                                            )
                                        ) : (
                                            <HelpCircle size={13} className="text-gi-muted/40" />
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className={cn("text-xs font-bold truncate", isKnown ? "text-gi-text" : "text-gi-muted/60 italic")}>
                                            {name}
                                        </span>
                                        <span className="text-[10px] text-gi-muted">
                                            {subLabel}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center shrink-0 tabular-nums">
                                    <span className="text-xs font-bold text-gi-primary">
                                        {percentage}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MapInspection;
