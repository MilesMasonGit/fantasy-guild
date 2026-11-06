import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../../i18n/index.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { prefersReducedMotion } from '../board/fx/pixelSteps.js';
import { tileArt, ropeArt, symbolArt, SYMBOL_LANDS } from '../../../config/worldMapArt.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import {
    ART_SCALE, HEX_R, TILE_LIFT, TILE_W, TILE_H, TILE_MID, ICON_PX, MAX_ICONS, CELL_LOOK, LOOK_FILTER,
    cellMiddle, cellCentreArt, tilePoints, mapBounds, clampView, viewOn
} from './worldMapLayout.js';
import { paintWorld, paintRope, ringEdges, tileStandIn, pictureFrame, landOf, FOG_CSS } from './worldPicture.js';
import { CellTip } from './WorldPanel.jsx';

/**
 * The world map: the painted world (`worldPicture.js`) with the shown cells standing on it as
 * board tiles, each with the Token its place holds most of and a plate of what it yields, the ring
 * lines a rope along the tiles' edges, and the guild's flag on the place it is in. Drawn once per
 * world and rings shown; a drag or the wheel moves it around.
 *
 * Cell looks (`worldMapLayout.cellLook`): settled and settle-able in full colour, a cell the guild
 * can settle now pulsing gold, a frontier cell it cannot pay for darkened, a cell further out in
 * black and white; the pointer over any cell shows it in full colour with a white outline.
 */

const GOLD = '#fbbf24';
const GOLD_PALE = '#fde68a';
const PULSE_S = 1;
/** How far the pointer moves before a press becomes a drag (and the click is dropped). */
const DRAG_START_PX = 5;
const HERE_FLAG_PX = 48;
const LIFT_PX = TILE_LIFT * ART_SCALE;

// ------------------------------------------------------------------ pictures, kept once built

/** The art pictures in `worldMapArt.DRAWN`, loaded once. */
const artImages = new Map();
function loadArt(path) {
    if (!path || typeof Image === 'undefined') return Promise.resolve(null);
    if (!artImages.has(path)) {
        artImages.set(path, new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = path;
        }));
    }
    return artImages.get(path);
}

/** Whether this page can draw on a canvas at all (a test page cannot): asked once. */
let canDraw = null;
const canvasOf = (width, height) => {
    if (typeof document === 'undefined' || canDraw === false) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canDraw = typeof ImageData !== 'undefined' && !!canvas.getContext('2d');
    return canDraw ? canvas : null;
};

const putPixels = (canvas, { width, height, data }) => {
    canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
    return canvas;
};

const pixelsOf = (img) => {
    const canvas = canvasOf(img.width, img.height);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height);
};

/** The tile stand-ins as pictures, one per land. */
const standIns = new Map();
function standInUrl(land) {
    if (!standIns.has(land)) {
        const art = tileStandIn(land);
        const canvas = canvasOf(art.width, art.height);
        standIns.set(land, canvas ? putPixels(canvas, art).toDataURL() : null);
    }
    return standIns.get(land);
}

/**
 * The painter's worker (`worldPicture.worker.js`), made on first use; null where a page has none or
 * it failed, and the picture is then painted here. Painting takes a few hundred ms: on this thread
 * it would freeze the screen each time a new world is shown (the new-game screen's Reroll).
 */
let painter;
let paintJobs = 0;
const paintWaiting = new Map();
function paintOffThread(args) {
    if (painter === undefined) {
        try {
            painter = typeof Worker === 'undefined' ? null : new Worker(new URL('./worldPicture.worker.js', import.meta.url), { type: 'module' });
        } catch {
            painter = null;
        }
        painter?.addEventListener('message', (e) => {
            const { id, pixels } = e.data || {};
            paintWaiting.get(id)?.(pixels || null);
            paintWaiting.delete(id);
        });
        painter?.addEventListener('error', () => {
            painter = null;
            for (const resolve of paintWaiting.values()) resolve(null);
            paintWaiting.clear();
        });
    }
    if (!painter) return Promise.resolve(null);
    const id = ++paintJobs;
    return new Promise((resolve) => {
        paintWaiting.set(id, resolve);
        painter.postMessage({ id, args });
    });
}

/**
 * The painted world and the rope for one world and rings shown, as canvases: built once and kept
 * (the last few), so opening the map again costs nothing. The time each took is kept with them.
 */
const pictures = new Map();
const PICTURES_KEPT = 3;
async function worldPictures(view) {
    const key = `${view.seed}|${view.rings}`;
    if (pictures.has(key)) return pictures.get(key);
    const symbols = {};
    for (const land of SYMBOL_LANDS) {
        const img = await loadArt(symbolArt(land));
        if (img) symbols[land] = pixelsOf(img);
    }
    const frame = pictureFrame(view.rings);
    if (!canvasOf(1, 1)) return null;
    const started = performance.now();
    const args = { cells: view.world.cells, rings: view.rings, symbols };
    const pixels = (await paintOffThread(args)) || paintWorld(args);
    if (pictures.has(key)) return pictures.get(key);
    const world = putPixels(canvasOf(frame.width, frame.height), pixels);
    const painted = performance.now();
    const edges = ringEdges(view.world.cells, view.rings, cellCentreArt);
    const drawnRope = ['flat', 'rise', 'fall'].filter(kind => ropeArt(kind));
    const rope = putPixels(canvasOf(frame.width, frame.height), paintRope(edges, frame, { skip: drawnRope, skipKnots: !!ropeArt('knot') }));
    const out = { frame, world, rope, edges, ms: { world: painted - started, rope: performance.now() - painted } };
    pictures.set(key, out);
    while (pictures.size > PICTURES_KEPT) pictures.delete(pictures.keys().next().value);
    return out;
}

/** The time the last world picture took to build, for the QA panel and the checks. */
export const lastPictureTimes = () => [...pictures.values()].map(p => p.ms);

/** A canvas showing one of the kept pictures at the art scale, its Hall's middle at the map's origin. */
const PictureCanvas = ({ picture, which, ...rest }) => {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        const ctx = el?.getContext?.('2d');
        if (!ctx || !picture) return;
        ctx.clearRect(0, 0, el.width, el.height);
        ctx.drawImage(picture[which], 0, 0);
    }, [picture, which]);
    if (!picture) return null;
    const { frame } = picture;
    return (
        <canvas
            ref={ref}
            aria-hidden="true"
            width={frame.width}
            height={frame.height}
            className="absolute pointer-events-none"
            style={{
                left: -frame.originX * ART_SCALE,
                top: -frame.originY * ART_SCALE,
                width: frame.width * ART_SCALE,
                height: frame.height * ART_SCALE,
                imageRendering: 'pixelated'
            }}
            {...rest}
        />
    );
};

/** An art picture at 2x its own size, centred on a point. */
const ArtAt = ({ src, x, y, ...rest }) => {
    const [size, setSize] = useState(null);
    return (
        <img
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="absolute pointer-events-none select-none"
            style={{
                left: x - (size ? size.w * ART_SCALE / 2 : 0),
                top: y - (size ? size.h * ART_SCALE / 2 : 0),
                width: size ? size.w * ART_SCALE : undefined,
                height: size ? size.h * ART_SCALE : undefined,
                maxWidth: 'none',
                visibility: size ? 'visible' : 'hidden',
                imageRendering: 'pixelated'
            }}
            {...rest}
        />
    );
};

// ------------------------------------------------------------------ the layers

const lookFilter = (cell, hoverId) => (cell.id === hoverId ? 'none' : LOOK_FILTER[cell.look]);

/** The tiles, back row first, so a nearer tile's top stands over the side of the one behind. */
const Tiles = memo(function Tiles({ cells, hoverId }) {
    return cells.map(cell => {
        const art = cellCentreArt(cell);
        const land = landOf(cell);
        const src = tileArt(land) || standInUrl(land);
        return (
            <div
                key={cell.id}
                data-world-tile={cell.id}
                data-world-look={cell.look}
                data-world-land={land}
                className="absolute pointer-events-none"
                style={{
                    left: (art.x - TILE_MID.x) * ART_SCALE,
                    top: (art.y - TILE_LIFT - TILE_MID.y) * ART_SCALE,
                    width: TILE_W * ART_SCALE,
                    height: TILE_H * ART_SCALE,
                    filter: lookFilter(cell, hoverId)
                }}
            >
                {src && (
                    <img src={src} alt="" draggable={false} className="block select-none" style={{ width: '100%', height: '100%', maxWidth: 'none', imageRendering: 'pixelated' }} />
                )}
            </div>
        );
    });
});

/** The owner's rope pieces, where drawn: one per ring edge at its angle, a knot on each corner. */
const RopeArt = ({ edges }) => {
    const knot = ropeArt('knot');
    return (
        <>
            {edges.edges.map((e, i) => {
                const src = ropeArt(e.kind);
                return src ? <ArtAt key={`e${i}`} src={src} x={e.mid.x * ART_SCALE} y={(e.mid.y - TILE_LIFT) * ART_SCALE} /> : null;
            })}
            {knot && edges.corners.map((p, i) => <ArtAt key={`k${i}`} src={knot} x={p.x * ART_SCALE} y={(p.y - TILE_LIFT) * ART_SCALE} />)}
        </>
    );
};

/** The outlines on the tiles' tops: white under the pointer and on the chosen cell, gold pulsing on a cell ready now. */
const Outlines = ({ cells, hoverId, selectedId }) => {
    const still = prefersReducedMotion();
    return (
        <svg aria-hidden="true" width="1" height="1" className="absolute left-0 top-0 overflow-visible pointer-events-none">
            {cells.map(cell => {
                const { x, y } = cellMiddle(cell);
                const ready = cell.look === CELL_LOOK.READY;
                const white = cell.id === hoverId || cell.id === selectedId;
                if (!ready && !white) return null;
                return (
                    <g key={cell.id} transform={`translate(${x} ${y})`}>
                        {ready && (
                            <polygon data-world-pulse={cell.id} points={tilePoints({ inset: 6 })} fill="none" stroke={GOLD} strokeWidth={4} shapeRendering="crispEdges">
                                {!still && <animate attributeName="stroke" values={`${GOLD};${GOLD_PALE}`} dur={`${PULSE_S}s`} calcMode="discrete" repeatCount="indefinite" />}
                            </polygon>
                        )}
                        {white && !ready && (
                            <polygon data-world-outline={cell.id} points={tilePoints({ inset: 5 })} fill="none" stroke="#ffffff" strokeWidth={2} shapeRendering="crispEdges" />
                        )}
                        {white && ready && (
                            <polygon data-world-outline={cell.id} points={tilePoints({ inset: 9 })} fill="none" stroke="#ffffff" strokeWidth={2} shapeRendering="crispEdges" />
                        )}
                    </g>
                );
            })}
        </svg>
    );
};

/** A big Token (a tree two cells wide) stands at half size, so every Token fits its tile. */
const tokenScale = (typeId) => ((getTokenType(typeId)?.size || 1) >= 2 ? 0.5 : 1);

/** What stands on each tile: its Token, and a plate of what it yields. */
const Contents = memo(function Contents({ cells, hoverId }) {
    return cells.map(cell => {
        const { x, y } = cellMiddle(cell);
        const top = y - LIFT_PX;
        const icons = cell.outputs.slice(0, MAX_ICONS);
        const more = cell.outputs.length - icons.length;
        return (
            <div key={cell.id} data-world-contents={cell.id} className="absolute pointer-events-none" style={{ left: x, top, width: 0, height: 0, filter: lookFilter(cell, hoverId) }}>
                {cell.token && (
                    <div className="absolute flex items-end justify-center" style={{ left: -64, width: 128, bottom: -6 }}>
                        <TokenSprite typeId={cell.token} surface={TOKEN_SURFACE.INSPECT} scale={tokenScale(cell.token)} alt="" />
                    </div>
                )}
                {icons.length > 0 && (
                    <div data-world-plate className="absolute flex items-center gap-0.5 px-[3px] py-[3px]" style={{ top: 14, left: 0, transform: 'translateX(-50%)', background: 'rgba(14, 10, 6, 0.82)' }}>
                        {icons.map(id => <ItemIcon key={id} item={id} size={ICON_PX} title={null} />)}
                        {more > 0 && <span className="font-pixel ui-text-small text-white/90 pl-0.5 pr-1">{t('worldMap.more', { count: more })}</span>}
                    </div>
                )}
            </div>
        );
    });
});

/** The guild's flag on the place it is in: the hero job flag, drawn large. */
const HereFlag = ({ cell }) => {
    if (!cell) return null;
    const { x, y } = cellMiddle(cell);
    return (
        <span data-world-here className="absolute pointer-events-none" style={{ left: x - HEX_R * ART_SCALE + 10, top: y - LIFT_PX - 64 - HERE_FLAG_PX / 2 }}>
            <FlagMark size={HERE_FLAG_PX} alt={t('worldMap.here')} />
        </span>
    );
};

/** The cells' hit areas, over everything: the hover tip, the pointer's outline and the click. */
const HitAreas = ({ cells, onSelect, onHover, dropClick }) => (
    <svg width="1" height="1" className="absolute left-0 top-0 overflow-visible">
        {cells.map(cell => {
            const { x, y } = cellMiddle(cell);
            return (
                <Tooltip key={cell.id} title={cell.name} content={<CellTip cell={cell} />} maxWidth={320}>
                    <polygon
                        role="button"
                        aria-label={cell.name}
                        data-world-cell={cell.id}
                        data-world-state={cell.state}
                        data-world-look={cell.look}
                        data-world-ready={cell.look === CELL_LOOK.READY || undefined}
                        points={tilePoints({ withSide: true })}
                        transform={`translate(${x} ${y})`}
                        fill="transparent"
                        className="cursor-pointer"
                        onPointerEnter={() => onHover(cell.id)}
                        onPointerLeave={() => onHover(null)}
                        onClick={() => {
                            if (dropClick.current) {
                                dropClick.current = false;
                                return;
                            }
                            onSelect(cell.id);
                        }}
                    />
                </Tooltip>
            );
        })}
    </svg>
);

// ------------------------------------------------------------------ the map

/**
 * @param {object} props
 * @param {object} props.view `worldView()`
 * @param {string|null} props.selectedId
 * @param {(id: string) => void} props.onSelect
 * @param {number} [props.reserveRight] the strip on the right under the panel, in px: the map
 *   centres in the room left of it
 * @param {boolean} [props.readOnly] a look only (the new-game screen): no cell is picked or outlined
 * @param {number} [props.scale] the size a parent's CSS scale draws the map at, so a drag keeps up with the pointer
 */
export const WorldMap = ({ view, selectedId = null, onSelect, reserveRight = 0, readOnly = false, scale = 1 }) => {
    const shown = useMemo(
        () => view.cells.filter(c => c.shown).sort((a, b) => cellCentreArt(a).y - cellCentreArt(b).y || a.q - b.q),
        [view]
    );
    const bounds = useMemo(() => mapBounds(shown), [shown]);
    const [picture, setPicture] = useState(null);
    useEffect(() => {
        let live = true;
        // A new world drops the last one's ground at once, rather than show it under the new tiles.
        setPicture(null);
        worldPictures(view).then(p => { if (live) setPicture(p); });
        return () => { live = false; };
    }, [view.seed, view.rings]); // eslint-disable-line react-hooks/exhaustive-deps

    const rootRef = useRef(null);
    const [room, setRoom] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const measure = () => {
            const el = rootRef.current;
            if (!el) return;
            setRoom(r => (r.w === el.clientWidth && r.h === el.clientHeight ? r : { w: el.clientWidth, h: el.clientHeight }));
        };
        measure();
        window.addEventListener('resize', measure);
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        if (ro && rootRef.current) ro.observe(rootRef.current);
        return () => {
            window.removeEventListener('resize', measure);
            ro?.disconnect();
        };
    }, []);
    const sight = { w: Math.max(0, room.w - reserveRight), h: room.h };

    // Where the Hall's middle stands in the window: on the guild's place at first, then dragged.
    const [view0, setView] = useState(null);
    const here = view.cells.find(c => c.here) || view.cells.find(c => c.ring === 0);
    const at = view0 ?? (room.w > 0 ? clampView(viewOn(here, sight), sight, bounds) : { x: 0, y: 0 });
    const atRef = useRef(at);
    atRef.current = at;
    const fitRef = useRef({ sight, bounds });
    fitRef.current = { sight, bounds };
    useEffect(() => {
        setView(v => (v ? clampView(v, fitRef.current.sight, fitRef.current.bounds) : v));
    }, [sight.w, sight.h, bounds]);

    const dropClick = useRef(false);
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        dropClick.current = false;
        const start = { id: e.pointerId, x: e.clientX, y: e.clientY, from: atRef.current, moved: false };
        const move = (ev) => {
            if (ev.pointerId !== start.id) return;
            const dx = (ev.clientX - start.x) / scale;
            const dy = (ev.clientY - start.y) / scale;
            if (!start.moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
            start.moved = true;
            setView(clampView({ x: start.from.x + dx, y: start.from.y + dy }, fitRef.current.sight, fitRef.current.bounds));
        };
        const up = (ev) => {
            if (ev.pointerId !== start.id) return;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
            if (start.moved) dropClick.current = true;
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
    };
    const onWheel = (e) => {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        setView(clampView({ x: atRef.current.x - dx, y: atRef.current.y - dy }, fitRef.current.sight, fitRef.current.bounds));
    };

    const [hoverId, setHoverId] = useState(null);
    const hereCell = shown.find(c => c.here) || null;

    return (
        <div
            ref={rootRef}
            data-world-map
            data-world-rings={view.rings}
            data-world-view={`${at.x},${at.y}`}
            data-world-picture-ms={picture ? Math.round(picture.ms.world) : undefined}
            className="absolute inset-0 overflow-hidden select-none cursor-grab active:cursor-grabbing"
            style={{ background: FOG_CSS }}
            onPointerDown={onPointerDown}
            onWheel={onWheel}
        >
            <div className="absolute left-0 top-0" style={{ transform: `translate3d(${at.x}px, ${at.y}px, 0)` }}>
                <PictureCanvas picture={picture} which="world" data-world-picture />
                <Tiles cells={shown} hoverId={hoverId} />
                <PictureCanvas picture={picture} which="rope" data-world-rope />
                {picture && <RopeArt edges={picture.edges} />}
                {!readOnly && <Outlines cells={shown} hoverId={hoverId} selectedId={selectedId} />}
                <Contents cells={shown} hoverId={hoverId} />
                <HereFlag cell={hereCell} />
                {!readOnly && <HitAreas cells={shown} onSelect={onSelect} onHover={setHoverId} dropClick={dropClick} />}
            </div>
        </div>
    );
};

const DEMO_CELLS = [
    { id: 'demo_settled', q: 0, kit: 'woodland', look: CELL_LOOK.SETTLED, here: true, outputs: ['item_oak_wood'] },
    { id: 'demo_ready', q: 2, kit: 'highland', look: CELL_LOOK.READY, outputs: ['item_copper_ore', 'item_stone', 'item_coal', 'item_clay'] },
    { id: 'demo_dark', q: 4, kit: 'plains', look: CELL_LOOK.DARK, outputs: ['item_wheat'] },
    { id: 'demo_grey', q: 6, kit: 'riverside', look: CELL_LOOK.GREY, outputs: ['item_iron_ore', 'item_fir_wood'] },
    { id: 'demo_hover', q: 8, kit: 'wetland', look: CELL_LOOK.GREY, outputs: ['item_iron_ore'] }
].map(c => ({ ...c, r: -c.q / 2, ring: 1, token: null, name: c.kit, terrain: c.kit, price: { items: [], skills: [], met: true } }));

/** The style sheet's sample: settled with the flag, ready (pulsing), darkened, black and white, and one under the pointer. */
export const WorldCellDemo = () => {
    const w = (DEMO_CELLS.length * 1.5 + 0.5) * HEX_R * ART_SCALE;
    const h = (TILE_H + 8) * ART_SCALE;
    return (
        <div data-kit-world-cells className="relative" style={{ width: w, height: h, background: FOG_CSS }}>
            <div className="absolute" style={{ left: HEX_R * ART_SCALE, top: (TILE_MID.y + TILE_LIFT + 4) * ART_SCALE }}>
                <Tiles cells={DEMO_CELLS} hoverId="demo_hover" />
                <Outlines cells={DEMO_CELLS} hoverId="demo_hover" selectedId={null} />
                <Contents cells={DEMO_CELLS} hoverId="demo_hover" />
                <HereFlag cell={DEMO_CELLS[0]} />
            </div>
        </div>
    );
};

export default WorldMap;
