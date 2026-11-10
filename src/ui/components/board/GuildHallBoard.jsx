import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import {
    GUILD_UPGRADES, HALL_NODE, CONSTELLATIONS, getUpgradeDef, getUpgradeWebLinks, isUpgradeAccessible, skyVersion
} from '../../../config/guildUpgrades.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { useBoardScale } from '../../hooks/useBoardScale.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { GuildHallEffectsPopover } from './GuildHallEffectsPopover.jsx';
import { StarOutline } from './StarOutline.jsx';
import { outlineSrc, OUTLINE_PX } from './hallStarOutline.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { HallCeremony, ConstellationPicture } from './HallCeremony.jsx';
import { ceremonyFor, constellationStars, STAR_CHIME, CONSTELLATION_CHIME } from './hallCeremony.js';
import { staggerStars } from './hallStarStagger.js';

/**
 * The web's natural space, in pixels. Upgrade node positions are unit coordinates centred on
 * the Hall (`guildUpgrades.js`); one unit is `WEB_UNIT_PX` spread by `SKY_SPACING`, so the first
 * ring (0.5 out) sits 280px from the Hall. The space is fitted to the window (`useBoardScale`), but
 * only the positions scale: stars, lines and tags are drawn at fixed whole-pixel sizes, so the art
 * stays crisp at any fit.
 */
export const WEB_W = 1000;
export const WEB_H = 760;
export const WEB_UNIT_PX = 400;
/**
 * How far the authored places are spread apart on screen. Star places stay as authored; at 1.4 no
 * star's title touches another title, a star or a constellation name.
 */
export const SKY_SPACING = 1.4;
const UNIT_PX = WEB_UNIT_PX * SKY_SPACING;

/**
 * Room past the outermost star for its tag (a tag runs sideways or hangs below), and past the
 * outermost constellation name for its text, which is centred on its point.
 */
const STAR_PAD = { x: 170, y: 70 };
const NAME_PAD = { x: 120, y: 40 };

/**
 * The fit below which the sky stops shrinking: positions closer than this crowd stars and tags,
 * which keep their size. A sky that would need less is drawn at this and dragged to see the rest.
 */
export const MIN_SKY_SCALE = 0.75;

/** A drag shorter than this is a click, not a pan. */
const PAN_SLOP_PX = 4;

/**
 * The web's natural size for the sky as it stands: at least `WEB_W x WEB_H`, and wide and tall
 * enough to hold every star and constellation name with room for its tag.
 */
export function webSize() {
    let halfW = 0;
    let halfH = 0;
    const reach = (p, pad) => {
        halfW = Math.max(halfW, Math.abs(p?.x || 0) * UNIT_PX + pad.x);
        halfH = Math.max(halfH, Math.abs(p?.y || 0) * UNIT_PX + pad.y);
    };
    for (const def of GUILD_UPGRADES) reach(def.node, STAR_PAD);
    for (const c of CONSTELLATIONS) reach(c.label, NAME_PAD);
    return { w: Math.max(WEB_W, Math.ceil(2 * halfW)), h: Math.max(WEB_H, Math.ceil(2 * halfH)) };
}

/**
 * How far the sky may be dragged each way: half of what sticks out past the space it is shown in,
 * so either edge can be brought into view and no further.
 */
export function panLimit(board, view) {
    return {
        x: Math.max(0, Math.round((board.w - view.w) / 2)),
        y: Math.max(0, Math.round((board.h - view.h) / 2))
    };
}

/** A pan held inside its limit. */
export function clampPan(pan, limit) {
    return {
        x: Math.max(-limit.x, Math.min(limit.x, Math.round(pan.x))),
        y: Math.max(-limit.y, Math.min(limit.y, Math.round(pan.y)))
    };
}

/** The owner's star sprites, 32 art pixels square, one per look ({@link starLook}). */
export const STAR_ART_PX = 32;
export const STAR_SPRITES = {
    grey: '/assets/playmat/screens/ui_star_grey.png',
    blue: '/assets/playmat/screens/ui_star_blue.png',
    gold: '/assets/playmat/screens/ui_star_gold.png'
};

/**
 * A star's look, steady: gold at its top rank, blue while the Bank can pay for its next rank
 * now, grey otherwise. Its size still says whether it has a rank ({@link STAR_SCALE}).
 */
export function starLook(state, canAfford) {
    if (state === 'maxed') return 'gold';
    return canAfford ? 'blue' : 'grey';
}

/** Each state's whole-pixel scale: a star with a rank is bigger. */
export const STAR_SCALE = { locked: 1, buyable: 1, bought: 2, maxed: 2 };
export const HALL_STAR_SCALE = 3;
/** The smallest click target around a star, so a 32 px star is not fiddly to hit. */
const HIT_PX = 56;
/** One art pixel of the 2× sky: the width of a line. */
const LINE_PX = 2;


/** A node's centre in the web's natural pixels (a `size` from {@link webSize}). The Hall is the middle. */
export function webPoint(nodeId, size = { w: WEB_W, h: WEB_H }) {
    if (nodeId === HALL_NODE) return { x: size.w / 2, y: size.h / 2 };
    const node = getUpgradeDef(nodeId)?.node || { x: 0, y: 0 };
    return { x: size.w / 2 + node.x * UNIT_PX, y: size.h / 2 + node.y * UNIT_PX };
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
 * Where a star's title sits in the star's box (`box` square, the star or its outline `starPx` in
 * its middle): always under it, centred on a zero-width anchor just off its edge, so the title
 * never covers its own star whatever its length. A star's authored `tag` side is not read.
 */
export function tagPlacement(box, starPx) {
    const mid = box / 2;
    return { left: mid, top: mid + starPx / 2 + 2, width: 0, justifyContent: 'center' };
}

/**
 * GuildHallBoard: the Guild Hall upgrades as a night sky.
 *
 * Every upgrade is a pixel star whose sprite and size say its state, with its item's outline over
 * it (`hallStarOutline.js`) and its title under it; its rank shows only under the pointer. The Hall
 * is the pole star in the middle that every constellation starts from. Lines are faint until both
 * ends are lit. The sky behind is `HallSky` and the Upgrade drawer slides over one side of it, both
 * in `ReactRoot`; the web runs on under the panel and the nav.
 * A click on a star opens it in the Upgrade drawer (`onSelectUpgrade`); hovering only shows its rank.
 * The Hall star shows the Hall's Effects ({@link GuildHallEffectsPopover}): while hovered, or
 * pinned open by a click. A second click on the star, Escape, or a click anywhere else closes a
 * pinned one.
 * A sky too big for the space at {@link MIN_SKY_SCALE} is dragged to see the rest: press on the
 * dark between the stars and move. It moves by transform, so nothing here scrolls.
 */
export const GuildHallBoard = ({
    selectedUpgradeId,
    onSelectUpgrade
}) => {
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    );
    // The authored sky can change under the screen (a QA scene); its version is read so it redraws.
    const skyVer = useGameState(() => skyVersion(), [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]);
    // Which upgrades the Bank can pay for right now (Hall upgrades cost items). A flat id list
    // as a string, per the useGameState selector contract.
    const affordableSignature = useGameState(
        () => GUILD_UPGRADES.filter(u => GuildUpgradeManager.canAfford(u.id)).map(u => u.id).join(','),
        [ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    );
    const affordable = new Set((affordableSignature || '').split(',').filter(Boolean));

    const finished = new Set(finishedConstellations(ranks));

    // The upgrade ceremony plays for a purchase heard while this sky is mounted (the Hall open),
    // once. A load, a catch-up (the quiet bus skips UI listeners) or a dev write names no star,
    // and a rank bought while the Hall is closed is never heard here.
    const [ceremony, setCeremony] = useState(null);
    const [glowing, setGlowing] = useState([]);
    const ceremonySeq = useRef(0);
    useEffect(() => EventBus.subscribe(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, (data) => {
        const c = ceremonyFor(data?.upgradeId, data?.rank, GuildUpgradeManager.getRanks(), data?.fromRank);
        if (!c) return;
        ceremonySeq.current += 1;
        setCeremony({ ...c, seq: ceremonySeq.current });
        if (c.finished.length) setGlowing(g => [...g.filter(id => !c.finished.includes(id)), ...c.finished]);
        // No pitch spread: it would draw from the game's shared random stream.
        EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, {
            clip: c.finished.length ? CONSTELLATION_CHIME : STAR_CHIME,
            options: { pitchVariance: 0 }
        });
    }, UI_LISTENER), []);

    const size = webSize();
    const fit = useBoardScale(size.w, size.h);
    const scale = Math.max(fit.scale, MIN_SKY_SCALE);
    const boardW = Math.round(size.w * scale);
    const boardH = Math.round(size.h * scale);
    const placed = (nodeId) => {
        const p = webPoint(nodeId, size);
        return { x: Math.round(p.x * scale), y: Math.round(p.y * scale) };
    };

    // Star titles never overlap: each title is measured once drawn, and stars whose titles would
    // touch are moved down for drawing (`staggerStars`); the authored places stay as they are.
    const titleRefs = useRef(new Map());
    const [titleSizes, setTitleSizes] = useState('');
    useLayoutEffect(() => {
        const parts = [];
        for (const def of GUILD_UPGRADES) {
            const el = titleRefs.current.get(def.id);
            if (el && el.offsetWidth > 0) parts.push(`${def.id}:${el.offsetWidth}:${el.offsetHeight}`);
        }
        const sig = parts.join(',');
        if (sig !== titleSizes) setTitleSizes(sig);
    }, [titleSizes, skyVer]);
    const measured = new Map(titleSizes.split(',').filter(Boolean).map(part => {
        const [id, w, h] = part.split(':');
        return [id, { w: Number(w), h: Number(h) }];
    }));
    const nudges = staggerStars(GUILD_UPGRADES.filter(def => measured.has(def.id)).map(def => {
        const p = placed(def.id);
        return { id: def.id, x: p.x, y: p.y, px: drawnStarPx(def, nodeState(def.id, ranks)), ...measured.get(def.id) };
    }));
    const at = (nodeId) => {
        const p = placed(nodeId);
        const dy = nudges.get(nodeId) || 0;
        return dy ? { x: p.x, y: p.y + dy } : p;
    };

    // Dragging the sky: only when it is bigger than its space.
    const viewRef = useRef(null);
    const fitRef = fit.ref;
    const setViewRef = useCallback((el) => { viewRef.current = el; fitRef(el); }, [fitRef]);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const drag = useRef(null);
    const limitNow = () => panLimit({ w: boardW, h: boardH }, {
        w: viewRef.current?.clientWidth || boardW, h: viewRef.current?.clientHeight || boardH
    });
    const limit = limitNow();
    const shown = clampPan(pan, limit);
    const pannable = limit.x > 0 || limit.y > 0;
    const onPanDown = (e) => {
        if (e.button !== 0 || e.target?.closest?.('button')) return;
        drag.current = { x: e.clientX, y: e.clientY, from: shown, moved: false, id: e.pointerId };
    };
    const onPanMove = (e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < PAN_SLOP_PX) return;
        if (!d.moved) {
            d.moved = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
        }
        setPan(clampPan({ x: d.from.x + dx, y: d.from.y + dy }, limitNow()));
    };
    const onPanUp = (e) => {
        if (drag.current?.id === e.pointerId) drag.current = null;
    };
    const links = getUpgradeWebLinks();
    const hall = at(HALL_NODE);
    const hallPx = STAR_ART_PX * HALL_STAR_SCALE;

    const hallRef = useRef(null);
    const effectsRef = useRef(null);
    const [effectsHovered, setEffectsHovered] = useState(false);
    const [effectsPinned, setEffectsPinned] = useState(false);
    const toggleEffects = () => {
        // Unpinning hides it at once, though the pointer is still on the star.
        if (effectsPinned) setEffectsHovered(false);
        setEffectsPinned(p => !p);
    };
    useEscapeLayer(effectsPinned, () => { setEffectsPinned(false); setEffectsHovered(false); });
    useEffect(() => {
        if (!effectsPinned) return undefined;
        const onDown = (e) => {
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const within = (el) => el && (path.includes(el) || el.contains(e.target));
            if (within(effectsRef.current) || within(hallRef.current)) return;
            setEffectsPinned(false);
        };
        window.addEventListener('pointerdown', onDown, true);
        return () => window.removeEventListener('pointerdown', onDown, true);
    }, [effectsPinned]);

    return (
        // ⚠️ Nothing here clips: the web runs on under the nav and the Upgrade drawer to the screen's
        // edge, where the screen clips it (`ReactRoot`, an `overflow-clip` box, so focus moving to a
        // star past the edge cannot scroll anything). This box only centres the sky and limits its pan.
        <div className="w-full h-full min-w-0 min-h-0 flex select-none">
            <div
                ref={setViewRef}
                data-hall-sky-view
                data-sky-pannable={pannable ? 'true' : 'false'}
                onPointerDown={onPanDown}
                onPointerMove={onPanMove}
                onPointerUp={onPanUp}
                onPointerCancel={onPanUp}
                className={cn('flex-1 min-w-0 min-h-0 flex items-center justify-center', pannable && 'cursor-grab')}
            >
                <div
                    data-board-origin
                    data-guild-hall-board="true"
                    data-natural-width={size.w}
                    data-natural-height={size.h}
                    data-sky-scale={scale}
                    className="relative shrink-0"
                    style={{ width: boardW, height: boardH, transform: shown.x || shown.y ? `translate(${shown.x}px, ${shown.y}px)` : undefined }}
                >
                    {/* Lines first, so the stars sit on top of them. */}
                    <svg
                        className="absolute inset-0 pointer-events-none overflow-visible"
                        width={boardW}
                        height={boardH}
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

                    {/* The owner's picture of each finished constellation, under the stars (none drawn yet). */}
                    {[...finished].map(cid => (
                        <ConstellationPicture
                            key={`picture-${cid}`}
                            cid={cid}
                            centre={centreOf(constellationStars(cid).map(at))}
                            flash={glowing.includes(cid)}
                        />
                    ))}

                    {/* Constellation names: faint, bright once the constellation is finished. */}
                    {CONSTELLATIONS.map(c => {
                        const x = Math.round((size.w / 2 + c.label.x * UNIT_PX) * scale);
                        const y = Math.round((size.h / 2 + c.label.y * UNIT_PX) * scale);
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
                                >
                                    {c.name}
                                </span>
                            </div>
                        );
                    })}

                    {/* The Hall, the pole star: its Effects show beside it. */}
                    <div className="absolute flex flex-col items-center" style={{ left: hall.x - hallPx / 2, top: hall.y - hallPx / 2, width: hallPx }}>
                        <button
                            ref={hallRef}
                            type="button"
                            data-hall-node={HALL_NODE}
                            data-node-state="bought"
                            aria-expanded={effectsHovered || effectsPinned}
                            aria-pressed={effectsPinned}
                            onMouseEnter={() => setEffectsHovered(true)}
                            onMouseLeave={() => setEffectsHovered(false)}
                            onFocus={() => setEffectsHovered(true)}
                            onBlur={() => setEffectsHovered(false)}
                            onClick={toggleEffects}
                            className="gi-star-btn flex items-center justify-center cursor-pointer"
                            style={{ width: hallPx, height: hallPx, '--star-px': `${HALL_STAR_SCALE}px` }}
                        >
                            <img
                                src={STAR_SPRITES.gold}
                                alt="Guild Hall"
                                className="gi-star-img"
                                style={{ width: hallPx, height: hallPx, imageRendering: 'pixelated' }}
                            />
                        </button>
                        <div
                            className="mt-1 whitespace-nowrap ui-text-title leading-tight text-[#fff1c4] pointer-events-none"
                        >
                            Guild Hall
                        </div>
                    </div>
                    {(effectsHovered || effectsPinned) && (
                        <GuildHallEffectsPopover anchorRef={hallRef} popoverRef={effectsRef} pinned={effectsPinned} />
                    )}

                    {GUILD_UPGRADES.map((def) => {
                        const p = at(def.id);
                        const state = nodeState(def.id, ranks);
                        const rank = ranks[def.id] || 0;
                        const isSelected = selectedUpgradeId === def.id;
                        const canAfford = (state === 'buyable' || state === 'bought') && affordable.has(def.id);
                        const look = starLook(state, canAfford);
                        const scale = STAR_SCALE[state];
                        const starPx = STAR_ART_PX * scale;
                        const box = Math.max(starPx, HIT_PX);
                        const outline = outlineSrc(def);
                        const drawnPx = drawnStarPx(def, state);
                        return (
                            <div
                                key={def.id}
                                data-star-nudge={nudges.get(def.id) || undefined}
                                className="absolute"
                                style={{ left: p.x - box / 2, top: p.y - box / 2, width: box, height: box }}
                            >
                                <button
                                    type="button"
                                    data-hall-node={def.id}
                                    data-node-state={state}
                                    data-star-look={look}
                                    data-selected={isSelected ? 'true' : undefined}
                                    data-upgrade-available={canAfford ? 'true' : undefined}
                                    id={def.id === 'roster_size' ? 'guild-roster-upgrade-node' : def.id === 'wishing_well' ? 'guild-wishing-well-upgrade-node' : undefined}
                                    data-guild-roster-upgrade={def.id === 'roster_size' ? 'true' : undefined}
                                    data-guild-wishing-well-upgrade={def.id === 'wishing_well' ? 'true' : undefined}
                                    title={def.name}
                                    onClick={() => onSelectUpgrade?.(def)}
                                    className="gi-star-btn relative flex items-center justify-center cursor-pointer"
                                    style={{ width: box, height: box, '--star-px': `${scale}px` }}
                                >
                                    <img
                                        src={STAR_SPRITES[look]}
                                        alt={def.name}
                                        className={cn('gi-star-img', state === 'locked' && 'opacity-60')}
                                        style={{ width: starPx, height: starPx, imageRendering: 'pixelated' }}
                                    />
                                    {outline && <StarOutline src={outline} look={look} state={state} />}
                                </button>
                                {/* The title, under the star; its rank shows only while the star is hovered or focused (`.gi-star-rank`). */}
                                <div
                                    data-star-tag="below"
                                    className="absolute flex pointer-events-none"
                                    style={tagPlacement(box, drawnPx)}
                                >
                                    <span
                                        ref={(el) => { if (el) titleRefs.current.set(def.id, el); else titleRefs.current.delete(def.id); }}
                                        className={cn(
                                            'relative whitespace-nowrap ui-text-title leading-tight',
                                            state === 'locked' ? 'text-stone-400' : state === 'maxed' ? 'text-[#ffd84a]' : 'text-white'
                                        )}
                                    >
                                        {def.name}
                                        <span data-node-rank className="gi-star-rank absolute left-full top-0 pl-[0.4em]">{` ${rank}/${def.maxRank}`}</span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {ceremony && (
                        <HallCeremony
                            key={ceremony.seq}
                            ceremony={ceremony}
                            at={at}
                            radius={starRadius}
                            onDone={() => setCeremony(c => (c?.seq === ceremony.seq ? null : c))}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

/** The middle of a list of points, in whole pixels. */
function centreOf(points) {
    if (!points.length) return { x: 0, y: 0 };
    const sum = points.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
    return { x: Math.round(sum.x / points.length), y: Math.round(sum.y / points.length) };
}

/** A star's drawn size in its state: the star, or its item outline when that is bigger. */
function drawnStarPx(def, state) {
    const starPx = STAR_ART_PX * STAR_SCALE[state];
    return outlineSrc(def) ? Math.max(starPx, OUTLINE_PX) : starPx;
}

/** A star's drawn half-size, bought or not: where the ceremony's light leaves it or reaches it. */
function starRadius(id, bought) {
    const def = getUpgradeDef(id);
    const starPx = STAR_ART_PX * STAR_SCALE[bought ? 'bought' : 'buyable'];
    return Math.round((def && outlineSrc(def) ? Math.max(starPx, OUTLINE_PX) : starPx) / 2);
}

export default GuildHallBoard;
