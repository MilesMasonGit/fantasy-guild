import { cn } from '../../utils/cn.js';
import { getMap } from '../../../config/registries/mapRegistry.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { tokenForMap, isDiscovered, mapMaterials } from '../../../systems/board/Cartographer.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { Coins } from 'lucide-react';

/**
 * MapInspection — displays Map details, full token/item pool, and exact drop chances.
 */
export const MapInspection = ({ mapId, onInspect }) => {
    const map = getMap(mapId);
    if (!map) return null;

    const mapTokenId = tokenForMap(mapId);
    // Through the shared projection, not the raw registry (CR2-196): the raw
    // shape is `{ itemId, quantity }` with no name and no `id`, so reading it
    // here drew every material as "Unknown" under a duplicate React key.
    const materials = mapMaterials(map);
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
            {materials.length > 0 && (
                <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-gi-base/40 border border-gi-border/30">
                    <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">
                        Required Materials
                    </span>
                    <div className="flex flex-col gap-1">
                        {materials.map(m => (
                            <EntityRibbon
                                key={m.itemId}
                                kind="item"
                                id={m.itemId}
                                name={m.name}
                                quantity={m.quantity}
                                size="sm"
                                variant="cost"
                            />
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

                        return (
                            <EntityRibbon
                                key={`${entry.refId}-${index}`}
                                kind={entry.kind}
                                id={entry.refId}
                                quantity={entry.quantity || 1}
                                chance={`${percentage}%`}
                                subtitle={!isKnown ? 'Undiscovered' : (entry.kind === 'token' ? 'Token' : 'Item')}
                                // Showing the odds next to "Undiscovered" is
                                // deliberate, not a leak (owner, 2026-08-25):
                                // the numbers are what let a player compare two
                                // Maps in the shop, while *what* drops stays a
                                // surprise until one is opened. Say so, or the
                                // pairing reads as a bug.
                                title={!isKnown
                                    ? `${percentage}% of this Map's drops — what it is stays hidden until you open one`
                                    : undefined}
                                isDiscovered={isKnown}
                                size="md"
                                variant="loot"
                                onInspect={isKnown && entry.kind === 'token' ? onInspect : undefined}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MapInspection;
