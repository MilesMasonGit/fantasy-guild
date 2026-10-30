import { useEffect, useMemo, useReducer, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';
import { parseKey } from '../../../systems/progression/ledger/engine.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { PanelHeader } from '../base/CloseX.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { ItemTipContent } from '../drawer/ItemTip.jsx';
import { TokenCard } from '../board/TokenCard.jsx';
import { IngredientTree } from './IngredientTree.jsx';
import { encyclopedia, KIND, KINDS } from './encyclopediaModel.js';
import { takeLookUp, onLookUp } from './encyclopediaLink.js';

/** How far an arrow press scrolls a column. */
const SCROLL_STEP_PX = 160;

/** A selected row: white means selection (UI_STYLE "Colours"). */
const SELECTED_ROW = 'bg-white/10 text-white';

// ⚠️ Inline, because the unlayered input reset in `styles/main.css` outranks Tailwind classes.
const SEARCH_INPUT_STYLE = { padding: 0, border: 'none', background: 'transparent', fontSize: 'var(--font-size-xs)' };

/** The words a rule's way gets in a section: `source.work`, `use.craft`, … (keys are camelCase). */
const howKey = (how) => how.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** `m:ss` (UI_STYLE "Numbers"). */
export function clockText(ms) {
    const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** A chance as the screen says it: nothing when sure, "first kill" for a first-kill line. */
function chanceText(row) {
    if (row.firstKill) return t('encyclopedia.firstKill');
    if (!Number.isFinite(row.chance) || row.chance >= 1) return null;
    const pct = Math.round(row.chance * 1000) / 10;
    return t('encyclopedia.chance', { chance: pct });
}

/** The sprite of any entry: an item's icon, a Token's art, a recipe's first output. */
export const EntrySprite = ({ entry, size = 32 }) => {
    if (!entry) return null;
    if (entry.kind === KIND.ITEM) return <ItemIcon item={entry.id} size={size} title={null} />;
    if (entry.kind === KIND.RECIPE) {
        const out = (Array.isArray(entry.def?.outputs) ? entry.def.outputs : []).find(o => o?.itemId || o?.tokenId);
        if (out?.tokenId) return <TokenSprite typeId={out.tokenId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />;
        return out?.itemId ? <ItemIcon item={out.itemId} size={size} title={null} /> : null;
    }
    return <TokenSprite typeId={entry.id} surface={size > 32 ? TOKEN_SURFACE.INSPECT : TOKEN_SURFACE.CATALOGUE} alt={entry.name} />;
};

/** Focus and the trail back, together, so a step and its trail never disagree. */
function focusReducer(state, action) {
    switch (action.type) {
        case 'go':
            if (!action.key || action.key === state.focus) return state;
            return { focus: action.key, trail: state.focus ? [...state.trail, state.focus].slice(-50) : state.trail };
        case 'back': {
            if (!state.trail.length) return state;
            return { focus: state.trail[state.trail.length - 1], trail: state.trail.slice(0, -1) };
        }
        default: return state;
    }
}

/** One row of the left list. */
const ListRow = ({ entry, selected, onPick }) => (
    <button
        type="button"
        data-codex-row={entry.key}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onPick(entry.key)}
        className={cn(
            'w-full flex items-center gap-2 px-2 py-1 text-left ui-text-body cursor-pointer',
            selected ? SELECTED_ROW : 'text-gi-text hover:bg-white/5 hover:text-white'
        )}
    >
        <span className="w-8 h-8 shrink-0 flex items-center justify-center overflow-hidden"><EntrySprite entry={entry} /></span>
        <span className="flex-1 min-w-0 break-words">{entry.name}</span>
    </button>
);

/** A ribbon naming another entry, which a click makes the focus. */
const EntryRibbon = ({ book, entryKey, label, count, onGo, quantity }) => {
    const entry = book.entryOf(entryKey);
    if (!entry) return null;
    const isToken = entry.kind === KIND.TOKEN || entry.kind === KIND.ENEMY;
    return (
        <EntityRibbon
            data-codex-link={entryKey}
            kind={entry.kind === KIND.RECIPE ? 'recipe' : isToken ? 'token' : 'item'}
            id={entry.id}
            name={entry.name}
            icon={entry.kind === KIND.RECIPE ? <EntrySprite entry={entry} /> : undefined}
            subtitle={label}
            quantity={quantity}
            countText={quantity == null ? (count ?? '') : undefined}
            size="sm"
            wrap
            title={null}
            onClick={() => onGo(entryKey)}
        />
    );
};

const Section = ({ id, title, children }) => (
    <section data-codex-section={id} className="flex flex-col gap-1">
        <h4 className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{title}</h4>
        {children}
    </section>
);

const Muted = ({ children }) => <span className="ui-text-body text-gi-muted">{children}</span>;

/** A source with nothing to click: the opening Bank, the tutorial, the Shop and its price. */
const PlainSource = ({ row }) => (
    <div data-codex-source={row.how} className="flex flex-wrap items-center gap-2 ui-text-body text-gi-text px-1.5 py-1">
        <span>{t(`encyclopedia.source.${howKey(row.how)}`)}</span>
        {row.inputs.map(i => (
            <span key={i.key} className="inline-flex items-center gap-0.5 tabular-nums" title={null}>
                <ItemIcon item={parseKey(i.key).id} size={32} />
                {i.quantity.toLocaleString('en-US')}
            </span>
        ))}
    </div>
);

const SourcesSection = ({ book, entryKey, onGo }) => {
    const rows = book.sourcesOf(entryKey);
    return (
        <Section id="sources" title={t('encyclopedia.section.sources')}>
            {rows.length === 0 && <Muted>{t('encyclopedia.section.noSources')}</Muted>}
            {rows.map(row => (row.via && book.entryOf(row.via)
                ? <EntryRibbon key={`${row.how}|${row.via}`} book={book} entryKey={row.via} label={t(`encyclopedia.source.${howKey(row.how)}`)} count={chanceText(row)} onGo={onGo} />
                : <PlainSource key={`${row.how}|${row.via}`} row={row} />
            ))}
        </Section>
    );
};

const UsesSection = ({ book, entryKey, onGo }) => {
    const rows = book.usesOf(entryKey);
    return (
        <Section id="uses" title={t('encyclopedia.section.uses')}>
            {rows.length === 0 && <Muted>{t('encyclopedia.section.noUses')}</Muted>}
            {rows.map(row => (
                <EntryRibbon
                    key={`${row.how}|${row.by}|${row.nearby ? 'n' : ''}`}
                    book={book}
                    entryKey={row.by}
                    label={t(`encyclopedia.use.${row.nearby ? 'growNearby' : howKey(row.how)}`)}
                    quantity={row.quantity}
                    onGo={onGo}
                />
            ))}
        </Section>
    );
};

const GivesSection = ({ book, entryKey, onGo }) => {
    const rows = book.givesOf(entryKey);
    if (!rows.length) return null;
    return (
        <Section id="gives" title={t('encyclopedia.section.gives')}>
            {rows.map(row => (
                <EntryRibbon key={`${row.how}|${row.key}`} book={book} entryKey={row.key} label={t(`encyclopedia.give.${howKey(row.how)}`)} count={chanceText(row)} onGo={onGo} />
            ))}
        </Section>
    );
};

const TreeSection = ({ book, entry, onGo }) => {
    if (entry.kind === KIND.ITEM) {
        const tree = book.treeOf(entry.id);
        if (!tree) return null;
        return (
            <Section id="tree" title={t('encyclopedia.section.tree')}>
                <IngredientTree root={tree} book={book} onGo={onGo} />
            </Section>
        );
    }
    if (entry.kind === KIND.RECIPE) {
        const trees = book.recipeTreesOf(entry.id);
        if (!trees.length) return null;
        return (
            <Section id="tree" title={t('encyclopedia.section.takes')}>
                {trees.map(({ tree, quantity }) => <IngredientTree key={tree.key} root={tree} scale={quantity} book={book} onGo={onGo} asChild />)}
            </Section>
        );
    }
    return null;
};

/** What a recipe is: its skill and level, and how long one craft takes. */
const RecipeFacts = ({ recipe }) => {
    const skill = getSkill(recipe.skill);
    return (
        <div data-codex-recipe-facts className="flex flex-col gap-1 ui-text-body text-gi-text bg-black/40 p-2">
            {recipe.skill && (
                <span className="inline-flex items-center gap-1.5">
                    <SkillIcon skillId={recipe.skill} size={16} title={null} />
                    {t('encyclopedia.recipe.skill', { skill: skill?.name || recipe.skill, level: Math.max(1, Number(recipe.levelRequirement) || 1) })}
                </span>
            )}
            {Number(recipe.durationMs) > 0 && (
                <span className="inline-flex items-center gap-1.5">
                    <PixelGlyph name="clock" />
                    {t('encyclopedia.recipe.time', { time: clockText(recipe.durationMs) })}
                </span>
            )}
        </div>
    );
};

/** The entry's own card: what it is. */
const WhatItIs = ({ entry }) => {
    if (entry.kind === KIND.ITEM) {
        return (
            <div data-codex-what="item" className="bg-black/40 p-2 ui-text-body" style={{ width: 256 }}>
                <ItemTipContent item={entry.def} />
            </div>
        );
    }
    if (entry.kind === KIND.RECIPE) return <RecipeFacts recipe={entry.def} />;
    return (
        <div data-codex-what="token">
            <TokenCard typeId={entry.id} />
        </div>
    );
};

const Entry = ({ book, entry, trail, onGo, onBack }) => {
    const previous = trail.length ? book.entryOf(trail[trail.length - 1]) : null;
    return (
        <div data-codex-entry={entry.key} className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-3">
                {previous && (
                    <Tooltip title={t('encyclopedia.backTo', { name: previous.name })}>
                        <button
                            type="button"
                            data-codex-back
                            aria-label={t('encyclopedia.back')}
                            onClick={onBack}
                            className="shrink-0 p-1 text-gi-muted hover:text-white cursor-pointer"
                        >
                            <PixelGlyph name="back" />
                        </button>
                    </Tooltip>
                )}
                <span className="min-w-16 min-h-16 shrink-0 flex items-center justify-center bg-black/40"><EntrySprite entry={entry} size={64} /></span>
                <div className="flex flex-col min-w-0">
                    <h3 data-codex-name className="ui-text-title font-bold text-white break-words">{entry.name}</h3>
                    <span className="ui-text-small text-gi-muted">{t(`encyclopedia.kindOne.${entry.kind}`)}</span>
                </div>
            </div>
            <div className="flex flex-wrap items-start gap-4">
                <div className="shrink-0"><WhatItIs entry={entry} /></div>
                <div className="flex-1 min-w-[320px] max-w-[640px] flex flex-col gap-3">
                    <SourcesSection book={book} entryKey={entry.key} onGo={onGo} />
                    <TreeSection book={book} entry={entry} onGo={onGo} />
                    <GivesSection book={book} entryKey={entry.key} onGo={onGo} />
                    {entry.kind === KIND.ITEM && <UsesSection book={book} entryKey={entry.key} onGo={onGo} />}
                </div>
            </div>
        </div>
    );
};

const KindTabs = ({ kind, onKind, dimmed }) => (
    <div role="tablist" className="flex items-end gap-4">
        {KINDS.map(k => {
            const on = k === kind && !dimmed;
            return (
                <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    data-codex-tab={k}
                    onClick={() => onKind(k)}
                    className="flex items-center gap-1 pb-1 cursor-pointer font-bold ui-text-body"
                    style={{
                        color: on ? 'var(--color-ui-white)' : 'var(--color-ui-muted)',
                        borderBottom: `2px solid ${on ? 'var(--color-ui-gold)' : 'transparent'}`
                    }}
                >
                    {t(`encyclopedia.kind.${k}`)}
                </button>
            );
        })}
    </div>
);

const Search = ({ value, onChange }) => (
    <div className="ui-pixel-edge flex items-center gap-1 px-2 py-1 w-64">
        <input
            data-codex-search
            value={value}
            autoFocus
            onChange={e => onChange(e.target.value)}
            placeholder={t('encyclopedia.searchPlaceholder')}
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

/**
 * The Encyclopedia: every item, Token, enemy and recipe, shown in full from the start, by kind and
 * searchable. An entry says what it is, everything it comes from, what it is made from (the tree,
 * opened a level at a time) and what uses it; any entry named in it is a link that becomes the
 * focus, with a step back. It says what a thing comes from, never where on the world map.
 *
 * Mounted only while open: everything it reads is built the first time it opens.
 */
export const EncyclopediaScreen = ({ onClose }) => {
    const book = useMemo(() => encyclopedia(), []);
    const [nav, dispatch] = useReducer(focusReducer, null, () => ({
        focus: (() => { const k = takeLookUp(); return k && book.entryOf(k) ? k : (book.byKind[KIND.ITEM][0]?.key ?? null); })(),
        trail: []
    }));
    const [kind, setKind] = useState(() => book.kindOfKey(nav.focus) || KIND.ITEM);
    const [term, setTerm] = useState('');

    const go = (key) => {
        if (!book.entryOf(key)) return;
        dispatch({ type: 'go', key });
        setKind(book.kindOfKey(key));
    };
    const back = () => {
        const prev = nav.trail[nav.trail.length - 1];
        dispatch({ type: 'back' });
        if (prev) setKind(book.kindOfKey(prev));
    };

    // A link pressed while open (a card's ribbon) moves the focus here.
    useEffect(() => onLookUp((key) => {
        takeLookUp();
        if (!book.entryOf(key)) return;
        dispatch({ type: 'go', key });
        setKind(book.kindOfKey(key));
    }), [book]);

    const searching = term.trim().length > 0;
    const results = useMemo(() => (searching ? book.search(term) : null), [book, term, searching]);
    const entry = book.entryOf(nav.focus);

    return (
        <div
            data-encyclopedia
            className="absolute inset-0 z-[100] pointer-events-auto p-4 bg-black/55"
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <PixelFrame kind={FRAME_KIND.STUDS} className="h-full" frameClassName="flex flex-col min-h-0 p-3 gap-2 bg-gi-surface/95">
                <PanelHeader title={t('encyclopedia.title')} onClose={onClose} className="gap-4">
                    <Search value={term} onChange={setTerm} />
                </PanelHeader>
                <KindTabs kind={kind} onKind={(k) => { setKind(k); setTerm(''); }} dimmed={searching} />
                <div className="flex-1 min-h-0 flex gap-3">
                    <div className="w-72 shrink-0 flex flex-col min-h-0 bg-black/30">
                        <ArrowScrollList step={SCROLL_STEP_PX} compact className="flex-1 min-h-0" listProps={{ 'data-codex-list': searching ? 'search' : kind }}>
                            {searching ? (
                                results.length === 0
                                    ? <div className="p-3"><Muted>{t('encyclopedia.noResults')}</Muted></div>
                                    : KINDS.map(k => {
                                        const hits = results.filter(e => e.kind === k);
                                        if (!hits.length) return null;
                                        return (
                                            <div key={k} data-codex-group={k}>
                                                <div className="px-2 pt-2 ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{t(`encyclopedia.kind.${k}`)}</div>
                                                {hits.map(e => <ListRow key={e.key} entry={e} selected={e.key === nav.focus} onPick={go} />)}
                                            </div>
                                        );
                                    })
                            ) : (
                                book.byKind[kind].map(e => <ListRow key={e.key} entry={e} selected={e.key === nav.focus} onPick={go} />)
                            )}
                        </ArrowScrollList>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-black/20">
                        <ArrowScrollList step={SCROLL_STEP_PX} compact className="flex-1 min-h-0">
                            {entry
                                ? <Entry book={book} entry={entry} trail={nav.trail} onGo={go} onBack={back} />
                                : <div className="p-3"><Muted>{t('encyclopedia.pick')}</Muted></div>}
                        </ArrowScrollList>
                    </div>
                </div>
            </PixelFrame>
        </div>
    );
};

export default EncyclopediaScreen;
