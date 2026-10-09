import { useEffect, useRef, useState } from 'react';
import { Check, Swords } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as FlagRules from '../../../systems/board/FlagRules.js';
import { GameState } from '../../../state/GameState.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { TopBarTip } from '../board/TopBarTip.jsx';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { skillLevelText } from './heroPanelSkills.js';
import { DOCK_STRIP_PX } from './dockHeroView.js';
import {
    MAX_ROWS, ruleGroups, isRuleColumn, columnName, cellOf, clickCell, toggleRow, toggleColumn,
    tintLightness, levelTint, highlightHero
} from './workRules.js';

/** The drawer's slide-down (`duration-200`), plus a little slack, before it unmounts. */
const DRAWER_CLOSE_MS = 250;
const ROW_PX = 26;
const COL_PX = 24;
const HEADER_PX = 136;
const GEAR_SRC = '/assets/ui/ui_gear.png';

/**
 * The hero bar's Work Rules button (the Stations' orange gear) at the bar's left end: the only
 * way to the rules grid. Toggles the drawer.
 */
export const WorkRulesButton = ({ open = false, onToggle }) => {
    const ref = useRef(null);
    const [hovered, setHovered] = useState(false);
    return (
        <>
            <button
                ref={ref}
                type="button"
                data-work-rules-button
                aria-pressed={open ? 'true' : 'false'}
                aria-label="Work rules"
                // ⚠️ Stops the press reaching the bar's drop zone and any hero under it.
                onPointerDown={e => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={cn(
                    'absolute left-2 top-1/2 -translate-y-1/2 z-50 w-10 h-10 flex items-center justify-center rounded-md cursor-pointer',
                    'filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] transition-transform duration-150 hover:scale-110 active:scale-95',
                    open && 'bg-white/10'
                )}
            >
                <img src={GEAR_SRC} alt="" draggable={false} className="w-7 h-7 pointer-events-none" style={{ imageRendering: 'pixelated' }} />
            </button>
            {hovered && <TopBarTip anchor={ref.current} title="Work rules" lines={['Which skills each hero works, and in what order.']} width={200} />}
        </>
    );
};

/** The hero panel's small "Work rules" link: opens the drawer with this hero's row lit. */
export const WorkRulesLink = ({ heroId }) => (
    <button
        type="button"
        data-hero-panel-rules
        onClick={(e) => {
            e.stopPropagation();
            EventBus.publish(UI_EVENTS.UI_OPEN_FLAG_RULES, { heroId });
        }}
        className="self-start flex items-center gap-1 text-[10px] font-bold text-gi-muted hover:text-gi-gold transition-colors"
    >
        <img src={GEAR_SRC} alt="" draggable={false} className="w-3 h-3" style={{ imageRendering: 'pixelated' }} />
        Work rules
    </button>
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
 * The work rules grid, in a drawer that rises from behind the hero bar: one row per hero, one
 * column per skill, then Fight. Open until the button or Escape closes it; the mat stays usable.
 * Rules go through `Flags.setRule`, so the engine sees nothing new.
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
            className="absolute left-2 z-[45] overflow-hidden pointer-events-auto select-none"
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
    const [tip, setTip] = useState(null);
    const [hoverRow, setHoverRow] = useState(null);

    useEffect(() => () => highlightHero(null), []);

    const heroes = (GameState.state?.heroes || []).filter(h => h?.id);
    const heroIds = heroes.map(h => h.id);
    const groups = ruleGroups();
    const columns = groups.flatMap(g => g.columns);
    const groupStarts = new Set(groups.slice(1).map(g => g.columns[0]));
    const template = `${HEADER_PX}px repeat(${columns.length}, ${COL_PX}px)`;
    const shown = Math.min(heroes.length, MAX_ROWS);

    const showTip = (el, title, lines) => setTip({ el, title, lines });
    const hideTip = () => setTip(null);
    const hairline = (columnId) => (groupStarts.has(columnId) ? 'border-l border-white/15' : '');

    return (
        <div className="flex flex-col text-gi-text" data-rules-priority-mode={priorityMode ? 'true' : 'false'}>
            <div className="flex items-center gap-3 px-2 pt-1.5 pb-1">
                <span className="text-[11px] font-bold gi-caps tracking-wider text-gi-muted">Work rules</span>
                <button
                    type="button"
                    data-rules-mode
                    aria-pressed={priorityMode ? 'true' : 'false'}
                    onClick={() => setPriorityMode(m => !m)}
                    className="flex items-center gap-1.5 text-[10px] font-bold gi-caps text-gi-muted hover:text-gi-text transition-colors cursor-pointer"
                >
                    <span className={cn('relative w-6 h-3 rounded-full transition-colors', priorityMode ? 'bg-gi-gold/80' : 'bg-white/15')}>
                        <span className={cn('absolute top-0.5 w-2 h-2 rounded-full bg-white transition-[left]', priorityMode ? 'left-3.5' : 'left-0.5')} />
                    </span>
                    Priorities
                </button>
                <span className="ml-auto text-[10px] text-gi-muted/80">Click: up · Right-click: down</span>
            </div>

            {/* Group headers, then one header per column. */}
            <div className="grid" style={{ gridTemplateColumns: template }}>
                <span />
                {groups.map(g => (
                    <span
                        key={g.id}
                        data-rules-group={g.id}
                        style={{ gridColumn: `span ${g.columns.length}` }}
                        className={cn('px-1 text-[9px] font-bold gi-caps tracking-wider text-gi-muted truncate', g.id !== groups[0].id && 'border-l border-white/15')}
                    >
                        {g.name}
                    </span>
                ))}
            </div>
            <div className="grid border-b border-white/10" style={{ gridTemplateColumns: template, height: ROW_PX }}>
                <span />
                {columns.map(columnId => {
                    const rule = isRuleColumn(columnId);
                    return (
                        <button
                            key={columnId}
                            type="button"
                            data-rules-col={columnId}
                            data-group-start={groupStarts.has(columnId) ? 'true' : undefined}
                            onClick={() => { if (rule) toggleColumn(heroIds, columnId); }}
                            onMouseEnter={e => showTip(e.currentTarget, columnName(columnId), [
                                rule ? 'Click to allow or disallow for every hero.' : 'Level only. Fighting is the Fight column.'
                            ])}
                            onMouseLeave={hideTip}
                            className={cn('flex items-center justify-center', rule ? 'cursor-pointer hover:bg-white/10' : 'cursor-default', hairline(columnId))}
                        >
                            {columnId === FlagRules.FIGHT
                                ? <Swords size={14} className="text-gi-gold" />
                                : <SkillIcon skillId={columnId} size={16} />}
                        </button>
                    );
                })}
            </div>

            <div
                data-rules-body
                data-rows-shown={shown}
                className={heroes.length > MAX_ROWS ? 'overflow-y-auto gi-scrollbar' : undefined}
                style={heroes.length > MAX_ROWS ? { maxHeight: MAX_ROWS * ROW_PX } : undefined}
            >
                {heroes.map(hero => {
                    const lit = hero.id === litHeroId;
                    const portrait = resolveSpritePath(hero.spriteId || 'hero_recruit_0');
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
                            <button
                                type="button"
                                data-rules-row-header
                                onClick={() => toggleRow(hero.id)}
                                onMouseEnter={e => showTip(e.currentTarget, hero.name, ['Click to allow or disallow every skill.'])}
                                onMouseLeave={hideTip}
                                className="flex items-center gap-1.5 px-1.5 min-w-0 text-left cursor-pointer hover:bg-white/10"
                            >
                                {portrait && (
                                    <img
                                        src={portrait.startsWith('/') ? portrait : `/${portrait}`}
                                        alt=""
                                        draggable={false}
                                        className="w-5 h-5 shrink-0 object-contain"
                                        style={{ imageRendering: 'pixelated' }}
                                    />
                                )}
                                <span className={cn('truncate text-[11px] font-bold', lit ? 'text-gi-gold' : 'text-white')}>{hero.name}</span>
                            </button>
                            {columns.map(columnId => (
                                <RuleCell
                                    key={columnId}
                                    hero={hero}
                                    columnId={columnId}
                                    priorityMode={priorityMode}
                                    hairline={hairline(columnId)}
                                    onTip={showTip}
                                    onTipEnd={hideTip}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>
            {tip && <TopBarTip anchor={tip.el} title={tip.title} lines={tip.lines} width={180} />}
        </div>
    );
};

/** One hero's one skill: blank if not held, a tint if a combat skill, else a tick or a number. */
const RuleCell = ({ hero, columnId, priorityMode, hairline, onTip, onTipEnd }) => {
    const cell = cellOf(hero.id, columnId);
    const id = `${hero.id}:${columnId}`;
    if (!cell.held) {
        return <span data-rules-cell={id} data-cell="missing" aria-disabled="true" className={cn('m-px bg-black/40 opacity-50', hairline)} />;
    }
    const tint = {
        'data-cell-tint': tintLightness(cell.level),
        style: { backgroundColor: levelTint(cell.level) },
        onMouseEnter: e => onTip(e.currentTarget, hero.name, [`${columnName(columnId)} ${skillLevelText(cell.level)}`]),
        onMouseLeave: onTipEnd
    };
    if (!cell.rule) {
        return <span data-rules-cell={id} data-cell="level" {...tint} className={cn('m-px', hairline)} />;
    }
    return (
        <span
            role="button"
            data-rules-cell={id}
            data-cell="rule"
            data-cell-on={cell.allowed ? 'true' : 'false'}
            data-cell-priority={cell.allowed ? cell.priority : undefined}
            {...tint}
            onClick={() => clickCell(hero.id, columnId, 'up', priorityMode)}
            onContextMenu={(e) => {
                e.preventDefault();
                clickCell(hero.id, columnId, 'down', priorityMode);
            }}
            className={cn(
                'm-px flex items-center justify-center cursor-pointer text-[11px] font-bold tabular-nums text-white hover:brightness-125',
                hairline
            )}
            style={{ ...tint.style, textShadow: '0 1px 2px #000' }}
        >
            {cell.allowed && (priorityMode
                ? cell.priority
                : <Check data-cell-tick size={14} strokeWidth={3} />)}
        </span>
    );
};

export default WorkRulesDrawer;
