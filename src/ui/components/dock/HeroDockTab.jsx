import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getJob } from '../../../config/registries/jobRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { Pencil, Backpack, Heart } from 'lucide-react';

/**
 * HeroDockTab — sliding hero tab in the rightmost Hero Dock.
 * - Collapsed: 64px headshot portrait on the left, top hero name, mini HP bar.
 * - Hover: Slides out to preview stats without displacing the dock.
 * - Sits above the inspection sheet with z-30 / z-40.
 */
export const HeroDockTab = ({
    heroId,
    isSelected = false,
    onSelect,
    onDoubleClick,
    onEdit
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const engine = useEngine();

    const hero = useGameState(
        state => (state.heroes || []).find(h => h.id === heroId),
        ['heroes_updated', 'hero_equipment_changed', 'hero:status_changed', 'state_changed'],
        null,
        { deps: [heroId] }
    );

    const tile = useGameState(
        state => state.board?.heroTiles?.[heroId] ?? null,
        ['board:hero_placed', 'board:hero_recalled', 'state_changed'],
        null,
        { deps: [heroId] }
    );

    const token = useGameState(
        state => tile == null ? null : (state.board?.tiles?.[tile] || null),
        ['board:tile_changed', 'state_changed'],
        null,
        { deps: [tile] }
    );

    const drag = useEntityDrag({
        id: `rightmost-dock-${heroId}`,
        surface: DND_SURFACE.DRAWER,
        kind: DRAG_KIND.HERO,
        payload: { kind: DRAG_KIND.HERO, heroId }
    });

    const drop = useEntityDrop({
        id: `rightmost-dock-drop-${heroId}`,
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.ITEM && p.fromHeroId !== heroId,
        onDrop: p => {
            if (p.itemId) {
                engine.EquipmentManager.equipItem(heroId, p.itemId);
            }
        }
    });

    if (!hero) return null;

    const def = token ? getTokenType(token.typeId) : null;
    const isWorking = tile != null && !!def?.config && !token.alert;
    const isWounded = hero.status === 'wounded';
    const job = hero.jobId ? getJob(hero.jobId) : null;
    const jobTitle = job ? job.name : (hero.className || 'Recruit');
    const level = Math.floor(hero.level || 1);

    // Inventory count out of 9
    const equippedCount = Array.isArray(hero.equipment)
        ? hero.equipment.filter(Boolean).length
        : Object.values(hero.equipment || {}).filter(Boolean).length;

    // Sprite & Icon paths
    const headshotPath = resolveSpritePath(hero.icon || 'icon_recruit_0') || resolveSpritePath(hero.spriteId || 'hero_recruit_0');

    // Health
    const hp = Math.max(0, Math.round(hero.hp?.current ?? 0));
    const hpMax = Math.max(1, hero.hp?.max ?? 100);
    const hpPercent = Math.min(100, Math.round((hp / hpMax) * 100));

    // Status Pip Tone
    const pipColor = isWounded
        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)] animate-pulse'
        : isWorking
        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
        : 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]';

    const titleText = isHovered ? `${hero.name}, Lv ${level} ${jobTitle}` : hero.name;

    return (
        <div
            className="relative w-20 h-[72px] select-none shrink-0"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
                {...drag.dragHandleProps}
                {...drop.droppableProps}
                onClick={() => onSelect?.(heroId)}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDoubleClick?.(heroId);
                }}
                className={cn(
                    'absolute right-0 top-0 h-[72px] rounded-l-xl border-2 border-r-0 border-[#3a271d]',
                    'bg-[#140e0b]/95 shadow-2xl transition-all duration-200 ease-out select-none flex flex-col justify-between pt-1 pb-1.5 px-1.5',
                    isSelected
                        ? 'w-20 z-30 ring-2 ring-gi-gold border-gi-gold bg-[#1e1511]'
                        : isHovered
                        ? 'w-64 z-40 bg-[#1e1511] border-[#8a5d45] shadow-[0_4px_24px_rgba(0,0,0,0.9)] cursor-grab active:cursor-grabbing'
                        : 'w-20 z-30 hover:border-[#6a4431] cursor-grab active:cursor-grabbing',
                    drag.isDragging && 'opacity-30'
                )}
            >
                {/* Top: Hero Name sits above the headshot, sliding out with it */}
                <div className="absolute -top-3.5 left-2 flex items-center gap-1 pointer-events-none z-20">
                    <span
                        className="text-[10px] font-bold text-white whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,1)] tracking-wide leading-none"
                        style={{ textShadow: '0 1px 3px #000, 0 0 4px #000' }}
                        title={titleText}
                    >
                        {titleText}
                    </span>
                    {isHovered && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit?.(heroId);
                            }}
                            className="p-0.5 rounded hover:bg-white/10 text-gi-muted hover:text-gi-gold transition-colors pointer-events-auto drop-shadow"
                            title="Edit Hero"
                        >
                            <Pencil size={10} />
                        </button>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex items-center gap-2 min-h-0 overflow-hidden pt-1">
                    {/* Left: 64px Headshot Portrait with Activity Pip */}
                    <div className="w-14 h-14 rounded-lg bg-black/60 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 relative shadow-inner">
                        <div
                            className={cn("absolute top-1 right-1 w-2 h-2 rounded-full z-10", pipColor)}
                            title={isWounded ? 'Wounded' : isWorking ? `Working: ${token ? tokenName(token.typeId) : 'Tile'}` : 'Idle in Guild'}
                        />
                        {headshotPath ? (
                            <img
                                src={headshotPath.startsWith('/') ? headshotPath : `/${headshotPath}`}
                                alt={hero.name}
                                className="w-14 h-14 object-contain"
                                style={{ imageRendering: 'pixelated' }}
                            />
                        ) : (
                            <span className="text-xl">{hero.icon || '🧑'}</span>
                        )}
                    </div>

                    {/* Right: Expanded Info when Hovered */}
                    {isHovered && (
                        <div className="flex-1 flex flex-col justify-center h-full py-0.5 min-w-0 pointer-events-auto space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] text-gi-muted">
                                <Backpack size={11} className="text-amber-400 shrink-0" />
                                <span className="text-gi-gold font-medium">{equippedCount}/9 Items</span>
                            </div>

                            <div className="text-[10px] truncate">
                                {isWounded ? (
                                    <span className="text-red-400 font-bold">Wounded</span>
                                ) : isWorking ? (
                                    <span className="text-emerald-400 truncate">
                                        Working: {token ? tokenName(token.typeId) : 'Tile'}
                                    </span>
                                ) : (
                                    <span className="text-blue-300">Idle in Guild</span>
                                )}
                            </div>

                            <div className="text-[9px] text-gi-muted/80 flex items-center gap-1">
                                <Heart size={9} className="text-red-400 shrink-0" />
                                <span>{hp} / {hpMax} HP</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom: Mini HP Bar */}
                <div className="w-full h-1 bg-black/80 rounded-full overflow-hidden border border-white/10 shrink-0 mt-0.5">
                    <div
                        className={cn(
                            "h-full transition-all duration-300",
                            hpPercent > 50 ? "bg-emerald-500" : hpPercent > 20 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${hpPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default HeroDockTab;
