import React, { useEffect, useState } from 'react';
import { Swords, RotateCcw } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as FlagRules from '../../../systems/board/FlagRules.js';
import { flagColourOf } from '../../../systems/board/FlagColours.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { PixelArt } from '../base/TokenSprite.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { flagTooltip } from '../board/flagText.js';
import { STATE_TONE } from '../board/FlagLayer.jsx';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * FlagRulesPanel: one hero's flag rules.
 * A narrow panel that covers the Notifications column, so the board stays in view while the
 * rules change. Opened only from a flag's gear badge; `ReactRoot` places it.
 * * **Header**: portrait, name, flag colour, what the hero is doing and up to five Tokens
 * their flag passed over (every reason). Re-read twice a second, because skips change without
 * an event.
 * * **One row per `FlagRules.rowsFor`**: every held work skill, then Fight for a hero who can
 * fight. An **Allowed** toggle and a **priority 1–5** (1 is highest, 3 the default); the row
 * the hero is working now is highlighted. Both call `Flags.setRule`.
 * * **Reset to defaults**: `Flags.resetRules`.
 * The rules live on the hero, so a recalled or defeated hero's panel stays editable and reads
 * 'In the Guild'. A hero who no longer exists shows 'Hero gone'.
 */
export const FlagRulesPanel = ({ heroId, onClose }) => {
    const [, refresh] = useState(0);
    useEffect(() => {
        const bump = () => refresh(n => n + 1);
        const timer = setInterval(bump, 500);
        const unsubs = [ENGINE_EVENTS.HEROES_UPDATED, BOARD_EVENTS.HERO_MOVED, ENGINE_EVENTS.STATE_CHANGED].map(e => EventBus.subscribe(e, bump, UI_LISTENER));
        return () => { clearInterval(timer); unsubs.forEach(u => u()); };
    }, []);

    const hero = FlagRules.heroRecord(heroId);

    if (!hero) {
        return (
            <PanelShell title="Flag rules" onClose={onClose}>
                <div data-flag-rules-gone className="flex-1 flex flex-col items-center justify-center gap-3 p-4 text-sm text-gi-muted">
                    <span>Hero gone</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 rounded border border-gi-border text-xs font-bold text-gi-text hover:border-gi-gold/60 transition-colors"
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
    const portrait = resolveSpritePath(hero.spriteId || hero.classId || 'hero_recruit_0');

    return (
        <PanelShell title="Flag rules" onClose={onClose} heroId={heroId}>
            {/* Who, and what they are doing */}
            <div className="shrink-0 flex gap-2.5 p-3 border-b border-gi-border/40">
                <div className="shrink-0 w-16 h-16 rounded-lg bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center">
                    {portrait && <PixelArt src={portrait} alt={hero.name} size={64} />}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span data-flag-rules-name className="font-bold text-sm text-white truncate">{hero.name}</span>
                        <span className="shrink-0 w-6 h-6" title="Flag colour">
                            <FlagMark colour={flagColourOf(heroId)} size={24} alt="Flag colour" />
                        </span>
                    </div>
                    <div data-flag-rules-status className={cn('text-xs', STATE_TONE[tip.state] || 'text-sky-300')}>
                        {tip.status}
                    </div>
                    {tip.skips.length > 0 && (
                        <ul data-flag-rules-skips className="mt-0.5 flex flex-col gap-0.5 text-[10px] leading-tight text-white/65">
                            {tip.skips.map((line, i) => <li key={i}>{line}</li>)}
                            {tip.more > 0 && <li className="text-white/45">+{tip.more} more</li>}
                        </ul>
                    )}
                </div>
            </div>

            <div className="shrink-0 px-3 pt-2 text-[10px] text-gi-muted leading-snug">
                Priority 1 is highest. Within the same number the hero takes the nearest job.
            </div>

            {/* One row per rule */}
            <div className="flex-1 min-h-0 overflow-y-auto gi-scrollbar px-2 py-2 flex flex-col gap-1.5">
                {rows.length === 0 && (
                    <div className="text-xs text-gi-muted px-1">This hero holds no skills.</div>
                )}
                {rows.map(row => (
                    <RuleRow key={row.ruleId} heroId={heroId} row={row} working={working === row.ruleId} />
                ))}
            </div>

            <div className="shrink-0 p-2 border-t border-gi-border/40">
                <button
                    type="button"
                    data-flag-rules-reset
                    onClick={() => Flags.resetRules(heroId)}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-gi-border/60 text-xs font-bold text-gi-text hover:border-gi-gold/60 hover:text-gi-gold transition-colors"
                >
                    <RotateCcw size={12} /> Reset to defaults
                </button>
            </div>
        </PanelShell>
    );
};

/** The drawer look (the Bank pane header), narrowed to one column. */
const PanelShell = ({ title, onClose, heroId = null, children }) => (
    <section
        data-flag-rules={heroId || ''}
        data-dnd-surface="drawer"
        className="w-full h-full flex flex-col bg-gi-surface border border-gi-primary/30 rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden text-gi-text select-none"
    >
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-gi-border/40 bg-gi-base/80 min-h-[44px]">
            <span className="text-sm font-bold tracking-wide">{title}</span>
            <button
                type="button"
                onClick={onClose}
                title="Close rules"
                aria-label="Close rules"
                className="p-0.5 rounded cursor-pointer flex items-center justify-center gi-hover-pulse"
            >
                <img
                    src="/assets/ui/ui_cancel_red.png"
                    alt="Close"
                    className="w-8 h-8 object-contain select-none pointer-events-none"
                    style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }}
                />
            </button>
        </div>
        {children}
    </section>
);

/** One skill (or Fight): icon, name, level, Allowed, priority 1–5. */
const RuleRow = ({ heroId, row, working }) => {
    const priorities = [];
    for (let n = FlagRules.PRIORITY_MIN; n <= FlagRules.PRIORITY_MAX; n++) priorities.push(n);

    return (
        <div
            data-rule-row={row.ruleId}
            data-rule-working={working ? 'true' : undefined}
            className={cn(
                'flex flex-col gap-1 px-2 py-1.5 rounded-lg border transition-colors',
                working ? 'bg-emerald-900/30 border-emerald-400/60' : 'bg-[#181412] border-white/10'
            )}
        >
            <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 w-6 h-6 flex items-center justify-center">
                    {row.combat
                        ? <Swords size={18} className="text-gi-gold" />
                        : <SkillIcon skillId={row.ruleId} size={24} />}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-white">{row.name}</span>
                {row.level != null && <span className="shrink-0 text-[10px] text-gi-muted tabular-nums">Lv {row.level}</span>}
                <label className="shrink-0 flex items-center gap-1 text-[10px] text-gi-muted cursor-pointer">
                    Allowed
                    <input
                        type="checkbox"
                        data-rule-allowed={row.ruleId}
                        checked={row.allowed}
                        onChange={(e) => Flags.setRule(heroId, row.ruleId, { allowed: e.target.checked })}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                    />
                </label>
            </div>
            <div className={cn('flex items-center gap-1 pl-8', !row.allowed && 'opacity-40')}>
                {priorities.map(n => (
                    <button
                        key={n}
                        type="button"
                        data-rule-priority={n}
                        aria-pressed={row.priority === n}
                        title={n === FlagRules.PRIORITY_MIN ? 'Priority 1 (highest)' : `Priority ${n}`}
                        onClick={() => Flags.setRule(heroId, row.ruleId, { priority: n })}
                        className={cn(
                            'w-6 h-6 rounded text-[11px] font-bold tabular-nums border transition-colors',
                            row.priority === n
                                ? 'bg-gi-gold text-black border-gi-gold'
                                : 'bg-black/40 text-gi-muted border-white/15 hover:border-gi-gold/60 hover:text-gi-text'
                        )}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FlagRulesPanel;
