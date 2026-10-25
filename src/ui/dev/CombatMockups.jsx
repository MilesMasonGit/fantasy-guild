// The combat screen mock-ups on the style sheet page: three options for the owner
// to pick from by screenshot. Static pictures built from the real sprites and the pixel kit, fed
// the fixture fight in `combatMockups.js`; nothing in the game uses them.
// Each option shows the same four things: a fight on the mat (HP bars with "number · %", floating
// numbers, the fight icon, the bubble row at the feet), every floating number side by side, the
// enemy card on hover (fought before, never fought), and the fight panel open over the playmat.
// Geometry is the mat's at 1920 × 1080: art at 2×, the mat at a fit of 0.9, the hero standing
// `artRadius + STAND_GAP` from the enemy's centre, the pinned flag at the top of its art circle.

import { PixelFrame, FRAME_KIND } from '../components/base/PixelFrame.jsx';
import { PanelHeader, CloseX } from '../components/base/CloseX.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { SkillIcon } from '../components/base/SkillIcon.jsx';
import { TokenSprite } from '../components/base/TokenSprite.jsx';
import { Tooltip } from '../components/base/Tooltip.jsx';
import { AnimatedHeroSprite } from '../components/board/AnimatedHeroSprite.jsx';
import { FlagMark } from '../components/board/FlagMark.jsx';
import { FLAG_PX, POLE_BASE, PIN_INSET } from '../components/board/flagGeometry.js';
import { artRadius } from '../../config/matGeometry.js';
import { STAND_GAP } from '../../systems/board/HeroMotion.js';
import { FIGHT, ENEMY_CARDS, FLOAT_SAMPLES, COMBAT_GLYPHS, COMBAT_OPTIONS, hpLabel, hpPercent } from './combatMockups.js';

/** One art pixel of the mat on screen at 1920 × 1080. */
const U = 2;
/** A 1×1 Token's art and a hero's art, on screen. */
const ART = 64 * U;
const FIT = 0.9;
/** How far a fighting hero stands from the enemy's centre, on screen. */
const STAND = Math.round((artRadius(1) + STAND_GAP) * FIT);
/** The grass under the mock-ups: the mat's own mean green (the real mat is textured). */
const GROUND = '#5d9440';
/** Today's HP bar fill on the mat (`healthBar.js`). */
const HP_FILL = '#F09595';
const TRACK = 'rgba(10, 8, 6, 0.85)';
const EDGE = '#0d0a08';

const COLOUR = Object.freeze({
    white: 'var(--color-ui-white)',
    red: 'var(--color-ui-red)',
    green: 'var(--color-ui-green)',
    gold: 'var(--color-ui-gold)',
    muted: 'var(--color-ui-muted)',
    // Option B only: two colours the kit does not have yet (a new meaning needs the owner's OK).
    poison: '#b98cff',
    burn: '#ff8c3a'
});

/** The kit's text sizes in screen px at the default Text size (main.css). */
const SIZE = Object.freeze({ small: 14, body: 16, title: 18, display: 32 });

/** A hard outline of `px` around text: eight unblurred copies, no soft shadow. */
const edge = (px, colour = '#000') => [[px, 0], [-px, 0], [0, px], [0, -px], [px, px], [-px, px], [px, -px], [-px, -px]]
    .map(([x, y]) => `${x}px ${y}px 0 ${colour}`).join(', ');

// ---------------------------------------------------------------------------------------------
// Placeholder glyphs (8×8, drawn in code), one <img> each
// ---------------------------------------------------------------------------------------------

const glyphCache = new Map();

/**
 * A glyph as an SVG picture in `colour`; `outlined` adds a one-pixel black ring around its lit
 * pixels (a 10×10 picture), so a bare glyph reads on the grass with no filter.
 */
export function glyphSrc(name, colour = '#ffffff', outlined = false) {
    const key = `${name}|${colour}|${outlined}`;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const rows = COMBAT_GLYPHS[name] || [];
    const pad = outlined ? 1 : 0;
    const lit = new Set();
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') lit.add(`${x + pad},${y + pad}`); }));
    let ring = '';
    if (outlined) {
        const seen = new Set();
        for (const p of lit) {
            const [x, y] = p.split(',').map(Number);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const q = `${x + dx},${y + dy}`;
                    if (!lit.has(q) && !seen.has(q)) { seen.add(q); ring += `M${x + dx} ${y + dy}h1v1h-1z`; }
                }
            }
        }
    }
    let body = '';
    for (const p of lit) { const [x, y] = p.split(','); body += `M${x} ${y}h1v1h-1z`; }
    const n = 8 + 2 * pad;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${n}' height='${n}' shape-rendering='crispEdges'>` +
        (ring ? `<path fill='#000' d='${ring}'/>` : '') + `<path fill='${colour}' d='${body}'/></svg>`;
    const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    glyphCache.set(key, uri);
    return uri;
}

/** The kit colours as plain values, for glyph pictures (an SVG cannot read a CSS variable). */
const RAW = Object.freeze({
    white: '#ffffff', red: '#ff2d55', green: '#09b554', gold: '#fbbf24', muted: '#737373',
    poison: '#b98cff', burn: '#ff8c3a', text: '#e5e5e5'
});

const Glyph = ({ name, colour = RAW.white, scale = 2, outlined = false, style, ...rest }) => {
    const n = (outlined ? 10 : 8) * scale;
    return (
        <img
            src={glyphSrc(name, colour, outlined)}
            alt=""
            draggable={false}
            data-glyph={name}
            className="select-none pointer-events-none shrink-0"
            style={{ width: n, height: n, imageRendering: 'pixelated', ...style }}
            {...rest}
        />
    );
};

// ---------------------------------------------------------------------------------------------
// The ground and the fighters
// ---------------------------------------------------------------------------------------------

const Ground = ({ w, h, children, ...rest }) => (
    <div className="relative overflow-hidden" style={{ width: w, height: h, background: GROUND }} {...rest}>
        {children}
    </div>
);

/** The fight's points on screen, from the enemy's centre (`tx`, `ty`). */
const fightPoints = (tx, ty) => ({
    tx, ty,
    hx: tx + STAND,
    seam: Math.round(tx + STAND / 2),
    /** The top of both art boxes: bars stand just above it. */
    head: ty - ART / 2,
    foot: ty + ART / 2,
    poleY: Math.round(ty - (artRadius(1) - PIN_INSET) * FIT)
});

/** The pinned flag, the enemy and the hero facing it, as the mat draws them. */
const Fighters = ({ p, enemyType = FIGHT.enemy.typeId, withHero = true, flag = true }) => (
    <>
        {flag && (
            <FlagMark colour="orange" size={FLAG_PX} className="absolute" style={{ left: p.tx - POLE_BASE.x, top: p.poleY - POLE_BASE.y }} />
        )}
        <div className="absolute" style={{ left: p.tx - ART / 2, top: p.ty - ART / 2, width: ART, height: ART }}>
            <TokenSprite typeId={enemyType} size={ART} outline={null} />
        </div>
        {withHero && (
            <div className="absolute" style={{ left: p.hx - ART / 2, top: p.ty - ART / 2, width: ART, height: ART }}>
                <AnimatedHeroSprite src={FIGHT.hero.sheet} size={ART} animationState="combat" facingLeft />
            </div>
        )}
    </>
);

/** A thing placed with its centre-bottom at (x, y). */
const At = ({ x, y, children, anchor = 'bottom', ...rest }) => (
    <div
        className="absolute flex flex-col items-center"
        style={{ left: x, top: y, transform: anchor === 'bottom' ? 'translate(-50%, -100%)' : anchor === 'top' ? 'translate(-50%, 0)' : 'translate(-50%, -50%)' }}
        {...rest}
    >
        {children}
    </div>
);

/** A mouse pointer drawn in code, where the player's pointer rests. */
const Pointer = ({ x, y }) => (
    <svg
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{ left: x, top: y }}
        width={14} height={22} viewBox="0 0 7 11" shapeRendering="crispEdges"
    >
        <path fill="#000" d="M0 0h1v11h-1zM1 1h1v1h-1zM2 2h1v1h-1zM3 3h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v2h-1zM4 7h2v1h-2zM4 8h1v2h-1zM5 9h1v1h-1zM3 9h1v1h-1zM1 9h2v1h-2zM2 8h1v1h-1z" />
        <path fill="#fff" d="M1 2h1v7h-1zM2 3h1v5h-1zM3 4h1v5h-1zM4 5h1v2h-1zM5 6h1v1h-1z" />
    </svg>
);

// ---------------------------------------------------------------------------------------------
// HP bars
// ---------------------------------------------------------------------------------------------

/** The fill, cut to whole art pixels. */
const fillPx = (cur, max, w) => Math.round((hpPercent(cur, max) / 100) * (w / U)) * U;

/** A bare bar: dark track, 1-art-pixel black edge, the fill; `children` written over it. */
const Bar = ({ cur, max, w, h, edged = true, children, ...rest }) => (
    <div
        className="relative shrink-0"
        style={{ width: w, height: h, background: TRACK, boxShadow: edged ? `0 0 0 ${U}px ${EDGE}` : undefined }}
        {...rest}
    >
        <div className="absolute left-0 top-0 bottom-0" style={{ width: fillPx(cur, max, w), background: HP_FILL }} />
        {children}
    </div>
);

const BarLabel = ({ children, size = SIZE.small, align = 'center', style }) => (
    <span
        className="font-bold leading-none whitespace-nowrap tabular-nums text-white"
        style={{ fontSize: size, textShadow: edge(U / 2 + 1), textAlign: align, ...style }}
    >
        {children}
    </span>
);

// ---------------------------------------------------------------------------------------------
// Floating numbers
// ---------------------------------------------------------------------------------------------

const FloatText = ({ size, colour, edgeColour = '#000', children }) => (
    <span
        className="font-bold leading-none whitespace-nowrap tabular-nums"
        style={{ fontSize: size, color: colour, textShadow: edge(U, edgeColour) }}
    >
        {children}
    </span>
);

/** The colour a hit's number takes: white on the enemy, red on the hero. */
const sideColour = (s) => (s.on === 'enemy' ? COLOUR.white : COLOUR.red);

/** How each option draws one floating number. */
const FLOAT_LOOK = Object.freeze({
    A: (s) => {
        switch (s.kind) {
            case 'crit': return (
                <span className="flex flex-col items-center gap-0.5">
                    <FloatText size={SIZE.body} colour={COLOUR.gold}>Crit!</FloatText>
                    <FloatText size={SIZE.display} colour={sideColour(s)}>{s.text}</FloatText>
                </span>
            );
            case 'miss': return <FloatText size={SIZE.body} colour={COLOUR.white}>{s.text}</FloatText>;
            case 'heal': return <FloatText size={SIZE.title} colour={COLOUR.green}>{s.text}</FloatText>;
            case 'poison':
            case 'burn': return (
                <span className="flex items-center gap-1">
                    <Glyph name={s.kind === 'poison' ? 'drop' : 'flame'} colour={RAW.red} outlined />
                    <FloatText size={SIZE.title} colour={COLOUR.red}>{s.text}</FloatText>
                </span>
            );
            default: return <FloatText size={SIZE.title} colour={sideColour(s)}>{s.text}</FloatText>;
        }
    },
    B: (s) => {
        switch (s.kind) {
            case 'crit': return (
                <span className="flex flex-col items-center gap-1">
                    <FloatText size={SIZE.title} colour={COLOUR.gold}>CRIT!</FloatText>
                    <FloatText size={SIZE.display} colour={sideColour(s)} edgeColour={RAW.gold}>{s.text}</FloatText>
                </span>
            );
            case 'miss': return <FloatText size={SIZE.title} colour={COLOUR.white}>{s.text}</FloatText>;
            case 'heal': return <FloatText size={SIZE.display} colour={COLOUR.green}>{s.text}</FloatText>;
            case 'poison': return <FloatText size={SIZE.display} colour={COLOUR.poison}>{s.text}</FloatText>;
            case 'burn': return <FloatText size={SIZE.display} colour={COLOUR.burn}>{s.text}</FloatText>;
            default: return <FloatText size={SIZE.display} colour={sideColour(s)}>{s.text}</FloatText>;
        }
    },
    C: (s) => {
        const withGlyph = (name, raw, colour, size = SIZE.body) => (
            <span className="flex items-center gap-1">
                <Glyph name={name} colour={raw} outlined />
                <FloatText size={size} colour={colour}>{s.text}</FloatText>
            </span>
        );
        switch (s.kind) {
            case 'crit': return (
                <span className="flex items-center gap-1">
                    <FloatText size={SIZE.body} colour={COLOUR.gold}>Crit!</FloatText>
                    <FloatText size={SIZE.title} colour={sideColour(s)}>{s.text}</FloatText>
                </span>
            );
            case 'miss': return <FloatText size={SIZE.small} colour={COLOUR.white}>{s.text}</FloatText>;
            case 'heal': return withGlyph('heart', RAW.green, COLOUR.green);
            case 'poison': return withGlyph('drop', RAW.red, COLOUR.red);
            case 'burn': return withGlyph('flame', RAW.red, COLOUR.red);
            default: return <FloatText size={SIZE.body} colour={sideColour(s)}>{s.text}</FloatText>;
        }
    }
});

const sample = (id) => FLOAT_SAMPLES.find(s => s.id === id);

/** Every floating number side by side on the grass, each with what it means. */
const FloatSheet = ({ option }) => (
    <Ground w={440} h={330} data-c6-shot="floats">
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {FLOAT_SAMPLES.map(s => (
                <div key={s.id} data-c6-float={s.id} className="relative flex flex-col items-center justify-end pb-2 gap-1">
                    <div className="flex-1 flex items-end justify-center">{FLOAT_LOOK[option](s)}</div>
                    <span className="ui-text-small text-white leading-none" style={{ textShadow: edge(1) }}>{s.caption}</span>
                    <span className="ui-text-small leading-none" style={{ color: '#d9f99d', textShadow: edge(1) }}>
                        {s.on === 'enemy' ? 'over the enemy' : 'over the hero'}
                    </span>
                </div>
            ))}
        </div>
    </Ground>
);

// ---------------------------------------------------------------------------------------------
// The bubble row in a fight (the work plate's place, on the seam under the feet)
// ---------------------------------------------------------------------------------------------

const Count = ({ children }) => (
    <span className="font-bold leading-none tabular-nums text-white" style={{ fontSize: SIZE.small, textShadow: `${U}px ${U}px 0 #000` }}>
        {children}
    </span>
);

const Style = ({ id }) => <SkillIcon skill={id} size={32} title={null} />;
const Elixir = ({ e, count = false }) => (
    <Tooltip title={`Elixir of ${e.name}`} lines={[`${e.effect}, ${e.fightsLeft} more fights`]}>
        <span className="relative flex items-center gap-0.5" data-c6-elixir={e.name}>
            <ItemIcon item={e.itemId} size={32} title={null} />
            {count && <Count>{e.fightsLeft}</Count>}
        </span>
    </Tooltip>
);

/** One plate: the chamfer frame with its hard shadow, 32 px cells. */
const Plate = ({ children, ...rest }) => (
    <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="plate" {...rest}>
        <div className="flex items-center" style={{ gap: 2 * U, padding: `0 ${U}px` }}>{children}</div>
    </PixelFrame>
);

const Vs = () => (
    <span className="font-bold leading-none text-gi-muted" style={{ fontSize: SIZE.small, textShadow: `${U}px ${U}px 0 #000` }}>vs</span>
);

const PLATES = Object.freeze({
    A: () => (
        <Plate data-c6-plate="A">
            <Style id={FIGHT.enemy.style} /><Vs /><Style id={FIGHT.hero.style} />
            {FIGHT.hero.elixirs.map(e => <Elixir key={e.itemId} e={e} />)}
        </Plate>
    ),
    B: () => (
        <Plate data-c6-plate="B">
            <Style id={FIGHT.enemy.style} />
            <span aria-hidden="true" style={{ width: U, height: 28, background: 'var(--color-ui-frame)' }} />
            <Style id={FIGHT.hero.style} />
            {FIGHT.hero.elixirs.map(e => <Elixir key={e.itemId} e={e} count />)}
        </Plate>
    ),
    C: ({ open = false }) => (
        <Plate data-c6-plate={open ? 'C-open' : 'C'}>
            <Style id={FIGHT.enemy.style} /><Style id={FIGHT.hero.style} />
            {open && FIGHT.hero.elixirs.map(e => <Elixir key={e.itemId} e={e} count />)}
        </Plate>
    )
});

// ---------------------------------------------------------------------------------------------
// The fight's look on the mat, per option: bars, numbers, the fight icon, floats
// ---------------------------------------------------------------------------------------------

/** Where a float stands over each fighter, per option (A and B above the head, C at the outer side). */
const floatPoint = (option, p, on) => {
    if (option === 'C') return on === 'enemy' ? { x: p.tx - 70, y: p.head + 30 } : { x: p.hx + 70, y: p.head + 30 };
    if (option === 'B') return { x: on === 'enemy' ? p.tx : p.hx, y: p.head - 30 };
    return { x: on === 'enemy' ? p.tx : p.hx, y: p.head - 40 };
};

const FightIconA = () => (
    <Tooltip title="Fight: Aela vs Goblin Warlord" lines={['Click to open the fight panel']}>
        <span data-c6-cost="icon" className="flex items-center"><Glyph name="fight" colour={RAW.gold} /></span>
    </Tooltip>
);

/** A: one framed strip above the fight, both bars with the number on them, the icon between. */
const StripA = ({ p, hovered = false }) => {
    const w = 80;
    const h = 14;
    return (
        <At x={p.seam} y={p.head - 2}>
            <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="bars" data-c6-bars="A">
                <div className="flex items-center" style={{ gap: 3 * U, padding: `${U}px ${U}px` }}>
                    <Bar cur={FIGHT.enemy.hp} max={FIGHT.enemy.maxHp} w={w} h={h} edged={false} data-c6-bar="enemy">
                        <span className="absolute inset-0 flex items-center justify-center"><BarLabel>{hpLabel(FIGHT.enemy.hp, FIGHT.enemy.maxHp)}</BarLabel></span>
                    </Bar>
                    <span style={hovered ? { outline: `${U}px solid #fff`, outlineOffset: U } : undefined}><FightIconA /></span>
                    <Bar cur={FIGHT.hero.hp} max={FIGHT.hero.maxHp} w={w} h={h} edged={false} data-c6-bar="hero">
                        <span className="absolute inset-0 flex items-center justify-center"><BarLabel>{hpLabel(FIGHT.hero.hp, FIGHT.hero.maxHp)}</BarLabel></span>
                    </Bar>
                </div>
            </PixelFrame>
        </At>
    );
};

/** B: a thin bar over each head, the number written above it; the icon on its own chip by the enemy. */
const BarsB = ({ p, hovered = false, only = null }) => {
    const w = 64;
    const one = (who, x, cur, max) => (
        <At key={who} x={x} y={p.head - 3}>
            <div data-c6-cost="bars" data-c6-bar={who} className="flex flex-col items-center" style={{ gap: U * 2 }}>
                <BarLabel>{hpLabel(cur, max)}</BarLabel>
                <Bar cur={cur} max={max} w={w} h={3 * U} />
            </div>
        </At>
    );
    return (
        <>
            {only !== 'hero' && one('enemy', p.tx, FIGHT.enemy.hp, FIGHT.enemy.maxHp)}
            {only !== 'enemy' && one('hero', p.hx, FIGHT.hero.hp, FIGHT.hero.maxHp)}
            {!only && (
                <div className="absolute" style={{ left: p.tx - 32 - 44, top: p.head - 3 - 34 }}>
                    <Tooltip title="Fight: Aela vs Goblin Warlord" lines={['Click to open the fight panel']}>
                        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="icon" style={hovered ? { outline: `${U}px solid #fff` } : undefined}>
                            <span className="flex items-center justify-center" style={{ padding: U }}><Glyph name="fight" colour={RAW.gold} /></span>
                        </PixelFrame>
                    </Tooltip>
                </div>
            )}
        </>
    );
};

/** C: a short bar over each head, the number beside it on the outer side; the bare icon between. */
const BarsC = ({ p, hovered = false, only = null }) => {
    const w = 40;
    const h = 4 * U;
    const y = p.head - 3;
    return (
        <>
            {only !== 'hero' && (
                <div data-c6-cost="bars" data-c6-bar="enemy" className="absolute flex items-center" style={{ right: `calc(100% - ${p.tx + w / 2}px)`, top: y - h, gap: 3 * U }}>
                    <BarLabel align="right">{hpLabel(FIGHT.enemy.hp, FIGHT.enemy.maxHp)}</BarLabel>
                    <Bar cur={FIGHT.enemy.hp} max={FIGHT.enemy.maxHp} w={w} h={h} />
                </div>
            )}
            {only !== 'enemy' && (
                <div data-c6-cost="bars" data-c6-bar="hero" className="absolute flex items-center" style={{ left: p.hx - w / 2, top: y - h, gap: 3 * U }}>
                    <Bar cur={FIGHT.hero.hp} max={FIGHT.hero.maxHp} w={w} h={h} />
                    <BarLabel align="left">{hpLabel(FIGHT.hero.hp, FIGHT.hero.maxHp)}</BarLabel>
                </div>
            )}
            {!only && (
                <At x={p.seam} y={y + U}>
                    <Tooltip title="Fight: Aela vs Goblin Warlord" lines={['Click to open the fight panel']}>
                        <span data-c6-cost="icon" className="flex" style={hovered ? { outline: `${U}px solid #fff` } : undefined}>
                            <Glyph name="fight" colour={RAW.white} outlined />
                        </span>
                    </Tooltip>
                </At>
            )}
        </>
    );
};

/** A bar alone over a hovered enemy (no fight), in the option's look. */
const EnemyBarAlone = ({ option, p, cur, max }) => {
    if (option === 'A') {
        return (
            <At x={p.tx} y={p.head - 2}>
                <PixelFrame kind={FRAME_KIND.CHAMFER}>
                    <div style={{ padding: U }}>
                        <Bar cur={cur} max={max} w={80} h={14} edged={false}>
                            <span className="absolute inset-0 flex items-center justify-center"><BarLabel>{hpLabel(cur, max)}</BarLabel></span>
                        </Bar>
                    </div>
                </PixelFrame>
            </At>
        );
    }
    if (option === 'B') {
        return (
            <At x={p.tx} y={p.head - 3}>
                <div className="flex flex-col items-center" style={{ gap: U * 2 }}>
                    <BarLabel>{hpLabel(cur, max)}</BarLabel>
                    <Bar cur={cur} max={max} w={64} h={3 * U} />
                </div>
            </At>
        );
    }
    return (
        <div className="absolute flex items-center" style={{ right: `calc(100% - ${p.tx + 20}px)`, top: p.head - 3 - 4 * U, gap: 3 * U }}>
            <BarLabel align="right">{hpLabel(cur, max)}</BarLabel>
            <Bar cur={cur} max={max} w={40} h={4 * U} />
        </div>
    );
};

/** The fight on the mat in one option's look, with a crit rising off the enemy and a poison tick off the hero. */
const FightOnMat = ({ option, p, floats = true, hovered = false, plateOpen = false }) => {
    const PlateFor = PLATES[option];
    return (
        <>
            <Fighters p={p} />
            {option === 'A' && <StripA p={p} hovered={hovered} />}
            {option === 'B' && <BarsB p={p} hovered={hovered} />}
            {option === 'C' && <BarsC p={p} hovered={hovered} />}
            <div className="absolute flex justify-center" style={{ left: p.seam - 200, width: 400, top: p.foot - 2 }}>
                <PlateFor open={plateOpen} />
            </div>
            {floats && ['enemy-crit', 'hero-poison'].map(id => {
                const s = sample(id);
                const at = floatPoint(option, p, s.on);
                return <At key={id} x={at.x} y={at.y} data-c6-cost="float">{FLOAT_LOOK[option](s)}</At>;
            })}
        </>
    );
};

// ---------------------------------------------------------------------------------------------
// The enemy card (hover, and inside the panel)
// ---------------------------------------------------------------------------------------------

const Stat = ({ glyph, text, tip, colour = RAW.text }) => (
    <Tooltip title={tip}>
        <span className="inline-flex items-center gap-1 cursor-help">
            <Glyph name={glyph} colour={colour} />
            <span className="tabular-nums font-bold">{text}</span>
        </span>
    </Tooltip>
);

const Dot = () => <span className="text-gi-muted">·</span>;

/** The enemy's numbers as icon and number, one line (A and C). */
const EnemyStats = ({ e, withHp = true, withLevel = true }) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 ui-text-body text-gi-text">
        {withLevel && (
            <Tooltip title={`Melee, level ${e.level}`}>
                <span className="inline-flex items-center gap-1"><SkillIcon skill={e.style} size={16} title={null} /><span className="font-bold tabular-nums">{e.level}/99</span></span>
            </Tooltip>
        )}
        {withHp && <Stat glyph="heart" text={e.hp} tip={`${e.hp} health at full`} />}
        <Stat glyph="hit" text={e.hit} tip={`Hits for ${e.hit} before your armour`} />
        <Stat glyph="shield" text={e.armour} tip={`Armour ${e.armour}: takes ${e.armour} off each of your hits`} />
        <Stat glyph="clock" text={e.swing} tip={`Swings every ${e.swing}`} />
    </div>
);

const Kinds = ({ e, label = false }) => (e.known ? (
    <div className="flex flex-wrap items-center gap-x-1.5 ui-text-body text-gi-text">
        {label && <span className="text-gi-muted">Kinds</span>}
        {e.kinds.map((k, i) => (
            <span key={k.name} className="inline-flex items-center gap-1.5">
                {i > 0 && <Dot />}
                <Tooltip title={k.name} lines={[k.tip]}><span className="font-bold cursor-help">{k.name}</span></Tooltip>
            </span>
        ))}
    </div>
) : (
    <Tooltip title="Kinds unknown" lines={['Fight one to learn its kinds']}>
        <span className="ui-text-body text-gi-muted cursor-help">{label ? 'Kinds ?' : '? Kinds: fight one to learn'}</span>
    </Tooltip>
));

/** The tooltip box the game uses (chamfer frame, gold title), with any content. */
const TipBox = ({ title, children, width, ...rest }) => (
    <PixelFrame kind={FRAME_KIND.CHAMFER} frameClassName="p-0.5 leading-snug text-white" style={{ width }} {...rest}>
        {title && <div className="ui-text-title font-bold text-gi-gold">{title}</div>}
        <div className="flex flex-col gap-1">{children}</div>
    </PixelFrame>
);

const ENEMY_CARD = Object.freeze({
    /** A: the tooltip's gold title, one line of icons and numbers, the kinds. */
    A: ({ e }) => (
        <TipBox title={e.name} data-c6-cost="card" data-c6-card={e.id}>
            <EnemyStats e={e} />
            <Kinds e={e} />
        </TipBox>
    ),
    /** B: words for everything, a two-column table; each kind says what it does. */
    B: ({ e }) => (
        <TipBox title={e.name} width={250} data-c6-cost="card" data-c6-card={e.id}>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 ui-text-body">
                <span className="text-gi-muted">Level</span><span className="font-bold tabular-nums">{e.level}/99</span>
                <span className="text-gi-muted">Style</span>
                <span className="inline-flex items-center gap-1 font-bold"><SkillIcon skill={e.style} size={16} title={null} />Melee</span>
                <span className="text-gi-muted">Health</span><span className="font-bold tabular-nums">{e.hp}</span>
                <span className="text-gi-muted">Hit</span><span className="font-bold tabular-nums">{e.hit}</span>
                <span className="text-gi-muted">Armour</span><span className="font-bold tabular-nums">{e.armour}</span>
                <span className="text-gi-muted">Swing</span><span className="font-bold tabular-nums">every {e.swing}</span>
                <span className="text-gi-muted">Kinds</span>
                {e.known ? (
                    <span className="flex flex-col">
                        {e.kinds.map(k => <span key={k.name}><span className="font-bold">{k.name}</span> <span className="text-gi-muted ui-text-small">{k.tip.split(': ')[1]}</span></span>)}
                    </span>
                ) : <span className="text-gi-muted">? fight one to learn</span>}
            </div>
        </TipBox>
    ),
    /** C: the enemy's own sprite at 1× beside its numbers, like a small Token card. */
    C: ({ e }) => (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="card" data-c6-card={e.id}>
            <div className="flex flex-col gap-1 p-0.5 text-white">
                <div className="flex items-start gap-2">
                    <TokenSprite typeId={e.typeId} size={64} />
                    <div className="flex flex-col gap-1">
                        <span className="ui-text-title font-bold text-gi-gold leading-tight">{e.name}</span>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 ui-text-body">
                            <Tooltip title={`Melee, level ${e.level}`}>
                                <span className="inline-flex items-center gap-1"><SkillIcon skill={e.style} size={16} title={null} /><span className="font-bold tabular-nums">{e.level}/99</span></span>
                            </Tooltip>
                            <Stat glyph="heart" text={e.hp} tip={`${e.hp} health at full`} />
                            <Stat glyph="hit" text={e.hit} tip={`Hits for ${e.hit} before your armour`} />
                            <Stat glyph="shield" text={e.armour} tip={`Armour ${e.armour}`} />
                            <Stat glyph="clock" text={e.swing} tip={`Swings every ${e.swing}`} />
                        </div>
                    </div>
                </div>
                <Kinds e={e} label />
            </div>
        </PixelFrame>
    )
});

/** An enemy standing alone, the pointer resting on it, its card where the tooltip opens. */
const EnemyHover = ({ option, e }) => {
    const p = fightPoints(110, 104);
    const Card = ENEMY_CARD[option];
    const W = 410;
    // The game's tooltip opens 16 px right of and 20 px below the pointer (`Tooltip.jsx`).
    const pointer = { x: p.tx + 6, y: p.ty - 6 };
    return (
        <figure className="flex flex-col gap-1" style={{ maxWidth: W }} data-c6-enemy-card={e.id}>
            <Ground w={W} h={{ A: 240, B: 390, C: 290 }[option]} data-c6-shot={`card-${e.id}`}>
                <Fighters p={p} enemyType={e.typeId} withHero={false} flag={false} />
                <EnemyBarAlone option={option} p={p} cur={e.hp} max={e.hp} />
                <Pointer x={pointer.x} y={pointer.y} />
                <div className="absolute" style={{ left: pointer.x + 16, top: pointer.y + 20 }}>
                    <Card e={e} />
                </div>
            </Ground>
            <figcaption className="text-xs text-gi-muted">Pointer on an enemy: {e.caption.toLowerCase()}</figcaption>
        </figure>
    );
};

// ---------------------------------------------------------------------------------------------
// The fight panel
// ---------------------------------------------------------------------------------------------

const Heading = ({ children }) => (
    <span className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{children}</span>
);

const Divider = () => <div aria-hidden="true" className="h-px bg-white/10 my-0.5" />;

const LOG_TONE = Object.freeze({ hit: COLOUR.white, hurt: COLOUR.red, heal: COLOUR.green, miss: COLOUR.muted });
const LOG_GLYPH = Object.freeze({ hit: RAW.text, hurt: RAW.red, heal: RAW.green, miss: RAW.muted });

const LogRows = ({ rows, times = false, size = 'small' }) => (
    <div className={`flex flex-col gap-0.5 ${size === 'small' ? 'ui-text-small' : 'ui-text-body'} text-gi-text`} data-c6-log>
        {FIGHT.log.slice(0, rows).map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
                {times && <span className="tabular-nums text-gi-muted shrink-0" style={{ width: 48 }}>{r.t}</span>}
                <Glyph name={r.icon} colour={r.icon === 'star' ? RAW.gold : LOG_GLYPH[r.tone]} />
                <span className="flex-1 min-w-0">{r.text}</span>
                {r.amount && <span className="tabular-nums font-bold" style={{ color: LOG_TONE[r.tone] }}>{r.amount}</span>}
            </div>
        ))}
    </div>
);

const Status = ({ s, colour = RAW.red, words = false }) => (
    <Tooltip title={`${s.name} ×${s.stacks}`} lines={[s.effect, `Stacks up to ${s.maxStacks}`]}>
        <span className="inline-flex items-center gap-1 cursor-help" data-c6-status={s.id}>
            <Glyph name="drop" colour={colour} />
            {words && <span className="font-bold">{s.name}</span>}
            <span className="tabular-nums font-bold">×{s.stacks}</span>
        </span>
    </Tooltip>
);

/** A wide bar inside a panel, the number on it (A) or beside it (B, C). */
const PanelBar = ({ cur, max, w, on = false }) => (on ? (
    <Bar cur={cur} max={max} w={w} h={14} data-c6-panel-bar>
        <span className="absolute inset-0 flex items-center justify-center"><BarLabel>{hpLabel(cur, max)}</BarLabel></span>
    </Bar>
) : (
    <div className="flex items-center gap-2" data-c6-panel-bar>
        <Bar cur={cur} max={max} w={w} h={4 * U} />
        <span className="ui-text-body font-bold tabular-nums text-white whitespace-nowrap">{hpLabel(cur, max)}</span>
    </div>
));

const PANEL_W = 256;
const noop = () => {};

/** A: one narrow column, the Token card's width: the hero, the enemy (its card inline), four swings. */
const PanelA = () => {
    const { hero, enemy } = FIGHT;
    const card = ENEMY_CARDS[0];
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="panel" data-c6-panel="A" style={{ width: PANEL_W + 12 }}>
            <div className="flex flex-col gap-1.5 p-1.5 text-gi-text">
                <PanelHeader title={`Fight ${FIGHT.clock}`} sprite={<Glyph name="fight" colour={RAW.gold} />} onClose={noop} />
                <div className="flex flex-col gap-1" data-c6-side="hero">
                    <div className="flex items-center gap-1.5 ui-text-body">
                        <SkillIcon skill={hero.style} size={32} title={null} />
                        <span className="font-bold text-white">{hero.name}</span>
                        <span className="flex-1" />
                        <span className="ui-text-small tabular-nums text-gi-muted">{hero.level}/99</span>
                    </div>
                    <PanelBar cur={hero.hp} max={hero.maxHp} w={PANEL_W - 12} on />
                    <div className="flex items-center gap-2 ui-text-body">
                        {hero.elixirs.map(e => <Elixir key={e.itemId} e={e} count />)}
                        {hero.statuses.map(s => <Status key={s.id} s={s} words />)}
                    </div>
                </div>
                <Divider />
                <div className="flex flex-col gap-1" data-c6-side="enemy">
                    <div className="flex items-center gap-1.5 ui-text-body">
                        <SkillIcon skill={enemy.style} size={32} title={null} />
                        <span className="font-bold text-white">{enemy.name}</span>
                        <span className="flex-1" />
                        <span className="ui-text-small tabular-nums text-gi-muted">{enemy.level}/99</span>
                    </div>
                    <PanelBar cur={enemy.hp} max={enemy.maxHp} w={PANEL_W - 12} on />
                    <EnemyStats e={card} withHp={false} withLevel={false} />
                    <Kinds e={card} />
                </div>
                <Divider />
                <LogRows rows={4} />
            </div>
        </PixelFrame>
    );
};

/** B's numbers: each word above its number, three across. */
const Words = ({ items }) => (
    <div className="grid grid-cols-3 gap-x-2">
        {items.map(([label, value, tip]) => (
            <Tooltip key={label} title={tip}>
                <span className="flex flex-col cursor-help leading-tight">
                    <span className="ui-text-small text-gi-muted">{label}</span>
                    <span className="ui-text-body font-bold tabular-nums text-white">{value}</span>
                </span>
            </Tooltip>
        ))}
    </div>
);

/** B: wide, the hero and the enemy side by side with portraits and words, a timed log of six swings. */
const PanelB = () => {
    const { hero, enemy } = FIGHT;
    const card = ENEMY_CARDS[0];
    const COL = 250;
    const Portrait = ({ src }) => (
        <img src={src} alt="" draggable={false} className="shrink-0" style={{ width: 64, height: 64, imageRendering: 'pixelated' }} />
    );
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="panel" data-c6-panel="B" style={{ width: 2 * COL + 40 }}>
            <div className="flex flex-col gap-2 p-2 text-gi-text">
                <PanelHeader title={`${hero.name} vs ${enemy.name}`} sprite={<Glyph name="fight" colour={RAW.gold} />} onClose={noop}>
                    <span className="ui-text-small tabular-nums text-gi-muted">{FIGHT.clock}</span>
                </PanelHeader>
                <div className="flex items-stretch gap-3">
                    <div className="flex flex-col gap-1.5" style={{ width: COL }} data-c6-side="hero">
                        <div className="flex items-center gap-2">
                            <Portrait src={`/${hero.portrait}`} />
                            <div className="flex flex-col gap-0.5">
                                <span className="ui-text-title font-bold text-white">{hero.name}</span>
                                <span className="inline-flex items-center gap-1 ui-text-body"><SkillIcon skill={hero.style} size={16} title={null} />Melee <span className="tabular-nums">{hero.level}/99</span></span>
                            </div>
                        </div>
                        <PanelBar cur={hero.hp} max={hero.maxHp} w={COL - 100} />
                        <Words items={[
                            ['Hit', hero.hit, 'Copper Sword 2, level 20 +1, Valor +1'],
                            ['Armour', hero.armour, 'Leather Chest 1, Ironskin 1'],
                            ['Swing', hero.swing, 'A normal weapon swings every 3 s']
                        ]} />
                        <Heading>Elixirs</Heading>
                        {hero.elixirs.map(e => (
                            <div key={e.itemId} className="flex items-center gap-1.5 whitespace-nowrap">
                                <ItemIcon item={e.itemId} size={32} title={null} />
                                <span className="flex flex-col leading-tight">
                                    <span className="ui-text-body font-bold text-white">{e.name}</span>
                                    <span className="ui-text-small text-gi-muted">{e.effect}</span>
                                </span>
                                <span className="flex-1" />
                                <span className="ui-text-small tabular-nums text-gi-muted">{e.fightsLeft} fights left</span>
                            </div>
                        ))}
                        <Heading>Status</Heading>
                        {hero.statuses.map(s => (
                            <div key={s.id} className="flex items-center gap-1.5 ui-text-body">
                                <Status s={s} colour={RAW.poison} words />
                                <span className="text-gi-muted ui-text-small">2 a tick</span>
                            </div>
                        ))}
                    </div>
                    <div aria-hidden="true" className="w-px bg-white/10" />
                    <div className="flex flex-col gap-1.5" style={{ width: COL }} data-c6-side="enemy">
                        <div className="flex items-center gap-2">
                            <TokenSprite typeId={enemy.typeId} size={64} />
                            <div className="flex flex-col gap-0.5">
                                <span className="ui-text-title font-bold text-white">{enemy.name}</span>
                                <span className="inline-flex items-center gap-1 ui-text-body"><SkillIcon skill={enemy.style} size={16} title={null} />Melee <span className="tabular-nums">{enemy.level}/99</span></span>
                            </div>
                        </div>
                        <PanelBar cur={enemy.hp} max={enemy.maxHp} w={COL - 100} />
                        <Words items={[
                            ['Hit', enemy.hit, 'Hits for 3 before your armour'],
                            ['Armour', enemy.armour, 'Takes nothing off your hits'],
                            ['Swing', enemy.swing, 'Slow: every 4 s']
                        ]} />
                        <Heading>Kinds</Heading>
                        {card.kinds.map(k => (
                            <div key={k.name} className="ui-text-body"><span className="font-bold text-white">{k.name}</span> <span className="text-gi-muted ui-text-small">{k.tip.split(': ')[1]}</span></div>
                        ))}
                    </div>
                </div>
                <Divider />
                <Heading>What happened</Heading>
                <LogRows rows={6} times size="body" />
            </div>
        </PixelFrame>
    );
};

/** C's see-through box, as the Token card's. */
const Box = ({ children, className = '' }) => (
    <div className={`bg-black/65 px-2 py-1.5 flex flex-col gap-1 ${className}`}>{children}</div>
);

/** C: the Token card itself: the battlefield scene behind see-through boxes, 256 px wide. */
const PanelC = () => {
    const { hero, enemy } = FIGHT;
    const card = ENEMY_CARDS[0];
    const Row = ({ f }) => (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 ui-text-body">
                <SkillIcon skill={f.style} size={16} title={null} />
                <span className="font-bold text-white">{f.name}</span>
                <span className="flex-1" />
                <span className="ui-text-small tabular-nums text-gi-muted">{f.level}/99</span>
            </div>
            <PanelBar cur={f.hp} max={f.maxHp} w={140} />
        </div>
    );
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="panel" data-c6-panel="C" style={{ width: PANEL_W + 12 }}>
            <div className="relative overflow-hidden" style={{ width: PANEL_W, minHeight: PANEL_W }}>
                {/* Taller than one picture: drawn at 2× to cover it, as the Token card does for its recipe list. */}
                <img
                    src="/assets/backgrounds/invasion/b_invasion_battlefield.png"
                    alt=""
                    draggable={false}
                    className="absolute top-0 left-0 max-w-none select-none pointer-events-none"
                    style={{ width: 2 * PANEL_W, height: 2 * PANEL_W, imageRendering: 'pixelated' }}
                />
                <div className="relative flex flex-col gap-1.5 p-1.5">
                    <div className="flex items-start gap-2">
                        <Box className="flex-1 min-w-0">
                            <h3 className="ui-text-title font-bold text-white leading-tight">{hero.name} vs {enemy.name}</h3>
                        </Box>
                        <CloseX onClick={noop} />
                    </div>
                    <Box><Row f={hero} /><Row f={enemy} /></Box>
                    <Box>
                        <Heading>{hero.name}</Heading>
                        <div className="flex items-center gap-2 ui-text-body text-gi-text">
                            {hero.elixirs.map(e => <Elixir key={e.itemId} e={e} count />)}
                            {hero.statuses.map(s => <Status key={s.id} s={s} words />)}
                        </div>
                    </Box>
                    <Box>
                        <Heading>{enemy.name}</Heading>
                        <EnemyStats e={card} withHp={false} withLevel={false} />
                        <Kinds e={card} />
                    </Box>
                    <Box><LogRows rows={3} /></Box>
                </div>
            </div>
        </PixelFrame>
    );
};

const PANELS = Object.freeze({ A: PanelA, B: PanelB, C: PanelC });

/** The fight icon clicked: the panel open beside the fight, as the Token card opens beside its Token. */
const PanelScene = ({ option }) => {
    const p = fightPoints(option === 'B' ? 110 : 130, 230);
    const Panel = PANELS[option];
    // The panel opens to the right of the fight (as the Token card does when there is no room
    // above), clear of the hero's HP number in C.
    const left = p.hx + ART / 2 + (option === 'C' ? 96 : 12);
    return (
        <figure className="flex flex-col gap-1" style={{ maxWidth: 840 }}>
            <div
                className="relative overflow-hidden"
                style={{ background: GROUND, width: 'max-content', minHeight: p.foot + 80, padding: `24px 24px 24px ${left}px` }}
                data-c6-shot="panel"
            >
                <FightOnMat option={option} p={p} floats={false} hovered plateOpen={option === 'C'} />
                <div className="relative"><Panel /></div>
            </div>
            <figcaption className="text-xs text-gi-muted">
                The fight icon clicked: the panel opens over the playmat beside the fight, as the Token card does{option === 'C' ? ' (the plate shows the elixirs while the pointer rests on the fight)' : ''}.
            </figcaption>
        </figure>
    );
};

/** The fight on the mat, frozen at the moment a crit lands on the enemy and poison ticks on the hero. */
const MatScene = ({ option }) => {
    const p = fightPoints(140, 186);
    return (
        <figure className="flex flex-col gap-1">
            <Ground w={380} h={330} data-c6-shot="mat">
                <FightOnMat option={option} p={p} />
            </Ground>
            <figcaption className="text-xs text-gi-muted" style={{ maxWidth: 380 }}>
                On the mat: a crit rising off the enemy, a poison tick off the hero (drawn together here; in play each rises for half a second).
            </figcaption>
        </figure>
    );
};

const OptionBlock = ({ option }) => (
    <article data-c6-option={option.id} className="flex flex-col gap-3 py-3 border-t border-white/10">
        <header className="flex flex-col gap-1">
            <h4 className="ui-text-title font-bold text-white">{option.name}</h4>
            <p className="text-xs text-gi-text max-w-3xl">{option.summary}</p>
        </header>
        <div className="flex flex-wrap items-start gap-3">
            <MatScene option={option.id} />
            <figure className="flex flex-col gap-1">
                <FloatSheet option={option.id} />
                <figcaption className="text-xs text-gi-muted">Every floating number, side by side.</figcaption>
            </figure>
        </div>
        <div className="flex flex-wrap items-start gap-3">
            {ENEMY_CARDS.map(e => <EnemyHover key={e.id} option={option.id} e={e} />)}
        </div>
        <PanelScene option={option.id} />
        <p className="text-xs text-gi-muted max-w-3xl" data-c6-cost-note><span className="font-bold text-gi-text">Draw cost:</span> {option.cost}</p>
    </article>
);

/** The style sheet page's "Combat screen" entry: the three options, one after the other. */
export const CombatMockups = () => (
    <div data-combat-mockups className="flex flex-col pb-8">
        {COMBAT_OPTIONS.map(o => <OptionBlock key={o.id} option={o} />)}
    </div>
);

export { COMBAT_OPTIONS };
export default CombatMockups;
