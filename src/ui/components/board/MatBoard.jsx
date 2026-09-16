import React, { useCallback, useMemo, useRef, useState } from 'react';
import { MAT_W, MAT_H, artRadius, TOKEN_PX } from '../../../config/matGeometry.js';
import { MAT_Z, tokenZ } from './matLayers.js';
import { PAIR_OFFSET_PX, HERO_HIT_PX, ALERT_HINT, ALERT_LABEL, alertFillClass } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';
import { pointerToMat } from './matPoint.js';
import { MatToken } from './MatToken.jsx';
import { MatHero } from './MatHero.jsx';
import { MatRings } from './MatRings.jsx';
import { MatPointAlerts } from './MatPointAlerts.jsx';
import { FlagLayer } from './FlagLayer.jsx';
import { SpriteLayerView } from './SpriteLayerView.jsx';
import { TerrainCanvas } from './TerrainCanvas.jsx';
import { TERRAIN_ENABLED } from '../../../config/registries/terrainRegistry.js';
import { announce } from './dropOnMat.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useActiveDrag, useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { GameState } from '../../../state/GameState.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { cn } from '../../utils/cn.js';
import { isElementOpaqueAtPoint } from '../../utils/alphaHitTest.js';
import { playLootArc } from '../../utils/lootArc.js';

/**
 * ⭐ **The playmat as it is actually drawn** (Free Playmat slice 1.6c-2).
 *
 * It replaced the 6×6 CSS grid of `BoardTile`s. Nothing here knows what a tile
 * is: every Token, hero and flag is drawn **at its own mat point**, keyed by
 * **Token instance id**, in the layers `matLayers.js` sets out. The one
 * tile-shaped thing left on screen is the faint outline of where Tokens may
 * still land (FP-93) — a labelled stopgap that slice 1.6d deletes along with
 * the snapping behind it.
 *
 * ## Which Token the pointer is on is decided once, here
 * Token art is a circle, Tokens may overlap, and a box-shaped hover would let
 * the corner of one steal the pointer from another. So a single `pointermove`
 * on the mat asks the engine (`Flags.tokenAtPoint` — nearest centre, earliest
 * placed on a tie), and the answer is **raised to the front of the Token
 * layer**, which is what puts its own drag, click and right-click listeners
 * under the pointer. Badges reaching outside the art circle keep the hover
 * while the pointer is on them, so a gear badge can still be clicked.
 *
 * The hover pass steps aside entirely while a drag is live: dnd-kit owns the
 * pointer then, and re-ordering Tokens under a drag made the ghost flicker.
 */
export const MatBoard = ({
    onInspectToken,
    onClearInspect,
    onOpenRecipes,
    inspectedHeroId = null
}) => {
    const { EventBus } = useEngine();
    const rootRef = useRef(null);

    /** The Token the pointer is on, and the hero it is on — both by id. */
    const [hoveredId, setHoveredId] = useState(null);
    const [hoverHeroId, setHoverHeroId] = useState(null);
    const { isDragging } = useActiveDrag();

    // dnd-kit owns the pointer during a drag, and a Token re-ordering itself
    // under the ghost made it flicker. Nothing is hovered while dragging.
    React.useEffect(() => {
        if (isDragging) setHoveredId(null);
    }, [isDragging]);

    /** Every Token on the mat: where it is, and nothing about how it is doing. */
    const tokensRaw = useGameState(
        () => BoardState.tokens().map(t => ({
            id: t.id,
            typeId: t.typeId,
            x: t.x,
            y: t.y,
            placedAt: t.placedAt ?? 0,
            size: getTokenType(t.typeId)?.size || 1
        })),
        [BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.TOKEN_DEPLETED, 'state_changed'],
        null
    );
    const tokens = useMemo(() => tokensRaw || [], [tokensRaw]);

    /**
     * Back to front: lower on the mat draws in front, then the earlier-placed
     * (`placedAt`), so the order never flickers between two Tokens level with
     * each other.
     */
    const ordered = useMemo(
        () => [...tokens].sort((a, b) => (a.y - b.y) || (a.placedAt - b.placedAt)),
        [tokens]
    );
    const zById = useMemo(() => {
        const out = new Map();
        ordered.forEach((t, i) => out.set(t.id, tokenZ(i)));
        // The hovered Token comes to the front of the layer, so its own
        // listeners — drag, click, right-click — are the ones under the pointer.
        if (hoveredId && out.has(hoveredId)) out.set(hoveredId, tokenZ(ordered.length));
        return out;
    }, [ordered, hoveredId]);

    /**
     * Where each hero is DRAWN goes through the worker seam. A hero working a
     * Token or waiting on a spot is drawn here; an **idle** hero is drawn beside
     * their flag by `FlagLayer` (FP-29, FP-84). Several heroes may stand on one
     * Token — the grid's one-per-tile rule (FPP-6) went with the grid.
     */
    const heroesRaw = useGameState(
        (state) => {
            const roster = state.heroes || [];
            const out = [];
            for (const [heroId, point] of BoardState.heroesOnBoard()) {
                const status = Flags.statusOf(heroId);
                if (status.state !== 'working' && status.state !== 'waiting') continue;
                if (!point) continue;
                const workId = status.state === 'working' ? BoardState.workTokenOf(heroId) : null;
                const worked = workId ? BoardState.getTokenById(workId) : null;
                const hero = roster.find(h => h?.id === heroId);
                out.push({
                    heroId,
                    state: status.state,
                    tokenId: worked?.id || null,
                    size: worked ? (getTokenType(worked.typeId)?.size || 1) : 1,
                    x: point.x,
                    y: point.y,
                    name: hero?.name || 'Hero',
                    sprite: hero?.spriteId || hero?.classId || null,
                    // Not working productively: the Token it holds is stuck.
                    // Such a hero gets no glow — the red badge says it alone.
                    stuck: !!worked?.alert
                });
            }
            return out;
        },
        [
            BOARD_EVENTS.HERO_MOVED,
            BOARD_EVENTS.TILE_CHANGED,
            BOARD_EVENTS.ALERT_CHANGED,
            'heroes_updated',
            'state_changed'
        ],
        null
    );
    const heroes = useMemo(() => heroesRaw || [], [heroesRaw]);

    /** Spots a Manager owes a Token it cannot supply (FP-19, ALERT.UNSTOCKED). */
    const ghosts = useGameState(
        () => BoardState.spotVacancies()
            .filter(([, v]) => v?.unstocked)
            .map(([spotId, v]) => ({ spotId, typeId: v.typeId, x: v.x, y: v.y })),
        [BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.ALERT_CHANGED, 'state_changed'],
        null
    ) || [];

    const boardMaps = useGameState(
        state => state.board?.maps || [],
        ['state_changed', BOARD_EVENTS.TILE_CHANGED]
    ) || [];

    // The painted ground. Dormant while terrain is off (FP-10).
    const terrain = useGameState(
        state => (TERRAIN_ENABLED ? state.board?.terrain || NO_TERRAIN : NO_TERRAIN),
        ['state_changed', BOARD_EVENTS.TILE_CHANGED]
    );

    // ---------------------------------------------------------------------
    // What the pointer is on
    // ---------------------------------------------------------------------

    const handlePointerMove = useCallback((e) => {
        if (typeof document !== 'undefined' && document.body.classList.contains('gi-dnd-active')) return;
        const el = rootRef.current;
        if (!el) return;
        const point = pointerToMat({ x: e.clientX, y: e.clientY }, el.getBoundingClientRect());
        let id = point ? (Flags.tokenAtPoint(point)?.id ?? null) : null;
        if (!id) {
            // Outside every art circle, but perhaps on a badge that reaches past
            // one — the gear sits in the corner of the box, beyond the circle.
            id = e.target?.closest?.('[data-token-id]')?.getAttribute('data-token-id') || null;
        }
        setHoveredId(prev => (prev === id ? prev : id));
    }, []);

    const clearHover = useCallback(() => setHoveredId(null), []);

    // ---------------------------------------------------------------------
    // What the player can do to a Token
    // ---------------------------------------------------------------------

    const handleRecallHero = useCallback((heroId) => {
        announce(Placement.recallHeroById(heroId));
    }, []);

    const handleReturnToTray = useCallback((instanceId) => {
        announce(Placement.returnTokenToTrayById(instanceId));
    }, []);

    const handleAutoAssignHero = useCallback((instanceId) => {
        const heroes_ = GameState.state?.heroes || [];
        // A hero with no flag is in the Dock and free to send (slice 1.4b).
        const idleHero = heroes_.find(h => !BoardState.flagOf(h.id));
        const token = BoardState.getTokenById(instanceId);
        if (idleHero && token) {
            announce(Placement.plantFlagAt(idleHero.id, { x: token.x, y: token.y }));
        } else if (heroes_.length === 0) {
            NotificationSystem.warning('No heroes recruited yet');
        } else {
            NotificationSystem.info('All heroes are working elsewhere — drag a hero to reassign');
        }
    }, []);

    const handleBurstMap = useCallback((mapId) => {
        const map = BoardState.removeBoardMap(mapId);
        if (!map) return;
        const origin = { x: map.x, y: map.y };
        // Same announcer every other board outcome uses, so a refused burst
        // tells the player why instead of the Map just reappearing (CR2-170.1).
        const result = announce(Cartographer.openMap({ typeId: map.typeId, usesRemaining: map.usesRemaining }, origin));
        if (!result.success) {
            BoardState.addBoardMap(map.typeId, map.x, map.y, map.usesRemaining);
        }
        EventBus?.publish('state_changed', {});
    }, [EventBus]);

    const hoveredCentre = useMemo(() => {
        const t = hoveredId ? tokens.find(k => k.id === hoveredId) : null;
        return t ? { x: t.x, y: t.y } : null;
    }, [hoveredId, tokens]);

    const workedBy = useMemo(() => {
        const out = new Map();
        for (const h of heroes) if (h.tokenId) out.set(h.tokenId, h.heroId);
        return out;
    }, [heroes]);

    return (
        <div
            ref={rootRef}
            data-mat-board
            className="absolute left-0 top-0"
            style={{ width: MAT_W, height: MAT_H }}
            onPointerMove={handlePointerMove}
            onPointerLeave={clearHover}
        >
            {/* 0 — ⭐ the mat itself (FP-96): a plain darker surface with a soft
                rounded border. A placeholder until the owner gives it art — and
                with free placement (1.6d) the only edge there is, since a Token
                may now stand anywhere on it. The practice outline went with the
                snapping it existed to explain. */}
            <div
                data-mat-surface
                className="absolute left-0 top-0 pointer-events-auto"
                style={{
                    width: MAT_W,
                    height: MAT_H,
                    zIndex: MAT_Z.SURFACE,
                    borderRadius: 28,
                    backgroundColor: 'rgba(0, 0, 0, 0.22)',
                    border: '2px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: 'inset 0 0 90px rgba(0, 0, 0, 0.40), 0 0 0 1px rgba(0, 0, 0, 0.35)'
                }}
            />

            {TERRAIN_ENABLED && <TerrainCanvas terrain={terrain} seed={0} />}

            {/* 5 — the ghost of a Token this spot is owed. */}
            {ghosts.map(g => <UnstockedGhost key={g.spotId} ghost={g} />)}

            {/* 10+ — Tokens, the heroes on them, and what is written on them. */}
            {ordered.map(t => (
                <MatToken
                    key={t.id}
                    id={t.id}
                    typeId={t.typeId}
                    x={t.x}
                    y={t.y}
                    size={t.size}
                    z={zById.get(t.id)}
                    isHovered={hoveredId === t.id}
                    hasHero={workedBy.has(t.id)}
                    onInspectToken={onInspectToken}
                    onClearInspect={onClearInspect}
                    onAutoAssignHero={handleAutoAssignHero}
                    onOpenRecipes={onOpenRecipes}
                    onReturnToTray={handleReturnToTray}
                    onRecallHero={handleRecallHero}
                />
            ))}

            {heroes.map(h => {
                const place = heroPlacement(h);
                return (
                    <MatHero
                        key={h.heroId}
                        heroId={h.heroId}
                        name={h.name}
                        sprite={h.sprite}
                        left={place.left}
                        top={place.top}
                        z={h.tokenId && zById.has(h.tokenId) ? zById.get(h.tokenId) + 1 : MAT_Z.WAITING_HERO}
                        glow={h.state === 'working' && !h.stuck ? 'gi-glow-active' : null}
                        hovered={hoverHeroId === h.heroId || (h.tokenId != null && hoveredId === h.tokenId)}
                        onHover={setHoverHeroId}
                        onRecall={handleRecallHero}
                    />
                );
            })}

            {/* 700 — Maps lying loose on the mat. */}
            {boardMaps.map(map => (
                <BoardMapToken key={map.id} map={map} onBurst={handleBurstMap} />
            ))}

            {/* 750 — news with no Token left to sit on. */}
            <MatPointAlerts />

            {/* 760 — the Near ring (FP-64). Flag radius rings are FlagLayer's. */}
            <MatRings hoveredCentre={hoveredCentre} matRef={rootRef} />

            {/* 800 — loot on the floor. */}
            <SpriteLayerView />

            {/* 850 — flags, idle heroes and their rings. */}
            <FlagLayer
                inspectedHeroId={inspectedHeroId}
                hoverHeroId={hoverHeroId}
                onHoverHero={setHoverHeroId}
                matRef={rootRef}
            />
        </div>
    );
};

/** Shared empty terrain, so a dormant board's selector returns a stable value. */
const NO_TERRAIN = Object.freeze({});

/**
 * ⭐ Where a hero's 64 × 128 box goes, in mat units (FP-77, D-266).
 *
 * * **Working a 1×1 Token** — half the pair offset to the left of its centre;
 *   the Token slides the same distance right, so the two stand 48 u apart.
 * * **Working a 2×2 Token** — down and left, standing in front of the art
 *   rather than beside it; a 2×2 is big enough to stand on.
 * * **Waiting** on an empty spot (FP-70) — squarely on the spot, with nothing
 *   there to make room for.
 */
export function heroPlacement({ state, size, x, y }) {
    if (state === 'working' && size === 2) {
        return { left: x - 80 - HERO_HIT_PX / 2, top: y + 80 - FLAG_PX / 2 };
    }
    if (state === 'working') {
        return { left: x - PAIR_OFFSET_PX - HERO_HIT_PX / 2, top: y - FLAG_PX / 2 };
    }
    return { left: x - HERO_HIT_PX / 2, top: y - FLAG_PX / 2 };
}

/**
 * The ghost of a Token a Manager owes this spot but cannot supply (FP-19).
 *
 * Greyed and faint, so it reads as a memory of what stood here rather than as
 * something in play, with the same red "Restock" bar a stuck Token wears — this
 * is the one alert with no Token left to draw it on.
 */
const UnstockedGhost = ({ ghost }) => {
    const r = artRadius(getTokenType(ghost.typeId)?.size || 1);
    return (
        <div
            data-unstocked-spot={ghost.spotId}
            title={ALERT_HINT[ALERT.UNSTOCKED]}
            className="absolute pointer-events-auto"
            style={{
                left: ghost.x - r,
                top: ghost.y - r,
                width: r * 2,
                height: r * 2,
                zIndex: MAT_Z.GHOST
            }}
        >
            <div
                className="w-full h-full flex items-center justify-center"
                style={{ opacity: 0.35, filter: 'grayscale(1)' }}
            >
                <TokenSprite
                    typeId={ghost.typeId}
                    surface={TOKEN_SURFACE.BOARD}
                    alt={`${tokenName(ghost.typeId) || 'Token'} — awaiting restock`}
                    className="absolute inset-0 m-auto"
                />
            </div>
            <div className="absolute bottom-0 translate-y-[3px] left-2 right-2 h-3 pointer-events-none">
                <div className="relative w-full h-full overflow-hidden rounded-full border border-white/30 bg-black/85 flex items-center justify-center">
                    <div className={cn('absolute left-0 top-0 bottom-0 right-0 rounded-full', alertFillClass(ALERT.UNSTOCKED))} />
                    <span className="relative text-[8px] font-bold font-mono text-white gi-text-outline tracking-wider select-none leading-none">
                        {ALERT_LABEL[ALERT.UNSTOCKED]}
                    </span>
                </div>
            </div>
        </div>
    );
};

/** A Map lying loose on the mat: drag it anywhere, click it to burst it. */
const BoardMapToken = ({ map, onBurst }) => {
    const [isHovered, setIsHovered] = useState(false);
    const elementRef = useRef(null);
    const { activePayload, isDragging: isAnyDragging } = useActiveDrag();
    const drag = useEntityDrag({
        id: `board-map-${map.id}`,
        kind: DRAG_KIND.TOKEN,
        payload: {
            typeId: map.typeId,
            from: { boardMapId: map.id },
            usesRemaining: map.usesRemaining
        },
        sourceSurface: DND_SURFACE.BOARD
    });

    const isThisDragging = drag.isDragging || (activePayload?.from?.boardMapId === map.id);

    React.useEffect(() => {
        if (Date.now() - (map.bornAt ?? 0) >= 1500 || map.fromX == null) return;
        const fx = map.fromX;
        const fy = map.fromY ?? 0;
        if (elementRef.current && (fx !== 0 || fy !== 0)) {
            playLootArc(elementRef.current, fx, fy, { centered: false, duration: 480 });
        }
    }, [map.bornAt, map.fromX, map.fromY, map.x, map.y]);

    const setNodeRef = (node) => {
        elementRef.current = node;
        drag.setNodeRef(node);
    };

    const label = tokenName(map.typeId);

    const handlePointerMove = (e) => {
        const el = e.currentTarget;
        if (!el) return;
        const isOpaque = isElementOpaqueAtPoint(el, e.clientX, e.clientY);
        if (!isOpaque && isHovered) setIsHovered(false);
        else if (isOpaque && !isHovered) setIsHovered(true);
    };

    /**
     * ⚠️ **A Map bursts on a SINGLE click here too** — owner ruling 2026-08-24
     * (CR2-158): one click, Tray and board alike. `onDoubleClick` is wired to
     * the same function only so a double-click is not swallowed; its first
     * click has already burst the Map.
     */
    const handleClick = (e) => {
        const el = e.currentTarget;
        if (el && !isElementOpaqueAtPoint(el, e.clientX, e.clientY)) {
            return; // Transparent pixel: pass the click to whatever is underneath
        }
        e.stopPropagation();
        onBurst?.(map.id);
    };

    return (
        <div
            ref={setNodeRef}
            {...drag.handleProps}
            data-board-map-id={map.id}
            data-alpha-test="true"
            onMouseEnter={() => setIsHovered(true)}
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
            onDoubleClick={handleClick}
            className={cn(
                'absolute pointer-events-auto cursor-grab active:cursor-grabbing select-none',
                isThisDragging && 'opacity-0 pointer-events-none'
            )}
            style={{
                left: map.x,
                top: map.y,
                width: TOKEN_PX,
                height: TOKEN_PX,
                zIndex: MAT_Z.MAP,
                opacity: isThisDragging ? 0 : 1,
                visibility: isThisDragging ? 'hidden' : 'visible'
            }}
        >
            <div
                className={cn(
                    'w-full h-full flex items-center justify-center transition-[filter] duration-150',
                    isHovered && !isAnyDragging && !isThisDragging && 'gi-token-hover-pulse'
                )}
            >
                <TokenSprite
                    typeId={map.typeId}
                    surface={TOKEN_SURFACE.BOARD}
                    alt={label}
                    className="w-full h-full"
                />
            </div>
        </div>
    );
};

export default MatBoard;
