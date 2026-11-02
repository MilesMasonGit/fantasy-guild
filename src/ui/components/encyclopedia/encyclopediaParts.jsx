import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';
import { GameState } from '../../../state/GameState.js';
import { getSkill, COMBAT_SKILL_IDS } from '../../../config/registries/skillRegistry.js';
import { COMBAT } from '../../../systems/progression/ledger/engine.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { TokenSprite } from '../base/TokenSprite.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { KIND } from './encyclopediaModel.js';
import { STATIONS } from './encyclopediaChart.js';

/** A clipped room never scrolls: focus moving to something out of sight would shift the whole book. */
export const unscroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop || el.scrollLeft) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
    }
};

/** The sprite box of a row or a chart node. */
export const SPRITE_PX = 32;

/** The sprite of any entry at `size`: an item's icon, a Token's art, a recipe's first output, a station type's first station. */
export const EntrySprite = ({ entry, size = SPRITE_PX }) => {
    if (!entry) return null;
    if (entry.kind === KIND.ITEM) return <ItemIcon item={entry.id} size={size} title={null} />;
    if (entry.kind === KIND.RECIPE) {
        const out = (Array.isArray(entry.def?.outputs) ? entry.def.outputs : []).find(o => o?.itemId || o?.tokenId);
        if (out?.tokenId) return <TokenSprite typeId={out.tokenId} size={size} alt="" />;
        return out?.itemId ? <ItemIcon item={out.itemId} size={size} title={null} /> : null;
    }
    if (entry.kind === STATIONS) {
        const first = entry.members?.[0];
        return first ? <TokenSprite typeId={first.slice(first.indexOf(':') + 1)} size={size} alt="" /> : null;
    }
    return <TokenSprite typeId={entry.id} size={size} alt={entry.name} />;
};

/** Whether this run has collected `entry`: obtained, made, beaten. */
export const isCollected = (got, entry) => !!entry && got?.[entry.kind]?.has(entry.id) === true;

/** The collected tick: green, the "ready, enough" colour. */
export const Tick = ({ label = t('encyclopedia.collected') }) => (
    <span data-codex-tick title={label} aria-label={label} className="shrink-0" style={{ color: 'var(--color-ui-green)' }}>
        <PixelGlyph name="tick" />
    </span>
);

/** Whether any hero of the guild holds `gate.skill` at `gate.level` or above (Combat: any fighting style). */
export function heroHas(gate, heroes = GameState.heroes) {
    if (!gate?.skill) return true;
    const skills = gate.skill === COMBAT ? COMBAT_SKILL_IDS : [gate.skill];
    return (Array.isArray(heroes) ? heroes : []).some(h => skills.some(s => (h?.skills?.[s]?.level ?? -Infinity) >= gate.level));
}

/**
 * What a box asks of a hero, written above it: "Smithing 15" with its skill icon, red when no
 * hero has it yet; hover names the stations that make a recipe. A fight reads "Combat · Lv 12",
 * never red: no hero level is checked to fight.
 */
export const RequirementLine = ({ requirement, heroes, book, className, style }) => {
    if (!requirement?.skill) return null;
    const stationNames = (requirement.stations || []).map(k => book?.nameOf(k) ?? k);
    const madeAt = stationNames.length ? t('encyclopedia.madeAtNames', { names: stationNames.join(', ') }) : null;
    if (requirement.skill === COMBAT) {
        return (
            <Tooltip lines={[t('encyclopedia.combatTip', { level: requirement.level })]}>
                <span data-codex-req={COMBAT} className={cn('inline-flex items-center gap-1 tabular-nums', className)} style={style}>
                    {t('encyclopedia.combatLevel', { level: requirement.level })}
                </span>
            </Tooltip>
        );
    }
    const name = getSkill(requirement.skill)?.name || requirement.skill;
    const has = heroHas(requirement, heroes);
    const words = t('encyclopedia.level', { skill: name, level: requirement.level });
    const tip = [has ? null : t('encyclopedia.noHero', { skill: name, level: requirement.level }), madeAt].filter(Boolean);
    return (
        <Tooltip lines={tip.length ? tip : [words]}>
            <span
                data-codex-req={requirement.skill}
                data-codex-req-short={has ? undefined : 'true'}
                data-codex-made-at={madeAt ?? undefined}
                className={cn('inline-flex items-center gap-1 tabular-nums', className)}
                style={has ? style : { ...style, color: 'var(--color-ui-red)' }}
            >
                <SkillIcon skillId={requirement.skill} size={16} title={null} />
                {words}
            </span>
        </Tooltip>
    );
};

// ⚠️ Inline, because the unlayered input reset in `styles/main.css` outranks Tailwind classes.
const SEARCH_INPUT_STYLE = { padding: 0, border: 'none', background: 'transparent', fontSize: 'var(--font-size-xs)' };

/**
 * The search box: the same one on the opening page and over the chart. `focusOnMount` takes the
 * keys at once. ⚠️ Not `autoFocus`: that scrolls the book's clipped room to the box while the book
 * is still rising from below, and the room stays scrolled.
 */
export const SearchBox = ({ value, onChange, onEnter, focusOnMount = false, className }) => {
    const input = useRef(null);
    useEffect(() => {
        if (focusOnMount) input.current?.focus({ preventScroll: true });
    }, [focusOnMount]);
    return (
    <div className={cn('ui-pixel-edge flex items-center gap-1 px-2 py-1 bg-gi-surface/95', className)}>
        <input
            ref={input}
            data-codex-search
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onEnter?.(); }}
            placeholder={t('encyclopedia.searchPlaceholder')}
            aria-label={t('encyclopedia.searchPlaceholder')}
            style={SEARCH_INPUT_STYLE}
            className="outline-none text-gi-text w-full min-w-0 leading-normal placeholder:text-gi-muted/60"
        />
        {value ? (
            <button
                type="button"
                onClick={() => onChange('')}
                title={t('encyclopedia.clearSearch')}
                aria-label={t('encyclopedia.clearSearch')}
                className="text-gi-muted hover:text-gi-text p-0.5 cursor-pointer shrink-0"
            >
                <X size={12} />
            </button>
        ) : null}
    </div>
    );
};

/** One entry in a list (search results, the recent ones): its sprite, name and tick. */
export const EntryRow = ({ entry, got, onPick, dataAttr = 'data-codex-row' }) => (
    <button
        type="button"
        {...{ [dataAttr]: entry.key }}
        onClick={() => onPick(entry.key)}
        className="w-full flex items-center gap-2 px-2 py-1 text-left ui-text-body cursor-pointer text-gi-text hover:bg-white/10 hover:text-white"
    >
        <span className="w-8 h-8 shrink-0 flex items-center justify-center"><EntrySprite entry={entry} /></span>
        <span className="flex-1 min-w-0 break-words">{entry.name}</span>
        {isCollected(got, entry) && <Tick />}
    </button>
);
