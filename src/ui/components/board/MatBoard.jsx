import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { MAT_Z, matStackOrder, sameStackOrder, heroZ, walkerSortY } from './matLayers.js';
import { createStackWriter } from './stackWriter.js';
import { pointerToMat } from './matPoint.js';
import { installPressRouting } from './pressRouting.js';
import { flagClothOver } from './flagCloth.js';
import { MatToken, MatTokenGrab } from './MatToken.jsx';
import { MatHero, heroBoxAt } from './MatHero.jsx';
import { MatRings } from './MatRings.jsx';
import { CalloutLayer } from './CalloutLayer.jsx';
import { HeroBubbleLayer } from './HeroBubbleLayer.jsx';
import { strikesLive, heroAnimationState, hitSkillOf, hitsOnAttack } from './hitAnimations.js';
import { FlagLayer } from './FlagLayer.jsx';
import { heroOutline } from './spriteOutline.js';
import { SpriteLayerView } from './SpriteLayerView.jsx';
import { TerrainCanvas } from './TerrainCanvas.jsx';
import { TERRAIN_ENABLED } from '../../../config/registries/terrainRegistry.js';
import { announce } from './dropOnMat.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { useDisallowMode, flipDisallowed } from '../../hooks/useDisallowMode.js';
import { useMatFit } from './MatFitContext.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import * as EnemyMotion from '../../../systems/board/EnemyMotion.js';
import * as Placement from '../../../systems/board/Placement.js';
import { showsNearRing } from '../../../systems/board/reachDisplay.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { usePerfRenderCount } from '../../dev/perf/PerfProfiler.jsx';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { watchSpawns } from './spawnMotion.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The playmat as it is actually drawn. Every Token, hero and flag is drawn at its own mat
 * point, keyed by Token instance id, in the layers `matLayers.js` sets out.
 * Which Token the pointer is on is decided once, here. Token art is a circle and Tokens may
 * overlap, so a box-shaped hover would let the corner of one steal the pointer from another. A
 * single `pointermove` on the mat asks the engine (`Flags.tokenAtPoint`: nearest centre,
 * earliest placed on a tie), and the answer is raised to the front of the Token layer, which
 * puts its own drag, click and right-click listeners under the pointer. Badges reaching
 * outside the art circle keep the hover while the pointer is on them, so a gear badge can
 * still be clicked.
 * The hover pass steps aside entirely while a drag is live: dnd-kit owns the pointer then, and
 * re-ordering Tokens under a drag made the ghost flicker.
 * ⚠️ Memoised: its parent holds the mat's drop target, which dnd-kit re-renders at every drag
 * start, end and change of target.
 */
export const MatBoard = React.memo(function MatBoard({
    onInspectToken,
    onClearInspect,
    onOpenRecipes,
    inspectedHeroId = null,
    inspectedTokenId = null
}) {
    // Dev only (an empty function in production): MatBoard's OWN renders for the Perf HUD,
    // beside Board.jsx's subtree Profiler.
    usePerfRenderCount('MatBoard');
    // Perf draw switches: each only stops DRAWING (see drawSwitches.js).
    const ringsDrawn = useDrawn('rings');
    const alertsDrawn = useDrawn('alerts');
    const speechDrawn = useDrawn('speech');
    const rootRef = useRef(null);

    // Read through the hook so the whole board redraws when the Mat Tuner resizes it.
    const mat = useMatSize();

    const [hoveredId, setHoveredId] = useState(null);
    const [hoverHeroId, setHoverHeroId] = useState(null);
    /** The pointer is on a Token's art circle, so every flag lets it through. */
    const [flagsYield, setFlagsYield] = useState(false);
    const { isDragging, activePayload } = useActiveDrag();
    // The mat Token in the hand, if one is: it stays where it is, hidden, while it is carried.
    const carriedId = isDragging && activePayload?.kind === DRAG_KIND.TOKEN ? (activePayload.from?.instanceId ?? null) : null;

    // Every Token is picked up through one shared drag source (`MatTokenGrab`): a press says
    // which Token, points the source at its art, and hands the press on.
    const pressedRef = useRef(null);
    const grabRef = useRef(null);
    const handleTokenPress = useCallback((e, token, artEl) => {
        pressedRef.current = token;
        const grab = grabRef.current;
        if (!grab) return;
        grab.setNodeRef(artEl);
        grab.listeners?.onPointerDown?.(e);
    }, []);

    // Disallow mode. Read once here and handed to each Token as a prop, so a Token holds no
    // subscription of its own for it.
    const disallowMode = useDisallowMode();
    const fit = useMatFit() || 1;

    // dnd-kit owns the pointer during a drag, and a Token re-ordering itself under the ghost
    // made it flicker. Nothing is hovered while dragging.
    // The drag ghost has pointer-events: none, so a hero or flag underneath it still gets
    // onMouseEnter/onMouseLeave as the cursor crosses it, which would show that hero's reach
    // ring and force a full MatBoard commit even though the carried Token would not land
    // there. `FlagLayer` already rings exactly the flags the Token WOULD land in
    // (`useTokenDragLanding`); that is the only ring that should show mid-drag, so hero hover
    // is cleared here and ignored below for the drag's duration.
    React.useEffect(() => {
        if (isDragging) { setHoveredId(null); setFlagsYield(false); setHoverHeroId(null); }
    }, [isDragging]);

    // A no-op while dragging, so a hero/flag crossing mid-drag does not reinstate a stray
    // hover ring (and the commit it would cost). Read from the page rather than `isDragging`, so
    // the handler stays the same and no hero or flag is redrawn for a new one at each drag.
    const handleHoverHero = useCallback((id) => {
        if (typeof document !== 'undefined' && document.body.classList.contains('gi-dnd-active')) return;
        setHoverHeroId(id);
    }, []);

    /**
     * Every Token on the mat: where it is, and nothing about how it is doing.
     * ⚠️ A walking enemy's steps do not redraw the mat. For a Token that is walking this tick,
     * `x` is null and `y` is only its place in the stack (`walkerSortY`), which holds still
     * until it crosses another Token or flag; its box follows the engine by itself
     * (`MatToken`). So a step re-renders MatBoard only when it changes who is in front of
     * whom, or the walk starts, stops or turns.
     */
    const tokensRaw = useGameState(
        () => {
            const all = BoardState.tokens();
            const facing = all.map(t => EnemyMotion.walkFacingOf(t.id));
            if (!facing.some(f => f != null)) {
                return all.map(t => ({ id: t.id, typeId: t.typeId, x: t.x, y: t.y, placedAt: t.placedAt ?? 0, walkFacing: null }));
            }
            const flagYs = [];
            for (const [heroId] of BoardState.heroesOnBoard()) {
                const flag = BoardState.flagOf(heroId);
                if (flag) flagYs.push(flag.y);
            }
            return all.map((t, i) => {
                // An enemy walking by its spawner glides from step to step, facing the way it
                // goes. Null for everything standing still.
                const walkFacing = facing[i];
                if (walkFacing == null) {
                    return { id: t.id, typeId: t.typeId, x: t.x, y: t.y, placedAt: t.placedAt ?? 0, walkFacing };
                }
                const others = flagYs.slice();
                for (const o of all) if (o !== t) others.push(o.y);
                return { id: t.id, typeId: t.typeId, x: null, y: walkerSortY(t.y, others), placedAt: t.placedAt ?? 0, walkFacing };
            });
        },
        [BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.TOKEN_DEPLETED, BOARD_EVENTS.ENEMIES_WALKED, ENGINE_EVENTS.STATE_CHANGED],
        null
    );
    const tokens = useMemo(() => tokensRaw || [], [tokensRaw]);

    /**
     * Back to front: lower on the mat draws in front, then the earlier-placed
     * (`placedAt`), so the order never flickers between two Tokens level with
     * each other. This is only the order the Tokens are written into the page;
     * who is in front is `matStackOrder`'s, below.
     */
    const ordered = useMemo(
        () => [...tokens].sort((a, b) => (a.y - b.y) || (a.placedAt - b.placedAt)),
        [tokens]
    );

    /**
     * Every hero on the mat is drawn here, where they really are: their body's position from
     * `HeroMotion` (walking, working beside a Token, or idle beside their flag). One component
     * per hero in every state, so a hero is never swapped between layers mid-walk.
     * `HEROES_WALKED` redraws as they step.
     */
    const heroesRaw = useGameState(
        (state) => {
            const roster = state.heroes || [];
            const out = [];
            // Flag holders in planting order, then heroes with no flag whose figure is still
            // walking home: they have a body but no flag.
            const ids = BoardState.heroesOnBoard().map(([heroId]) => heroId);
            for (const [heroId] of BoardState.heroBodies()) if (!ids.includes(heroId)) ids.push(heroId);
            for (const heroId of ids) {
                const status = Flags.statusOf(heroId);
                if (status.state === 'docked') continue;
                const body = HeroMotion.bodyView(heroId);
                if (!body) continue;
                const worked = status.state === 'working' ? BoardState.getTokenById(status.instanceId) : null;
                const hero = roster.find(h => h?.id === heroId);
                out.push({
                    heroId,
                    state: status.state,
                    tokenId: worked?.id || null,
                    // No point while moving: the figure follows its steps by itself
                    // (`MatHero`), so a step redraws nothing here. It comes back when they
                    // stop.
                    x: body.moving ? null : body.x,
                    y: body.moving ? null : body.y,
                    moving: body.moving,
                    facing: body.facing,
                    limp: body.limp,
                    name: hero?.name || 'Hero',
                    sprite: hero?.spriteId || hero?.classId || null,
                    // Not working productively: the Token it holds is stuck. Such a hero gets
                    // no glow (the red badge says it alone) and stands idle instead of
                    // swinging. The same test as the Token's own hit reaction (`strikesLive`).
                    stuck: !!worked && !strikesLive(heroId, worked.alert),
                    // Fighting: idle, one attack per real attack.
                    combat: !!worked && hitsOnAttack(hitSkillOf(getTokenType(worked.typeId))),
                    // Which alert; the speech bubble says what is wrong.
                    alert: worked?.alert || null
                });
            }
            return out;
        },
        [
            BOARD_EVENTS.HERO_MOVED,
            BOARD_EVENTS.HEROES_WALKED,
            BOARD_EVENTS.TILE_CHANGED,
            BOARD_EVENTS.ALERT_CHANGED,
            ENGINE_EVENTS.HEROES_UPDATED,
            ENGINE_EVENTS.STATE_CHANGED
        ],
        null
    );
    const heroes = useMemo(() => heroesRaw || [], [heroesRaw]);

    /** Every flag's point, in planting order; flags sort with the Tokens. */
    const flagsRaw = useGameState(
        () => {
            const out = [];
            for (const [heroId] of BoardState.heroesOnBoard()) {
                const flag = BoardState.flagOf(heroId);
                if (flag) out.push({ heroId, y: flag.y });
            }
            return out;
        },
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.TILE_CHANGED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.STATE_CHANGED],
        null
    );
    const flagPoints = useMemo(() => flagsRaw || [], [flagsRaw]);

    // The painted ground. Dormant while terrain is off.
    const terrain = useGameState(
        state => (TERRAIN_ENABLED ? state.board?.terrain || NO_TERRAIN : NO_TERRAIN),
        [ENGINE_EVENTS.STATE_CHANGED, BOARD_EVENTS.TILE_CHANGED]
    );


    const handlePointerMove = useCallback((e) => {
        if (typeof document !== 'undefined' && document.body.classList.contains('gi-dnd-active')) return;
        const el = rootRef.current;
        if (!el) return;
        /**
         * Flags have no hitbox over Tokens, except their cloth. A point on a Token's art circle
         * is that Token's, even when a flag is drawn in front of it: the Token is hovered (and
         * so raised to the front), and every flag lets the pointer through until it leaves the
         * circle. Only the cloth of a flag drawn in front of that Token keeps the pointer, so a
         * flag standing among Tokens can always be picked up by its banner.
         */
        const point = pointerToMat({ x: e.clientX, y: e.clientY }, el.getBoundingClientRect());
        let id = point ? (Flags.tokenAtPoint(point)?.id ?? null) : null;
        if (id && flagClothOver(el, e.clientX, e.clientY, id)) {
            setFlagsYield(prev => (prev === false ? prev : false));
            setHoveredId(prev => (prev === null ? prev : null));
            return;
        }
        const onToken = !!id;
        setFlagsYield(prev => (prev === onToken ? prev : onToken));
        if (!id) {
            // Not over a Token: a flag in front keeps the pointer (it is grabbable).
            if (e.target?.closest?.('[data-flag]')) {
                setHoveredId(prev => (prev === null ? prev : null));
                return;
            }
            // Outside every art circle, but perhaps on a badge that reaches past
            // one — the gear sits in the corner of the box, beyond the circle.
            id = e.target?.closest?.('[data-token-id]')?.getAttribute('data-token-id') || null;
        }
        setHoveredId(prev => (prev === id ? prev : id));
    }, []);

    const clearHover = useCallback(() => { setHoveredId(null); setFlagsYield(false); }, []);

    // A press where two Tokens' circles overlap goes to the one hovering would pick, even when no
    // pointer move has raised it to the front yet.
    useEffect(() => {
        const el = rootRef.current;
        return el ? installPressRouting(el, Flags.tokenAtPoint) : undefined;
    }, []);


    // Remembers where each new Token came from, for its pop-out (`MatToken`).
    useEffect(() => watchSpawns(), []);

    const handleRecallHero = useCallback((heroId) => {
        announce(Placement.recallHeroById(heroId));
    }, []);

    // A click on a Token in disallow mode (a Token no hero works: nothing).
    const handleFlipDisallow = useCallback((instanceId) => { flipDisallowed(instanceId); }, []);



    // Only a Token that acts on or depends on its neighbours shows a ring (`showsNearRing`).
    const hoveredCentre = useMemo(() => {
        const t = hoveredId ? tokens.find(k => k.id === hoveredId) : null;
        if (!t || !showsNearRing(t.typeId)) return null;
        // A walker's own point is not in `tokens`: read it live.
        const at = t.x == null ? BoardState.getTokenById(t.id) : t;
        return at ? { x: at.x, y: at.y } : null;
    }, [hoveredId, tokens]);

    const workedBy = useMemo(() => {
        const out = new Map();
        for (const h of heroes) if (h.tokenId) out.set(h.tokenId, h.heroId);
        return out;
    }, [heroes]);

    /**
     * Who is in front of whom: Tokens and flags sorted together; a worked Token, with its
     * hero, in front of every Token and flag at rest; the hovered Token frontmost. See
     * `matLayers.js`.
     */
    // Keyed by the worked ids, not the heroes: heroes redraw every walking step.
    const workedKey = [...workedBy.keys()].sort().join('|');
    // The same object when no z changed, so `flagZ` is a stable prop.
    const lastOrderRef = useRef(null);
    const order = useMemo(() => {
        const next = matStackOrder({ tokens, flags: flagPoints, workedIds: workedKey ? workedKey.split('|') : [], hoveredId });
        return sameStackOrder(lastOrderRef.current, next) ? lastOrderRef.current : next;
    }, [tokens, flagPoints, workedKey, hoveredId]);
    lastOrderRef.current = order;
    // Each Token's z goes straight onto its boxes, so a re-rank redraws no Token. A layout
    // effect: written in the same commit, before anything is painted.
    const stack = useMemo(() => createStackWriter(), []);
    useLayoutEffect(() => { stack.apply(order.tokenZ); }, [stack, order]);

    return (
        <div
            ref={rootRef}
            data-mat-board
            data-disallow-mode={disallowMode ? 'on' : undefined}
            className="absolute left-0 top-0"
            style={{ width: mat.w, height: mat.h }}
            onPointerMove={handlePointerMove}
            onPointerLeave={clearHover}
        >
            {/**
             * 0: the mat itself, a plain darker surface with a soft rounded border. With free
             * placement it is the only edge there is, since a Token may stand anywhere on it.
             */}
            <div
                data-mat-surface
                className="absolute left-0 top-0 pointer-events-auto"
                style={{
                    width: mat.w,
                    height: mat.h,
                    zIndex: MAT_Z.SURFACE,
                    borderRadius: 28,
                    backgroundColor: 'rgba(0, 0, 0, 0.22)',
                    border: '2px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: 'inset 0 0 90px rgba(0, 0, 0, 0.40), 0 0 0 1px rgba(0, 0, 0, 0.35)'
                }}
            />

            {TERRAIN_ENABLED && <TerrainCanvas terrain={terrain} seed={0} />}

            {/**
             * 10+: Tokens, the heroes on them, and what is written on them; flags and idle
             * heroes sort in among them (FlagLayer, below).
             */}
            {ordered.map(t => (
                <MatToken
                    key={t.id}
                    id={t.id}
                    typeId={t.typeId}
                    x={t.x}
                    y={t.y}
                    walkFacing={t.walkFacing}
                    stack={stack}
                    isHovered={hoveredId === t.id}
                    selected={inspectedTokenId != null && inspectedTokenId === t.id}
                    hasHero={workedBy.has(t.id)}
                    onInspectToken={onInspectToken}
                    onClearInspect={onClearInspect}
                    onOpenRecipes={onOpenRecipes}
                    onRecallHero={handleRecallHero}
                    disallowMode={disallowMode}
                    onFlipDisallow={handleFlipDisallow}
                    dragging={carriedId === t.id}
                    onPress={handleTokenPress}
                />
            ))}
            <MatTokenGrab pressedRef={pressedRef} grabRef={grabRef} />

            {heroes.map(h => {
                // A moving hero's point is MatHero's own.
                const place = h.x == null ? { left: null, top: null } : heroPlacement(h);
                const animState = heroAnimationState({
                    moving: h.moving, working: h.state === 'working', stuck: h.stuck, combat: h.combat
                });

                return (
                    <MatHero
                        key={h.heroId}
                        heroId={h.heroId}
                        name={h.name}
                        sprite={h.sprite}
                        left={place.left}
                        top={place.top}
                        z={heroZ(h, order)}
                        outline={heroOutline({
                            hovered: hoverHeroId === h.heroId || (h.tokenId != null && hoveredId === h.tokenId),
                            selected: inspectedHeroId === h.heroId,
                            working: h.state === 'working',
                            stuck: h.stuck
                        })}
                        hovered={hoverHeroId === h.heroId || (h.tokenId != null && hoveredId === h.tokenId)}
                        onHover={handleHoverHero}
                        onRecall={handleRecallHero}
                        animationState={animState}
                        moving={h.moving}
                        facing={h.facing}
                        limp={h.limp}
                        fighting={h.combat}
                    />
                );
            })}

            {/* 760: the Near ring. Flag radius rings are FlagLayer's. */}
            {ringsDrawn && <MatRings hoveredCentre={hoveredCentre} matRef={rootRef} />}

            {/* 800: loot on the floor. */}
            <SpriteLayerView />

            {/* Flags, sorted in among the Tokens, and their rings (760). */}
            <FlagLayer
                flagZ={order.flagZ}
                inspectedHeroId={inspectedHeroId}
                hoverHeroId={hoverHeroId}
                onHoverHero={handleHoverHero}
                matRef={rootRef}
                yieldToTokens={flagsYield}
            />

            {/* 855 — callouts: quick popups over a Token or a refused drop's spot. */}
            {alertsDrawn && <CalloutLayer />}

            {/* 860 — hero speech bubbles, above every hero. */}
            {speechDrawn && <HeroBubbleLayer heroes={heroes} />}

            {/**
             * Disallow mode's red dashed edge and hint, above everything and never in the
             * pointer's way. Sized against the mat's fit so they read the same at any zoom.
             */}
            {disallowMode && (
                <div
                    data-disallow-edge
                    aria-hidden="true"
                    className="absolute left-0 top-0 pointer-events-none"
                    style={{
                        width: mat.w,
                        height: mat.h,
                        zIndex: DISALLOW_EDGE_Z,
                        borderRadius: 28,
                        border: `${3 / fit}px dashed #E24B4A`
                    }}
                >
                    <div
                        data-disallow-hint
                        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#791F1F]/90 border border-[#E24B4A] text-red-50 font-pixel"
                        style={{ top: 12 / fit, fontSize: 11 / fit, padding: `${2 / fit}px ${8 / fit}px` }}
                    >
                        Click a Token to allow / disallow · Esc to finish
                    </div>
                </div>
            )}
        </div>
    );
});

/**
 * Disallow mode's edge and hint: above the speech bubbles (`MAT_Z.HERO_BUBBLE`, 860).
 */
const DISALLOW_EDGE_Z = 900;

/** Shared empty terrain, so a dormant board's selector returns a stable value. */
const NO_TERRAIN = Object.freeze({});

/**
 * Where a hero's 64 × 128 box goes, in mat units: centred on the hero's own point. A working
 * hero's point is already beside their Token (`HeroMotion.standingSpot`), so there is no
 * per-state offset.
 */
export function heroPlacement({ x, y }) {
    return heroBoxAt({ x, y });
}

export default MatBoard;
