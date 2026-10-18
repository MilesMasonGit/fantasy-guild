import { useEffect, useState } from 'react';
import { Check, Swords } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as FlagRules from '../../../systems/board/FlagRules.js';
import { GameState } from '../../../state/GameState.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { skillLevelText } from './heroPanelSkills.js';
import { DOCK_STRIP_PX } from './dockHeroView.js';
import {
    MAX_ROWS, ruleGroups, isRuleColumn, columnName, columnPurpose, cellOf, clickCell, toggleRow, toggleColumn,
    tintLightness, levelTint, highlightHero
} from './workRules.js';

/** The drawer's slide-down (`duration-200`), plus a little slack, before it unmounts. */
const DRAWER_CLOSE_MS = 250;
const ROW_PX = 30;
const HEADER_ROW_PX = 40;
const NAME_PX = 150;
const GEAR_SRC = '/assets/ui/u_gear.png';
/** The gear sprite's own size: it draws at 1×. */
const GEAR_PX = 32;

/** The launcher's slot width at the hero bar's left end; the heroes start after it. */
export const LAUNCHER_PX = 136;

/** The name a player reads for the rules grid, everywhere. */
export const WORK_PERMISSIONS = 'Work Permissions';

/**
 * The hero bar's Work Permissions launcher: its own framed slot at the bar's left end, the gear
 * and the label, with a divider before the heroes. The only way to the grid. Toggles the drawer.
 */
export const WorkRulesButton = ({ open = false, onToggle }) => (
    <div
        data-work-rules-slot
        className="absolute left-0 top-0 bottom-0 z-50 flex items-stretch p-1 border-r border-white/15"
        style={{ width: LAUNCHER_PX }}
    >
        <Tooltip title={WORK_PERMISSIONS} lines={['Which skills each hero works, and in what order.']}>
            <button
                type="button"
                data-work-rules-button
                aria-pressed={open ? 'true' : 'false'}
                aria-label={WORK_PERMISSIONS}
                // ⚠️ Stops the press reaching the bar's drop zone and any hero under it.
                onPointerDown={e => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                className={cn(
                    'flex-1 min-w-0 flex items-center gap-1.5 px-1.5 rounded-md border cursor-pointer transition-colors',
                    open ? 'border-ui-gold/70 bg-white/10' : 'border-white/15 bg-black/30 hover:border-ui-white/60'
                )}
            >
                <img
                    src={GEAR_SRC}
                    alt=""
                    draggable={false}
                    className="shrink-0 pointer-events-none"
                    style={{ width: GEAR_PX, height: GEAR_PX, imageRendering: 'pixelated' }}
                />
                <span className={cn('ui-text-small font-bold leading-tight text-left', open ? 'text-ui-gold' : 'text-white')}>
                    Work<br />Permissions
                </span>
            </button>
        </Tooltip>
    </div>
);

/** Re-render on anything that changes a hero, a rule or a level. Only while the drawer is mounted. */
function useHeroesRefresh() {
    const [, bump] = useState(0);
    useEffect(() => {
        const tick = () => bump(n => n + 1);
        const events = [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.STATE_CHANGED, ENGINE_EVENTS.HERO_LEVELED, ENGINE_EVENTS.HERO_PROMOTED];
        const unsubs = events.filter(Boolean).map(e => EventBus.subscribe(e, tick, UI_LISTENER));
        return () => unsubs.forEach(u => u());
    }, []);
}

/**
 * The Work Permissions grid, in a drawer that slides up from behind the hero bar, the full width
 * of the mat: one row per hero, one column per work skill, then Combat. Open until the launcher or
 * Escape closes it; the mat stays usable. Rules go through `Flags.setRule`, so the engine sees
 * nothing new.
 */
export const WorkRulesDrawer = ({ open = false, litHeroId = null, onClose }) => {
    const engine = useEngine();
    const [mounted, setMounted] = useState(open);
    const [entered, setEntered] = useState(false);

    // ⚠️ Unmounted after its slide-down: dnd-kit ignores opacity and pointer-events, so a closed
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

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (e) => {
            // One Escape, one layer: while a drag is live, Escape only cancels it.
            if (e.key === 'Escape' && !document.body.classList.contains('gi-dnd-active')) onClose?.();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    // A hero or flag dropped on the open drawer goes home, anything else is a miss rather than
    // landing on the mat hidden under it.
    const recall = useEntityDrop({
        id: 'work-rules-drop',
        surface: DND_SURFACE.DRAWER,
        accepts: isRecallDrop,
        onDrop: p => recallFromDrop(engine?.BoardPlacement, p),
        disabled: !mounted
    });

    if (!mounted) return null;

    return (
        <div
            ref={recall.setNodeRef}
            {...recall.droppableProps}
            data-work-rules-drawer
            data-dnd-region={DND_SURFACE.DRAWER}
            onContextMenu={e => e.preventDefault()}
            style={{ bottom: DOCK_STRIP_PX }}
            className="absolute left-0 right-0 z-[45] overflow-hidden pointer-events-auto select-none"
        >
            <div
                className={cn(
                    'rounded-t-lg border border-b-0 bg-[#140e0b]/95 shadow-[0_0_24px_rgba(0,0,0,0.6)] transition-[transform,opacity] duration-200 ease-out',
                    recall.valid ? 'border-gi-success/70' : 'border-white/10',
                    open && entered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                )}
            >
                <RulesGrid litHeroId={litHeroId} />
            </div>
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
    // Hero names take a fixed width; the columns share the rest evenly, whatever their count.
    const template = `${NAME_PX}px repeat(${columns.length}, minmax(0, 1fr))`;
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
                    const portrait = resolveSpritePath(hero.spriteId || 'hn_recruit_por');
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
                                    {portrait && (
                                        <img
                                            src={portrait.startsWith('/') ? portrait : `/${portrait}`}
                                            alt=""
                                            draggable={false}
                                            className="w-6 h-6 shrink-0 object-contain"
                                            style={{ imageRendering: 'pixelated' }}
                                        />
                                    )}
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
