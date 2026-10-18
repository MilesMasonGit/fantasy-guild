// The style sheet page: every standard UI piece from UI_STYLE, live, for builders to copy from
// and the owner to eye-check. Opened from the QA panel.
// ⚠️ Pieces in the "new, unapproved" group are placeholders drawn here only: no screen uses them
// yet. Once a piece has one shared version, its entry points at that version and moves to the
// shared group.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn.js';
import { EntityRibbon } from '../components/base/EntityRibbon.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { VitalBar } from '../components/base/VitalBar.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../components/base/TokenSprite.jsx';
import { StationGearBadge } from '../components/board/TokenBadges.jsx';
import { Tooltip } from '../components/base/Tooltip.jsx';
import { TEXT_SIZES } from '../components/base/textSizes.js';
import { ArrowScrollList } from '../components/base/ArrowScrollList.jsx';
import { LevelUpFloats } from '../components/board/LevelUpFloat.jsx';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';

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

// The two 7×7 nine-slice pictures and their black shadow copies, from
// docs/active/research/pixel_borders_demo.html (approach B, the shipping art).
const FRAME_ART = {
    chamfer: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAHCAYAAADEUlfTAAAAJ0lEQVR4nGNggILpxWL/YZgBGYAEeLk44BiuAF0CRQH5knjtxOdaAJ98OWfLy6Z1AAAAAElFTkSuQmCC',
    chamferShadow: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAHCAYAAADEUlfTAAAAHklEQVR4nGNgQID/SBgF/MeCcUrAFZAviddOnK4FAGcpJNzTXOuEAAAAAElFTkSuQmCC',
    studs: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAHCAYAAADEUlfTAAAAL0lEQVR4nGOYXiz2HxdmABF/n3WBObxcHP+R+QwwVSAJGEbRiSyBrICwToJ2YsMA/ElgF+rVz5AAAAAASUVORK5CYII=',
    studsShadow: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAHCAYAAADEUlfTAAAAEUlEQVR4nGNgYGD4jwcPIUkAEsQw0PomzpoAAAAASUVORK5CYII='
};

const nineSlice = (src) => ({
    borderStyle: 'solid',
    borderWidth: 3 * ART_PX,
    borderImage: `url(${src}) 3 fill / ${3 * ART_PX}px stretch`,
    imageRendering: 'pixelated'
});

/** A pixel frame: the nine-slice picture with its hard shadow, 2 art pixels down-right. */
export const KitFrame = ({ kind = 'chamfer', className, children, ...rest }) => (
    <div className={cn('relative isolate', className)} data-kit-frame={kind} {...rest}>
        <div
            aria-hidden="true"
            className="absolute -z-10 pointer-events-none"
            style={{
                inset: 0,
                transform: `translate(${2 * ART_PX}px, ${2 * ART_PX}px)`,
                ...nineSlice(FRAME_ART[`${kind}Shadow`])
            }}
        />
        <div style={nineSlice(FRAME_ART[kind])} className="relative">
            {children}
        </div>
    </div>
);

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
            <KitFrame kind="chamfer" className={cn(blocked && 'opacity-50 grayscale')}>
                <button
                    type="button"
                    disabled={blocked}
                    data-kit-main-button
                    className={cn('flex items-center gap-3 px-2 py-0.5 font-bold', blocked ? 'cursor-not-allowed' : 'cursor-pointer')}
                    style={{ color: blocked ? ui('--color-ui-muted') : ui('--color-ui-gold') }}
                >
                    {label}
                    {cost.map(c => <KitPill key={c.itemId} {...c} />)}
                </button>
            </KitFrame>
            {blocked && <span className="text-xs" style={{ color: ui('--color-ui-red') }}>{blockedReason}</span>}
        </div>
    );
};

const KitHeader = ({ title, sprite }) => (
    <div data-kit-header className="flex items-center gap-2 px-2 py-1">
        {sprite && <UiSprite src={sprite} artSize={16} />}
        <span className="font-bold text-gi-text">{title}</span>
        <span className="flex-1" />
        <KitIconButton src="/assets/ui/u_cancel_red.png" label="Close" />
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

const ArrowBarDemo = () => (
    <div className="flex flex-col w-64 h-48 bg-gi-base/60">
        <ArrowScrollList step={100} className="flex-1 min-h-0 p-2 flex flex-col gap-1">
            {Array.from({ length: 12 }, (_, i) => (
                <EntityRibbon key={i} kind="item" id={SAMPLE_ITEMS[i % SAMPLE_ITEMS.length]} quantity={i + 1} size="sm" />
            ))}
        </ArrowScrollList>
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
        id: 'bars', title: 'Bars', status: 'shared', source: 'VitalBar',
        rule: 'HP is a bar; in the hero panel its numbers show beside it.',
        Demo: () => (
            <div className="w-48 flex flex-col gap-1">
                <VitalBar label="HP" value={62} max={100} barClass="bg-gi-hp" />
                <VitalBar label="NRJ" value={30} max={100} barClass="bg-[var(--color-energy)]" />
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
        source: 'ui-text-title, ui-text-body, ui-text-small, ui-text-display (src/tailwind.css); no panel uses them yet',
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
        id: 'header', title: 'Panel header and close X', status: 'unapproved',
        source: 'none shared: Bank, Shop and hero panel each draw their own',
        rule: 'Title on the left with an optional sprite; ui_cancel_red.png (16 px) at 2× top right.',
        Demo: () => (
            <div className="w-80 bg-gi-surface">
                <KitHeader title="Item Bank" sprite="/assets/ui/u_upgrade.png" />
                <div className="px-2 pb-2 text-xs text-gi-muted">Panel body</div>
            </div>
        )
    },
    {
        id: 'main-button', title: 'Main action button', status: 'unapproved', source: 'none yet',
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
        id: 'icon-button', title: 'Icon button', status: 'unapproved', source: 'none yet',
        rule: 'The bare sprite, white outline on hover.',
        Demo: () => (
            <div className="flex gap-4 items-center">
                <KitIconButton src="/assets/ui/u_cancel_red.png" label="Close" />
                <KitIconButton src="/assets/ui/u_upgrade.png" label="Upgrade" />
                <KitIconButton src="/assets/ui/u_add_green.png" label="Add" />
            </div>
        )
    },
    {
        id: 'tabs', title: 'Tabs', status: 'unapproved', source: 'none shared: the Atlas tabs are the nearest',
        rule: 'Sprite + word. The open one has a 1-art-pixel gold line under it and bright text; the others muted. Never boxed.',
        Demo: KitTabs
    },
    {
        id: 'arrow-bars', title: 'Arrow bars', status: 'shared', source: 'ArrowScrollList',
        rule: 'No scrollbars: an arrow bar above and below that dims at the end but keeps its space. A click scrolls about two rows, holding repeats, the wheel works.',
        Demo: ArrowBarDemo
    },
    {
        id: 'frames', title: 'Pixel frames', status: 'unapproved', source: 'none yet (the research demo’s art)',
        rule: 'Nine-slice pictures: studs on big docked panels, chamfer on small floating ones; a hard shadow under every panel.',
        Demo: () => (
            <div className="flex flex-wrap gap-8 items-start">
                <KitFrame kind="studs" className="w-56">
                    <div className="bg-gi-surface p-2 text-sm">Studs: Bank, Shop, hero panel</div>
                </KitFrame>
                <KitFrame kind="chamfer" className="w-48">
                    <div className="p-2 text-xs">Chamfer: tooltips, pop-ups, toasts</div>
                </KitFrame>
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
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const shared = KIT_SECTIONS.filter(s => s.status === 'shared');
    const unapproved = KIT_SECTIONS.filter(s => s.status === 'unapproved');
    return (
        <div
            data-style-sheet-page
            role="dialog"
            aria-label="Style sheet"
            className="fixed inset-0 z-[10000] bg-gi-base text-gi-text overflow-y-auto pointer-events-auto"
        >
            <div className="max-w-4xl mx-auto px-6 py-4">
                <div className="sticky top-0 z-[60] bg-gi-base flex items-center gap-3 py-2 border-b border-white/10">
                    <h2 className="font-bold">Style sheet</h2>
                    <span className="text-xs text-gi-muted">Every standard piece from UI_STYLE, live.</span>
                    <span className="flex-1" />
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close style sheet"
                        data-style-sheet-close
                        className="p-0 cursor-pointer"
                    >
                        <UiSprite src="/assets/ui/u_cancel_red.png" alt="Close" />
                    </button>
                </div>

                <h2 data-kit-group="shared" className="mt-4 font-bold" style={{ color: ui('--color-ui-green') }}>
                    Shared pieces
                </h2>
                {shared.map(s => <SectionCard key={s.id} section={s} />)}

                <h2 data-kit-group="unapproved" className="mt-6 font-bold" style={{ color: ui('--color-ui-gold') }}>
                    New, unapproved
                </h2>
                <p className="text-xs text-gi-muted">
                    Placeholders for pieces UI_STYLE describes but no screen shares yet. Nothing in the game uses them.
                </p>
                {unapproved.map(s => <SectionCard key={s.id} section={s} />)}
            </div>
        </div>
    );
};

export default StyleSheetPage;
