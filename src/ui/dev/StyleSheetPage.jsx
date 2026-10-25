// The style sheet page: every standard UI piece from UI_STYLE, live, for builders to copy from
// and the owner to eye-check. Opened from the QA panel.
// ⚠️ Pieces in the "new, unapproved" group wait for the owner's OK: placeholders drawn here only,
// or new pieces only the screen their entry names uses so far. Once a piece has one shared version, its entry points at that version and moves to the
// shared group.

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn.js';
import { useEscapeLayer } from '../utils/escapeLayers.js';
import { EntityRibbon } from '../components/base/EntityRibbon.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { VitalBar, vitalTone } from '../components/base/VitalBar.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../components/base/TokenSprite.jsx';
import { StationGearBadge } from '../components/board/TokenBadges.jsx';
import { Tooltip } from '../components/base/Tooltip.jsx';
import { PixelFrame } from '../components/base/PixelFrame.jsx';
import { CloseX, PanelHeader } from '../components/base/CloseX.jsx';
import { TEXT_SIZES } from '../components/base/textSizes.js';
import { ArrowScrollList } from '../components/base/ArrowScrollList.jsx';
import { LevelUpFloats } from '../components/board/LevelUpFloat.jsx';
import { ModeBannerView } from '../components/board/MatModeControls.jsx';
import { MAT_TOP_BAR_PX } from '../components/board/MatTopBar.jsx';
import { MatRegionName } from '../components/board/MatRegionName.jsx';
import { MAP_MODE } from '../hooks/useMapMode.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { ProblemMark } from '../components/board/ProblemMark.jsx';
import { SEVERITY } from '../components/board/problemMark.js';
import { ALERT } from '../../systems/board/boardEvents.js';
import { PixelGlyph, GLYPHS, SLOT_GLYPHS } from '../components/base/PixelGlyph.jsx';
import { itemTintStyle } from '../components/base/itemTint.js';
import { ItemTipContent } from '../components/drawer/ItemTip.jsx';
import { TokenCard } from '../components/board/TokenCard.jsx';
import { RecipeList } from '../components/board/RecipeList.jsx';
import { listSkillOf } from '../../systems/board/RecipeList.js';
import { Stub } from '../components/notifications/ItemStubColumn.jsx';
import { Banner } from '../components/notifications/BannerStack.jsx';
import { bannerText } from '../../systems/notifications/bannerKinds.js';
import { BookTab } from '../components/atlas/AtlasTome.jsx';
import { MapSprite, MapOutline, MAP_PX, SLOT_PX } from '../components/atlas/MapPieces.jsx';
import { WorkPlateDemo } from './WorkPlateDemo.jsx';
import { CombatMockups } from './CombatMockups.jsx';
import { KitButton, KIT_BUTTON_TONE, PixelToggle } from '../components/base/KitButton.jsx';

/** One art pixel of the UI, in screen pixels: UI sprites draw at 2×. */
const ART_PX = 2;

const SAMPLE_ITEMS = ['item_oak_wood', 'item_copper_ore', 'item_copper_ingot'];
const SAMPLE_TOKEN = 'token_oak_forest';
const itemName = (id) => getItem(id)?.name || id;

/** The five colour meanings, as the shared CSS variables in `tailwind.css`. */
export const KIT_COLOURS = [
    { name: 'Red', cssVar: '--color-ui-red', means: 'short, can’t, danger' },
    { name: 'Green', cssVar: '--color-ui-green', means: 'ready, enough' },
    { name: 'Gold', cssVar: '--color-ui-gold', means: 'alert, attention, upgrade, the selected tab' },
    { name: 'White', cssVar: '--color-ui-white', means: 'hover, selection' },
    { name: 'Muted grey', cssVar: '--color-ui-muted', means: 'locked, unavailable' }
];

const ui = (cssVar) => `var(${cssVar})`;

// ---------------------------------------------------------------------------------------------
// Placeholders for the pieces with no shared version yet.
// ---------------------------------------------------------------------------------------------

/** A hard one-art-pixel outline around a sprite's own shape, in a colour. No blur. */
const spriteOutline = (colour) => [
    [ART_PX, 0], [-ART_PX, 0], [0, ART_PX], [0, -ART_PX]
].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${colour})`).join(' ');

const UiSprite = ({ src, artSize = 16, scale = ART_PX, outline = null, alt = '' }) => (
    <img
        src={src}
        alt={alt}
        draggable={false}
        className="select-none pointer-events-none"
        style={{
            width: artSize * scale,
            height: artSize * scale,
            imageRendering: 'pixelated',
            filter: outline ? spriteOutline(outline) : undefined
        }}
    />
);

const KitIconButton = ({ src, label, artSize = 16 }) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            data-kit-icon-button
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            className="p-0 bg-transparent border-0 cursor-pointer"
        >
            <UiSprite src={src} artSize={artSize} outline={hover ? ui('--color-ui-white') : null} alt={label} />
        </button>
    );
};

const KitPill = ({ itemId, have, need }) => (
    <span
        data-kit-pill
        title={itemName(itemId)}
        className="inline-flex items-center gap-0.5 tabular-nums"
    >
        <ItemIcon item={itemId} size={32} />
        <span style={{ color: have < need ? ui('--color-ui-red') : undefined }}>{have}/{need}</span>
    </span>
);

const KitMainButton = ({ label, cost = [], blockedReason = null }) => {
    const blocked = !!blockedReason;
    return (
        <div className="inline-flex flex-col items-start gap-1">
            <PixelFrame kind="chamfer" className={cn('inline-block', blocked && 'opacity-50 grayscale')}>
                <button
                    type="button"
                    disabled={blocked}
                    data-kit-main-button
                    className={cn('ui-shine flex items-center gap-3 px-2 py-0.5 font-bold', blocked ? 'cursor-not-allowed' : 'cursor-pointer')}
                    style={{ color: blocked ? ui('--color-ui-muted') : ui('--color-ui-gold') }}
                >
                    {label}
                    {cost.map(c => <KitPill key={c.itemId} {...c} />)}
                </button>
            </PixelFrame>
            {blocked && <span className="text-xs" style={{ color: ui('--color-ui-red') }}>{blockedReason}</span>}
        </div>
    );
};

const KitHeader = ({ title, sprite }) => (
    <div data-kit-header>
        <PanelHeader title={title} sprite={sprite && <UiSprite src={sprite} artSize={16} />} onClose={() => {}} className="px-2 py-1" />
    </div>
);

const KIT_TABS = [
    { id: 'upgrades', label: 'Upgrades', sprite: '/assets/ui/u_upgrade.png' },
    { id: 'alerts', label: 'Alerts', sprite: '/assets/ui/u_alert_yellow.png' },
    { id: 'add', label: 'Build', sprite: '/assets/ui/u_add_green.png' }
];

const KitTabs = () => {
    const [open, setOpen] = useState(KIT_TABS[0].id);
    return (
        <div role="tablist" className="flex items-end gap-4">
            {KIT_TABS.map(t => {
                const on = t.id === open;
                return (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        data-kit-tab={t.id}
                        onClick={() => setOpen(t.id)}
                        className="flex items-center gap-1 pb-1 cursor-pointer font-bold"
                        style={{
                            color: on ? ui('--color-ui-white') : ui('--color-ui-muted'),
                            borderBottom: `${ART_PX}px solid ${on ? ui('--color-ui-gold') : 'transparent'}`
                        }}
                    >
                        <UiSprite src={t.sprite} artSize={16} />
                        {t.label}
                    </button>
                );
            })}
        </div>
    );
};

const KIT_BOOK_TABS = [
    { id: 'cartography', label: 'Cartography', colour: '#7a1f1f' },
    { id: 'regions', label: 'Regions', colour: '#1f3f6e' }
];

/** The Atlas's page tabs, tucked under a strip of book cover as on the tome. */
const BookTabDemo = () => {
    const [open, setOpen] = useState(KIT_BOOK_TABS[0].id);
    return (
        <div className="relative inline-flex items-start py-2">
            <div role="tablist" aria-orientation="vertical" className="flex flex-col items-end gap-2">
                {KIT_BOOK_TABS.map(t => <BookTab key={t.id} {...t} selected={t.id === open} onSelect={setOpen} />)}
            </div>
            <div className="relative -ml-4 w-6 self-stretch" style={{ background: '#4a2a1a' }} />
        </div>
    );
};

/** The Cartography table's maps: a tile, one with every copy slotted, an empty slot and a filled one. */
const KIT_MAP = { id: 'dev_map_forest', biome: 'forest' };
const MapPiecesDemo = () => (
    <div data-kit-map-pieces className="inline-flex items-end gap-3 p-2 bg-gi-surface/95">
        {[2, 0].map(n => (
            <div key={n} className={cn('flex flex-col items-center bg-black/30', n === 0 && 'opacity-35 grayscale')} style={{ width: MAP_PX }}>
                <MapSprite recipe={KIT_MAP} />
                <span className="ui-text-small tabular-nums text-white/85 leading-none pb-0.5">×{n}</span>
            </div>
        ))}
        <div className="flex items-center justify-center bg-black/20" style={{ width: SLOT_PX, height: SLOT_PX }}><MapOutline /></div>
        <div className="flex items-center justify-center bg-black/40" style={{ width: SLOT_PX, height: SLOT_PX }}><MapSprite recipe={KIT_MAP} /></div>
    </div>
);

const KitXpBar = ({ cur, max }) => (
    <div
        data-kit-xp-bar
        title={`${cur.toLocaleString('en-US')} / ${max.toLocaleString('en-US')} XP`}
        className="bg-black/60"
        style={{ height: ART_PX, width: 160 }}
    >
        <div className="h-full bg-[var(--color-xp)]" style={{ width: `${(cur / max) * 100}%` }} />
    </div>
);

// ---------------------------------------------------------------------------------------------
// Demos that use the shared pieces.
// ---------------------------------------------------------------------------------------------

const TooltipDemo = () => (
    <div className="flex flex-wrap gap-4">
        <Tooltip title="Oak Wood" lines={['×1,154', 'Drag to sort, or onto a hero to equip']}>
            <span data-kit-tooltip-target className="inline-block px-2 py-1 border border-dashed border-white/30 cursor-default">
                Hover: title and lines
            </span>
        </Tooltip>
        <Tooltip lines={['Item stacks in the bank / slot capacity']}>
            <span className="inline-block px-2 py-1 border border-dashed border-white/30 cursor-default">Hover: one line</span>
        </Tooltip>
    </div>
);

/** One kit text size: a sample in its class, and the size it renders at right now. */
const TextSizeRow = ({ size }) => {
    const ref = useRef(null);
    const [px, setPx] = useState(null);
    useLayoutEffect(() => {
        if (ref.current) setPx(getComputedStyle(ref.current).fontSize);
    }, []);
    return (
        <div data-kit-text-size={size.id} className="flex items-baseline gap-3">
            <span ref={ref} className={`${size.className} shrink-0 whitespace-nowrap`}>Mining 25/99</span>
            <span className="ui-text-small text-gi-muted">
                <b>{size.id}</b> <code>.{size.className}</code> reads <code>{size.cssVar}</code>: {px || '?'} now, {size.px} px by default. {size.use}.
            </span>
        </div>
    );
};

const TextSizesDemo = () => (
    <div className="flex flex-col gap-1.5">
        {TEXT_SIZES.map(size => <TextSizeRow key={size.id} size={size} />)}
        <p className="ui-text-small text-gi-muted max-w-2xl">
            Measured in the running game at the default Text size (computed sizes, not class names):
            panel titles render at 18 px (Bank “Item Bank”, Shop “Shop”, the hero’s name, Shop row
            names); rows and ribbons at 16 px (hero skill rows, Shop prices, Bank counts). Counts and
            hints render at 16 px too, the same as rows, so small takes the setting’s next step down,
            14 px. No panel text renders at a display size today; display takes the setting’s 32 px
            step. Change Settings › Accessibility › Typography Scale and reopen this page: every row
            follows its step.
        </p>
    </div>
);

/** The map modes' hover outlines and their banners, as the top bar shows them. */
const MapModesDemo = () => {
    const known = !!getTokenType(SAMPLE_TOKEN);
    return (
        <div className="flex flex-col gap-3">
            {known && (
                <div className="flex items-end gap-6">
                    {[['muted', 'Disallow'], ['danger', 'Demolish']].map(([outline, label]) => (
                        <figure key={outline} className="flex flex-col items-center gap-1">
                            <TokenSprite typeId={SAMPLE_TOKEN} surface={TOKEN_SURFACE.INSPECT} scale={2} outline={outline} />
                            <figcaption className="text-xs text-gi-muted">{label}: outline=&quot;{outline}&quot;</figcaption>
                        </figure>
                    ))}
                </div>
            )}
            {[MAP_MODE.DISALLOW, MAP_MODE.DEMOLISH].map(mode => (
                <PixelFrame key={mode} kind="studs" style={{ height: MAT_TOP_BAR_PX }} frameClassName="px-2 ui-text-title text-amber-100">
                    <ModeBannerView mode={mode} />
                </PixelFrame>
            ))}
        </div>
    );
};

/** The top bar's left end: a Region name over its banner, two banners to compare. */
const RegionBannerDemo = () => (
    <div className="flex flex-col gap-3">
        {[['Elderfield', 'b_golden_plains'], ['Rockblight Valley', 'b_lush_forest']].map(([name, banner]) => (
            <PixelFrame key={banner} kind="studs" style={{ height: MAT_TOP_BAR_PX, width: 520 }} frameClassName="flex items-center">
                <MatRegionName readName={() => ({ name, practical: 'Starter Camp' })} readBanner={() => banner} />
            </PixelFrame>
        ))}
    </div>
);

const HoverOutlineDemo = () => {
    const [hover, setHover] = useState(false);
    const known = !!getTokenType(SAMPLE_TOKEN);
    if (!known) return <span className="text-gi-muted">({SAMPLE_TOKEN} not loaded)</span>;
    return (
        <div className="flex items-end gap-6">
            <figure className="flex flex-col items-center gap-1">
                <TokenSprite typeId={SAMPLE_TOKEN} surface={TOKEN_SURFACE.INSPECT} scale={2} outline="hover" />
                <figcaption className="text-xs text-gi-muted">outline=&quot;hover&quot;</figcaption>
            </figure>
            <figure
                className="flex flex-col items-center gap-1"
                onPointerEnter={() => setHover(true)}
                onPointerLeave={() => setHover(false)}
            >
                <TokenSprite typeId={SAMPLE_TOKEN} surface={TOKEN_SURFACE.INSPECT} scale={2} outline={hover ? 'hover' : null} />
                <figcaption className="text-xs text-gi-muted">hover me</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-1">
                <UiSprite src="/assets/ui/u_upgrade.png" outline={ui('--color-ui-white')} />
                <figcaption className="text-xs text-gi-muted">UI sprite (placeholder)</figcaption>
            </figure>
        </div>
    );
};

const AlertOutlineDemo = () => (
    <div className="flex items-end gap-6">
        <figure className="flex flex-col items-center gap-1">
            <StationGearBadge recipe={null} pulsing onClick={() => {}} />
            <figcaption className="text-xs text-gi-muted">gold, steps between two golds</figcaption>
        </figure>
        {getTokenType(SAMPLE_TOKEN) && (
            <figure className="flex flex-col items-center gap-1">
                <TokenSprite typeId={SAMPLE_TOKEN} surface={TOKEN_SURFACE.INSPECT} scale={2} outline="alert" />
                <figcaption className="text-xs" style={{ color: ui('--color-ui-red') }}>
                    Token outline=&quot;alert&quot; is red today
                </figcaption>
            </figure>
        )}
    </div>
);

/** The mat's level-up float, two skills side by side over a patch of ground. */
const LevelUpFloatPatch = () => {
    const [floats] = useState(() => {
        const at = Date.now();
        return [
            { key: 'mining', skillId: 'mining', skillName: 'Mining', from: 49, to: 50, at, held: false },
            { key: 'logging', skillId: 'logging', skillName: 'Logging', from: 12, to: 15, at, held: false }
        ];
    });
    return (
        <div className="px-6 py-4" style={{ background: '#4a6b34' }}>
            <LevelUpFloats floats={floats} unit={2} fit={1} />
        </div>
    );
};

/** Replay draws a fresh patch, so the flash and roll play again. */
const LevelUpFloatDemo = () => {
    const [round, setRound] = useState(0);
    return (
        <div className="flex items-center gap-6">
            <LevelUpFloatPatch key={round} />
            <button
                type="button"
                data-kit-replay
                onClick={() => setRound(r => r + 1)}
                className="px-2 py-1 text-xs font-bold border border-white/20 hover:border-white"
            >
                Replay
            </button>
        </div>
    );
};

/** The mat's problem mark, both colours, each with its hover; and the work bar, running and held. */
const ProblemMarkDemo = () => (
    <div className="flex items-center gap-6 px-4 py-3" style={{ background: '#4a6b34' }}>
        {[
            { problem: { kind: ALERT.INPUTS, severity: SEVERITY.WAITING }, tip: 'Needs Oak Wood', label: 'waiting' },
            { problem: { kind: ALERT.NO_ROOM, severity: SEVERITY.CANT }, tip: 'No room for what it makes', label: 'can’t' }
        ].map(m => (
            <figure key={m.label} className="flex flex-col items-center gap-1">
                <ProblemMark problem={m.problem} tip={m.tip} artUnit={ART_PX} />
                <figcaption className="text-xs text-white/80">{m.label}: hover me</figcaption>
            </figure>
        ))}
    </div>
);

/** The card's small icons, code-drawn placeholders at 2×. */
const CardIconsDemo = () => (
    <div className="flex items-end gap-4 text-gi-text">
        {Object.keys(GLYPHS).map(name => (
            <figure key={name} className="flex flex-col items-center gap-1">
                <PixelGlyph name={name} />
                <figcaption className="text-xs text-gi-muted">{name}</figcaption>
            </figure>
        ))}
    </div>
);

/** One sample item per tile surface (a stand-in object, so the page needs no particular content). */
const TINT_SAMPLES = [
    { type: 'material', id: 'item_oak_wood' },
    { type: 'tool', id: 'item_copper_pickaxe' },
    { type: 'food', id: 'item_shrimp' },
    { type: 'drink', id: 'item_water' },
    { type: 'potion', id: 'item_shrimp_trawler_potion' },
    { type: 'map', id: 'map_forest' },
    { type: 'other', id: null }
];

/** The kit's small controls, live. */
const KitControlsDemo = () => {
    const [on, setOn] = useState(true);
    const [level, setLevel] = useState(60);
    return (
        <div className="flex flex-wrap items-center gap-5">
            <KitButton buttonClassName="px-3 py-1">Save</KitButton>
            <KitButton tone={KIT_BUTTON_TONE.PLAIN} buttonClassName="px-3 py-1">Cancel</KitButton>
            <KitButton tone={KIT_BUTTON_TONE.DANGER} buttonClassName="px-3 py-1">Delete</KitButton>
            <KitButton disabled buttonClassName="px-3 py-1">Can’t</KitButton>
            <PixelToggle on={on} onClick={() => setOn(v => !v)} />
            <input type="range" min="0" max="100" value={level} onChange={e => setLevel(Number(e.target.value))} className="ui-range w-32" />
            <input placeholder="Type here" className="ui-pixel-edge bg-black/40 px-2 py-1 text-sm w-32" />
            <div className="flex gap-1.5">
                <div className="ui-slot-empty w-10 h-10" />
                <div className="ui-slot-empty w-10 h-10 border-[var(--color-ui-white)] bg-white/15" />
            </div>
        </div>
    );
};

/** Bank tiles on their type's surface; hover one for the lighter surface and its tooltip. */
const ItemTilesDemo = () => (
    <div className="flex items-end gap-3 flex-wrap">
        {TINT_SAMPLES.map(({ type, id }) => {
            const item = (id && getItem(id)) || { id: id || 'sample', name: type, type };
            return (
                <figure key={type} className="flex flex-col items-center gap-1">
                    <Tooltip title={item.name} maxWidth={300} content={<ItemTipContent item={item} count={12} />}>
                        <div
                            data-kit-item-tile={type}
                            style={itemTintStyle(item)}
                            className="ui-item-tile w-24 h-24 flex items-center justify-center"
                        >
                            {id && getItem(id) ? <ItemIcon item={item} size={64} title={null} /> : null}
                        </div>
                    </Tooltip>
                    <figcaption className="text-xs text-gi-muted">{type}</figcaption>
                </figure>
            );
        })}
    </div>
);

/** The loadout slots' kind marks, code-drawn placeholders at 2×. */
const SlotMarksDemo = () => (
    <div className="flex items-end gap-4 text-gi-text">
        {Object.keys(SLOT_GLYPHS).map(name => (
            <figure key={name} className="flex flex-col items-center gap-1">
                <PixelGlyph name={name} />
                <figcaption className="text-xs text-gi-muted">{name.replace('slot_', '')}</figcaption>
            </figure>
        ))}
    </div>
);

/** Two Token cards from the Shop's view (no Token on the mat): one with its activity's art, one plain. */
const TokenCardDemo = () => (
    <div className="flex items-start gap-6 flex-wrap">
        {['token_copper_ore_vein', 'token_oak_tree'].map(id => (
            <PixelFrame key={id} style={{ width: 256 + 12 }}>
                <TokenCard typeId={id} />
            </PixelFrame>
        ))}
    </div>
);

/** Two made-up heroes, so the dividers show; the first is the worker. */
const demoHeroes = (skill) => [
    { id: 'kit_hero_a', name: 'Worker', skills: { [skill]: { level: 3, xp: 0 } } },
    { id: 'kit_hero_b', name: 'Veteran', skills: { [skill]: { level: 20, xp: 0 } } }
];

const RecipeListDemo = () => (
    <div className="flex items-start gap-6 flex-wrap">
        {['token_furnace', 'token_wood_foundation'].map(id => {
            const def = getTokenType(id);
            if (!def) return null;
            return (
                <PixelFrame key={id} className="bg-gi-base/80">
                    <div className="p-1.5" style={{ width: 'max-content', minWidth: 256 }}>
                        <RecipeList def={def} heroes={demoHeroes(listSkillOf(def))} workerId="kit_hero_a" onChoose={() => {}} />
                    </div>
                </PixelFrame>
            );
        })}
    </div>
);

const ArrowBarDemo = () => (
    <div className="flex flex-col w-64 h-48 bg-gi-base/60">
        <ArrowScrollList step={100} className="flex-1 min-h-0 p-2 flex flex-col gap-1">
            {Array.from({ length: 12 }, (_, i) => (
                <EntityRibbon key={i} kind="item" id={SAMPLE_ITEMS[i % SAMPLE_ITEMS.length]} quantity={i + 1} size="sm" />
            ))}
        </ArrowScrollList>
    </div>
);

/** Item stubs: a pinned tracker (always open) at the top, a gain, a loss, a first find, and one hovered open. */
const sampleStub = (itemId, added, removed, extra = {}) => ({
    itemId, added, removed, firstAt: 0, lastChangedAt: 0, isNew: false, pinned: false, pinnedAt: null, fading: false, leaving: false, ...extra
});
const ItemStubDemo = () => (
    <div className="flex flex-col items-end">
        <Stub interactive={false} stub={sampleStub(SAMPLE_ITEMS[0], 340, 0, { pinned: true, pinnedAt: 1 })} openRate={120} />
        <Stub interactive={false} stub={sampleStub(SAMPLE_ITEMS[1], 120, 40)} />
        <Stub interactive={false} stub={sampleStub(SAMPLE_ITEMS[2], 2, 14)} />
        <Stub interactive={false} stub={sampleStub(SAMPLE_ITEMS[2], 1, 0, { isNew: true })} />
        <Stub interactive={false} stub={sampleStub(SAMPLE_ITEMS[1], 12, 0)} openRate={80} />
    </div>
);

/** A milestone and a problem banner. */
const sampleBanner = (id, kind, tone, parts, sprite) => ({ id, kind, tone, parts, sprite, subjects: [], ...bannerText(kind, parts) });
const BannerDemo = () => (
    <div className="flex flex-col gap-2">
        <Banner banner={sampleBanner(-1, 'recipe', 'milestone', { heroes: ['Aela'], recipes: ['Cider', 'Apple Pie', 'Stew'] }, { kind: 'item', id: SAMPLE_ITEMS[2] })} />
        <Banner banner={sampleBanner(-2, 'knockout', 'problem', { heroes: ['Bram'], lost: ['Copper Sword'] }, { kind: 'src', src: '/assets/heroes/hm_fighter_por.png' })} />
    </div>
);

// ---------------------------------------------------------------------------------------------
// The page's sections. `status` 'shared' renders a shared component; 'unapproved' a placeholder
// or a new piece waiting for the owner's OK. `slot` names the phase that replaces the entry with
// its shared version.
// ---------------------------------------------------------------------------------------------

export const KIT_SECTIONS = [
    {
        id: 'colours', title: 'Colours', status: 'shared', source: 'CSS variables in src/tailwind.css',
        rule: 'Five meanings, used the same way everywhere.',
        Demo: () => (
            <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-1">
                {KIT_COLOURS.map(c => (
                    <div key={c.cssVar} className="contents" data-kit-colour={c.cssVar}>
                        <span className="inline-block w-6 h-6 border border-white/20" style={{ background: ui(c.cssVar) }} />
                        <span className="font-bold" style={{ color: ui(c.cssVar) }}>{c.name}</span>
                        <span className="text-xs text-gi-muted"><code>{c.cssVar}</code>: {c.means}</span>
                    </div>
                ))}
            </div>
        )
    },
    {
        id: 'hover-outline', title: 'Hover outline', status: 'shared', source: 'PixelArt / TokenSprite outline="hover"',
        rule: 'A 1-art-pixel white outline. No glows, bobbing or scaling.',
        Demo: HoverOutlineDemo
    },
    {
        id: 'alert-outline', title: 'Alert outline', status: 'shared', source: 'StationGearBadge (the recipe gear)',
        rule: 'A gold 1-art-pixel outline that may pulse between two golds, never moving or resizing.',
        Demo: AlertOutlineDemo
    },
    {
        id: 'ribbon', title: 'Ribbon row', status: 'shared', source: 'EntityRibbon',
        rule: 'Sprite, name, count, wherever items are listed with room. Costs read have/need, red when short.',
        Demo: () => (
            <div className="flex flex-col gap-1.5 w-80">
                <EntityRibbon kind="item" id={SAMPLE_ITEMS[0]} have={3} required={10} size="sm" />
                <EntityRibbon kind="item" id={SAMPLE_ITEMS[1]} have={5} required={5} size="sm" />
                <EntityRibbon kind="item" id={SAMPLE_ITEMS[2]} minQty={1} maxQty={3} chance={25} size="sm" />
                <EntityRibbon kind="item" id={SAMPLE_ITEMS[0]} amount={5900} sign="+" size="sm" />
            </div>
        )
    },
    {
        id: 'bars', title: 'Bars', status: 'shared', source: 'VitalBar (the hero panel)',
        rule: 'HP is a bar; in the hero panel its numbers show beside it.',
        Demo: () => (
            <div className="w-48 flex flex-col gap-1">
                {[[62, 100], [30, 100], [12, 100]].map(([value, max]) => (
                    <VitalBar key={value} value={value} max={max} barClass={vitalTone(value, max)} />
                ))}
            </div>
        )
    },
    {
        id: 'tooltip', title: 'Tooltip', status: 'shared', source: 'Tooltip (the Bank, the Shop, the hero panel)',
        rule: 'One gold-edged tooltip that follows the cursor, offset so it never covers what is under it, flipping at the screen edges. No header and no X. Browser tips only on icon buttons.',
        Demo: TooltipDemo
    },
    {
        id: 'text-sizes', title: 'Text sizes', status: 'unapproved',
        source: 'ui-text-title, ui-text-body, ui-text-small, ui-text-display (src/tailwind.css); what the old bracketed pixel sizes are now written as',
        rule: 'Three sizes in panels (title, body, small), plus one display size for mat celebrations. The Text size setting scales all four.',
        Demo: TextSizesDemo
    },
    {
        id: 'pill', title: 'Pill', status: 'unapproved', source: 'none yet',
        rule: 'Sprite and count, name on hover, only where space is tight. Red when short.',
        Demo: () => (
            <div className="flex gap-4">
                <KitPill itemId={SAMPLE_ITEMS[0]} have={3} need={10} />
                <KitPill itemId={SAMPLE_ITEMS[1]} have={5} need={5} />
            </div>
        )
    },
    {
        id: 'header', title: 'Panel header and close X', status: 'shared',
        source: 'PanelHeader and CloseX (every window, the Bank, the Shop, the hero panel, the Token card)',
        rule: 'Title on the left with an optional sprite; ui_cancel_red.png (16 px) at 2× top right.',
        Demo: () => (
            <div className="w-80 bg-gi-surface">
                <KitHeader title="Item Bank" sprite="/assets/ui/u_upgrade.png" />
                <div className="px-2 pb-2 text-xs text-gi-muted">Panel body</div>
            </div>
        )
    },
    {
        id: 'main-button', title: 'Main action button', status: 'unapproved', source: 'KitButton (base/KitButton.jsx); the Hall’s Upgrade button wears the same frame',
        rule: 'Chamfer pixel frame, gold text. When it can’t be used it greys out and the reason shows underneath.',
        Demo: () => (
            <div className="flex flex-wrap items-start gap-6">
                <KitMainButton label="Upgrade" cost={[{ itemId: SAMPLE_ITEMS[0], have: 10, need: 10 }]} />
                <KitMainButton
                    label="Upgrade"
                    cost={[{ itemId: SAMPLE_ITEMS[0], have: 3, need: 10 }, { itemId: SAMPLE_ITEMS[1], have: 5, need: 5 }]}
                    blockedReason="Needs 7 more Oak Wood"
                />
            </div>
        )
    },
    {
        id: 'shine', title: 'Shine', status: 'unapproved', source: 'ui-shine (src/tailwind.css); Upgrade and Settle use it',
        rule: 'Main-action buttons only: one fast, stepped, solid diagonal glint across the whole button when hovered, once per hover, over its text and icons. No glint with reduced motion.',
        Demo: () => (
            <div className="flex flex-wrap items-start gap-6">
                <KitMainButton label="Hover me" cost={[{ itemId: SAMPLE_ITEMS[0], have: 10, need: 10 }]} />
            </div>
        )
    },
    {
        id: 'icon-button', title: 'Icon button', status: 'unapproved', source: 'none yet',
        rule: 'The bare sprite, white outline on hover.',
        Demo: () => (
            <div className="flex gap-4 items-center">
                <CloseX onClick={() => {}} />
                <KitIconButton src="/assets/ui/u_upgrade.png" label="Upgrade" />
                <KitIconButton src="/assets/ui/u_add_green.png" label="Add" />
            </div>
        )
    },
    {
        id: 'tabs', title: 'Tabs', status: 'unapproved', source: 'none shared (the Atlas has its own page tabs, below)',
        rule: 'Sprite + word. The open one has a 1-art-pixel gold line under it and bright text; the others muted. Never boxed.',
        Demo: KitTabs
    },
    {
        id: 'arrow-bars', title: 'Arrow bars', status: 'shared', source: 'ArrowScrollList',
        rule: 'No scrollbars: an arrow bar above and below that dims at the end but keeps its space. A click scrolls about two rows, holding repeats, the wheel works.',
        Demo: ArrowBarDemo
    },
    {
        id: 'frames', title: 'Pixel frames', status: 'unapproved', source: 'PixelFrame, ui-frame-studs / ui-frame-chamfer (src/tailwind.css); the mat’s top bar wears studs',
        rule: 'Nine-slice pictures: studs on big docked panels, chamfer on small floating ones; a hard shadow under every panel.',
        Demo: () => (
            <div className="flex flex-wrap gap-8 items-start">
                <PixelFrame kind="studs" className="w-56">
                    <div className="bg-gi-surface p-2 text-sm">Studs: Bank, Shop, hero panel</div>
                </PixelFrame>
                <PixelFrame kind="chamfer" className="w-48">
                    <div className="p-2 text-xs">Chamfer: tooltips, pop-ups, toasts</div>
                </PixelFrame>
            </div>
        )
    },
    {
        id: 'level-up-float', title: 'Level-up float', status: 'unapproved', source: 'LevelUpFloat (over a hero on the mat)',
        rule: 'The skill icon at 2× and the level in the display size, no frame, hard shadow. The old number flashes a 1-art-pixel gold outline, rolls up in stepped jumps to the new one, stays about 30 s, then fades in steps.',
        Demo: LevelUpFloatDemo
    },
    {
        id: 'xp-bar', title: 'XP bar', status: 'unapproved', source: 'none shared',
        rule: 'XP is a thin bar; the exact number shows on hover.',
        Demo: () => <KitXpBar cur={1154} max={1500} />
    },
    {
        id: 'problem-mark', title: 'Problem mark', status: 'unapproved', source: 'ProblemMark (the mat, one per Token nobody works)',
        rule: 'One mark at the centre of a Token nobody works (a worked Token’s problem is on its work plate), yellow while it waits (items, a Token beside it, a choice), red when it can’t (no room, the cap, the hero’s skill). Drawn at the Token’s art-pixel size with a hard shadow. Its hover says exactly what, in the mark’s colour. Placeholder: the alert “!” sprites.',
        Demo: ProblemMarkDemo
    },
    {
        id: 'token-card', title: 'Token card', status: 'unapproved', source: 'TokenCard (the card a click on a Token opens)',
        rule: 'The 256 px activity scene fills the card behind the information, at 1×; a Token with none gets a plain card. Each block sits in a see-through box: name and X; work; cycle; the current recipe (needs, tools as hollow bars, makes); lifecycle; drops. Every icon and number explains itself on hover.',
        Demo: TokenCardDemo
    },
    {
        id: 'recipe-list', title: 'Recipe list', status: 'unapproved', source: 'RecipeList (the card’s Change recipe; a Foundation’s Choose what to build)',
        rule: 'One line per recipe, by level: inputs as pills with have/need (red when short), needed Tokens as hollow bars (red when not beside it), then the main output as the headline, byproducts muted with their chance, XP and time muted at the end. A thin line with a hero’s face sits under the last recipe they can run; the worker’s face is ringed gold. The next two out of reach show as ??? silhouettes. Search box and Back at the top. Hover: white outline; the current recipe: gold.',
        Demo: RecipeListDemo
    },
    {
        id: 'card-icons', title: 'Card icons', status: 'unapproved', source: 'PixelGlyph (the Token card’s lines)',
        rule: 'Placeholders drawn in code until the owner’s sprites: clock, charges, regrow, spawn, grow, turn. 8×8 at 2×, in the text colour.',
        Demo: CardIconsDemo
    },
    {
        id: 'item-tiles', title: 'Item tiles and their tooltip', status: 'unapproved',
        source: 'ui-item-tile + itemTint.js (the Bank’s tiles, a hero’s loadout slots); ItemTip (the Bank’s tooltip)',
        rule: 'Each tile is square, with the frames’ 1-art-pixel line, and sits on a dark, low-colour surface chosen by the item’s type (material, tool, food, drink, potion, map; anything else plain); on hover the surface is a little lighter and the line white, so a sprite’s dark outline reads. A surface, not a colour meaning. Hover shows everything about the item: name, type and count, Equippable: <slot>, its tool or what it restores, tags, description, and for a map what it writes.',
        Demo: ItemTilesDemo
    },
    {
        id: 'kit-controls', title: 'Buttons, switch, slider, boxes, slots', status: 'unapproved',
        source: 'KitButton, PixelToggle (base/KitButton.jsx); ui-pixel-edge, ui-range, ui-slot-empty (src/tailwind.css)',
        rule: 'Every boxed button is the chamfer button: gold words for the main action, muted for a second choice, red for one that loses something. The switch, the slider, a box to type in and a select are square with the frames’ 1-art-pixel line, white on hover. An empty slot or a choice tile is a dark well with a dimmed line; the chosen one has a white line.',
        Demo: KitControlsDemo
    },
    {
        id: 'slot-marks', title: 'Loadout slot kind marks', status: 'unapproved', source: 'PixelGlyph slot_* (a hero’s loadout slots, bottom-right corner)',
        rule: 'Placeholders drawn in code until the owner’s sprites: hand, hat, chest, trinket, food, drink, consumable, and a ? for a kind with no mark. 8×8 at 2× with a hard shadow, in the bottom-right corner of a filled slot.',
        Demo: SlotMarksDemo
    },
    {
        id: 'item-stubs', title: 'Item stubs', status: 'unapproved', source: 'ItemStubColumn (top right of the mat)',
        rule: 'Amount then the sprite (32 px) in a chamfer frame flush to the right edge of the screen (no right side), each stub as wide as its content, sliding out of the edge when new and back in when it fades or is cleared. One stub per item showing its net flow since it appeared or was reset: green gain, red loss. A first find is a gold frame led by "New!". Hover grows the same box left into one line: amount, sprite, name, net per hour. Left-click pins or unpins; pinned stubs sit at the top with no header, always show the open line and never fade. New stubs join the bottom, an unpinned one goes to the top of the rest, and a stub whose place changes glides there. Right-click clears an unpinned stub and sets a pinned one back to +0. No icons.',
        Demo: ItemStubDemo
    },
    {
        id: 'banners', title: 'Banners', status: 'unapproved', source: 'BannerStack (top centre of the mat)',
        rule: 'About 480 px, a big sprite, a title and one line, studded frame: gold edge for a milestone (one shine pass), red for a problem. Drops from behind the top bar with one overshoot; a click dismisses. Three stack, then "+N". Gold and red frames are code placeholders until the owner draws the ribbon.',
        Demo: BannerDemo
    },
    {
        id: 'atlas-tabs', title: 'Atlas page tabs', status: 'unapproved', source: 'AtlasTome (the Atlas only)',
        rule: 'The Atlas’s own variant of the tabs: cloth page tabs stacked down the left edge of the book, coming out from under its cover. The open one stands further out with bright text and a 1-art-pixel gold edge along each long side; the others are muted. Code placeholders until the owner draws the tabs.',
        Demo: BookTabDemo
    },
    {
        id: 'atlas-maps', title: 'Cartography maps and slots', status: 'unapproved', source: 'CartographyTable, MapPieces (the Atlas only)',
        rule: 'Each map is its 64 px sprite at 1× with its count under it, like the Bank’s tiles, greyed once every copy is slotted; hover names it and says what it adds. A slot is a 68 px box: empty, a faint dashed outline of a map; filled, the map’s sprite. The Region’s preview beside them is a tiny real map: the mat’s own ground and each Token’s sprite shrunk by a whole number, drawn at the UI’s 2×.',
        Demo: MapPiecesDemo
    },
    {
        id: 'map-modes', title: 'Map mode outlines and banners', status: 'unapproved',
        source: 'MatModeControls (the top bar), outline="muted" / "danger"',
        rule: 'While a map mode is on, the hovered Token’s outline takes the mode’s colour: muted grey for Disallow, red for Demolish (muted grey on a Token the mode cannot act on). The bar’s centre says what a click does; Demolish’s in red.',
        Demo: MapModesDemo
    },
    {
        id: 'region-banner', title: 'Region name on its banner', status: 'unapproved',
        source: 'MatRegionName (the top bar’s left end)',
        rule: 'The Region’s banner (the one the Atlas shows) lies behind its name at 2×, up to one picture (512 px) across, showing the band just below its middle; crisp on the left and fading to the bar’s fill by the end of the bar’s left part. The name is the display size (ui-text-bar-name, the bar’s only one) with a 2 px black outline so it reads over any picture. Hover: a white outline round the whole banner; click opens the Atlas.',
        Demo: RegionBannerDemo
    },
    {
        id: 'work-plate', title: 'Work plate (who is working what)', status: 'shared',
        source: 'WorkPlateView, drawn on the mat by WorkPlateLayer (one per hero at work)',
        rule: 'While a hero works a Token, one chamfer-framed plate on the seam between them, just below their feet, over any loot lying there. At rest: what is being made, with the cycle filling along the plate’s foot in whole art pixels, and the charges left; while the Token waits, exactly what it waits for as a red have/need pill, the frame gold (red when it can’t go on) and the cycle held grey. Resting the pointer on the hero, the Token or the plate opens the full line: skill, output, charges, time to the next one, each with its tooltip; the names drop below it. Pressing it grabs the Token. A Token nobody works keeps its own “!” and hover rings. A fight has no plate yet: its place is kept for the fight’s link. Drawn here at the mat’s 1920 × 1080 size; hover any part.',
        Demo: WorkPlateDemo
    },
    {
        id: 'combat-screen', title: 'Combat screen (mock-ups A, B, C)', status: 'unapproved',
        source: 'CombatMockups (pictures only, nothing in the game uses them)',
        rule: 'Three options for the fight on the mat and its panel, for the owner to pick from: HP bars with the number and the percentage, a floating number for every hit both ways, a fight icon above each fight that opens the panel over the playmat, the enemy card on hover, and the bubble row while fighting. The same fixture fight in each: Aela (Melee 20) with Valor and Ironskin, poisoned ×2, against a Goblin Warlord (a Brute, Venomous) at 0:12. Placeholder icons are drawn in code.',
        Demo: CombatMockups
    }
];

const SectionCard = ({ section }) => {
    const { id, title, source, rule, slot, Demo } = section;
    return (
        <section data-kit-section={id} className="flex flex-col gap-2 py-3 border-b border-white/10">
            <header className="flex items-baseline gap-3 flex-wrap">
                <h3 className="text-sm font-bold text-gi-text">{title}</h3>
                {slot && <span className="text-xs font-bold" style={{ color: ui('--color-ui-gold') }}>{slot} slot</span>}
                <span className="text-xs text-gi-muted">{source}</span>
            </header>
            <p className="text-xs text-gi-muted">{rule}</p>
            <div className="py-1"><Demo /></div>
        </section>
    );
};

/** The style sheet page itself: a full-screen dev overlay. Escape or the X closes it. */
export const StyleSheetPage = ({ onClose }) => {
    useEscapeLayer(true, () => onClose?.());

    const shared = KIT_SECTIONS.filter(s => s.status === 'shared');
    const unapproved = KIT_SECTIONS.filter(s => s.status === 'unapproved');
    return (
        <div
            data-style-sheet-page
            role="dialog"
            aria-label="Style sheet"
            className="fixed inset-0 z-(--z-style-sheet) bg-gi-base text-gi-text overflow-y-auto pointer-events-auto"
        >
            <div className="max-w-4xl mx-auto px-6 py-4">
                <div className="sticky top-0 z-60 bg-gi-base flex items-center gap-3 py-2 border-b border-white/10">
                    <h2 className="font-bold">Style sheet</h2>
                    <span className="text-xs text-gi-muted">Every standard piece from UI_STYLE, live.</span>
                    <span className="flex-1" />
                    <CloseX onClick={onClose} label="Close style sheet" data-style-sheet-close />
                </div>

                <h2 data-kit-group="shared" className="mt-4 font-bold" style={{ color: ui('--color-ui-green') }}>
                    Shared pieces
                </h2>
                {shared.map(s => <SectionCard key={s.id} section={s} />)}

                <h2 data-kit-group="unapproved" className="mt-6 font-bold" style={{ color: ui('--color-ui-gold') }}>
                    New, unapproved
                </h2>
                <p className="text-xs text-gi-muted">
                    Pieces waiting for the owner’s OK: placeholders for what UI_STYLE describes, and new pieces only the screen their entry names uses so far.
                </p>
                {unapproved.map(s => <SectionCard key={s.id} section={s} />)}
            </div>
        </div>
    );
};

export default StyleSheetPage;
