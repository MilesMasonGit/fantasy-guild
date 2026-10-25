// The combat screen mock-ups on the style sheet page, round two: the fight on the mat as the owner
// settled it after round one, and three options for the fight panel (a battlefield scene with the
// two fighters facing each other, both sides' numbers, the log behind a toggle). Static pictures
// built from the real sprites and the pixel kit, fed the fixture fight in `combatMockups.js`;
// nothing in the game uses them.
// The mat's geometry is the mat's at 1920 × 1080: art at 2×, the mat at a fit of 0.9, the hero
// standing `artRadius + STAND_GAP` from the enemy's centre, the pinned flag at the top of its art
// circle.

import { useState } from 'react';
import { PixelFrame, FRAME_KIND } from '../components/base/PixelFrame.jsx';
import { PanelHeader, CloseX } from '../components/base/CloseX.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { SkillIcon } from '../components/base/SkillIcon.jsx';
import { TokenSprite } from '../components/base/TokenSprite.jsx';
import { Tooltip } from '../components/base/Tooltip.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../components/base/KitButton.jsx';
import { AnimatedHeroSprite } from '../components/board/AnimatedHeroSprite.jsx';
import { FlagMark } from '../components/board/FlagMark.jsx';
import { FLAG_PX, POLE_BASE, PIN_INSET } from '../components/board/flagGeometry.js';
import { artRadius } from '../../config/matGeometry.js';
import { HERO_SHEET_GRID } from '../../config/spriteFx.js';
import { STAND_GAP } from '../../systems/board/HeroMotion.js';
import {
    FIGHT, ENEMY_CARDS, FLOAT_SAMPLES, COMBAT_GLYPHS, MAT_SETTLED, PANEL_OPTIONS, PANEL_MOTION, hpLabel, hpPercent
} from './combatMockups.js';

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
/** The battlefield scene (256 px, the owner's art) behind every panel option. */
const BATTLEFIELD = '/assets/backgrounds/invasion/b_invasion_battlefield.png';
const BATTLEFIELD_PX = 256;

const COLOUR = Object.freeze({
    white: 'var(--color-ui-white)',
    red: 'var(--color-ui-red)',
    green: 'var(--color-ui-green)',
    gold: 'var(--color-ui-gold)',
    muted: 'var(--color-ui-muted)'
});

/** The kit colours as plain values, for glyph pictures (an SVG cannot read a CSS variable). */
const RAW = Object.freeze({
    white: '#ffffff', red: '#ff2d55', green: '#09b554', gold: '#fbbf24', muted: '#737373', text: '#e5e5e5'
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
// The ground, the fighters, bars and floats
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
const At = ({ x, y, children, ...rest }) => (
    <div className="absolute flex flex-col items-center" style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }} {...rest}>
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

/** The fill, cut to whole art pixels. */
const fillPx = (cur, max, w) => Math.round((hpPercent(cur, max) / 100) * (w / U)) * U;

/** A bare bar: dark track, 1-art-pixel black edge, the fill. */
const Bar = ({ cur, max, w, h, ...rest }) => (
    <div className="relative shrink-0" style={{ width: w, height: h, background: TRACK, boxShadow: `0 0 0 ${U}px ${EDGE}` }} {...rest}>
        <div className="absolute left-0 top-0 bottom-0" style={{ width: fillPx(cur, max, w), background: HP_FILL }} />
    </div>
);

const BarLabel = ({ children, size = SIZE.small }) => (
    <span className="font-bold leading-none whitespace-nowrap tabular-nums text-white" style={{ fontSize: size, textShadow: edge(U / 2 + 1) }}>
        {children}
    </span>
);

/** The settled bar: the number written above a thin bar. */
const LabelledBar = ({ cur, max, w = 64, ...rest }) => (
    <div className="flex flex-col items-center" style={{ gap: U * 2 }} {...rest}>
        <BarLabel>{hpLabel(cur, max)}</BarLabel>
        <Bar cur={cur} max={max} w={w} h={3 * U} />
    </div>
);

const FloatText = ({ size, colour, children }) => (
    <span className="font-bold leading-none whitespace-nowrap tabular-nums" style={{ fontSize: size, color: colour, textShadow: edge(U) }}>
        {children}
    </span>
);

/** The colour a hit's number takes: white on the enemy, red on the hero. */
const sideColour = (s) => (s.on === 'enemy' ? COLOUR.white : COLOUR.red);

/** The settled float: the title size, a crit's number in the display size under a gold "Crit!", ticks red with their icon. */
const floatLook = (s) => {
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
};

const sample = (id) => FLOAT_SAMPLES.find(s => s.id === id);

/** Every floating number side by side on the grass, each with what it means. */
const FloatSheet = () => (
    <Ground w={440} h={330} data-c6-shot="floats">
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {FLOAT_SAMPLES.map(s => (
                <div key={s.id} data-c6-float={s.id} className="relative flex flex-col items-center justify-end pb-2 gap-1">
                    <div className="flex-1 flex items-end justify-center">{floatLook(s)}</div>
                    <span className="ui-text-small text-white leading-none" style={{ textShadow: edge(1) }}>{s.caption}</span>
                    <span className="ui-text-small leading-none" style={{ color: '#d9f99d', textShadow: edge(1) }}>
                        {s.on === 'enemy' ? 'beside the enemy' : 'beside the hero'}
                    </span>
                </div>
            ))}
        </div>
    </Ground>
);

// ---------------------------------------------------------------------------------------------
// The bubble row in a fight, and the fight icon
// ---------------------------------------------------------------------------------------------

const Count = ({ children }) => (
    <span className="font-bold leading-none tabular-nums text-white" style={{ fontSize: SIZE.small, textShadow: `${U}px ${U}px 0 #000` }}>
        {children}
    </span>
);

const Style = ({ id, size = 32 }) => <SkillIcon skill={id} size={size} title={null} />;

const Elixir = ({ e, size = 32 }) => (
    <Tooltip title={`Elixir of ${e.name}`} lines={[`${e.effect}, ${e.fightsLeft} more fights`]}>
        <span className="relative flex items-center gap-0.5" data-c6-elixir={e.name}>
            <ItemIcon item={e.itemId} size={size} title={null} />
            <Count>{e.fightsLeft}</Count>
        </span>
    </Tooltip>
);

/** The plate on the seam under the feet: enemy style | hero style, the elixirs with fights left. */
const FightPlate = () => (
    <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="plate">
        <div className="flex items-center" style={{ gap: 2 * U, padding: `0 ${U}px` }}>
            <Style id={FIGHT.enemy.style} />
            <span aria-hidden="true" style={{ width: U, height: 28, background: 'var(--color-ui-frame)' }} />
            <Style id={FIGHT.hero.style} />
            {FIGHT.hero.elixirs.map(e => <Elixir key={e.itemId} e={e} />)}
        </div>
    </PixelFrame>
);

const FightIcon = () => (
    <Tooltip title="Fight: Aela vs Goblin Warlord" lines={['Click to open the fight panel']}>
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="icon">
            <span className="flex items-center justify-center" style={{ padding: U }}><Glyph name="fight" colour={RAW.gold} /></span>
        </PixelFrame>
    </Tooltip>
);

/** Where a float rises: at each fighter's outer side, below the bars and clear of the flag. */
const floatPoint = (p, on) => (on === 'enemy' ? { x: p.tx - 72, y: p.head + 64 } : { x: p.hx + 72, y: p.head + 64 });

/** The fight on the mat as settled, a crit rising beside the enemy and a poison tick beside the hero. */
const SettledFight = ({ p }) => (
    <>
        <Fighters p={p} />
        <At x={p.tx} y={p.head - 3}><LabelledBar cur={FIGHT.enemy.hp} max={FIGHT.enemy.maxHp} data-c6-cost="bars" data-c6-bar="enemy" /></At>
        <At x={p.hx} y={p.head - 3}><LabelledBar cur={FIGHT.hero.hp} max={FIGHT.hero.maxHp} data-c6-cost="bars" data-c6-bar="hero" /></At>
        <div className="absolute" style={{ left: p.tx - 32 - 44, top: p.head - 3 - 34 }}><FightIcon /></div>
        <div className="absolute flex justify-center" style={{ left: p.seam - 200, width: 400, top: p.foot - 2 }}><FightPlate /></div>
        {['enemy-crit', 'hero-poison'].map(id => {
            const s = sample(id);
            const at = floatPoint(p, s.on);
            return <At key={id} x={at.x} y={at.y} data-c6-cost="float">{floatLook(s)}</At>;
        })}
    </>
);

// ---------------------------------------------------------------------------------------------
// The enemy card on hover (option B's, as settled)
// ---------------------------------------------------------------------------------------------

const TipBox = ({ title, children, width, ...rest }) => (
    <PixelFrame kind={FRAME_KIND.CHAMFER} frameClassName="p-0.5 leading-snug text-white" style={{ width }} {...rest}>
        {title && <div className="ui-text-title font-bold text-gi-gold">{title}</div>}
        <div className="flex flex-col gap-1">{children}</div>
    </PixelFrame>
);

const EnemyCard = ({ e }) => (
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
);

/** An enemy standing alone, the pointer resting on it, its card where the tooltip opens. */
const EnemyHover = ({ e }) => {
    const p = fightPoints(110, 104);
    const W = 410;
    // The game's tooltip opens 16 px right of and 20 px below the pointer (`Tooltip.jsx`).
    const pointer = { x: p.tx + 6, y: p.ty - 6 };
    return (
        <figure className="flex flex-col gap-1" style={{ maxWidth: W }} data-c6-enemy-card={e.id}>
            <Ground w={W} h={390} data-c6-shot={`card-${e.id}`}>
                <Fighters p={p} enemyType={e.typeId} withHero={false} flag={false} />
                <At x={p.tx} y={p.head - 3}><LabelledBar cur={e.hp} max={e.hp} /></At>
                <Pointer x={pointer.x} y={pointer.y} />
                <div className="absolute" style={{ left: pointer.x + 16, top: pointer.y + 20 }}><EnemyCard e={e} /></div>
            </Ground>
            <figcaption className="text-xs text-gi-muted">Pointer on an enemy: {e.caption.toLowerCase()}</figcaption>
        </figure>
    );
};

// ---------------------------------------------------------------------------------------------
// The panel's pieces
// ---------------------------------------------------------------------------------------------

/** The battlefield art at `scale`, its art pixel (`x`, `y`) at the box's top left. */
const SceneArt = ({ scale = 1, x = 0, y = 0 }) => (
    <img
        src={BATTLEFIELD}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none pointer-events-none"
        style={{ left: -x * scale, top: -y * scale, width: BATTLEFIELD_PX * scale, height: BATTLEFIELD_PX * scale, maxWidth: 'none', imageRendering: 'pixelated' }}
    />
);

/** One frame of the hero's sheet (8 × 3: attack, walk, idle), facing right. */
const HeroPose = ({ size, row = 0, col = 5, style }) => (
    <div
        aria-hidden="true"
        data-c6-fighter="hero"
        className="absolute"
        style={{
            width: size,
            height: size,
            backgroundImage: `url("/${FIGHT.hero.sheet}")`,
            backgroundSize: `${size * HERO_SHEET_GRID.cols}px ${size * HERO_SHEET_GRID.rows}px`,
            backgroundPosition: `-${col * size}px -${row * size}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            ...style
        }}
    />
);

/** The enemy's still sprite; it faces left, towards a hero on its left. */
const EnemyPose = ({ size, style }) => (
    <div aria-hidden="true" data-c6-fighter="enemy" className="absolute" style={{ width: size, height: size, ...style }}>
        <TokenSprite typeId={FIGHT.enemy.typeId} size={size} />
    </div>
);

const Stat = ({ glyph, text, tip, colour = RAW.text }) => (
    <Tooltip title={tip}>
        <span className="inline-flex items-center gap-1 cursor-help">
            <Glyph name={glyph} colour={colour} />
            <span className="tabular-nums font-bold text-white">{text}</span>
        </span>
    </Tooltip>
);

const HERO_TIPS = Object.freeze({
    hit: 'Hits for 4: Copper Sword 2, level 20 +1, Valor +1',
    armour: 'Armour 2: Leather Chest 1, Ironskin 1. Takes 2 off each enemy hit',
    swing: 'Swings every 3 s (a normal weapon)'
});
const ENEMY_TIPS = Object.freeze({
    hit: 'Hits for 3 before your armour',
    armour: 'Armour 0: takes nothing off your hits',
    swing: 'Swings every 4 s (Brute: slow)'
});

/** A side's hit, armour and swing as icon and number. */
const StatLine = ({ f, tips, className = '' }) => (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ui-text-body ${className}`} data-c6-stats>
        <Stat glyph="hit" text={f.hit} tip={tips.hit} />
        <Stat glyph="shield" text={f.armour} tip={tips.armour} />
        <Stat glyph="clock" text={f.swing} tip={tips.swing} />
    </div>
);

/** A side's style and level: the style's icon, then 20/99. */
const StyleLevel = ({ f, name = true, mirror = false }) => (
    <Tooltip title={`${f.name}: Melee ${f.level}/99`}>
        <span className={`inline-flex items-center gap-1.5 ui-text-body ${mirror ? 'flex-row-reverse' : ''}`}>
            <SkillIcon skill={f.style} size={16} title={null} />
            {name && <span className="font-bold text-white">{f.name}</span>}
            <span className="ui-text-small tabular-nums text-gi-muted">{f.level}/99</span>
        </span>
    </Tooltip>
);

const Status = ({ s }) => (
    <Tooltip title={`${s.name} ×${s.stacks}`} lines={[s.effect, `Stacks up to ${s.maxStacks}`]}>
        <span className="inline-flex items-center gap-1 cursor-help" data-c6-status={s.id}>
            <Glyph name="drop" colour={RAW.red} />
            <span className="font-bold text-white">{s.name}</span>
            <span className="tabular-nums font-bold text-white">×{s.stacks}</span>
        </span>
    </Tooltip>
);

/** The hero's elixirs (each with its fights left) and statuses (with their stacks). */
const HeroEffects = ({ className = '' }) => (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ui-text-body ${className}`} data-c6-effects>
        {FIGHT.hero.elixirs.map(e => <Elixir key={e.itemId} e={e} />)}
        {FIGHT.hero.statuses.map(s => <Status key={s.id} s={s} />)}
    </div>
);

const KIND_TIPS = Object.freeze(Object.fromEntries(ENEMY_CARDS[0].kinds.map(k => [k.name, k.tip])));

/** The enemy's kinds, shown once the guild has fought one. */
const EnemyKinds = ({ className = '', stacked = false }) => (
    <div
        className={`flex ${stacked ? 'flex-col items-end' : 'flex-wrap items-center'} gap-x-1.5 ui-text-body ${className}`}
        data-c6-kinds
    >
        {FIGHT.enemy.kinds.map((k, i) => (
            <span key={k} className="inline-flex items-center gap-1.5">
                {i > 0 && !stacked && <span className="text-gi-muted">·</span>}
                <Tooltip title={k} lines={[KIND_TIPS[k]]}><span className="font-bold text-white cursor-help">{k}</span></Tooltip>
            </span>
        ))}
    </div>
);

const LOG_TONE = Object.freeze({ hit: COLOUR.white, hurt: COLOUR.red, heal: COLOUR.green, miss: COLOUR.muted });
const LOG_GLYPH = Object.freeze({ hit: RAW.text, hurt: RAW.red, heal: RAW.green, miss: RAW.muted });

const LogRows = ({ rows = 5, times = true }) => (
    <div className="flex flex-col gap-0.5 ui-text-small text-gi-text" data-c6-log>
        {FIGHT.log.slice(0, rows).map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
                {times && <span className="tabular-nums text-gi-muted shrink-0" style={{ width: 40 }}>{r.t}</span>}
                <Glyph name={r.icon} colour={r.icon === 'star' ? RAW.gold : LOG_GLYPH[r.tone]} />
                <span className="flex-1 min-w-0">{r.text}</span>
                {r.amount && <span className="tabular-nums font-bold" style={{ color: LOG_TONE[r.tone] }}>{r.amount}</span>}
            </div>
        ))}
    </div>
);

/** "Show log" / "Hide log": the kit's plain button with a pixel triangle; the log opens below it. */
const LogToggle = ({ open, onToggle }) => (
    <div className="flex justify-center pt-0.5 pb-1">
        <KitButton tone={KIT_BUTTON_TONE.PLAIN} onClick={onToggle} buttonClassName="ui-text-small" data-c6-log-toggle={open ? 'open' : 'closed'}>
            {open ? 'Hide log' : 'Show log'}
            <Glyph name={open ? 'up' : 'down'} colour={RAW.text} />
        </KitButton>
    </div>
);

/** The log part of every panel: the toggle, and the last swings when open. */
const LogPart = ({ open, onToggle, times = true }) => (
    <div className="flex flex-col gap-1 px-1.5 pb-1">
        {open && <div aria-hidden="true" className="h-px bg-white/10" />}
        {open && <LogRows times={times} />}
        <LogToggle open={open} onToggle={onToggle} />
    </div>
);

/** The see-through box the Token card lays over its art. */
const Box = ({ children, className = '', ...rest }) => (
    <div className={`bg-black/65 px-2 py-1 flex flex-col gap-1 ${className}`} {...rest}>{children}</div>
);

const noop = () => {};

// ---------------------------------------------------------------------------------------------
// Panel 1: the arena
// ---------------------------------------------------------------------------------------------

const P1_W = 360;
const P1_SCENE_H = 236;

const Panel1 = ({ logOpen, onToggle }) => {
    const { hero, enemy } = FIGHT;
    const heroX = 28;
    const enemyX = P1_W - 28 - ART;
    const top = P1_SCENE_H - ART - 10;
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="panel" data-c6-panel="1" style={{ width: P1_W + 12 }}>
            <div className="relative" style={{ width: P1_W }}>
                <div className="relative overflow-hidden" style={{ height: P1_SCENE_H }} data-c6-scene>
                    <SceneArt scale={2} x={10} y={62} />
                    <div className="absolute left-1.5 right-1.5 top-1.5 flex items-start gap-2">
                        <Box className="flex-1 min-w-0 flex-row items-center">
                            <Glyph name="fight" colour={RAW.gold} />
                            <span className="ui-text-title font-bold text-white leading-tight flex-1">{hero.name} vs {enemy.name}</span>
                            <span className="ui-text-small tabular-nums text-gi-muted">{FIGHT.clock}</span>
                        </Box>
                        <CloseX onClick={noop} />
                    </div>
                    <HeroPose size={ART} row={0} col={5} style={{ left: heroX, top }} />
                    <EnemyPose size={ART} style={{ left: enemyX, top }} />
                    <At x={heroX + ART / 2} y={top + 8}><LabelledBar cur={hero.hp} max={hero.maxHp} w={80} /></At>
                    <At x={enemyX + ART / 2} y={top + 8}><LabelledBar cur={enemy.hp} max={enemy.maxHp} w={80} /></At>
                    <At x={enemyX + ART / 2 + 36} y={top + 92}>{floatLook(sample('enemy-hit'))}</At>
                    <At x={heroX + 18} y={top + 96}>{floatLook(sample('hero-poison'))}</At>
                </div>
                <div className="grid grid-cols-2 gap-3 px-2 pt-1.5 pb-1">
                    <div className="flex flex-col gap-1" data-c6-side="hero">
                        <StyleLevel f={hero} name={false} />
                        <StatLine f={hero} tips={HERO_TIPS} />
                        <HeroEffects />
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right" data-c6-side="enemy">
                        <StyleLevel f={enemy} name={false} mirror />
                        <StatLine f={enemy} tips={ENEMY_TIPS} className="justify-end" />
                        <EnemyKinds className="justify-end" />
                    </div>
                </div>
                <LogPart open={logOpen} onToggle={onToggle} />
            </div>
        </PixelFrame>
    );
};

// ---------------------------------------------------------------------------------------------
// Panel 2: the versus card
// ---------------------------------------------------------------------------------------------

const P2_W = 256;
const P2_SCENE_H = 178;

/** One row of the versus table: the hero's value, the shared icon, the enemy's value. */
const VsRow = ({ glyph, hero, enemy, tips }) => (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 ui-text-body" data-c6-vs-row={glyph}>
        <Tooltip title={tips[0]}><span className="text-right font-bold tabular-nums text-white cursor-help">{hero}</span></Tooltip>
        <Glyph name={glyph} colour={RAW.text} />
        <Tooltip title={tips[1]}><span className="text-left font-bold tabular-nums text-white cursor-help">{enemy}</span></Tooltip>
    </div>
);

const Panel2 = ({ logOpen, onToggle }) => {
    const { hero, enemy } = FIGHT;
    const heroX = 36;
    const enemyX = P2_W - 36 - 64;
    const top = P2_SCENE_H - 64 - 8;
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="panel" data-c6-panel="2" style={{ width: P2_W + 12 }}>
            <div className="relative" style={{ width: P2_W }}>
                <div className="relative overflow-hidden" style={{ height: P2_SCENE_H }} data-c6-scene>
                    <SceneArt scale={1} x={0} y={78} />
                    <div className="absolute left-1.5 right-1.5 top-1.5 flex items-start gap-2">
                        <Box className="flex-1 min-w-0">
                            <span className="ui-text-title font-bold text-white leading-tight">{hero.name} vs {enemy.name}</span>
                        </Box>
                        <CloseX onClick={noop} />
                    </div>
                    <HeroPose size={64} row={0} col={5} style={{ left: heroX, top }} />
                    <EnemyPose size={64} style={{ left: enemyX, top }} />
                    <At x={heroX + 32} y={top + 6}><LabelledBar cur={hero.hp} max={hero.maxHp} w={56} /></At>
                    <At x={enemyX + 32} y={top + 6}><LabelledBar cur={enemy.hp} max={enemy.maxHp} w={56} /></At>
                </div>
                <div className="flex flex-col gap-1 px-2 pt-1.5 pb-1">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <span className="flex justify-end"><StyleLevel f={hero} name={false} mirror /></span>
                        <span className="ui-text-small font-bold text-gi-muted">VS</span>
                        <span className="flex justify-start"><StyleLevel f={enemy} name={false} /></span>
                    </div>
                    <VsRow glyph="hit" hero={hero.hit} enemy={enemy.hit} tips={[HERO_TIPS.hit, ENEMY_TIPS.hit]} />
                    <VsRow glyph="shield" hero={hero.armour} enemy={enemy.armour} tips={[HERO_TIPS.armour, ENEMY_TIPS.armour]} />
                    <VsRow glyph="clock" hero={hero.swing} enemy={enemy.swing} tips={[HERO_TIPS.swing, ENEMY_TIPS.swing]} />
                    <div className="h-px bg-white/10 my-0.5" />
                    <div className="grid grid-cols-2 gap-3 items-start">
                        <HeroEffects />
                        <EnemyKinds stacked />
                    </div>
                </div>
                <LogPart open={logOpen} onToggle={onToggle} times={false} />
            </div>
        </PixelFrame>
    );
};

// ---------------------------------------------------------------------------------------------
// Panel 3: compact
// ---------------------------------------------------------------------------------------------

const P3_W = 304;
const P3_BAND_H = 76;

/** One side's dense column: name and level, bar and number, its numbers, its effects or kinds. */
const Column = ({ f, tips, mirror = false, children }) => (
    <div className={`flex flex-col gap-1 ${mirror ? 'items-end text-right' : ''}`} data-c6-side={mirror ? 'enemy' : 'hero'}>
        <span className="ui-text-small font-bold text-white leading-none">{f.name}</span>
        <StyleLevel f={f} name={false} mirror={mirror} />
        <div className={`flex items-center gap-2 ${mirror ? 'flex-row-reverse' : ''}`}>
            <Bar cur={f.hp} max={f.maxHp} w={52} h={3 * U} />
            <span className="ui-text-small font-bold tabular-nums text-white whitespace-nowrap">{hpLabel(f.hp, f.maxHp)}</span>
        </div>
        <StatLine f={f} tips={tips} className={mirror ? 'justify-end' : ''} />
        {children}
    </div>
);

const Panel3 = ({ logOpen, onToggle }) => {
    const { hero, enemy } = FIGHT;
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-c6-cost="panel" data-c6-panel="3" style={{ width: P3_W + 12 }}>
            <div className="relative flex flex-col" style={{ width: P3_W }}>
                <PanelHeader
                    title={`Fight ${FIGHT.clock}`}
                    sprite={<Glyph name="fight" colour={RAW.gold} />}
                    onClose={noop}
                    className="px-1.5 pt-1 pb-1"
                />
                <div className="relative overflow-hidden mx-1.5" style={{ height: P3_BAND_H }} data-c6-scene>
                    <SceneArt scale={2} x={30} y={118} />
                    <HeroPose size={64} row={0} col={5} style={{ left: 18, top: P3_BAND_H - 64 - 4 }} />
                    <EnemyPose size={64} style={{ right: 18, top: P3_BAND_H - 64 - 4 }} />
                </div>
                <div className="grid grid-cols-2 gap-3 px-2 pt-1.5 pb-1">
                    <Column f={hero} tips={HERO_TIPS}><HeroEffects /></Column>
                    <Column f={enemy} tips={ENEMY_TIPS} mirror><EnemyKinds stacked /></Column>
                </div>
                <LogPart open={logOpen} onToggle={onToggle} times={false} />
            </div>
        </PixelFrame>
    );
};

const PANELS = Object.freeze({ 1: Panel1, 2: Panel2, 3: Panel3 });

/** A panel whose log toggle works on the page, closed to start with. */
const LivePanel = ({ id }) => {
    const [open, setOpen] = useState(false);
    const Panel = PANELS[id];
    return <Panel logOpen={open} onToggle={() => setOpen(o => !o)} />;
};

/** One option: the panel over the playmat with its log closed (the toggle works), and with it open. */
const PanelOption = ({ option }) => {
    const Panel = PANELS[option.id];
    return (
        <article data-c6-panel-option={option.id} className="flex flex-col gap-2 py-3 border-t border-white/10">
            <header className="flex flex-col gap-1">
                <h4 className="ui-text-title font-bold text-white">{option.name}</h4>
                <p className="text-xs text-gi-text max-w-3xl">{option.summary}</p>
            </header>
            <div className="flex items-start gap-4 p-4" style={{ background: GROUND, width: 'max-content', maxWidth: '100%' }}>
                <div data-c6-shot="closed"><LivePanel id={option.id} /></div>
                <div data-c6-shot="open"><Panel logOpen onToggle={noop} /></div>
            </div>
            <p className="text-xs text-gi-muted">Left: as it opens (log closed; the button works here). Right: with the log open.</p>
            {option.cost && <p className="text-xs text-gi-muted max-w-3xl" data-c6-cost-note><span className="font-bold text-gi-text">Draw cost:</span> {option.cost}</p>}
        </article>
    );
};

/** Light motion, drawn as three still frames: rest, wind-up, the strike with its number. */
const MotionStrip = () => {
    const frames = [
        { id: 'rest', caption: '1. Rest: the idle cycle', row: 2, col: 0, step: 0, float: false },
        { id: 'windup', caption: '2. Wind-up: the attack row', row: 0, col: 2, step: 0, float: false },
        { id: 'strike', caption: '3. Strike: 2 art px forward, the number rises', row: 0, col: 5, step: 2, float: true }
    ];
    const W = 252;
    const H = 132;
    return (
        <figure className="flex flex-col gap-1">
            <div className="flex gap-3" data-c6-shot="motion">
                {frames.map(f => (
                    <div key={f.id} className="flex flex-col gap-1">
                        <div className="relative overflow-hidden" style={{ width: W, height: H }}>
                            <SceneArt scale={1} x={0} y={96} />
                            <HeroPose size={64} row={f.row} col={f.col} style={{ left: 50 + f.step * 2, top: H - 64 - 6 }} />
                            <EnemyPose size={64} style={{ left: W - 50 - 64, top: H - 64 - 6 }} />
                            {f.float && <At x={W - 50 + 12} y={H - 30}>{floatLook(sample('enemy-hit'))}</At>}
                        </div>
                        <span className="text-xs text-gi-muted">{f.caption}</span>
                    </div>
                ))}
            </div>
            <figcaption className="text-xs text-gi-muted max-w-3xl">
                {PANEL_MOTION.summary} <span className="font-bold text-gi-text">Cost:</span> {PANEL_MOTION.cost}
            </figcaption>
        </figure>
    );
};

/** The style sheet page's "Combat screen" entry: the settled mat, then the three panel options. */
export const CombatMockups = () => {
    const p = fightPoints(140, 186);
    return (
        <div data-combat-mockups className="flex flex-col pb-8">
            <article data-c6-mat className="flex flex-col gap-3 py-3 border-t border-white/10">
                <header className="flex flex-col gap-1">
                    <h4 className="ui-text-title font-bold text-white">{MAT_SETTLED.name}</h4>
                    <p className="text-xs text-gi-text max-w-3xl">{MAT_SETTLED.summary}</p>
                </header>
                <div className="flex flex-wrap items-start gap-3">
                    <figure className="flex flex-col gap-1">
                        <Ground w={380} h={330} data-c6-shot="mat"><SettledFight p={p} /></Ground>
                        <figcaption className="text-xs text-gi-muted" style={{ maxWidth: 380 }}>
                            A crit rising beside the enemy, a poison tick beside the hero (drawn together here; in play each rises for half a second).
                        </figcaption>
                    </figure>
                    <figure className="flex flex-col gap-1">
                        <FloatSheet />
                        <figcaption className="text-xs text-gi-muted">Every floating number, side by side.</figcaption>
                    </figure>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                    {ENEMY_CARDS.map(e => <EnemyHover key={e.id} e={e} />)}
                </div>
                <p className="text-xs text-gi-muted max-w-3xl" data-c6-cost-note><span className="font-bold text-gi-text">Draw cost:</span> {MAT_SETTLED.cost}</p>
            </article>
            <h4 className="ui-text-title font-bold text-white pt-3">The fight panel: three options</h4>
            <p className="text-xs text-gi-text max-w-3xl">
                Opened by the fight icon, over the playmat beside the fight. Each shows the battlefield with the two fighters facing each other, both sides’ hit, armour and swing, the hero’s elixirs with their fights left and statuses with their stacks, and the enemy’s kinds once fought. The log is closed until asked for.
            </p>
            {PANEL_OPTIONS.map(o => <PanelOption key={o.id} option={o} />)}
            <MotionStrip />
        </div>
    );
};

export default CombatMockups;
