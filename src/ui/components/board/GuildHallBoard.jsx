import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import {
    GUILD_UPGRADES, HALL_NODE, getUpgradeDef, getUpgradeWebLinks, isUpgradeAccessible, toRoman
} from '../../../config/guildUpgrades.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { useBoardScale } from '../../hooks/useBoardScale.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The web's natural drawing space, in pixels, before it is scaled to fit the
 * window (`useBoardScale`, as the mat does). Upgrade node positions are unit
 * coordinates centred on the Hall (`guildUpgrades.js`); one unit is
 * `WEB_UNIT_PX`, so the first ring (0.5 out) sits 200px from the Hall.
 */
export const WEB_W = 1000;
export const WEB_H = 760;
export const WEB_UNIT_PX = 400;
const NODE_PX = 112;
const HALL_PX = 168;

const PIXEL_FONT = "'Silkscreen', cursive, monospace";
const OUTLINE = '0 1px 0 #000, 1px 0 0 #000, 0 -1px 0 #000, -1px 0 0 #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 3px rgba(0,0,0,0.95)';

/** A node's centre in the web's natural pixels. The Hall is the middle. */
export function webPoint(nodeId) {
    if (nodeId === HALL_NODE) return { x: WEB_W / 2, y: WEB_H / 2 };
    const node = getUpgradeDef(nodeId)?.node || { x: 0, y: 0 };
    return { x: WEB_W / 2 + node.x * WEB_UNIT_PX, y: WEB_H / 2 + node.y * WEB_UNIT_PX };
}

/**
 * A node's state on the web: `maxed` at its top rank, `bought` from rank
 * one, `buyable` when open but not yet bought, `locked` when no linked node is
 * bought. The Hall is the root and counts as bought.
 */
export function nodeState(nodeId, ranks) {
    if (nodeId === HALL_NODE) return 'bought';
    const def = getUpgradeDef(nodeId);
    if (!def) return 'locked';
    const rank = ranks[def.id] || 0;
    if (rank >= def.maxRank) return 'maxed';
    if (rank >= 1) return 'bought';
    return isUpgradeAccessible(def.id, ranks) ? 'buyable' : 'locked';
}

const isOwned = (state) => state === 'bought' || state === 'maxed';

/**
 * GuildHallBoard — the Guild Hall upgrade web.
 *
 * The Hall in the centre, every upgrade a node placed freely around it, lines
 * between linked nodes. A line glows gold once both its ends are bought (the
 * Hall always is), so the bought paths read at a glance; a line to a locked
 * node is dimmed. There are no tiles here: nodes are picked by upgrade id.
 * The Effects list sits to the left of this, in `ReactRoot`.
 */
export const GuildHallBoard = ({
    selectedUpgradeId,
    onSelectUpgrade,
    onClose
}) => {
    const [hovered, setHovered] = useState(null);
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.STATE_CHANGED]
    );
    // Which upgrades the Bank can pay for right now (Hall upgrades cost items). A flat id list
    // as a string, per the useGameState selector contract.
    const affordableSignature = useGameState(
        () => GUILD_UPGRADES.filter(u => GuildUpgradeManager.canAfford(u.id)).map(u => u.id).join(','),
        [ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.STATE_CHANGED]
    );
    const affordable = new Set((affordableSignature || '').split(',').filter(Boolean));

    const fit = useBoardScale(WEB_W, WEB_H);
    const links = getUpgradeWebLinks();
    const hall = webPoint(HALL_NODE);

    return (
        <div className="w-full h-full min-w-0 min-h-0 flex items-center justify-center py-8 px-4 overflow-hidden select-none">
            {/* The wooden frame (the Effects panel's), floored in the Hall's
                own boards. */}
            <div
                className="w-full h-full min-w-0 min-h-0 relative rounded-2xl border-4 border-[#3a271d] overflow-hidden flex"
                style={{
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/assets/playmat/tiles/pm_board_guild_hall_1.png')`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: 'auto, 128px',
                    imageRendering: 'pixelated',
                    boxShadow: 'inset 0 0 28px rgba(0,0,0,0.9), 0 8px 24px rgba(0,0,0,0.6)'
                }}
            >
                <div ref={fit.ref} className="flex-1 min-w-0 min-h-0 flex items-center justify-center p-4 overflow-hidden">
                    <div className="relative shrink-0" style={{ width: fit.size, height: fit.height }}>
                        <div
                            data-board-origin
                            data-guild-hall-board="true"
                            data-natural-width={WEB_W}
                            data-natural-height={WEB_H}
                            className="relative shrink-0"
                            style={{
                                width: WEB_W,
                                height: WEB_H,
                                transform: `scale(${fit.scale})`,
                                transformOrigin: 'top left'
                            }}
                        >
                            {/* Lines first, so the nodes sit on top of them. */}
                            <svg
                                className="absolute inset-0 pointer-events-none"
                                width={WEB_W}
                                height={WEB_H}
                                viewBox={`0 0 ${WEB_W} ${WEB_H}`}
                            >
                                {links.map(({ from, to }) => {
                                    const a = webPoint(from);
                                    const b = webPoint(to);
                                    const sa = nodeState(from, ranks);
                                    const sb = nodeState(to, ranks);
                                    const lit = isOwned(sa) && isOwned(sb);
                                    const dim = sa === 'locked' || sb === 'locked';
                                    return (
                                        <g key={`${from}:${to}`} data-hall-link={`${from}:${to}`} data-link-lit={lit ? 'true' : 'false'}>
                                            {/* A dark casing under every line keeps it legible on the floor. */}
                                            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#140d08" strokeWidth={12} strokeLinecap="round" opacity={dim ? 0.5 : 0.9} />
                                            <line
                                                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                                stroke={lit ? '#f5c542' : dim ? '#4a3526' : '#9a7650'}
                                                strokeWidth={lit ? 6 : 5}
                                                strokeLinecap="round"
                                                strokeDasharray={dim ? '10 10' : undefined}
                                                opacity={dim ? 0.6 : 1}
                                                style={lit ? { filter: 'drop-shadow(0 0 6px rgba(245,197,66,0.85))' } : undefined}
                                            />
                                        </g>
                                    );
                                })}
                            </svg>

                            {/* The Hall. Clicking it returns to the playmat. */}
                            <button
                                type="button"
                                data-hall-node={HALL_NODE}
                                data-node-state="bought"
                                title="Return to Playmat"
                                onMouseEnter={() => setHovered(HALL_NODE)}
                                onMouseLeave={() => setHovered(null)}
                                onClick={() => onClose?.()}
                                className="absolute flex items-center justify-center rounded-full border-4 border-gi-gold bg-[#2a1d15] cursor-pointer"
                                style={{
                                    left: hall.x - HALL_PX / 2,
                                    top: hall.y - HALL_PX / 2,
                                    width: HALL_PX,
                                    height: HALL_PX,
                                    boxShadow: '0 0 22px rgba(245,197,66,0.55), inset 0 0 18px rgba(0,0,0,0.8)'
                                }}
                            >
                                <img
                                    src="/assets/tokens/token_guildhall.png"
                                    alt="Guild Hall"
                                    className={cn('w-32 h-32 object-contain drop-shadow-md transition-[filter] duration-150', hovered === HALL_NODE && 'gi-token-hover-pulse')}
                                    style={{ imageRendering: 'pixelated' }}
                                />
                            </button>

                            {GUILD_UPGRADES.map(def => {
                                const p = webPoint(def.id);
                                const state = nodeState(def.id, ranks);
                                const rank = ranks[def.id] || 0;
                                const isSelected = selectedUpgradeId === def.id;
                                const canAfford = (state === 'buyable' || state === 'bought') && affordable.has(def.id);
                                const owned = isOwned(state);
                                return (
                                    <div
                                        key={def.id}
                                        className="absolute flex flex-col items-center"
                                        style={{ left: p.x - NODE_PX / 2, top: p.y - NODE_PX / 2, width: NODE_PX }}
                                    >
                                        <button
                                            type="button"
                                            data-hall-node={def.id}
                                            data-node-state={state}
                                            data-selected={isSelected ? 'true' : undefined}
                                            id={def.id === 'roster_size' ? 'guild-roster-upgrade-node' : def.id === 'wishing_well' ? 'guild-wishing-well-upgrade-node' : undefined}
                                            data-guild-roster-upgrade={def.id === 'roster_size' ? 'true' : undefined}
                                            data-guild-wishing-well-upgrade={def.id === 'wishing_well' ? 'true' : undefined}
                                            title={def.name}
                                            onMouseEnter={() => setHovered(def.id)}
                                            onMouseLeave={() => setHovered(null)}
                                            onClick={() => onSelectUpgrade?.(def)}
                                            className={cn(
                                                'relative flex items-center justify-center rounded-xl border-4 cursor-pointer transition-[box-shadow,border-color] duration-150',
                                                state === 'maxed' && 'border-yellow-300',
                                                state === 'bought' && 'border-gi-gold',
                                                state === 'buyable' && 'border-[#9a7650]',
                                                state === 'locked' && 'border-[#3a271d]',
                                                isSelected && 'outline outline-4 outline-offset-2 outline-white/85'
                                            )}
                                            style={{
                                                width: NODE_PX,
                                                height: NODE_PX,
                                                backgroundColor: state === 'locked' ? '#15100b' : '#2a1d15',
                                                boxShadow: state === 'maxed'
                                                    ? '0 0 24px rgba(253,224,71,0.8), inset 0 0 14px rgba(0,0,0,0.8)'
                                                    : state === 'bought'
                                                        ? '0 0 14px rgba(245,197,66,0.55), inset 0 0 14px rgba(0,0,0,0.8)'
                                                        : 'inset 0 0 14px rgba(0,0,0,0.8), 0 4px 10px rgba(0,0,0,0.6)'
                                            }}
                                        >
                                            <img
                                                src={def.sprite}
                                                alt={def.name}
                                                className={cn(
                                                    'w-24 h-24 object-contain transition-[filter] duration-150',
                                                    state === 'locked' && 'grayscale opacity-30',
                                                    hovered === def.id && state !== 'locked' && 'gi-token-hover-pulse'
                                                )}
                                                style={{ imageRendering: 'pixelated' }}
                                            />
                                            {state === 'locked' && (
                                                <img
                                                    src="/assets/ui/ui_lock.png"
                                                    alt="Locked"
                                                    className="absolute w-12 h-12 object-contain opacity-80 drop-shadow-md pointer-events-none"
                                                    style={{ imageRendering: 'pixelated' }}
                                                />
                                            )}
                                            {/* Affordable: the Token Alert badge. */}
                                            {canAfford && (
                                                <div data-upgrade-available="true" className="absolute -top-3 -left-3 z-10 pointer-events-none">
                                                    <img
                                                        src="/assets/ui/ui_upgrade.png"
                                                        alt="Upgrade Available"
                                                        className="select-none animate-bounce drop-shadow-[0_0_8px_rgba(234,179,8,0.9)]"
                                                        style={{ width: 32, height: 32, imageRendering: 'pixelated', animationDuration: '2s' }}
                                                    />
                                                </div>
                                            )}
                                        </button>
                                        {/* The plaque: name and rank. */}
                                        <div
                                            className={cn(
                                                'mt-1.5 px-2 py-0.5 rounded-md border-2 text-center whitespace-nowrap pointer-events-none',
                                                owned ? 'bg-[#3d2a1f] border-gi-gold/70' : 'bg-[#1c140e]/95 border-[#3a271d]',
                                                state === 'locked' && 'opacity-60'
                                            )}
                                            style={{ fontFamily: PIXEL_FONT, textShadow: OUTLINE }}
                                        >
                                            <div className="text-[11px] leading-tight text-white">{def.name}</div>
                                            <div
                                                data-node-rank
                                                className={cn('text-[11px] leading-tight', state === 'maxed' ? 'text-yellow-300' : owned ? 'text-gi-gold' : 'text-stone-400')}
                                            >
                                                {`${toRoman(rank)}/${toRoman(def.maxRank)}`}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuildHallBoard;
