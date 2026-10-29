// The work plate on the style sheet page: the shared `WorkPlateView` in the moments it has to read
// in, each with its Token, its hero and the pinned flag drawn as the mat draws them at 1920 × 1080
// (art at 2×, the mat at a fit of 0.9, the hero `artRadius + STAND_GAP` from the Token's centre),
// then a Token nobody works, hovered, with its idle plate under it.
// Static: no engine behind it, every hover's words written here.

import { TokenSprite } from '../components/base/TokenSprite.jsx';
import { AnimatedHeroSprite } from '../components/board/AnimatedHeroSprite.jsx';
import { HealthBar } from '../components/board/HealthBar.jsx';
import { heroBarPlace, enemyBarPlace } from '../components/board/healthBar.js';
import { HERO_HIT_PX, HERO_BOX_PX } from '../components/board/boardConstants.js';
import { MARKER_ART_PX, markerCornerOffset } from '../components/board/flagGeometry.js';
import { useCornerShare } from '../components/board/markerCorner.js';
import { tokenSpritePath } from '../../config/registries/tokenRegistry.js';
import { FlagMark } from '../components/board/FlagMark.jsx';
import { SEVERITY } from '../components/board/problemMark.js';
import { WorkPlateView, fillStyle } from '../components/board/WorkPlateLayer.jsx';
import { PLATE, CELL, plateCells, leadOf } from '../components/board/workPlate.js';
import { idlePlateCells, timerCellOf } from '../components/board/idlePlate.js';
import { ALERT } from '../../systems/board/boardEvents.js';
import { artRadius } from '../../config/matGeometry.js';
import { STAND_GAP } from '../../systems/board/HeroMotion.js';

/** The mat's fit at 1920 × 1080 (mat units to screen px). */
const FIT = 0.9;
/** A 1×1 Token's art and a hero's art on screen: 64 art pixels at 2×. */
const ART = 128;
/** How far a working hero stands from the Token's centre, on screen. */
const STAND = Math.round((artRadius(1) + STAND_GAP) * FIT);

const PATCH_W = 300;
const PATCH_H = 320;
/** The Token's centre in a patch; its hero stands to its right, facing it. */
const TX = 100;
const TY = 180;
const HX = TX + STAND;
const FOOT = TY + ART / 2;
const SEAM = Math.round(TX + STAND / 2);
/** The job flag, at the mat's size for this patch (2 screen px an art pixel). */
const FLAG_SIZE = MARKER_ART_PX * 2;
/** Flat grass: the mat's own mean green. */
const GROUND = '#5d9440';

const plate = (extra) => ({ skill: null, charges: null, problem: null, severity: null, missing: [], ...extra });

/** The moments the plate has to read in, and what each part's hover says. */
export const WORK_PLATE_MOMENTS = Object.freeze([
    {
        id: 'working', caption: 'Working, nothing to count: a Furnace making Copper Ingots shows its skill',
        token: 'token_furnace', sheet: 'assets/heroes/hn_recruit_sheet.png', flag: 'reddark', fill: 0.6,
        plate: plate({ skill: 'smithing' }),
        tips: { [CELL.SKILL]: 'Cora: Smithing 12/99, 6 XP a cycle' }
    },
    {
        id: 'waiting', caption: 'Waiting on an input: no Iron Ore (the frame gold, the cycle held grey)',
        token: 'token_furnace', sheet: 'assets/heroes/hn_recruit_sheet.png', flag: 'bluelite', fill: 0.45, blocked: true,
        plate: plate({
            skill: 'smithing', problem: ALERT.INPUTS, severity: SEVERITY.WAITING,
            missing: [{ itemId: 'item_iron_ore', have: 0, need: 6 }]
        }),
        tips: { [CELL.MISSING]: 'Needs 6 Iron Ore, you have 0' }
    },
    {
        id: 'charges', caption: 'A timed job with charges: Fir Forest (no Fir Wood icon: the art says what it makes)',
        token: 'token_fir_forest', sheet: 'assets/heroes/hn_recruit_sheet.png', flag: 'greenlite', fill: 0.3,
        plate: plate({ skill: 'forestry', charges: 248 }),
        tips: { [CELL.CHARGES]: '248 charges left' }
    },
    {
        id: 'open', caption: 'The pointer resting on the hero, the Token or the plate: the full line',
        token: 'token_fir_forest', sheet: 'assets/heroes/hn_recruit_sheet.png', flag: 'greenlite', fill: 0.3, open: true,
        plate: plate({ skill: 'forestry', charges: 248 }),
        timer: '0:13',
        tips: {
            [CELL.SKILL]: 'Cora: Forestry 30/99, 4 XP a cycle',
            [CELL.CHARGES]: '248 charges left',
            [CELL.TIMER]: 'Next Fir Wood in 0:13'
        }
    },
    {
        id: 'combat', caption: 'A fight: no plate yet. Its place is kept for the fight’s link (both styles, the elixirs), built with the combat work',
        token: 'token_goblin', sheet: 'assets/heroes/hn_fighter_sheet.png', flag: 'orange', combat: true,
        hp: { hero: [34, 50], enemy: [9, 20] }
    }
]);

/** A Token nobody works, the pointer resting on it: its idle plate under it, with what applies. */
export const IDLE_PLATE_MOMENTS = Object.freeze([
    {
        id: 'idle-vein', caption: 'Idle, hovered: a Copper vein’s charges',
        token: 'token_copper_ore_vein', cells: idlePlateCells({ charges: 40 })
    },
    {
        id: 'idle-resting', caption: 'Idle, hovered: a berry bush resting, its refill time',
        token: 'token_redberry_bush',
        cells: idlePlateCells({ timer: { ...timerCellOf({ kind: 'respawn', inMs: 34000 }), tip: 'Resting. Refills in 34s' } })
    },
    {
        id: 'idle-stump', caption: 'Idle, hovered: an Oak Stump regrowing',
        token: 'token_oak_stump',
        cells: idlePlateCells({ timer: { ...timerCellOf({ kind: 'grow', inMs: 125000 }), tip: 'Grows into Oak Sapling in 2:05' } })
    },
    {
        id: 'idle-spawner', caption: 'Idle, hovered: a Goblin Camp’s count against its limit',
        token: 'token_goblin_camp', cells: idlePlateCells({ spawner: { count: 3, cap: 5 } })
    },
    {
        id: 'idle-quest', caption: 'Idle, hovered: a quest’s progress',
        token: 'token_copper_ore_vein', cells: idlePlateCells({ quest: { currentCount: 3, requiredCount: 10, itemId: 'item_copper_ore' } })
    },
    {
        id: 'idle-problem', caption: 'Idle, hovered, waiting: its charges and its problem (the mark stays on the Token)',
        token: 'token_copper_ore_vein', tone: SEVERITY.WAITING,
        cells: idlePlateCells({ problem: { kind: ALERT.INPUTS, severity: SEVERITY.WAITING }, charges: 12 })
    }
]);

/** The ground, the pinned flag, the Token and its hero (or the enemy and the fighter, HP bars up). */
const Patch = ({ moment, children }) => {
    // The flag peeks out from behind the top-left corner of the Token's art, as on the mat.
    const corner = markerCornerOffset(ART, useCornerShare(tokenSpritePath(moment.token)), 2);
    const heroBox = { left: HX - HERO_HIT_PX / 2, top: TY - HERO_BOX_PX / 2, width: HERO_HIT_PX, height: HERO_BOX_PX };
    return (
        <figure className="flex flex-col gap-1" data-work-plate-moment={moment.id}>
            <div className="relative overflow-hidden" style={{ width: PATCH_W, height: PATCH_H, background: GROUND }}>
                <FlagMark size={FLAG_SIZE} className="absolute" style={{ left: TX - corner - FLAG_SIZE / 2, top: TY - corner - FLAG_SIZE / 2 }} />
                <div className="absolute" style={{ left: TX - ART / 2, top: TY - ART / 2, width: ART, height: ART }}>
                    <TokenSprite typeId={moment.token} size={ART} outline={moment.combat ? null : (moment.blocked ? 'alert' : 'work')} />
                    {moment.combat && <HealthBar who="enemy" cur={moment.hp.enemy[0]} max={moment.hp.enemy[1]} style={enemyBarPlace(ART)} />}
                </div>
                <div className="absolute" style={heroBox}>
                    <AnimatedHeroSprite
                        src={moment.sheet}
                        size={ART}
                        animationState={moment.combat ? 'idle' : 'attack'}
                        facingLeft
                        outline={moment.combat || moment.blocked ? null : 'work'}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    />
                    {moment.combat && <HealthBar who="hero" cur={moment.hp.hero[0]} max={moment.hp.hero[1]} style={heroBarPlace(ART)} />}
                </div>
                {children}
            </div>
            <figcaption className="text-xs text-gi-muted" style={{ maxWidth: PATCH_W }}>{moment.caption}</figcaption>
        </figure>
    );
};

/** A still fill, where the live one is the Token's work bar. */
const StillFill = ({ fraction, blocked, lead }) => (
    <div
        aria-hidden="true"
        data-work-bar-blocked={blocked ? 'true' : undefined}
        className="gi-work-bar absolute pointer-events-none"
        style={{ ...fillStyle(1, lead), '--work-bar-fill': Math.floor(fraction * PLATE.FILL_STEPS) / PLATE.FILL_STEPS }}
    />
);

/** One moment's plate, in its slot on the seam under the feet, as `WorkPlateLayer` places it. */
const MomentPlate = ({ moment }) => {
    if (!moment.plate) return null;
    const cells = plateCells(moment.plate, { open: !!moment.open })
        .map(c => (c.kind === CELL.TIMER ? { ...c, text: moment.timer } : c));
    return (
        <div className="absolute flex justify-center" style={{ left: SEAM - PATCH_W, width: 2 * PATCH_W, top: FOOT - PLATE.TUCK }}>
            <WorkPlateView
                cells={cells}
                tone={moment.plate.severity}
                tip={(cell) => moment.tips?.[cell.kind] || null}
                fill={<StillFill fraction={moment.fill} blocked={moment.blocked} lead={leadOf(cells)} />}
                plateProps={{ 'data-work-plate-demo': moment.id }}
            />
            {moment.open && (
                <span className="absolute left-0 right-0 flex justify-center" style={{ top: PLATE.H + 8 }}>
                    <span className="ui-text-small font-bold text-white" style={{ textShadow: '2px 2px 0 #000' }}>Fir Forest</span>
                </span>
            )}
        </div>
    );
};

/** A Token nobody works, hovered: its idle plate under it, centred, and its name below the plate. */
const IdlePatch = ({ moment }) => (
    <figure className="flex flex-col gap-1" data-work-plate-moment={moment.id}>
        <div className="relative overflow-hidden" style={{ width: PATCH_W, height: PATCH_H, background: GROUND }}>
            <div className="absolute" style={{ left: PATCH_W / 2 - ART / 2, top: TY - ART / 2, width: ART, height: ART }}>
                <TokenSprite typeId={moment.token} size={ART} outline="hover" />
            </div>
            <div className="absolute flex justify-center" style={{ left: 0, width: PATCH_W, top: FOOT - PLATE.TUCK }}>
                <WorkPlateView
                    cells={moment.cells}
                    tone={moment.tone || null}
                    tip={(cell) => cell.tip || null}
                    plateProps={{ 'data-work-plate-demo': moment.id }}
                />
            </div>
        </div>
        <figcaption className="text-xs text-gi-muted" style={{ maxWidth: PATCH_W }}>{moment.caption}</figcaption>
    </figure>
);

/** The style sheet page's "Work plate" entry. */
export const WorkPlateDemo = () => (
    <div data-work-plate-demo-root className="flex flex-wrap gap-3 pb-8">
        {WORK_PLATE_MOMENTS.map(m => (
            <Patch key={m.id} moment={m}>
                <MomentPlate moment={m} />
            </Patch>
        ))}
        {IDLE_PLATE_MOMENTS.map(m => <IdlePatch key={m.id} moment={m} />)}
    </div>
);

export default WorkPlateDemo;
