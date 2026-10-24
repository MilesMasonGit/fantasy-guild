import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Swords } from 'lucide-react';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { cn } from '../../utils/cn.js';
import * as Placement from '../../../systems/board/Placement.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as FlagRules from '../../../systems/board/FlagRules.js';
import { GameState } from '../../../state/GameState.js';
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { useHeroPortrait } from './heroPortrait.js';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { skillLevelText } from './heroPanelSkills.js';
import { DOCK_STRIP_PX } from './dockHeroView.js';
import {
    MAX_ROWS, ruleGroups, columnName, columnPurpose, cellOf, clickCell, toggleRow, toggleColumn,
    tintLightness, levelTint, highlightHero
} from './workRules.js';

/** The drawer's slide away (`duration-200`), plus a little slack, before it unmounts. */
const DRAWER_CLOSE_MS = 250;
/** Every skill cell, header cells included, is this square; 32 px fits the skill icon. */
export const CELL_PX = 32;
const ROW_PX = CELL_PX;
const HEADER_ROW_PX = CELL_PX;
const NAME_PX = 150;
const GEAR_SRC = '/assets/ui/u_gear.png';
/** The gear sprite's own size: it draws at 1×. */
const GEAR_PX = 32;

/** The launcher's slot width at the hero bar's left end, inside the mat's edges; the heroes start after it. */
export const LAUNCHER_PX = 160;

/** The name a player reads for the rules grid, everywhere. */
export const WORK_PERMISSIONS = 'Work Permissions';

/**
 * The hero bar's Work Permissions launcher: a solid chamfer-framed button at the bar's left end,
 * under the mat's left edge, with the gear and the label. The only way to the grid. Toggles the
 * drawer; it reads gold while the drawer is open and sinks into its shadow while pressed.
 */
export const WorkRulesButton = ({ open = false, onToggle }) => (
    <div
        data-work-rules-slot
        className="absolute left-0 top-0 bottom-0 z-50 flex items-center pl-1 pr-2"
        style={{ width: LAUNCHER_PX }}
        // ⚠️ Stops the press reaching the bar's drop zone and any hero under it.
        onPointerDown={e => e.stopPropagation()}
    >
        <Tooltip title={WORK_PERMISSIONS} lines={['Which skills each hero works, and in what order.']}>
            <PixelFrame kind={FRAME_KIND.CHAMFER} className="group flex-1 min-w-0" frameClassName="group-active:translate-x-[4px] group-active:translate-y-[4px]">
                <button
                    type="button"
                    data-work-rules-button
                    aria-pressed={open ? 'true' : 'false'}
                    aria-label={WORK_PERMISSIONS}
                    onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                    className="ui-shine w-full flex items-center gap-1.5 pr-1 cursor-pointer"
                >
                    <img
                        src={GEAR_SRC}
                        alt=""
                        draggable={false}
                        className="shrink-0 pointer-events-none"
                        style={{ width: GEAR_PX, height: GEAR_PX, imageRendering: 'pixelated' }}
                    />
                    <span className={cn('ui-text-small font-bold leading-tight text-left', open ? 'text-ui-gold' : 'text-ui-white')}>
                        Work<br />Permissions
                    </span>
                </button>
            </PixelFrame>
        </Tooltip>
    </div>
);

/**
 * How far the hero panel intrudes into the mat column from each side, in px, so the drawer can
 * centre on what is left visible. Zero for a missing panel or one that does not overlap.
 */
export function drawerInsets(columnRect, panelRect) {
    const none = { left: 0, right: 0 };
    if (!columnRect || !panelRect) return none;
    const onRight = panelRect.left + panelRect.right > columnRect.left + columnRect.right;
    if (onRight) return { left: 0, right: Math.max(0, Math.min(columnRect.right - panelRect.left, columnRect.right - columnRect.left)) };
    return { left: Math.max(0, Math.min(panelRect.right - columnRect.left, columnRect.right - columnRect.left)), right: 0 };
}

/** Re-render on anything that changes a hero, a rule or a level. Only while the drawer is mounted. */
function useHeroesRefresh() {
    const [, bump] = useState(0);
    useEffect(() => {
        const tick = () => bump(n => n + 1);
        const events = [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET, ENGINE_EVENTS.HERO_LEVELED, ENGINE_EVENTS.HERO_PROMOTED];
        const unsubs = events.filter(Boolean).map(e => EventBus.subscribe(e, tick, UI_LISTENER));
        return () => unsubs.forEach(u => u());
    }, []);
}

/**
 * The Work Permissions grid, in a chamfer-framed drawer that slides up from below the hero bar
 * and rests on it, as wide as its content and no wider than the mat: one row per hero, Combat
 * first, then one column per work skill. Open until the launcher or
 * Escape closes it; the mat stays usable. Rules go through `Flags.setRule`, so the engine sees
 * nothing new.
 */
export const WorkRulesDrawer = ({ open = false, heroPanelOpen = false, litHeroId = null, onClose }) => {
    const drawerRef = useRef(null);
    const [insets, setInsets] = useState({ left: 0, right: 0 });
    const [mounted, setMounted] = useState(open);
    const [entered, setEntered] = useState(false);

    // ⚠️ Unmounted after it slides away: dnd-kit ignores opacity and pointer-events, so a closed
    // drawer left mounted would still catch drops inside its box.
    useEffect(() => {
        if (open) {
            setMounted(true);
            const t = setTimeout(() => setEntered(true), 16);
            return () => clearTimeout(t);
        }
        setEntered(false);
        const t = setTimeout(() => setMounted(false), DRAWER_CLOSE_MS);
        return () => clearTimeout(t);
    }, [open]);

    useEscapeLayer(!!open, () => onClose?.());

    // A hero or flag dropped on the open drawer goes home, anything else is a miss rather than
    // landing on the mat hidden under it.
    const recall = useEntityDrop({
        id: 'work-rules-drop',
        surface: DND_SURFACE.DRAWER,
        accepts: isRecallDrop,
        onDrop: p => recallFromDrop(Placement, p),
        disabled: !mounted
    });

    // Centred on the part of the mat column the hero panel leaves visible. ⚠️ The panel mounts a
    // render after its id is set, so a missing panel is looked for again shortly.
    useLayoutEffect(() => {
        const column = drawerRef.current?.parentElement;
        if (!mounted || !column) return undefined;
        let timer = 0;
        let tries = 0;
        let observed = null;
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
        function measure() {
            const panel = heroPanelOpen ? document.querySelector('[data-hero-panel]') : null;
            if (heroPanelOpen && !panel && tries++ < 10) {
                timer = setTimeout(measure, 30);
                return;
            }
            if (panel && panel !== observed) {
                observed = panel;
                observer?.observe(panel);
            }
            const next = panel ? drawerInsets(column.getBoundingClientRect(), panel.getBoundingClientRect()) : { left: 0, right: 0 };
            setInsets(prev => (prev.left === next.left && prev.right === next.right ? prev : next));
        }
        observer?.observe(column);
        measure();
        window.addEventListener('resize', measure);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', measure);
            observer?.disconnect();
        };
    }, [mounted, heroPanelOpen]);

    if (!mounted) return null;

    return (
        <div
            ref={(node) => { drawerRef.current = node; recall.setNodeRef(node); }}
            {...recall.droppableProps}
            data-work-rules-drawer
            data-dnd-region={DND_SURFACE.DRAWER}
            onContextMenu={e => e.preventDefault()}
            style={{
                bottom: DOCK_STRIP_PX,
                left: insets.left,
                right: insets.right,
                maxWidth: `calc(100% - ${insets.left + insets.right}px)`
            }}
            className="absolute mx-auto w-max z-45 pointer-events-auto select-none"
        >
            {/* Closed, it waits below the bottom of the screen (the column clips it there) and
                rises past the hero bar into place. */}
            <PixelFrame
                kind={FRAME_KIND.CHAMFER}
                data-work-rules-panel
                className="transition-transform duration-200 ease-out motion-reduce:transition-none"
                frameClassName={cn(recall.valid && 'outline-2 outline-gi-success/70')}
                style={{ transform: open && entered ? 'translateY(0)' : `translateY(calc(100% + ${DOCK_STRIP_PX + 8}px))` }}
            >
                <RulesGrid litHeroId={litHeroId} />
            </PixelFrame>
        </div>
    );
};

const RulesGrid = ({ litHeroId }) => {
    useHeroesRefresh();
    const [priorityMode, setPriorityMode] = useState(false);
    const [hoverRow, setHoverRow] = useState(null);

    useEffect(() => () => highlightHero(null), []);

    const heroes = (GameState.state?.heroes || []).filter(h => h?.id);
    const heroIds = heroes.map(h => h.id);
    const groups = ruleGroups();
    const columns = groups.flatMap(g => g.columns);
    const groupStarts = new Set(groups.slice(1).map(g => g.columns[0]));
    // Hero names take a fixed width and every column is one square cell wide, so the drawer is
    // only as wide as its content.
    const template = `${NAME_PX}px repeat(${columns.length}, ${CELL_PX}px)`;
    const shown = Math.min(heroes.length, MAX_ROWS);
    const hairline = (columnId) => (groupStarts.has(columnId) ? 'border-l border-white/15' : '');

    return (
        <div className="flex flex-col text-gi-text" data-rules-priority-mode={priorityMode ? 'true' : 'false'}>
            <div className="flex items-center gap-4 px-2 pt-1.5 pb-1">
                <span data-rules-title className="ui-text-title font-bold text-ui-gold">{WORK_PERMISSIONS}</span>
                <button
                    type="button"
                    data-rules-mode
                    aria-pressed={priorityMode ? 'true' : 'false'}
                    onClick={() => setPriorityMode(m => !m)}
                    className="flex items-center gap-1.5 ui-text-small font-bold text-ui-muted hover:text-ui-white transition-colors cursor-pointer"
                >
                    <span className={cn('relative w-6 h-3 rounded-full transition-colors', priorityMode ? 'bg-gi-gold/80' : 'bg-white/15')}>
                        <span className={cn('absolute top-0.5 w-2 h-2 rounded-full bg-white transition-[left]', priorityMode ? 'left-3.5' : 'left-0.5')} />
                    </span>
                    Priorities
                </button>
                <span className="ml-auto ui-text-small text-ui-muted">Click: up · Right-click: down</span>
            </div>

            {/* Group headers, then one header per column. */}
            <div className="grid" style={{ gridTemplateColumns: template }}>
                <span />
                {groups.map(g => (
                    <span
                        key={g.id}
                        data-rules-group={g.id}
                        style={{ gridColumn: `span ${g.columns.length}` }}
                        className={cn('px-1 ui-text-small font-bold text-ui-muted truncate', g.id !== groups[0].id && 'border-l border-white/15')}
                    >
                        {g.name}
                    </span>
                ))}
            </div>
            <div className="grid border-b border-white/10" style={{ gridTemplateColumns: template, height: HEADER_ROW_PX }}>
                <span />
                {columns.map(columnId => (
                    <Tooltip key={columnId} title={columnName(columnId)} lines={[columnPurpose(columnId)]}>
                        <button
                            type="button"
                            data-rules-col={columnId}
                            data-group-start={groupStarts.has(columnId) ? 'true' : undefined}
                            aria-label={columnName(columnId)}
                            onClick={() => toggleColumn(heroIds, columnId)}
                            className={cn('min-w-0 flex items-center justify-center cursor-pointer hover:bg-white/10', hairline(columnId))}
                        >
                            {columnId === FlagRules.FIGHT
                                ? <Swords size={24} className="text-ui-gold" />
                                : <SkillIcon skillId={columnId} size={32} title={null} />}
                        </button>
                    </Tooltip>
                ))}
            </div>

            <div
                data-rules-body
                data-rows-shown={shown}
                className={heroes.length > MAX_ROWS ? 'overflow-y-auto gi-scrollbar' : undefined}
                style={heroes.length > MAX_ROWS ? { maxHeight: MAX_ROWS * ROW_PX } : undefined}
            >
                {heroes.map(hero => {
                    const lit = hero.id === litHeroId;
                    return (
                        <div
                            key={hero.id}
                            data-rules-row={hero.id}
                            data-rules-lit={lit ? 'true' : undefined}
                            onMouseEnter={() => { setHoverRow(hero.id); highlightHero(hero.id); }}
                            onMouseLeave={() => { setHoverRow(null); highlightHero(null); }}
                            className={cn('grid', lit ? 'bg-gi-gold/15' : hoverRow === hero.id && 'bg-white/5')}
                            style={{ gridTemplateColumns: template, height: ROW_PX }}
                        >
                            <Tooltip title={hero.name} lines={['Click to allow or disallow every skill.']}>
                                <button
                                    type="button"
                                    data-rules-row-header
                                    onClick={() => toggleRow(hero.id)}
                                    className="flex items-center gap-1.5 px-1.5 min-w-0 text-left cursor-pointer hover:bg-white/10"
                                >
                                    <RowPortrait hero={hero} />
                                    <span className={cn('truncate ui-text-body font-bold', lit ? 'text-ui-gold' : 'text-white')}>{hero.name}</span>
                                </button>
                            </Tooltip>
                            {columns.map(columnId => (
                                <RuleCell
                                    key={columnId}
                                    hero={hero}
                                    columnId={columnId}
                                    priorityMode={priorityMode}
                                    hairline={hairline(columnId)}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/** A row header's portrait: the hero bar's cut at 1x (its art size), or the still portrait turned left. */
const RowPortrait = ({ hero }) => {
    const sprite = hero.spriteId || hero.classId || null;
    const sheet = sprite ? resolveAnimationPath(sprite) : null;
    const cut = useHeroPortrait(sheet);
    const still = sheet ? null : resolveSpritePath(sprite || 'hn_recruit_por');
    const src = cut || (still ? (still.startsWith('/') ? still : `/${still}`) : null);
    return (
        <span data-rules-row-portrait={sheet || still || undefined} className="w-6 h-6 shrink-0">
            {src && (
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="w-6 h-6 object-contain"
                    style={{ imageRendering: 'pixelated', transform: cut ? undefined : 'scaleX(-1)' }}
                />
            )}
        </span>
    );
};

/** One hero's one column: blank if not held, else a level tint with a tick or a number. */
const RuleCell = ({ hero, columnId, priorityMode, hairline }) => {
    const cell = cellOf(hero.id, columnId);
    const id = `${hero.id}:${columnId}`;
    if (!cell.held || !cell.rule) {
        return <span data-rules-cell={id} data-cell="missing" aria-disabled="true" className={cn('m-px bg-black/40 opacity-50', hairline)} />;
    }
    return (
        <Tooltip title={hero.name} lines={[`${columnName(columnId)} ${skillLevelText(cell.level)}`]}>
            <span
                role="button"
                data-rules-cell={id}
                data-cell="rule"
                data-cell-on={cell.allowed ? 'true' : 'false'}
                data-cell-priority={cell.allowed ? cell.priority : undefined}
                data-cell-tint={tintLightness(cell.level)}
                onClick={() => clickCell(hero.id, columnId, 'up', priorityMode)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    clickCell(hero.id, columnId, 'down', priorityMode);
                }}
                className={cn(
                    'm-px flex items-center justify-center cursor-pointer ui-text-body font-bold tabular-nums text-white hover:brightness-125',
                    hairline
                )}
                style={{ backgroundColor: levelTint(cell.level), textShadow: '0 1px 2px #000' }}
            >
                {cell.allowed && (priorityMode
                    ? cell.priority
                    : <Check data-cell-tick size={16} strokeWidth={3} />)}
            </span>
        </Tooltip>
    );
};

export default WorkRulesDrawer;
