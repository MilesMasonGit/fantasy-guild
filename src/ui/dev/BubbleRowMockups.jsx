// Mock-ups of the bubble row (who is working what) for the owner to pick from on the style sheet
// page. Static pictures built from the real sprites and the pixel kit: nothing here is wired into
// the game. Each mock-up shows the same four moments: a hero working normally, a hero waiting on
// an input, a timed job with charges, and where a fight's link (both styles, the elixirs) would sit.
// Geometry is the mat's at 1920 × 1080: the art draws at 2×, the mat at a fit of 0.9, and a hero
// stands `artRadius + STAND_GAP` from the centre of the Token they work.

import { Tooltip } from '../components/base/Tooltip.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { SkillIcon } from '../components/base/SkillIcon.jsx';
import { TokenSprite } from '../components/base/TokenSprite.jsx';
import { PixelGlyph } from '../components/base/PixelGlyph.jsx';
import { AnimatedHeroSprite } from '../components/board/AnimatedHeroSprite.jsx';
import { HealthBar } from '../components/board/HealthBar.jsx';
import { heroBarPlace, enemyBarPlace } from '../components/board/healthBar.js';
import { HERO_HIT_PX } from '../components/board/boardConstants.js';
import { FLAG_PX, POLE_BASE, PIN_INSET } from '../components/board/flagGeometry.js';
import { FlagMark } from '../components/board/FlagMark.jsx';
import { PROBLEM_SPRITE, SEVERITY } from '../components/board/problemMark.js';
import { artRadius } from '../../config/matGeometry.js';
import { STAND_GAP } from '../../systems/board/HeroMotion.js';

/** The mat's fit at 1920 × 1080 (mat units to screen px). */
const FIT = 0.9;
/** One art pixel of the mat on screen at that fit: the art draws at 2×. */
const U = 2;
/** A 1×1 Token's art and a hero's art, on screen. */
const ART = 64 * U;
/** How far a working hero stands from the Token's centre, on screen. */
const STAND = Math.round((artRadius(1) + STAND_GAP) * FIT);

const PATCH_W = 300;
const PATCH_H = 320;
/** The Token's centre in a patch; its hero stands to its right, facing it. */
const TX = 100;
const TY = 180;
const HX = TX + STAND;
/** The foot of both art boxes, and the seam between the Token and its hero. */
const FOOT = TY + ART / 2;
const HEAD = TY - ART / 2;
const SEAM = Math.round(TX + STAND / 2);
/** A pinned flag's pole stands at the top of its Token's art circle (`pinnedFlagPoint`). */
const POLE_Y = Math.round(TY - (artRadius(1) - PIN_INSET) * FIT);

/** The grass under the mock-ups: the mat's own mean green. */
const GROUND = '#5d9440';
/** An icon cell: 32 px (an item at 1×, a skill or mark at 2×). */
const ICON = 32;
const GAP = 2 * U;
const HARD = '0 0 #000';
/** A hard one-art-pixel shadow under text, down and right, no blur. */
const TEXT_SHADOW = `${U}px ${U}px ${HARD}`;

/** The chamfer frame in red, the same 7 × 7 shape as the shared gold copy: a "can't" problem. */
const RED_CHAMFER = "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='7' shape-rendering='crispEdges'><path fill='%23dc2626' d='M2 0h3v1h-3zM1 1h1v1h-1zM5 1h1v1h-1zM0 2h1v3h-1zM6 2h1v3h-1zM1 5h1v1h-1zM5 5h1v1h-1zM2 6h3v1h-3z'/><path fill='%230d0a08' d='M2 1h3v1h-3zM1 2h5v3h-5zM2 5h3v1h-3z'/></svg>\")";

/** What each moment shows, and what each cell's hover would say. */
export const MOCK_SCENES = Object.freeze([
    {
        id: 'working', caption: 'Working: a Furnace making Copper Ingots',
        token: 'token_furnace', sheet: 'assets/heroes/hn_recruit_sheet.png', flag: 'reddark',
        skill: 'smithing', output: 'item_copper_ingot', fill: 0.6, timer: '0:03',
        tips: {
            skill: 'Aela: Smithing 30/99, 1 XP each Copper Ingot',
            output: 'Makes 1 Copper Ingot every 0:08 from 4 Copper Ore and 1 Coal',
            timer: 'Next Copper Ingot in 0:03'
        }
    },
    {
        id: 'waiting', caption: 'Waiting on an input: no Iron Ore',
        token: 'token_furnace', sheet: 'assets/heroes/hn_recruit_sheet.png', flag: 'bluelite',
        skill: 'smithing', output: 'item_iron_ingot', fill: 0.45, blocked: true, timer: '–',
        problem: { severity: SEVERITY.WAITING, item: 'item_iron_ore', have: 0, need: 6 },
        tips: {
            skill: 'Bram: Smithing 30/99, 5 XP each Iron Ingot',
            output: 'Makes 1 Iron Ingot every 0:19 from 6 Iron Ore and 2 Coal',
            problem: 'Needs 6 Iron Ore: the Bank has 0'
        }
    },
    {
        id: 'charges', caption: 'A timed job with charges: Fir Forest',
        token: 'token_fir_forest', sheet: 'assets/heroes/hn_recruit_sheet.png', flag: 'greenlite',
        skill: 'forestry', output: 'item_fir_wood', fill: 0.3, charges: 248, timer: '0:13',
        tips: {
            skill: 'Cora: Forestry 30/99, 4 XP a cycle',
            output: 'Cuts 1-2 Fir Wood every 0:19',
            charges: '248 charges left: then it is used up',
            timer: 'Next Fir Wood in 0:13'
        }
    },
    {
        id: 'combat', caption: 'Combat link: both styles and the elixirs; HP bars stay above',
        token: 'token_goblin', sheet: 'assets/heroes/hn_fighter_sheet.png', flag: 'orange', combat: true,
        hp: { hero: [34, 50], enemy: [9, 20] },
        styles: { hero: 'melee', enemy: 'melee' }, elixirs: ['item_shrimp_trawler_potion'],
        tips: {
            hero: 'Dain fights Melee: strong against Ranged',
            enemy: 'Goblin fights Melee',
            elixir: 'Shrimp Trawler Potion (stand-in): active this fight'
        }
    }
]);

// ---------------------------------------------------------------------------------------------
// Pieces shared by the mock-ups
// ---------------------------------------------------------------------------------------------

/** The chamfer frame and its hard shadow, under whatever sits in a chip or plate. */
const FrameUnder = ({ tone = null }) => (
    <>
        <span aria-hidden="true" className="ui-frame-shadow-chamfer absolute inset-0 pointer-events-none" />
        <span
            aria-hidden="true"
            className={`ui-frame-chamfer ${tone === SEVERITY.WAITING ? 'ui-frame-chamfer-gold ' : ''}absolute inset-0 pointer-events-none`}
            style={tone === SEVERITY.CANT ? { borderImageSource: RED_CHAMFER } : undefined}
        />
    </>
);

/** A cell that explains itself on hover (the shared tooltip). */
const Cell = ({ tip, name, children, style }) => (
    <Tooltip title={tip}>
        <div data-mock-cell={name} className="relative shrink-0 flex items-center justify-center" style={style}>
            {children}
        </div>
    </Tooltip>
);

/** The cycle, filled in whole art pixels; held grey while blocked. */
const CycleFill = ({ fraction, blocked = false, style }) => {
    const steps = 16;
    const lit = Math.floor(Math.max(0, Math.min(1, fraction)) * steps) / steps;
    return (
        <div aria-hidden="true" className="absolute" style={{ height: U * 2, background: 'rgba(10,8,6,0.85)', ...style }}>
            <div style={{ width: `${lit * 100}%`, height: '100%', background: blocked ? 'var(--color-work-bar-blocked)' : 'var(--color-work-bar)' }} />
        </div>
    );
};

const Num = ({ children, colour = '#fff', className = '' }) => (
    <span className={`ui-text-small font-bold tabular-nums leading-none ${className}`} style={{ color: colour, textShadow: TEXT_SHADOW }}>
        {children}
    </span>
);

const Item = ({ id }) => <ItemIcon item={id} size={ICON} title={null} />;
const Skill = ({ id }) => <SkillIcon skill={id} size={ICON} title={null} />;

/**
 * What the Token waits for, as a pill: the missing input's sprite and have/need in red. A problem
 * with no item to name (no room, the cap, the hero's level) shows the problem mark itself.
 */
const MissingItem = ({ problem }) => (problem.item ? (
    <span className="relative flex items-center gap-0.5">
        <Item id={problem.item} />
        <Num colour="var(--color-ui-red)">{problem.have}/{problem.need}</Num>
    </span>
) : (
    <img src={PROBLEM_SPRITE[problem.severity]} alt="" draggable={false} style={{ width: ICON, height: ICON, imageRendering: 'pixelated' }} />
));

/** The ground, the Token and its hero (or the enemy and the fighter), with HP bars in a fight. */
const Patch = ({ scene, caption, children }) => {
    const heroBox = { left: HX - HERO_HIT_PX / 2, top: TY - FLAG_PX / 2, width: HERO_HIT_PX, height: FLAG_PX };
    return (
        <figure className="flex flex-col gap-1" data-mock-scene={scene.id}>
            <div className="relative overflow-hidden" style={{ width: PATCH_W, height: PATCH_H, background: GROUND }}>
                {/* The hero's flag, pinned to the Token as in today's captures: its cloth flies above it. */}
                <FlagMark colour={scene.flag} size={FLAG_PX} className="absolute" style={{ left: TX - POLE_BASE.x, top: POLE_Y - POLE_BASE.y }} />
                <div className="absolute" style={{ left: TX - ART / 2, top: TY - ART / 2, width: ART, height: ART }}>
                    <TokenSprite typeId={scene.token} size={ART} outline={scene.combat ? null : (scene.blocked ? 'alert' : 'work')} />
                    {scene.combat && (
                        <HealthBar who="enemy" cur={scene.hp.enemy[0]} max={scene.hp.enemy[1]} style={enemyBarPlace(ART)} />
                    )}
                </div>
                <div className="absolute" style={heroBox}>
                    <AnimatedHeroSprite
                        src={scene.sheet}
                        size={ART}
                        animationState={scene.combat ? 'idle' : 'attack'}
                        facingLeft
                        outline={scene.combat || scene.blocked ? null : 'work'}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    />
                    {scene.combat && (
                        <HealthBar who="hero" cur={scene.hp.hero[0]} max={scene.hp.hero[1]} style={heroBarPlace(ART)} />
                    )}
                </div>
                {children}
            </div>
            <figcaption className="text-xs text-gi-muted" style={{ maxWidth: PATCH_W }}>{caption || scene.caption}</figcaption>
        </figure>
    );
};

// ---------------------------------------------------------------------------------------------
// A: square chips at the feet, on the seam. The Token's half (what it makes, its charges or what
// it waits for) sits on the Token's side of the seam, the hero's half (the skill) on the hero's.
// ---------------------------------------------------------------------------------------------

const CHIP = ICON + 2 * U;

const Chip = ({ tip, name, tone = null, width = CHIP, under = null, children }) => (
    <Cell tip={tip} name={name} style={{ width, height: CHIP }}>
        <FrameUnder tone={tone} />
        <div className="relative flex items-center justify-center gap-0.5">{children}</div>
        {under}
    </Cell>
);

const RowA = ({ scene }) => {
    const tokenSide = [];
    const heroSide = [];
    if (scene.combat) {
        tokenSide.push(<Chip key="enemy" name="enemy-style" tip={scene.tips.enemy}><Skill id={scene.styles.enemy} /></Chip>);
        heroSide.push(<Chip key="hero" name="hero-style" tip={scene.tips.hero}><Skill id={scene.styles.hero} /></Chip>);
        scene.elixirs.forEach(id => heroSide.push(<Chip key={id} name="elixir" tip={scene.tips.elixir}><Item id={id} /></Chip>));
    } else {
        if (scene.problem) {
            tokenSide.push(
                <Chip key="problem" name="problem" width={CHIP + 34} tone={scene.problem.severity} tip={scene.tips.problem}>
                    <MissingItem problem={scene.problem} />
                </Chip>
            );
        }
        if (scene.charges != null) {
            tokenSide.push(
                <Chip key="charges" name="charges" width={CHIP + 20} tip={scene.tips.charges}>
                    <PixelGlyph name="charges" scale={U} />
                    <Num>{scene.charges}</Num>
                </Chip>
            );
        }
        tokenSide.push(
            <Chip
                key="output"
                name="output"
                tip={scene.tips.output}
                under={<CycleFill fraction={scene.fill} blocked={scene.blocked} style={{ left: 3 * U, right: 3 * U, bottom: U }} />}
            >
                <Item id={scene.output} />
            </Chip>
        );
        heroSide.push(<Chip key="skill" name="skill" tip={scene.tips.skill}><Skill id={scene.skill} /></Chip>);
    }
    return (
        <div data-mock-row="A" className="absolute" style={{ left: 0, top: FOOT - 4, width: PATCH_W, height: CHIP }}>
            <div className="absolute flex justify-end" style={{ right: PATCH_W - SEAM + U, gap: GAP }}>{tokenSide}</div>
            <div className="absolute flex" style={{ left: SEAM + U, gap: GAP }}>{heroSide}</div>
        </div>
    );
};

// ---------------------------------------------------------------------------------------------
// B: one tag above the Token, its tail stepping down to the hero's head. In a fight the enemy's
// HP bar is where the tag stood, so the tag climbs over it.
// ---------------------------------------------------------------------------------------------

const PLATE_PAD = 2 * U;
const PLATE_H = ICON + 2 * PLATE_PAD;

const Plate = ({ tone = null, children, style, name }) => (
    <div data-mock-plate={name} className="absolute flex items-center" style={{ height: PLATE_H, padding: `0 ${PLATE_PAD + U}px`, gap: GAP, ...style }}>
        <FrameUnder tone={tone} />
        {children}
    </div>
);

/** The cells a full row shows: skill, output with its cycle, charges, the problem; or a fight's. */
const fullCells = (scene, { timer = false } = {}) => {
    if (scene.combat) {
        return [
            <Cell key="enemy" name="enemy-style" tip={scene.tips.enemy}><Skill id={scene.styles.enemy} /></Cell>,
            <span key="vs" className="relative ui-text-small font-bold text-white/70" style={{ textShadow: TEXT_SHADOW }}>vs</span>,
            <Cell key="hero" name="hero-style" tip={scene.tips.hero}><Skill id={scene.styles.hero} /></Cell>,
            ...scene.elixirs.map(id => <Cell key={id} name="elixir" tip={scene.tips.elixir}><Item id={id} /></Cell>)
        ];
    }
    const cells = [
        <Cell key="skill" name="skill" tip={scene.tips.skill}><Skill id={scene.skill} /></Cell>,
        <Cell key="output" name="output" tip={scene.tips.output} style={{ width: ICON, height: ICON }}>
            <Item id={scene.output} />
        </Cell>
    ];
    if (scene.charges != null) {
        cells.push(
            <Cell key="charges" name="charges" tip={scene.tips.charges}>
                <PixelGlyph name="charges" scale={U} />
                <Num>{scene.charges}</Num>
            </Cell>
        );
    }
    if (scene.problem) {
        cells.push(<Cell key="problem" name="problem" tip={scene.tips.problem}><MissingItem problem={scene.problem} /></Cell>);
    }
    if (timer && scene.timer) {
        cells.push(
            <Cell key="timer" name="timer" tip={scene.tips.timer || scene.tips.problem}>
                <PixelGlyph name="clock" scale={U} style={{ color: 'var(--color-ui-white)' }} />
                <Num colour={scene.blocked ? 'var(--color-ui-muted)' : '#fff'}>{scene.timer}</Num>
            </Cell>
        );
    }
    return cells;
};

/** A stepped one-art-pixel tail from (x0, y0) down to (x1, y1), drawn as pixel squares. */
const Tail = ({ x0, y0, x1, y1 }) => {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / U));
    const cells = [];
    for (let i = 0; i <= n; i++) {
        const x = Math.round((x0 + ((x1 - x0) * i) / n) / U) * U;
        const y = Math.round((y0 + ((y1 - y0) * i) / n) / U) * U;
        cells.push(<span key={i} className="absolute" style={{ left: x, top: y, width: U, height: U, background: '#0d0a08', boxShadow: `${U}px ${U}px ${HARD}` }} />);
    }
    return <div data-mock-tail aria-hidden="true" className="absolute inset-0 pointer-events-none">{cells}</div>;
};

const RowB = ({ scene }) => {
    const cells = fullCells(scene);
    // Over the Token's art, or over the enemy's HP bar in a fight; centred on the Token.
    const bottom = scene.combat ? HEAD - 18 : HEAD - 4;
    return (
        <>
            <div className="absolute flex justify-center" style={{ left: TX - PATCH_W / 2, width: PATCH_W, top: bottom - PLATE_H }}>
                <Plate name="B" tone={scene.problem?.severity} style={{ position: 'relative' }}>
                    {cells}
                    {!scene.combat && (
                        <CycleFill fraction={scene.fill} blocked={scene.blocked} style={{ left: PLATE_PAD + U, right: PLATE_PAD + U, bottom: U }} />
                    )}
                </Plate>
            </div>
            <Tail x0={TX + 36} y0={bottom} x1={HX - 6} y1={scene.combat ? HEAD - 20 : HEAD + 6} />
        </>
    );
};

// ---------------------------------------------------------------------------------------------
// C: one quiet plate at the feet, on the seam. At rest it shows only what the Token is making
// (its cycle along the plate's foot) and its charges, or exactly what it waits for; resting the
// pointer on the hero, the Token or the plate opens the full line, each cell with its tooltip.
// ---------------------------------------------------------------------------------------------

const quietCells = (scene) => {
    if (scene.combat) return fullCells(scene);
    const cells = [
        <Cell key="output" name="output" tip={scene.tips.output} style={{ width: ICON, height: ICON }}>
            <Item id={scene.output} />
        </Cell>
    ];
    if (scene.problem) {
        cells.push(<Cell key="problem" name="problem" tip={scene.tips.problem}><MissingItem problem={scene.problem} /></Cell>);
    } else if (scene.charges != null) {
        cells.push(
            <Cell key="charges" name="charges" tip={scene.tips.charges}>
                <PixelGlyph name="charges" scale={U} />
                <Num>{scene.charges}</Num>
            </Cell>
        );
    }
    return cells;
};

const RowC = ({ scene, open = false }) => {
    const cells = open ? fullCells(scene, { timer: true }) : quietCells(scene);
    return (
        <div data-mock-row="C" className="absolute flex justify-center" style={{ left: 0, width: 2 * SEAM, top: FOOT - 2 }}>
            <Plate name="C" tone={scene.problem?.severity} style={{ position: 'relative' }}>
                {cells}
                {!scene.combat && (
                    <CycleFill fraction={scene.fill} blocked={scene.blocked} style={{ left: PLATE_PAD + U, right: PLATE_PAD + U, bottom: U }} />
                )}
            </Plate>
            {open && (
                <span className="absolute left-0 right-0 flex justify-center" style={{ top: PLATE_H + 6 }}>
                    <span className="ui-text-small font-bold text-white" style={{ textShadow: TEXT_SHADOW }}>Fir Forest</span>
                </span>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------------------------

export const BUBBLE_ROW_MOCKUPS = [
    {
        id: 'A', title: 'A. Chips at the feet',
        blurb: 'Square pixel chips on the seam between the Token and its hero, just below their feet: the Token’s side shows what it makes (with the cycle under it) and its charges or what it waits for; the hero’s side shows the skill. Always shown while the hero works.',
        Row: RowA
    },
    {
        id: 'B', title: 'B. A tag over the Token, tailed to the hero',
        blurb: 'One framed tag above the Token (skill, output with the cycle along its foot, charges or what it waits for), a one-pixel tail stepping down to the hero’s head. Always shown while the hero works. In a fight it has to climb over the enemy’s HP bar.',
        Row: RowB
    },
    {
        id: 'C', title: 'C. A quiet plate at the feet (opens on hover)',
        blurb: 'One framed plate on the seam below their feet. At rest it shows only what is being made (the cycle along its foot) and the charges, or exactly what it waits for, in red have/need. Resting the pointer on the hero, the Token or the plate opens the full line: skill, output, charges, time to the next one, each with its tooltip. A fight shows both styles and the elixirs in the same place; HP bars stay above.',
        Row: RowC,
        extra: { scene: 'charges', caption: 'Resting the pointer on it: the full line, the Token’s name below', open: true }
    }
];

/** One mock-up: its four moments side by side (two rows on a narrow page). */
export const BubbleRowMockup = ({ mockup }) => {
    const { Row } = mockup;
    const extraScene = mockup.extra ? MOCK_SCENES.find(s => s.id === mockup.extra.scene) : null;
    return (
        <div data-mockup={mockup.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-3">
                {MOCK_SCENES.map(scene => (
                    <Patch key={scene.id} scene={scene}>
                        <Row scene={scene} />
                    </Patch>
                ))}
                {extraScene && (
                    <Patch scene={extraScene} caption={mockup.extra.caption}>
                        <Row scene={extraScene} open={mockup.extra.open} />
                    </Patch>
                )}
            </div>
        </div>
    );
};

/** All three, with what each is; the style sheet page's "Bubble row" entry. */
export const BubbleRowMockups = () => (
    <div data-bubble-row-mockups className="flex flex-col gap-6">
        {BUBBLE_ROW_MOCKUPS.map(m => (
            <section key={m.id} data-mockup-section={m.id} className="flex flex-col gap-2">
                <h4 className="text-sm font-bold" style={{ color: 'var(--color-ui-gold)' }}>{m.title}</h4>
                <p className="text-xs text-gi-muted" style={{ maxWidth: 620 }}>{m.blurb}</p>
                <BubbleRowMockup mockup={m} />
            </section>
        ))}
    </div>
);

export default BubbleRowMockups;
