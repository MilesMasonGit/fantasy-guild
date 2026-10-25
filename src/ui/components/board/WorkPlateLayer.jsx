import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MAT_Z } from './matLayers.js';
import { BubbleTip } from './Bubble.jsx';
import { useMatFit } from './MatFitContext.jsx';
import { useTokenState } from './tokenEvents.js';
import { watchWorkBar } from './workBar.js';
import { readCycle } from './cycleShare.js';
import { PROBLEM_SPRITE, SEVERITY } from './problemMark.js';
import {
    PLATE, CELL, workPlateOf, plateCells, plateTip, platePlace, timeLeftText, chargesText, glyphUri
} from './workPlate.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as FixedTokens from '../../../systems/board/FixedTokens.js';
import * as Placement from '../../../systems/board/Placement.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { skillArt } from '../base/SkillIcon.jsx';
import { useMatSize } from '../../hooks/useMatSize.js';

const PIXELATED = Object.freeze({ imageRendering: 'pixelated' });

/** An item's or a Token's sprite, by id. */
const spriteOf = (id) => resolveSpritePath(getItem(id) || getTokenType(id) || id);

/**
 * The plate's fill: the Token's own work bar model (`TokenBubbles` keeps it and feeds it the
 * engine's events) painting this element on the shared step clock. Held grey while the Token
 * waits.
 */
export const WorkBarFill = memo(function WorkBarFill({ instanceId, blocked = false, style }) {
    const elRef = useRef(null);
    useLayoutEffect(() => {
        let held = null;
        const stop = watchWorkBar(instanceId, (bar) => {
            held?.attach(null);
            held = bar;
            bar?.attach(elRef.current, PLATE.FILL_STEPS);
        });
        return () => {
            stop();
            held?.attach(null);
        };
    }, [instanceId]);
    return (
        <div
            ref={elRef}
            data-work-bar={instanceId}
            data-work-bar-blocked={blocked ? 'true' : undefined}
            aria-hidden="true"
            className="gi-work-bar absolute pointer-events-none"
            style={style}
        />
    );
});

/** One cell: its picture and number, its tooltip read when the pointer arrives. */
function PlateCell({ cell, u, tip }) {
    const ref = useRef(null);
    const [text, setText] = useState(null);
    const icon = { width: PLATE.ICON * u, height: PLATE.ICON * u, ...PIXELATED };
    const glyph = { width: 16 * u, height: 16 * u, ...PIXELATED };
    // The kit's small size, counter-scaled so the pixel font lands on whole screen pixels on the mat.
    const num = { fontSize: `calc(var(--font-size-xxs, 14px) * ${u})`, textShadow: `${2 * u}px ${2 * u}px 0 #000` };
    let body;
    switch (cell.kind) {
        case CELL.SKILL:
            body = <img src={skillArt(cell.id).spritePath || undefined} alt="" draggable={false} style={icon} />;
            break;
        case CELL.OUTPUT:
            body = <img src={spriteOf(cell.id)} alt="" draggable={false} style={icon} />;
            break;
        case CELL.MISSING:
            body = (
                <>
                    <img src={spriteOf(cell.itemId)} alt="" draggable={false} style={icon} />
                    <span className="font-bold tabular-nums leading-none" style={{ ...num, color: 'var(--color-ui-red)' }}>
                        {cell.have}/{cell.need}
                    </span>
                </>
            );
            break;
        case CELL.PROBLEM:
            body = <img src={PROBLEM_SPRITE[cell.severity] || PROBLEM_SPRITE[SEVERITY.WAITING]} alt="" draggable={false} style={icon} />;
            break;
        case CELL.CHARGES:
            body = (
                <>
                    <img src={glyphUri('charges')} alt="" draggable={false} style={glyph} />
                    <span className="font-bold tabular-nums leading-none text-white" style={num}>{chargesText(cell.count)}</span>
                </>
            );
            break;
        case CELL.DIVIDER:
            body = <span aria-hidden="true" style={{ width: 2 * u, height: 28 * u, background: 'var(--color-ui-frame)' }} />;
            break;
        case CELL.ELIXIR:
            body = (
                <>
                    <img src={spriteOf(cell.itemId)} alt="" draggable={false} style={icon} />
                    <span className="font-bold tabular-nums leading-none text-white" style={num}>{cell.count}</span>
                </>
            );
            break;
        case CELL.TIMER:
            body = (
                <>
                    <img src={glyphUri('clock')} alt="" draggable={false} style={glyph} />
                    <span className="font-bold tabular-nums leading-none text-white" style={num}>{cell.text}</span>
                </>
            );
            break;
        default:
            body = null;
    }
    return (
        <div
            ref={ref}
            data-plate-cell={cell.kind}
            className="relative shrink-0 flex items-center"
            style={{ gap: 2 * u }}
            onPointerEnter={() => setText(tip ? tip(cell) || null : null)}
            onPointerLeave={() => setText(null)}
            onPointerDown={() => setText(null)}
        >
            {body}
            {text && <BubbleTip anchor={ref.current} text={text} />}
        </div>
    );
}

/**
 * The plate as drawn: its frame (gold while the Token waits, red when it can't go on), its cells,
 * and the cycle's fill along its foot under the first cell. `u` is one plate pixel in the units it
 * is drawn in (mat units on the mat, screen pixels on the style sheet page). `fill` is the fill's
 * element (the live `WorkBarFill`, or a still one).
 */
export function WorkPlateView({ cells, tone = null, u = 1, tip = null, fill = null, plateProps = null }) {
    const band = PLATE.BAND * u;
    const frame = { borderWidth: band, borderImageWidth: `${band}px` };
    const { style: plateStyle, ...rest } = plateProps || {};
    return (
        <div
            data-work-plate-tone={tone || undefined}
            {...rest}
            className="relative flex items-center select-none pointer-events-auto cursor-grab active:cursor-grabbing"
            style={{ height: PLATE.H * u, padding: `0 ${PLATE.SIDE * u}px`, gap: PLATE.GAP * u, ...plateStyle }}
        >
            <span
                aria-hidden="true"
                className="ui-frame-shadow-chamfer absolute inset-0 pointer-events-none"
                style={{ ...frame, transform: `translate(${PLATE.SHADOW * u}px, ${PLATE.SHADOW * u}px)` }}
            />
            <span
                aria-hidden="true"
                className={`ui-frame-chamfer${tone === SEVERITY.WAITING ? ' ui-frame-chamfer-gold' : tone === SEVERITY.CANT ? ' ui-frame-chamfer-red' : ''} absolute inset-0 pointer-events-none`}
                style={frame}
            />
            {/* Keyed by what each cell is, so a cell keeps its tooltip while the plate opens round it. */}
            {cells.map(cell => <PlateCell key={`${cell.kind}:${cell.itemId || cell.id || ''}:${cell.who || ''}`} cell={cell} u={u} tip={tip} />)}
            {fill}
        </div>
    );
}

/** The icon cells before the output (the skill, in the opened line), for the fill to stand under it. */
export const leadOf = (cells) => Math.max(0, cells.findIndex(c => c.kind === CELL.OUTPUT));

/**
 * Where the fill stands in a plate, `u` units a plate pixel: along the foot, under what is being
 * made (`lead` icon cells before it: the skill, in the opened line).
 */
export const fillStyle = (u, lead = 0) => ({
    left: (PLATE.SIDE + lead * (PLATE.ICON + PLATE.GAP)) * u,
    bottom: PLATE.FILL_BOTTOM * u,
    width: PLATE.FILL_W * u,
    height: PLATE.FILL_H * u
});

const PLATE_ROUTES = Object.freeze([
    BOARD_EVENTS.TILE_CHANGED,              // a recipe picked, moved, turned into another
    BOARD_EVENTS.ALERT_CHANGED,             // waiting, or going again
    BOARD_EVENTS.HERO_MOVED,                // the hero arrived, or came round the other side
    BOARD_EVENTS.TOKEN_CHARGES_CHANGED      // a charge spent
]);

/** A plate takes the pointer unless its layer lets it through (`--plate-pointer`, set by the layer). */
const PLATE_POINTER = Object.freeze({ pointerEvents: 'var(--plate-pointer, auto)' });

/** How often the opened line's time to the next one is read again. */
const TIMER_MS = 1000;

/**
 * One Token's plate. Its look is read only on the events about that Token (`useTokenState`), the
 * Bank's changes only while it waits for an item; its fill is the Token's work bar. Opened, its
 * time to the next one is read once a second.
 * Pressing it grabs the Token, as pressing any bubble does.
 */
const WorkPlate = memo(function WorkPlate({ tokenId, heroId, x, y, typeId, open, fit, matH, onPress }) {
    const plate = useTokenState(tokenId, () => workPlateOf(tokenId), (p) => ({
        byId: PLATE_ROUTES,
        byKey: [{ event: BOARD_EVENTS.HERO_MOVED, field: 'heroId', key: heroId }],
        broadcast: [ENGINE_EVENTS.GAME_RESET, ...(p?.missing?.length ? [ENGINE_EVENTS.INVENTORY_UPDATED] : [])]
    }));

    const [now, setNow] = useState(0);
    useEffect(() => {
        if (!open) return undefined;
        setNow(performance.now());
        const timer = setInterval(() => setNow(performance.now()), TIMER_MS);
        return () => clearInterval(timer);
    }, [open]);

    const press = useCallback((e) => {
        const instance = BoardState.getTokenById(tokenId);
        if (!instance || FixedTokens.isFixed(instance)) return;
        const art = e.currentTarget.closest('[data-mat-board]')?.querySelector(`[data-token-art][data-token-id="${tokenId}"]`) || null;
        onPress?.(e, { id: tokenId, typeId: instance.typeId, permanent: Placement.isPermanentToken(instance.typeId) }, art);
    }, [tokenId, onPress]);
    const tip = useCallback((cell) => plateTip(cell, tokenId, readCycle(tokenId, performance.now())), [tokenId]);

    if (!plate || x == null) return null;
    const place = platePlace({ x, y, typeId: plate.typeId || typeId, side: plate.side, fit, matH });
    const u = place.unit;
    const cells = plateCells(plate, { open }).map(c => (
        c.kind === CELL.TIMER ? { ...c, text: timeLeftText(readCycle(tokenId, now || performance.now())) || '–' } : c
    ));
    return (
        <div
            data-work-plate-slot={tokenId}
            className="absolute flex justify-center pointer-events-none"
            style={{ left: place.left, top: place.top, width: place.width }}
        >
            <WorkPlateView
                cells={cells}
                tone={plate.severity}
                u={u}
                tip={tip}
                fill={<WorkBarFill instanceId={tokenId} blocked={!!plate.problem} style={fillStyle(u, leadOf(cells))} />}
                plateProps={{
                    'data-work-plate': tokenId,
                    'data-work-plate-open': open ? 'true' : undefined,
                    onPointerDown: press,
                    style: PLATE_POINTER
                }}
            />
        </div>
    );
});

/**
 * The work plates, one per hero at work, in one layer over the floor loot (`MAT_Z.WORK_PLATE`): in
 * a Token's own box the loot lying at its feet covered it. `plates` are `{ tokenId, heroId, typeId,
 * x, y }`; the one whose Token or hero the pointer rests on is open.
 * ⚠️ A plate never takes a Token from under the pointer. It stands below its hero's feet, so on a
 * crowded mat it lies across the top of the Token in the row below, and a point on a Token's circle
 * is that Token's: while the pointer is on one (`yieldToTokens`, the mat's own test) every plate
 * lets it through, and a press that lands on a plate there is sent to that Token
 * (`pressRouting.js`). Off every circle a plate keeps the pointer: its tooltips, and a press picks
 * up its own Token.
 * A fight has no plate yet: its place is kept for the fight's own link (both styles, the elixirs).
 */
export const WorkPlateLayer = memo(function WorkPlateLayer({ plates, restTokenId = null, restHeroId = null, onPress, yieldToTokens = false }) {
    const fit = useMatFit() || 1;
    const mat = useMatSize();
    return (
        <div
            data-work-plates
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            // One variable for every plate, so the pointer moving on and off a circle redraws none.
            style={{ zIndex: MAT_Z.WORK_PLATE, '--plate-pointer': yieldToTokens ? 'none' : 'auto' }}
        >
            {plates.map(p => (
                <WorkPlate
                    key={p.tokenId}
                    tokenId={p.tokenId}
                    heroId={p.heroId}
                    typeId={p.typeId}
                    x={p.x}
                    y={p.y}
                    open={restTokenId === p.tokenId || restHeroId === p.heroId}
                    fit={fit}
                    matH={mat.h}
                    onPress={onPress}
                />
            ))}
        </div>
    );
});

export default WorkPlateLayer;
