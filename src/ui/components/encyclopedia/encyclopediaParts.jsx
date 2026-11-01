import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';
import { GameState } from '../../../state/GameState.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { TokenSprite } from '../base/TokenSprite.jsx';
import { KIND } from './encyclopediaModel.js';

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

/** The sprite of any entry at `size`: an item's icon, a Token's art, a recipe's first output. */
export const EntrySprite = ({ entry, size = SPRITE_PX }) => {
    if (!entry) return null;
    if (entry.kind === KIND.ITEM) return <ItemIcon item={entry.id} size={size} title={null} />;
    if (entry.kind === KIND.RECIPE) {
        const out = (Array.isArray(entry.def?.outputs) ? entry.def.outputs : []).find(o => o?.itemId || o?.tokenId);
        if (out?.tokenId) return <TokenSprite typeId={out.tokenId} size={size} alt="" />;
        return out?.itemId ? <ItemIcon item={out.itemId} size={size} title={null} /> : null;
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

/** Whether any hero of the guild holds `gate.skill` at `gate.level` or above. */
export function heroHas(gate, heroes = GameState.heroes) {
    if (!gate?.skill) return true;
    return (Array.isArray(heroes) ? heroes : []).some(h => (h?.skills?.[gate.skill]?.level ?? -Infinity) >= gate.level);
}

/** A skill and level, "Smithing 15", red when no hero has it yet. */
export const GateLine = ({ gate, heroes }) => {
    if (!gate?.skill) return null;
    const name = getSkill(gate.skill)?.name || gate.skill;
    const has = heroHas(gate, heroes);
    const words = t('encyclopedia.level', { skill: name, level: gate.level });
    return (
        <span
            data-codex-gate={gate.skill}
            data-codex-gate-short={has ? undefined : 'true'}
            title={has ? words : t('encyclopedia.noHero', { skill: name, level: gate.level })}
            className="inline-flex items-center gap-1 tabular-nums"
            style={has ? undefined : { color: 'var(--color-ui-red)' }}
        >
            <SkillIcon skillId={gate.skill} size={16} title={null} />
            {words}
        </span>
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
