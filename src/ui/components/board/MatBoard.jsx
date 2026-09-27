import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { MAT_Z, matStackOrder, heroZ } from './matLayers.js';
import { HERO_HIT_PX } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';
import { pointerToMat } from './matPoint.js';
import { MatToken } from './MatToken.jsx';
import { MatHero } from './MatHero.jsx';
import { MatRings } from './MatRings.jsx';
import { MatPointAlerts } from './MatPointAlerts.jsx';
import { HeroBubbleLayer } from './HeroBubbleLayer.jsx';
import { strikesLive, heroAnimationState, hitSkillOf, hitsOnAttack } from './hitAnimations.js';
import { FlagLayer } from './FlagLayer.jsx';
import { SpriteLayerView } from './SpriteLayerView.jsx';
import { TerrainCanvas } from './TerrainCanvas.jsx';
import { TERRAIN_ENABLED } from '../../../config/registries/terrainRegistry.js';
import { announce } from './dropOnMat.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import * as Placement from '../../../systems/board/Placement.js';
import { showsNearRing } from '../../../systems/board/reachDisplay.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';

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
    const rootRef = useRef(null);

    // How big the mat is right now (slice 1.6d-3). Read through the hook so the
    // whole board redraws when the Mat Tuner resizes it.
    const mat = useMatSize();

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
     * each other. This is only the order the Tokens are written into the page;
     * who is in front is `matStackOrder`'s, below.
     */
    const ordered = useMemo(
        () => [...tokens].sort((a, b) => (a.y - b.y) || (a.placedAt - b.placedAt)),
        [tokens]
    );

    /**
     * ⭐ **Every hero on the mat is drawn here, where they really are** (Hero
     * Movement M1–M2): their body's position from `HeroMotion` — walking,
     * working beside a Token, or idle beside their flag.
     * One component per hero in every state, so a hero is never swapped
     * between layers mid-walk (that swap was M1's jump on reaching the flag).
     * `HEROES_WALKED` redraws as they step.
     */
    const heroesRaw = useGameState(
        (state) => {
            const roster = state.heroes || [];
            const out = [];
            // Flag holders in planting order, then heroes with no flag whose
            // figure is still walking home (M3) — they have a body but no flag.
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
                    x: body.x,
                    y: body.y,
                    moving: body.moving,
                    facing: body.facing,
                    limp: body.limp,
                    name: hero?.name || 'Hero',
                    sprite: hero?.spriteId || hero?.classId || null,
                    // Not working productively: the Token it holds is stuck.
                    // Such a hero gets no glow — the red badge says it alone —
                    // and stands idle instead of swinging (FB-50). The same
                    // test as the Token's own hit reaction (`strikesLive`).
                    stuck: !!worked && !strikesLive(heroId, worked.alert),
                    // Fighting: idle, one attack per real attack (FB-49).
                    combat: !!worked && hitsOnAttack(hitSkillOf(getTokenType(worked.typeId))),
                    // Which alert — the speech bubble says what is wrong (SB-B).
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
            'heroes_updated',
            'state_changed'
        ],
        null
    );
    const heroes = useMemo(() => heroesRaw || [], [heroesRaw]);

    /** Every flag's point, in planting order — flags sort with the Tokens (FB-1). */
    const flagsRaw = useGameState(
        () => {
            const out = [];
            for (const [heroId] of BoardState.heroesOnBoard()) {
                const flag = BoardState.flagOf(heroId);
                if (flag) out.push({ heroId, y: flag.y });
            }
            return out;
        },
        [BOARD_EVENTS.HERO_MOVED, BOARD_EVENTS.TILE_CHANGED, 'heroes_updated', 'state_changed'],
        null
    );
    const flagPoints = useMemo(() => flagsRaw || [], [flagsRaw]);

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
        // On a flag (its opaque pixels — `alphaHitTest`), the flag is what is in
        // front: raising a Token behind it would cover the flag under the
        // pointer and it could not be grabbed (flags sort with Tokens, FB-1).
        if (e.target?.closest?.('[data-flag], [data-flag-gear]')) {
            setHoveredId(prev => (prev === null ? prev : null));
            return;
        }
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

    // Right-click on a Token no hero works does nothing since the Vault went
    // (Token Lifecycle 9.3); it used to deposit the Token there (FP-45).

    // The green plus that sent an idle hero to a Token went with FB-6 (Token
    // Lifecycle feedback Q2): heroes find work through their flags.

    // Only a Token that acts on or depends on its neighbours shows a ring
    // (owner, 2026-09-21) — `showsNearRing`.
    const hoveredCentre = useMemo(() => {
        const t = hoveredId ? tokens.find(k => k.id === hoveredId) : null;
        return t && showsNearRing(t.typeId) ? { x: t.x, y: t.y } : null;
    }, [hoveredId, tokens]);

    const workedBy = useMemo(() => {
        const out = new Map();
        for (const h of heroes) if (h.tokenId) out.set(h.tokenId, h.heroId);
        return out;
    }, [heroes]);

    /**
     * ⭐ **Who is in front of whom** (feedback Q3): Tokens and flags sorted
     * together (FB-1); a worked Token, with its hero, in front of every Token
     * and flag at rest (FB-2); the hovered Token frontmost. `matLayers.js`.
     */
    // Keyed by the worked ids, not the heroes: heroes redraw every walking step.
    const workedKey = [...workedBy.keys()].sort().join('|');
    const order = useMemo(
        () => matStackOrder({ tokens, flags: flagPoints, workedIds: workedKey ? workedKey.split('|') : [], hoveredId }),
        [tokens, flagPoints, workedKey, hoveredId]
    );
    const zById = order.tokenZ;

    return (
        <div
            ref={rootRef}
            data-mat-board
            className="absolute left-0 top-0"
            style={{ width: mat.w, height: mat.h }}
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

            {/* 10+ — Tokens, the heroes on them, and what is written on them;
                flags and idle heroes sort in among them (FlagLayer, below). */}
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
                    onOpenRecipes={onOpenRecipes}
                    onRecallHero={handleRecallHero}
                />
            ))}

            {heroes.map(h => {
                const place = heroPlacement(h);
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
                        glow={h.state === 'working' && !h.stuck ? 'gi-glow-active' : null}
                        hovered={hoverHeroId === h.heroId || (h.tokenId != null && hoveredId === h.tokenId)}
                        onHover={setHoverHeroId}
                        onRecall={handleRecallHero}
                        animationState={animState}
                        moving={h.moving}
                        facing={h.facing}
                        limp={h.limp}
                    />
                );
            })}

            {/* 750 — news with no Token left to sit on. */}
            <MatPointAlerts />

            {/* 760 — the Near ring (FP-64). Flag radius rings are FlagLayer's. */}
            <MatRings hoveredCentre={hoveredCentre} matRef={rootRef} />

            {/* 800 — loot on the floor. */}
            <SpriteLayerView />

            {/* Flags, sorted in among the Tokens (FB-1), and their rings (760). */}
            <FlagLayer
                flagZ={order.flagZ}
                inspectedHeroId={inspectedHeroId}
                hoverHeroId={hoverHeroId}
                onHoverHero={setHoverHeroId}
                matRef={rootRef}
            />

            {/* 860 — hero speech bubbles, above every hero. */}
            <HeroBubbleLayer heroes={heroes} />
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
 */
export function heroPlacement({ x, y }) {
    // Centred on the hero's own point (Hero Movement M1). A working hero's
    // point is already beside their Token (`HeroMotion.standingSpot`, HM-2),
    // so there is no per-state offset any more (D-266's pairing went).
    return { left: x - HERO_HIT_PX / 2, top: y - FLAG_PX / 2 };
}

export default MatBoard;
