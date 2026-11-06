import { useMemo, useState } from 'react';
import { t } from '../../../i18n/index.js';
import * as World from '../../../systems/world/World.js';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { CELL_STATE, HALL_CELL } from '../../../systems/world/frontier.js';
import { worldTables } from '../../../config/registries/worldTablesRegistry.js';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import { tutorialTemplate } from '../../../systems/quests/tutorialQuests.js';
import { TUTORIAL_TEXT } from '../../../systems/quests/tutorialText.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { SKILLS } from '../../../config/registries/skillRegistry.js';
import { cn } from '../../utils/cn.js';
import { PixelFrame } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { AtlasButton } from './AtlasButton.jsx';
import { TomeSpread, usePageRects } from './AtlasTome.jsx';
import {
    shownRings, cellRadius, cellCentre, mapSize, hexPoints, iconsPerCell, ICON_PX
} from './worldMapLayout.js';

/**
 * The ground colour of each kit on the map: the look of the place, like a map's terrain colours.
 * ⚠️ Code-drawn stand-ins until the owner's hex art.
 */
export const KIT_COLOUR = Object.freeze({
    highland: '#6e6455',
    woodland: '#3e6a3c',
    plains: '#8b8a45',
    wetland: '#3d6a62',
    riverside: '#3d5f88'
});
const HALL_COLOUR = '#8a6a44';
const DEFAULT_COLOUR = '#5a5a5a';

/** The page's frame and padding on each side, in screen px. */
const PANEL_INSET_PX = 20;
const HERE_FLAG_PX = 24;

const headingCls = 'font-pixel ui-text-small uppercase tracking-wide text-white/60';

const skillName = (id) => SKILLS[id]?.name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : '');
const itemName = (id) => getItem(id)?.name || id;

/** A cell's ring in words: "Ring 2", or "Ring 5, wild". */
function ringWords(cell) {
    if (cell.ring === 0) return t('worldMap.hall');
    return cell.wild ? t('worldMap.wildRing', { ring: cell.ring }) : t('worldMap.ring', { ring: cell.ring });
}

/**
 * The cartographer's words while the tutorial's last step stands on the mat unfinished (the one
 * that opened this map), or null.
 */
function cartographerNote() {
    const step = QuestTokens.tutorialTokens().map(t => t.quest).find(q => tutorialTemplate(q.id)?.opensWorld && !q.done);
    return step ? { speaker: TUTORIAL_TEXT.speaker, title: step.title, says: step.says, instruction: step.instruction } : null;
}

/**
 * Everything the World page shows about the world, read once per refresh: each cell with its
 * state, outputs and price against the Bank and the heroes now. Null with no world.
 */
export function worldView() {
    const world = World.currentWorld();
    if (!world) return null;
    const settled = World.settledCellIds(world);
    const states = World.cellStatesNow(world);
    const here = World.activeCellId();
    const tables = worldTables();
    const cells = world.cells.map(cell => ({
        id: cell.id,
        q: cell.q,
        r: cell.r,
        ring: cell.ring,
        wild: cell.wild,
        kit: cell.kit,
        name: World.cellName(cell, tables),
        kitName: tables.kits.find(k => k.id === cell.kit)?.name || '',
        specialty: cell.specialty,
        state: states.get(cell.id),
        here: cell.id === here,
        outputs: World.outputsOf(cell),
        price: World.priceOf(cell),
        regionId: settled.has(cell.id) ? World.regionIdOfCell(cell.id) : null
    }));
    return { rings: shownRings(world, settled), cells, here, note: cartographerNote() };
}

/** What a cell's price lacks, as words for the disabled Settle: "Short of 3 Copper Ore, Mining 5". */
export function shortWords(price) {
    const parts = [
        ...price.items.filter(r => r.short).map(r => `${(r.need - r.have).toLocaleString('en-US')} ${itemName(r.itemId)}`),
        ...price.skills.filter(r => r.short).map(r => `${skillName(r.skill)} ${r.need}`)
    ];
    return parts.length ? t('worldMap.short', { what: parts.join(', ') }) : null;
}

/** The price as have/need lines (a red count when short): the hover's and the page's. */
const PriceRows = ({ price, compact = false }) => {
    if (!price.items.length && !price.skills.length) {
        return <div className="text-white/60">{t('worldMap.nothingAsked')}</div>;
    }
    if (compact) {
        return (
            <div className="flex flex-col gap-0.5">
                {price.items.map(r => (
                    <div key={r.itemId} data-world-price-item={r.itemId} className="flex items-center gap-1.5">
                        <ItemIcon item={r.itemId} size={32} title={null} />
                        <span className="text-white/85">{itemName(r.itemId)}</span>
                        <span className={cn('ml-auto pl-3 tabular-nums', r.short ? 'text-[var(--color-ui-red)]' : 'text-white')}>
                            {r.have.toLocaleString('en-US')}/{r.need.toLocaleString('en-US')}
                        </span>
                    </div>
                ))}
                {price.skills.map(r => (
                    <div key={r.skill} data-world-price-skill={r.skill} className="flex items-center gap-1.5">
                        <SkillIcon skillId={r.skill} size={32} />
                        <span className="text-white/85">{skillName(r.skill)}</span>
                        <span className={cn('ml-auto pl-3 tabular-nums', r.short ? 'text-[var(--color-ui-red)]' : 'text-white')}>
                            {r.have}/{r.need}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-1">
            {price.items.map(r => (
                <EntityRibbon key={r.itemId} data-world-price-item={r.itemId} kind="item" id={r.itemId} have={r.have} required={r.need} size="sm" wrap />
            ))}
            {price.skills.map(r => (
                <EntityRibbon
                    key={r.skill}
                    data-world-price-skill={r.skill}
                    icon={<SkillIcon skillId={r.skill} size={32} />}
                    name={skillName(r.skill)}
                    have={r.have}
                    required={r.need}
                    size="sm"
                    wrap
                />
            ))}
        </div>
    );
};

/** The hover over a cell: its name and ring, what it yields, and its price with have/need. */
const CellTip = ({ cell }) => (
    <div data-world-tip={cell.id} className="flex flex-col gap-1">
        <div className="text-white/70">{ringWords(cell)}{cell.kitName ? ` · ${cell.kitName}` : ''}</div>
        {cell.outputs.length > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-white/85">
                {cell.outputs.map(id => <span key={id}>{itemName(id)}</span>)}
            </div>
        )}
        {cell.state !== CELL_STATE.SETTLED && (
            <div className="flex flex-col gap-0.5 pt-1 mt-0.5 border-t border-white/10">
                <span className="ui-text-small text-white/55">{t('worldMap.price')}</span>
                <PriceRows price={cell.price} compact />
            </div>
        )}
        <div className="ui-text-small text-white/55">
            {cell.state === CELL_STATE.SETTLED ? (cell.here ? t('worldMap.here') : null)
                : cell.state === CELL_STATE.FRONTIER ? t('worldMap.frontier') : t('worldMap.beyond')}
        </div>
    </div>
);

/** One cell on the map: its hex in its kit's colour, lit when settled, dim beyond the frontier. */
const HexCell = ({ cell, radius, origin, selected, onSelect }) => {
    const { x, y } = cellCentre(cell, radius);
    const cx = origin.x + x;
    const cy = origin.y + y;
    const fill = cell.ring === 0 ? HALL_COLOUR : (KIT_COLOUR[cell.kit] || DEFAULT_COLOUR);
    const settled = cell.state === CELL_STATE.SETTLED;
    const beyond = cell.state === CELL_STATE.BEYOND;
    const ready = cell.state === CELL_STATE.FRONTIER && cell.price.met;
    const edge = selected ? 'var(--color-ui-white)' : ready ? 'var(--color-ui-green)' : settled ? 'var(--color-ui-gold)' : 'rgba(0,0,0,0.55)';
    const icons = iconsPerCell(radius);
    const shown = cell.outputs.slice(0, icons);
    const more = cell.outputs.length - shown.length;
    return (
        <Tooltip title={cell.name} content={<CellTip cell={cell} />} maxWidth={320}>
            <g
                role="button"
                tabIndex={-1}
                aria-label={cell.name}
                aria-pressed={selected}
                data-world-cell={cell.id}
                data-world-state={cell.state}
                data-world-ready={ready || undefined}
                onClick={() => onSelect(cell.id)}
                className="cursor-pointer group"
            >
                <polygon
                    points={hexPoints(radius - 1)}
                    transform={`translate(${cx} ${cy})`}
                    fill={fill}
                    stroke={edge}
                    strokeWidth={selected || ready || settled ? 2 : 1}
                    style={{ filter: settled ? 'none' : beyond ? 'brightness(0.45) saturate(0.6)' : 'brightness(0.8)' }}
                    shapeRendering="crispEdges"
                />
                <polygon
                    points={hexPoints(radius - 3)}
                    transform={`translate(${cx} ${cy})`}
                    fill="none"
                    stroke="var(--color-ui-white)"
                    strokeWidth={1}
                    className="opacity-0 group-hover:opacity-100"
                    shapeRendering="crispEdges"
                />
                <foreignObject x={cx - radius} y={cy - ICON_PX / 2} width={2 * radius} height={ICON_PX} style={{ pointerEvents: 'none', overflow: 'visible' }}>
                    <div className={cn('w-full h-full flex items-center justify-center gap-0.5', beyond && 'opacity-50')}>
                        {shown.map(id => <ItemIcon key={id} item={id} size={ICON_PX} title={null} />)}
                    </div>
                </foreignObject>
                {more > 0 && (
                    <text x={cx} y={cy + ICON_PX / 2 + 11} textAnchor="middle" className="font-pixel ui-text-small" fill="rgba(255,255,255,0.8)" style={{ pointerEvents: 'none' }}>
                        {t('worldMap.more', { count: more })}
                    </text>
                )}
                {cell.here && (
                    <foreignObject x={cx - HERE_FLAG_PX / 2} y={cy - radius * 0.86 - 2} width={HERE_FLAG_PX} height={HERE_FLAG_PX} style={{ pointerEvents: 'none', overflow: 'visible' }}>
                        <span data-world-here className="block leading-none"><FlagMark size={HERE_FLAG_PX} alt={t('worldMap.here')} /></span>
                    </foreignObject>
                )}
            </g>
        </Tooltip>
    );
};

/** The left page: the hex map, fitted to the page's parchment on screen. */
const HexMap = ({ view, selectedId, onSelect }) => {
    const rects = usePageRects();
    const roomW = Math.max(0, Math.floor(rects.left.width - 2 * PANEL_INSET_PX));
    const roomH = Math.max(0, Math.floor(rects.left.height - 2 * PANEL_INSET_PX));
    const radius = cellRadius(view.rings, roomW, roomH);
    const size = mapSize(view.rings, radius);
    const origin = { x: Math.round(size.width / 2), y: Math.round(size.height / 2) };
    const shown = view.cells.filter(c => c.ring <= view.rings);
    return (
        <div data-world-map data-world-rings={view.rings} data-world-radius={radius} className="flex-1 min-h-0 flex items-center justify-center">
            <svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} className="overflow-visible select-none">
                {shown.map(cell => (
                    <HexCell key={cell.id} cell={cell} radius={radius} origin={origin} selected={cell.id === selectedId} onSelect={onSelect} />
                ))}
            </svg>
        </div>
    );
};

/** The cartographer's words over the right page, while the tutorial's last step asks for a place. */
const CartographerNote = ({ note }) => (
    <div data-world-note className="shrink-0 mb-2">
        <PixelFrame kind="studs" backdrop="world" className="flex flex-col" frameClassName="px-2 py-1.5 bg-gi-surface/95 flex flex-col gap-0.5">
            <div className={headingCls}>{note.speaker}</div>
            <div className="font-pixel ui-text-title font-bold text-white">{note.title}</div>
            <div className="font-pixel ui-text-body text-white/85 italic">{note.says}</div>
            <div className="font-pixel ui-text-small text-white/70">{note.instruction}</div>
        </PixelFrame>
    </div>
);

/** The right page: the chosen cell, what it yields, its price, and Settle or Travel. */
const CellPage = ({ cell, onSettle, onTravel, message }) => {
    if (!cell) return <p className="font-pixel ui-text-body text-white/60 bg-black/60 px-2 self-start">{t('worldMap.pickCell')}</p>;
    const region = cell.regionId ? Atlas.getRegion(cell.regionId) : null;
    const settled = cell.state === CELL_STATE.SETTLED;
    const frontier = cell.state === CELL_STATE.FRONTIER;
    const short = frontier ? shortWords(cell.price) : null;
    return (
        <section data-world-detail={cell.id} className="flex-1 min-h-0 flex flex-col">
            <PixelFrame kind="studs" backdrop="world" className="shrink-0 flex flex-col" frameClassName="px-2 py-1.5 bg-gi-surface/95 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <div className="font-pixel ui-text-title font-bold text-white">{cell.name}</div>
                    <div className="flex-1" />
                    {cell.here && <FlagMark size={HERE_FLAG_PX} alt={t('worldMap.here')} />}
                </div>
                <div className="font-pixel ui-text-small text-white/70">{ringWords(cell)}</div>
                {cell.ring > 0 && cell.kitName && (
                    <div className="font-pixel ui-text-small text-white/70">
                        {t('worldMap.kitSpecialty', { kit: cell.kitName, specialty: skillName(cell.specialty) })}
                    </div>
                )}
                <div data-world-detail-state className="font-pixel ui-text-small text-white/85">
                    {settled ? (cell.here ? t('worldMap.here') : t('worldMap.settled', { name: region?.flavourName || '' }))
                        : frontier ? t('worldMap.frontier') : t('worldMap.beyond')}
                </div>
            </PixelFrame>
            <PixelFrame kind="studs" backdrop="world" className="mt-2 flex-1 min-h-0 flex flex-col" frameClassName="flex-1 min-h-0 flex flex-col p-2 bg-gi-surface/95">
                <ArrowScrollList step={80} compact className="flex-1 min-h-0">
                    <div className="flex flex-col gap-2">
                        {cell.outputs.length > 0 && (
                            <div className="flex flex-col gap-1" data-world-yields>
                                <h3 className={headingCls}>{t('worldMap.yields')}</h3>
                                {cell.outputs.map(id => <EntityRibbon key={id} kind="item" id={id} size="sm" wrap />)}
                            </div>
                        )}
                        {!settled && (
                            <div className="flex flex-col gap-1" data-world-price>
                                <h3 className={headingCls}>{t('worldMap.price')}</h3>
                                <PriceRows price={cell.price} />
                            </div>
                        )}
                    </div>
                </ArrowScrollList>
            </PixelFrame>
            <div className="mt-2 shrink-0 flex flex-col items-end gap-1">
                {frontier && (
                    <AtlasButton main data-world-settle={cell.id} disabled={!cell.price.met} onClick={() => onSettle(cell.id)}>{t('worldMap.settle')}</AtlasButton>
                )}
                {settled && !cell.here && cell.regionId && (
                    <AtlasButton main data-world-travel={cell.id} onClick={() => onTravel(cell.regionId)}>{t('worldMap.travel')}</AtlasButton>
                )}
                {(message || short) && (
                    <p role="status" data-world-message className="font-pixel ui-text-small bg-black/80 px-2" style={{ color: 'var(--color-ui-red)' }}>{message || short}</p>
                )}
            </div>
        </section>
    );
};

/**
 * The Atlas's World page: the run's hex world on the left page (`HexMap`), the chosen cell on the
 * right (`CellPage`). A cell's hover shows what it yields and its price against what the guild
 * has; Settle pays it all at once and takes the guild there; a settled place offers Travel. While
 * the tutorial's last step asks for a first place, the cartographer's words head the right page. A
 * save from before the world shows one line instead.
 *
 * @param {object} props
 * @param {number} props.version  moves on whenever the world, the Bank or the heroes may have changed
 * @param {(cellId: string) => Promise<object>} props.onSettle  settles the cell and closes the book on success
 * @param {(regionId: string) => void} props.onTravel
 */
export const WorldPage = ({ version, onSettle, onTravel }) => {
    const view = useMemo(() => worldView(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const [chosen, setChosen] = useState(null);
    const [message, setMessage] = useState(null);
    if (!view) {
        return (
            <div data-world-page="none" className="absolute inset-0">
                <TomeSpread left={<p data-world-none className="font-pixel ui-text-body text-white bg-black/70 px-2 py-1 self-start">{t('worldMap.noWorld')}</p>} right={null} />
            </div>
        );
    }
    const selectedId = chosen && view.cells.some(c => c.id === chosen) ? chosen : (view.here || HALL_CELL);
    const cell = view.cells.find(c => c.id === selectedId) || null;
    const select = (id) => {
        if (id !== selectedId) setMessage(null);
        setChosen(id);
    };
    const settle = async (id) => {
        const result = await onSettle(id);
        setMessage(result?.success ? null : (result?.reason ?? null));
    };
    return (
        <div data-world-page className="absolute inset-0">
            <TomeSpread
                left={<HexMap view={view} selectedId={selectedId} onSelect={select} />}
                right={(
                    <>
                        {view.note && <CartographerNote note={view.note} />}
                        <CellPage cell={cell} onSettle={settle} onTravel={onTravel} message={message} />
                    </>
                )}
            />
        </div>
    );
};

const DEMO_PRICE = (met) => ({ items: [{ itemId: 'item_oak_wood', need: 20, have: met ? 20 : 7, short: !met }], skills: [], met });
const DEMO_CELLS = [
    { id: 'demo_settled', q: 0, r: 0, ring: 1, kit: 'woodland', state: CELL_STATE.SETTLED, here: true, outputs: ['item_oak_wood'], price: DEMO_PRICE(true) },
    { id: 'demo_ready', q: 2, r: -1, ring: 1, kit: 'highland', state: CELL_STATE.FRONTIER, outputs: ['item_copper_ore', 'item_stone', 'item_coal'], price: DEMO_PRICE(true) },
    { id: 'demo_frontier', q: 4, r: -2, ring: 1, kit: 'plains', state: CELL_STATE.FRONTIER, outputs: ['item_wheat'], price: DEMO_PRICE(false) },
    { id: 'demo_beyond', q: 6, r: -3, ring: 2, kit: 'riverside', state: CELL_STATE.BEYOND, outputs: ['item_iron_ore', 'item_fir_wood'], price: DEMO_PRICE(false) }
].map(c => ({ ...c, name: c.kit, kitName: c.kit, wild: false, specialty: null, regionId: null }));

/** The style sheet's sample: a settled cell with the flag, a frontier cell ready, one short, one beyond. */
export const HexCellDemo = () => {
    const radius = 46;
    const [chosen, setChosen] = useState('demo_frontier');
    return (
        <svg data-kit-world-cells width={radius * 11} height={radius * 2} className="overflow-visible">
            {DEMO_CELLS.map(cell => (
                <HexCell key={cell.id} cell={cell} radius={radius} origin={{ x: radius, y: radius }} selected={cell.id === chosen} onSelect={setChosen} />
            ))}
        </svg>
    );
};

export default WorldPage;
