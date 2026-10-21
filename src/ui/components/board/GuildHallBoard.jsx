import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import {
    GUILD_UPGRADES, HALL_NODE, CONSTELLATIONS, getUpgradeDef, getUpgradeWebLinks, isUpgradeAccessible
} from '../../../config/guildUpgrades.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { useBoardScale } from '../../hooks/useBoardScale.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The web's natural space, in pixels. Upgrade node positions are unit coordinates centred on
 * the Hall (`guildUpgrades.js`); one unit is `WEB_UNIT_PX`, so the first ring (0.5 out) sits
 * 200px from the Hall. The space is fitted to the window (`useBoardScale`), but only the
 * positions scale: stars, lines and tags are drawn at fixed whole-pixel sizes, so the art stays
 * crisp at any fit.
 */
export const WEB_W = 1000;
export const WEB_H = 760;
export const WEB_UNIT_PX = 400;

/** The owner's star sprites, 32 art pixels square, one per lit state. */
export const STAR_ART_PX = 32;
export const STAR_SPRITES = {
    locked: '/assets/playmat/screens/ui_star_grey.png',
    buyable: '/assets/playmat/screens/ui_star_blue.png',
    bought: '/assets/playmat/screens/ui_star_blue.png',
    maxed: '/assets/playmat/screens/ui_star_gold.png'
};
/** Each state's whole-pixel scale: the brighter the star, the bigger. */
export const STAR_SCALE = { locked: 1, buyable: 1, bought: 2, maxed: 2 };
export const HALL_STAR_SCALE = 3;
/** The smallest click target around a star, so a 32 px star is not fiddly to hit. */
const HIT_PX = 56;
/** One art pixel of the 2× sky: the width of a line. */
const LINE_PX = 2;

const OUTLINE = '0 1px 0 #000, 1px 0 0 #000, 0 -1px 0 #000, -1px 0 0 #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';

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

/** The constellations whose every star is lit, as a sorted id list. */
export function finishedConstellations(ranks) {
    return CONSTELLATIONS
        .filter(c => {
            const stars = GUILD_UPGRADES.filter(u => u.constellation === c.id);
            return stars.length > 0 && stars.every(u => isOwned(nodeState(u.id, ranks)));
        })
        .map(c => c.id);
}

/**
 * The constellation a line belongs to: a line from a star to the Hall, or between two stars of
 * one constellation, is part of its picture; a line joining two constellations is part of
 * neither.
 */
export function linkConstellation(from, to) {
    const a = getUpgradeDef(from)?.constellation;
    if (to === HALL_NODE) return a || null;
    const b = getUpgradeDef(to)?.constellation;
    return a && a === b ? a : null;
}

/**
 * Where a star's tag sits in the star's box (`box` square, the star `starPx` in its middle): a
 * zero-size anchor just off the star's edge, with the text centred on it or running away from
 * it, so the tag never covers its own star whatever its length.
 */
function tagPlacement(side, box, starPx) {
    const mid = box / 2;
    const gap = starPx / 2 + 2;
    switch (side) {
        case 'above': return { left: mid, bottom: mid + gap, width: 0, justifyContent: 'center' };
        case 'left': return { right: mid + gap + 2, top: mid, height: 0, alignItems: 'center' };
        case 'right': return { left: mid + gap + 2, top: mid, height: 0, alignItems: 'center' };
        default: return { left: mid, top: mid + gap, width: 0, justifyContent: 'center' };
    }
}

/**
 * GuildHallBoard: the Guild Hall upgrades as a night sky.
 *
 * Every upgrade is a pixel star whose sprite and size say its state, tagged with its name and
 * rank; the Hall is the pole star in the middle that every constellation starts from. Lines are
 * faint until both ends are lit. The sky behind is `HallSky`, the Effects list sits to the left
 * and the details panel to the right, both in `ReactRoot`.
 * Hovering a star reports it (`onHoverUpgrade`) so the details panel can show it; a click pins
 * it (`onSelectUpgrade`).
 */
export const GuildHallBoard = ({
    selectedUpgradeId,
    onSelectUpgrade,
    onHoverUpgrade,
    onClose
}) => {
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    );
    // Which upgrades the Bank can pay for right now (Hall upgrades cost items). A flat id list
    // as a string, per the useGameState selector contract.
    const affordableSignature = useGameState(
        () => GUILD_UPGRADES.filter(u => GuildUpgradeManager.canAfford(u.id)).map(u => u.id).join(','),
        [ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    );
    const affordable = new Set((affordableSignature || '').split(',').filter(Boolean));

    // A constellation finished while the screen is open flashes once; one already finished when
    // the screen opens does not.
    const finishedKey = finishedConstellations(ranks).join(',');
    const finished = new Set(finishedKey.split(',').filter(Boolean));
    const seenFinished = useRef(null);
    const [glowing, setGlowing] = useState([]);
    useEffect(() => {
        const now = finishedKey.split(',').filter(Boolean);
        const before = seenFinished.current;
        seenFinished.current = new Set(now);
        if (!before) return;
        const fresh = now.filter(id => !before.has(id));
        if (fresh.length) setGlowing(g => [...g.filter(id => !fresh.includes(id)), ...fresh]);
    }, [finishedKey]);

    const fit = useBoardScale(WEB_W, WEB_H);
    const at = (nodeId) => {
        const p = webPoint(nodeId);
        return { x: Math.round(p.x * fit.scale), y: Math.round(p.y * fit.scale) };
    };
    const links = getUpgradeWebLinks();
    const hall = at(HALL_NODE);
    const hallPx = STAR_ART_PX * HALL_STAR_SCALE;
    const hover = (id) => onHoverUpgrade?.(id);

    return (
        // ⚠️ `overflow-clip`, not `overflow-hidden`: a hidden box is still a scroll container,
        // and focus moving to a star near the edge could scroll the whole web out of place.
        <div className="w-full h-full min-w-0 min-h-0 flex py-8 px-8 overflow-clip select-none">
            <div ref={fit.ref} className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
                <div
                    data-board-origin
                    data-guild-hall-board="true"
                    data-natural-width={WEB_W}
                    data-natural-height={WEB_H}
                    className="relative shrink-0"
                    style={{ width: fit.size, height: fit.height }}
                >
                    {/* Lines first, so the stars sit on top of them. */}
                    <svg
                        className="absolute inset-0 pointer-events-none overflow-visible"
                        width={fit.size}
                        height={fit.height}
                        shapeRendering="crispEdges"
                    >
                        {links.map(({ from, to }) => {
                            const a = at(from);
                            const b = at(to);
                            const lit = isOwned(nodeState(from, ranks)) && isOwned(nodeState(to, ranks));
                            const c = linkConstellation(from, to);
                            return (
                                <g key={`${from}:${to}`} data-hall-link={`${from}:${to}`} data-link-lit={lit ? 'true' : 'false'}>
                                    <line
                                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                        stroke={lit ? '#fff1c4' : '#aab4ff'}
                                        strokeOpacity={lit ? (c && finished.has(c) ? 1 : 0.85) : 0.28}
                                        strokeWidth={LINE_PX}
                                    />
                                </g>
                            );
                        })}
                        {glowing.map(cid => (
                            <g
                                key={`glow-${cid}`}
                                data-constellation-glow={cid}
                                className="gi-constellation-glow"
                                onAnimationEnd={() => setGlowing(g => g.filter(id => id !== cid))}
                            >
                                {links.filter(({ from, to }) => linkConstellation(from, to) === cid).map(({ from, to }) => {
                                    const a = at(from);
                                    const b = at(to);
                                    return <line key={`${from}:${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fffbe8" strokeWidth={LINE_PX * 3} />;
                                })}
                            </g>
                        ))}
                    </svg>

                    {/* Constellation names: faint, bright once the constellation is finished. */}
                    {CONSTELLATIONS.map(c => {
                        const x = Math.round((WEB_W / 2 + c.label.x * WEB_UNIT_PX) * fit.scale);
                        const y = Math.round((WEB_H / 2 + c.label.y * WEB_UNIT_PX) * fit.scale);
                        const done = finished.has(c.id);
                        return (
                            <div
                                key={c.id}
                                data-constellation={c.id}
                                data-constellation-finished={done ? 'true' : 'false'}
                                className="absolute flex justify-center pointer-events-none"
                                style={{ left: x, top: y - 8, width: 0 }}
                            >
                                <span
                                    className={cn('whitespace-nowrap ui-text-title tracking-[0.2em] uppercase', done ? 'text-[#fff1c4]' : 'text-[#aab4ff] opacity-40')}
                                    style={{ textShadow: OUTLINE }}
                                >
                                    {c.name}
                                </span>
                            </div>
                        );
                    })}

                    {/* The Hall, the pole star. Clicking it returns to the playmat. */}
                    <div className="absolute flex flex-col items-center" style={{ left: hall.x - hallPx / 2, top: hall.y - hallPx / 2, width: hallPx }}>
                        <button
                            type="button"
                            data-hall-node={HALL_NODE}
                            data-node-state="bought"
                            title="Return to Playmat"
                            onClick={() => onClose?.()}
                            className="gi-star-btn flex items-center justify-center cursor-pointer"
                            style={{ width: hallPx, height: hallPx, '--star-px': `${HALL_STAR_SCALE}px` }}
                        >
                            <img
                                src={STAR_SPRITES.maxed}
                                alt="Guild Hall"
                                className="gi-star-img"
                                style={{ width: hallPx, height: hallPx, imageRendering: 'pixelated' }}
                            />
                        </button>
                        <div
                            className="mt-1 whitespace-nowrap ui-text-title leading-tight text-[#fff1c4] pointer-events-none"
                            style={{ textShadow: OUTLINE }}
                        >
                            Guild Hall
                        </div>
                    </div>

                    {GUILD_UPGRADES.map((def, i) => {
                        const p = at(def.id);
                        const state = nodeState(def.id, ranks);
                        const rank = ranks[def.id] || 0;
                        const isSelected = selectedUpgradeId === def.id;
                        const canAfford = (state === 'buyable' || state === 'bought') && affordable.has(def.id);
                        const scale = STAR_SCALE[state];
                        const starPx = STAR_ART_PX * scale;
                        const box = Math.max(starPx, HIT_PX);
                        return (
                            <div
                                key={def.id}
                                className="absolute"
                                style={{ left: p.x - box / 2, top: p.y - box / 2, width: box, height: box }}
                            >
                                <button
                                    type="button"
                                    data-hall-node={def.id}
                                    data-node-state={state}
                                    data-selected={isSelected ? 'true' : undefined}
                                    data-upgrade-available={canAfford ? 'true' : undefined}
                                    id={def.id === 'roster_size' ? 'guild-roster-upgrade-node' : def.id === 'wishing_well' ? 'guild-wishing-well-upgrade-node' : undefined}
                                    data-guild-roster-upgrade={def.id === 'roster_size' ? 'true' : undefined}
                                    data-guild-wishing-well-upgrade={def.id === 'wishing_well' ? 'true' : undefined}
                                    title={def.name}
                                    onMouseEnter={() => hover(def.id)}
                                    onMouseLeave={() => hover(null)}
                                    onFocus={() => hover(def.id)}
                                    onBlur={() => hover(null)}
                                    onClick={() => onSelectUpgrade?.(def)}
                                    className="gi-star-btn flex items-center justify-center cursor-pointer"
                                    style={{ width: box, height: box, '--star-px': `${scale}px` }}
                                >
                                    <img
                                        src={STAR_SPRITES[state]}
                                        alt={def.name}
                                        className={cn('gi-star-img', state === 'buyable' && 'gi-star-twinkle', state === 'locked' && 'opacity-60')}
                                        style={{
                                            width: starPx,
                                            height: starPx,
                                            imageRendering: 'pixelated',
                                            // Twinkles out of step with each other.
                                            animationDelay: state === 'buyable' ? `-${(i * 0.53) % 1.6}s` : undefined
                                        }}
                                    />
                                </button>
                                {/* The tag: name and rank, on the side the upgrade names. */}
                                <div
                                    data-star-tag={def.tag || 'below'}
                                    className="absolute flex pointer-events-none"
                                    style={tagPlacement(def.tag, box, starPx)}
                                >
                                    <span
                                        className={cn(
                                            'whitespace-nowrap ui-text-title leading-tight',
                                            state === 'locked' ? 'text-stone-400' : state === 'maxed' ? 'text-[#ffd84a]' : 'text-white'
                                        )}
                                        style={{ textShadow: OUTLINE }}
                                    >
                                        {def.name}{' '}
                                        <span data-node-rank>{`${rank}/${def.maxRank}`}</span>
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

export default GuildHallBoard;
