import { useEffect, useState } from 'react';
import { Swords, RotateCcw, X } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as FlagRules from '../../../systems/board/FlagRules.js';
import { flagColourOf } from '../../../systems/board/FlagColours.js';
import { GameState } from '../../../state/GameState.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { flagTooltip } from '../board/flagText.js';
import { STATE_TONE } from '../board/FlagLayer.jsx';
import { skillLevelText } from '../dock/heroPanelSkills.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * FlagRulesPanel: one hero's work rules, filling the side panel (`HeroRulesSidePanel`).
 * * **Header**: the hero's flag and name, what they are doing and up to five Tokens their flag
 * passed over (every reason). Re-read twice a second, because skips change without an event.
 * * **One line per `FlagRules.rowsFor`**: every held work skill, then Fight for a hero who can
 * fight. Allowed and a priority 1–5 (1 is highest, 3 the default); the rule the hero is working
 * now is tinted. Both call `Flags.setRule`.
 * * **Copy rules to…**: the other heroes with checkboxes; `Flags.copyRules` skips the rules a
 * target does not hold, and the panel says which.
 * * **Reset to defaults**: `Flags.resetRules`.
 * The rules live on the hero, so a recalled or defeated hero's panel stays editable and reads
 * 'In the Guild'. A hero who no longer exists shows 'Hero gone'.
 */
export const FlagRulesPanel = ({ heroId, onClose }) => {
    const [, refresh] = useState(0);
    useEffect(() => {
        const bump = () => refresh(n => n + 1);
        const timer = setInterval(bump, 500);
        const unsubs = [ENGINE_EVENTS.HEROES_UPDATED, BOARD_EVENTS.HERO_MOVED, ENGINE_EVENTS.STATE_CHANGED].map(e => EventBus.subscribe(e, bump));
        return () => { clearInterval(timer); unsubs.forEach(u => u()); };
    }, []);

    const hero = FlagRules.heroRecord(heroId);

    if (!hero) {
        return (
            <PanelShell onClose={onClose} title={<span className="text-sm font-bold text-gi-muted">Work rules</span>}>
                <div data-flag-rules-gone className="flex-1 flex flex-col items-center justify-center gap-3 p-4 text-sm text-gi-muted">
                    <span>Hero gone</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded border border-white/15 text-xs font-bold text-gi-text hover:border-gi-gold/60 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </PanelShell>
        );
    }

    const tip = flagTooltip(heroId);
    const rows = FlagRules.rowsFor(heroId);
    const working = Flags.workingRuleOf(heroId);
    const colour = flagColourOf(heroId);

    const title = (
        <>
            <span data-flag-rules-colour={colour || 'base'} className="shrink-0 w-8 h-8" title="Flag colour">
                <FlagMark colour={colour} size={32} alt="Flag colour" />
            </span>
            <span className="min-w-0 flex flex-col leading-tight">
                <span data-flag-rules-name className="text-sm font-bold text-white truncate">{hero.name}</span>
                <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">Work rules</span>
            </span>
        </>
    );

    return (
        <PanelShell onClose={onClose} heroId={heroId} title={title}>
            <div className="shrink-0 px-3 pb-2 flex flex-col gap-0.5">
                <div data-flag-rules-status className={cn('text-xs', STATE_TONE[tip.state] || 'text-sky-300')}>
                    {tip.status}
                </div>
                {tip.skips.length > 0 && (
                    <ul data-flag-rules-skips className="flex flex-col gap-0.5 text-[10px] leading-tight text-white/65">
                        {tip.skips.map((line, i) => <li key={i}>{line}</li>)}
                        {tip.more > 0 && <li className="text-white/45">+{tip.more} more</li>}
                    </ul>
                )}
            </div>

            {/* One scrolling column, so the panel is only as long as its content. */}
            <div className="flex-1 min-h-0 overflow-y-auto gi-scrollbar border-t border-white/5">
                <div className="px-2 py-1.5">
                    {rows.length === 0 ? (
                        <div className="text-xs text-gi-muted px-1">This hero holds no skills.</div>
                    ) : (
                        <>
                            <div
                                className="flex items-center gap-1 px-1 pb-0.5 text-[9px] font-bold gi-caps text-gi-muted"
                                title="Priority 1 goes first. Within the same number the hero takes the nearest job."
                            >
                                <span className="flex-1">Skill</span>
                                <span className="shrink-0 w-3.5 text-center">On</span>
                                <span className="shrink-0 text-center" style={{ width: PRIORITY_ROW_PX }}>Priority</span>
                            </div>
                            <div className="flex flex-col">
                                {rows.map(row => (
                                    <RuleRow key={row.ruleId} heroId={heroId} row={row} working={working === row.ruleId} />
                                ))}
                            </div>
                            <button
                                type="button"
                                data-flag-rules-reset
                                onClick={() => Flags.resetRules(heroId)}
                                className="mt-1 flex items-center gap-1.5 px-1 py-0.5 text-[10px] font-bold text-gi-muted hover:text-gi-gold transition-colors"
                            >
                                <RotateCcw size={10} /> Reset to defaults
                            </button>
                        </>
                    )}
                </div>
                <CopyRules heroId={heroId} />
            </div>
        </PanelShell>
    );
};

/** One thin frame (the side panel's), a header line with the close X, then the content. */
const PanelShell = ({ title, onClose, heroId = null, children }) => (
    <section
        data-flag-rules={heroId || ''}
        className="w-full h-full flex flex-col text-gi-text select-none"
    >
        <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2">
            {title}
            <button
                type="button"
                data-flag-rules-close
                onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                title="Close (Esc)"
                aria-label="Close rules"
                className="ml-auto p-1 rounded hover:bg-white/10 text-gi-muted hover:text-gi-text transition-colors"
            >
                <X size={14} />
            </button>
        </div>
        {children}
    </section>
);

const PRIORITIES = [];
for (let n = FlagRules.PRIORITY_MIN; n <= FlagRules.PRIORITY_MAX; n++) PRIORITIES.push(n);
/** The priority chips' width: five 16 px chips, no gaps (the column header lines up over it). */
const PRIORITY_ROW_PX = PRIORITIES.length * 16;

/** One skill (or Fight) on one line: icon, name, 25/99, Allowed, priority 1–5. */
const RuleRow = ({ heroId, row, working }) => (
    <div
        data-rule-row={row.ruleId}
        data-rule-working={working ? 'true' : undefined}
        title={working ? 'Working this now' : undefined}
        className={cn('flex items-center gap-1 px-1 py-0.5 rounded min-w-0', working && 'bg-emerald-900/35')}
    >
        <span className="shrink-0 w-4 h-4 flex items-center justify-center">
            {row.combat
                ? <Swords size={13} className="text-gi-gold" />
                : <SkillIcon skillId={row.ruleId} size={16} />}
        </span>
        <span title={row.name} className={cn('flex-1 min-w-0 truncate text-[11px]', working ? 'text-emerald-200' : 'text-white')}>{row.name}</span>
        {row.level != null && (
            <span data-rule-level className="shrink-0 text-[10px] text-gi-muted tabular-nums">{skillLevelText(row.level)}</span>
        )}
        <input
            type="checkbox"
            data-rule-allowed={row.ruleId}
            title={row.allowed ? 'Allowed (click to forbid)' : 'Not allowed (click to allow)'}
            aria-label={`${row.name} allowed`}
            checked={row.allowed}
            onChange={(e) => Flags.setRule(heroId, row.ruleId, { allowed: e.target.checked })}
            className="shrink-0 w-3.5 h-3.5 accent-amber-400 cursor-pointer"
        />
        <span className={cn('shrink-0 flex items-center', !row.allowed && 'opacity-40')} style={{ width: PRIORITY_ROW_PX }}>
            {PRIORITIES.map(n => (
                <button
                    key={n}
                    type="button"
                    data-rule-priority={n}
                    aria-pressed={row.priority === n}
                    title={n === FlagRules.PRIORITY_MIN ? 'Priority 1 (highest)' : `Priority ${n}`}
                    onClick={() => Flags.setRule(heroId, row.ruleId, { priority: n })}
                    className={cn(
                        'w-4 h-4 rounded-sm text-[10px] font-bold tabular-nums leading-none transition-colors',
                        row.priority === n
                            ? 'bg-gi-gold text-black'
                            : 'text-gi-muted hover:bg-white/10 hover:text-gi-text'
                    )}
                >
                    {n}
                </button>
            ))}
        </span>
    </div>
);

/** A skill or Fight, by rule id, for the skipped list. */
const ruleName = (ruleId) => (ruleId === FlagRules.FIGHT ? 'Fight' : (getSkill(ruleId)?.name || ruleId));

/** "Copy rules to…": the other heroes, checkboxes, Copy, and one line on what happened. */
const CopyRules = ({ heroId }) => {
    const [checked, setChecked] = useState(() => new Set());
    const [result, setResult] = useState(null);
    const others = (GameState.state?.heroes || []).filter(h => h?.id && h.id !== heroId);

    // A different hero's panel starts clean.
    useEffect(() => { setChecked(new Set()); setResult(null); }, [heroId]);

    if (others.length === 0) return null;

    const nameOf = (id) => others.find(h => h.id === id)?.name || 'A hero';
    const toggle = (id) => setChecked(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const copy = () => {
        const ids = others.map(h => h.id).filter(id => checked.has(id));
        const res = Flags.copyRules(heroId, ids);
        if (!res.success) { setResult(res.reason || 'Could not copy.'); return; }
        const names = res.results.map(r => nameOf(r.heroId));
        const skips = res.results
            .filter(r => r.skipped.length > 0)
            .map(r => `${nameOf(r.heroId)} skipped ${r.skipped.map(ruleName).join(', ')}.`);
        setResult([`Copied to ${names.join(', ')}.`, ...skips].join(' '));
        setChecked(new Set());
    };

    return (
        <div data-copy-rules-section className="px-3 py-2 border-t border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">Copy rules to…</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
                {others.map(h => (
                    <label key={h.id} data-copy-target={h.id} className="flex items-center gap-1 text-xs cursor-pointer min-w-0">
                        <input
                            type="checkbox"
                            checked={checked.has(h.id)}
                            onChange={() => toggle(h.id)}
                            className="w-3.5 h-3.5 accent-amber-400 cursor-pointer"
                        />
                        <span className="truncate max-w-[7rem]">{h.name}</span>
                    </label>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    data-copy-rules
                    disabled={checked.size === 0}
                    onClick={copy}
                    className={cn(
                        'px-2.5 py-0.5 rounded-sm text-[11px] font-bold transition-colors',
                        checked.size === 0
                            ? 'bg-white/5 text-white/30 cursor-default'
                            : 'bg-gi-gold text-black hover:bg-amber-300 cursor-pointer'
                    )}
                >
                    Copy
                </button>
                <span className="text-[10px] text-gi-muted leading-tight">Skills a hero doesn’t hold are skipped.</span>
            </div>
            {result && <div data-copy-result className="text-[10px] leading-snug text-emerald-200/90">{result}</div>}
        </div>
    );
};

export default FlagRulesPanel;
