// crowded fights step to open space

import { GameState } from '../../state/GameState.js';
import { artRadius, artRadiusOf, matW, matH } from '../../config/matGeometry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import * as BoardState from './BoardState.js';
import * as Hand from './Hand.js';
import { STAND_GAP } from './standing.js';

/**
 * When a hero reaches an enemy and the fight about to start would cover another fight or a hero
 * standing there, the enemy walks to the nearest clear spot within {@link STEP_REACH} and the
 * hero walks with it (they stand beside it, so they follow); the fight starts there. A lone fight,
 * or one with no clear spot that close, starts where it stands. Asked once, as the hero arrives:
 * nothing moves a fight once it has begun.
 *
 * What a fight covers is what the screen draws over it at the mat's natural size: both fighters'
 * art and, above them, the two health bars and the fight button between them ({@link fightBox}).
 * A hero covers their art and the bar over it ({@link heroBox}). Two boxes crowd each other when
 * they come within {@link CLEAR_GAP} of each other. Tokens never count: heroes and enemies already
 * stand over them.
 *
 * Who counts: every fight (a hero who has reached an enemy, or a fight stepping aside, at the spot
 * it is stepping to) and every hero standing still. Not a hero walking (they are passing through),
 * nor one waiting to fight this same enemy (they stand beside it and follow it).
 *
 * `HeroMotion` asks {@link holdsArrival} as the hero arrives and holds them back while a step is
 * under way; `EnemyMotion` walks the enemy there at its full walking speed. A step is runtime only,
 * never saved: a save taken during one loads with the hero walking up to the enemy again.
 *
 * A step costs its fight the enemy's walk and no more, whatever the tick's length. The hero, who
 * follows the enemy, arrives the tick after it gets there, so the part of the tick the enemy did not
 * need is handed to the fight's first tick ({@link takeLeftover}). Without it a catch-up's 1 s steps
 * would start the fight after a 96 u step 0.9 s later than 100 ms ticks do.
 *
 * ⚠️ Deterministic, so a catch-up steps exactly as live play does: the spots tried are whole mat
 * units from a fixed table, nearest first, the boxes are sums and comparisons, and nothing here
 * draws a random number.
 */

/** How far a fight may step to find room, in mat units: one mat step. */
export const STEP_REACH = 160;

/** The spacing of the spots tried, in mat units. */
export const STEP_GRID = 8;

/** The least room between two boxes for them to read apart, in mat units (`FightBars.test.js`'s 8). */
export const CLEAR_GAP = 8;

/**
 * The fight as `healthBar.js` draws it at a fit of 1, one plate pixel a mat unit (`MAT_BAR`,
 * `CHIP_PX`, `CHIP.GAP`, `fightBarShift`, `fightButtonPlace`): repeated here because the board may
 * not import the screen. `FightStep.test.js` holds the two together.
 */
const HERO_HALF = artRadius(1);
const BAR_W = 64;
const BAR_H = 14;
const BAR_GAP = 3;
const BUTTON = 32;
const BUTTON_GAP = 4;
const BAR_RISE = BAR_GAP + BAR_H;
const BUTTON_MID = BAR_GAP + BAR_H / 2;
const SHIFT_NEED = BAR_W / 2 + BUTTON_GAP + BUTTON / 2;

/**
 * The spots a step tries, as offsets from where the enemy stands: every point of an
 * {@link STEP_GRID} grid within {@link STEP_REACH}, nearest first; on a tie the flatter step first
 * (fights are wide), then up before down, then left before right. Flat pairs, `dx, dy`.
 */
const OFFSETS = (() => {
    const list = [];
    const n = Math.floor(STEP_REACH / STEP_GRID);
    for (let i = -n; i <= n; i++) {
        for (let j = -n; j <= n; j++) {
            const dx = i * STEP_GRID;
            const dy = j * STEP_GRID;
            const d2 = dx * dx + dy * dy;
            if (d2 > 0 && d2 <= STEP_REACH * STEP_REACH) list.push({ dx, dy, d2 });
        }
    }
    list.sort((a, b) => a.d2 - b.d2 || Math.abs(a.dy) - Math.abs(b.dy) || a.dy - b.dy || a.dx - b.dx);
    const flat = new Int32Array(list.length * 2);
    list.forEach((o, k) => { flat[2 * k] = o.dx; flat[2 * k + 1] = o.dy; });
    return flat;
})();

/** How many spots one search may try, at most. */
export const CANDIDATES = OFFSETS.length / 2;

/** The box of a fight with its enemy (art radius `r`) at `(ex, ey)` and its hero at `(hx, hy)`. */
function boxOf(r, ex, ey, hx, hy, out) {
    const dir = hx >= ex ? 1 : -1;
    // Close fighters push their bars apart to leave the button a gap (`fightBarShift`).
    const shift = Math.max(0, SHIFT_NEED - Math.abs(hx - ex) / 2);
    const enemyBar = ex - dir * shift;
    const heroBar = hx + dir * shift;
    const enemyTop = ey - r;
    const heroTop = hy - HERO_HALF;
    const mid = (ex + hx) / 2;
    // The button sits on the lower bar's middle (`fightButtonPlace`).
    const buttonTop = Math.max(enemyTop, heroTop) - BUTTON_MID - BUTTON / 2;
    out.left = Math.min(ex - r, hx - HERO_HALF, enemyBar - BAR_W / 2, heroBar - BAR_W / 2, mid - BUTTON / 2);
    out.right = Math.max(ex + r, hx + HERO_HALF, enemyBar + BAR_W / 2, heroBar + BAR_W / 2, mid + BUTTON / 2);
    out.top = Math.min(enemyTop - BAR_RISE, heroTop - BAR_RISE, buttonTop);
    out.bottom = Math.max(ey + r, hy + HERO_HALF, buttonTop + BUTTON);
    return out;
}

/** Where the hero stands beside an enemy (art radius `r`) at `x`, on `side`: `standingSpot`'s rule. */
function heroX(r, x, side, w) {
    const offset = r + STAND_GAP;
    const at = x + side * offset;
    return at < 0 || at > w ? x - side * offset : at;
}

/**
 * The box a fight takes up, `{ left, top, right, bottom }` in mat units, with its enemy (of
 * `typeId`) at `centre` and its hero beside it on `side`.
 */
export function fightBox(typeId, centre, side) {
    const r = artRadiusOf(typeId);
    return boxOf(r, centre.x, centre.y, heroX(r, centre.x, side, matW()), centre.y, {});
}

/** The box a hero standing at `point` takes up: their art and the bar over it. */
export function heroBox(point) {
    return {
        left: point.x - HERO_HALF,
        top: point.y - HERO_HALF - BAR_RISE,
        right: point.x + HERO_HALF,
        bottom: point.y + HERO_HALF
    };
}

/** Whether two boxes come within {@link CLEAR_GAP} of each other. */
export function crowds(a, b) {
    return a.left < b.right + CLEAR_GAP && b.left < a.right + CLEAR_GAP
        && a.top < b.bottom + CLEAR_GAP && b.top < a.bottom + CLEAR_GAP;
}

function crowdsAny(box, boxes) {
    for (let i = 0; i < boxes.length; i++) if (crowds(box, boxes[i])) return true;
    return false;
}

const isEnemy = (instance) => isEnemyDef(getTokenType(instance?.typeId));

/**
 * The steps under way on the current board: `enemyId → { heroId, x, y, side, done, leftoverMs }`,
 * the spot the enemy walks to, the side its hero stands on, and once it is there the part of that
 * tick it did not need. Kept per board object, like `EnemyMotion`'s bodies; never saved.
 */
const stepsByBoard = new WeakMap();

/** `enemyId → ms`: a finished step's leftover, from its hero's arrival to its fight's first tick. */
const leftoversByBoard = new WeakMap();

function perBoard(byBoard) {
    const board = GameState.state?.board;
    if (!board) return null;
    let map = byBoard.get(board);
    if (!map) {
        map = new Map();
        byBoard.set(board, map);
    }
    return map;
}

const steps = () => perBoard(stepsByBoard);

/** What the searches have cost and what they found (tests and probes). */
const counts = { searches: 0, candidates: 0, worst: 0, stepped: 0, walked: 0, farthest: 0 };

/**
 * `{ searches, candidates, worst, stepped, walked, farthest }`: crowded fights that looked for
 * room, the spots they tried in all and at most in one search, the fights that found some, and how
 * far those stepped in all and at most, in mat units.
 */
export function stats() {
    return { ...counts };
}

export function resetStats() {
    for (const key of Object.keys(counts)) counts[key] = 0;
}

/** Everything a fight starting at `enemyId` for `heroId` must keep clear of, as boxes. */
function obstaclesFor(heroId, enemyId) {
    const out = [];
    const plans = steps();
    for (const [otherId, body] of BoardState.heroBodies()) {
        if (otherId === heroId) continue;
        const workId = BoardState.claimOfHero(otherId)?.instanceId;
        if (workId && workId !== enemyId) {
            const plan = plans?.get(workId);
            const work = BoardState.getTokenById(workId);
            if (work && plan && plan.heroId === otherId) {
                out.push(fightBox(work.typeId, plan, plan.side));
                continue;
            }
            if (work && body.atWork === workId && isEnemy(work)) {
                out.push(fightBox(work.typeId, work, body.side));
                continue;
            }
        }
        if (body.moving) continue;
        if (BoardState.flagOf(otherId)?.pinnedTo === enemyId) continue;
        out.push(heroBox(body));
    }
    return out;
}

/**
 * Whether the fight `heroId` is about to start against `enemy`, on `side`, is crowded, and the
 * spot it steps to: `{ crowded: false, to: null }` when it stands clear (it stays),
 * `{ crowded: true, to: { x, y } }` with the nearest clear spot within reach (whole mat units,
 * the whole box on the mat), or `{ crowded: true, to: null }` when there is none (it stays).
 */
export function planFor(heroId, enemy, side) {
    const obstacles = obstaclesFor(heroId, enemy.id);
    if (!obstacles.length) return { crowded: false, to: null };
    const r = artRadiusOf(enemy.typeId);
    const w = matW();
    const h = matH();
    const box = boxOf(r, enemy.x, enemy.y, heroX(r, enemy.x, side, w), enemy.y, {});
    if (!crowdsAny(box, obstacles)) return { crowded: false, to: null };

    counts.searches++;
    const x0 = Math.round(enemy.x);
    const y0 = Math.round(enemy.y);
    let tried = 0;
    let to = null;
    for (let k = 0; k < OFFSETS.length; k += 2) {
        const x = x0 + OFFSETS[k];
        const y = y0 + OFFSETS[k + 1];
        tried++;
        boxOf(r, x, y, heroX(r, x, side, w), y, box);
        if (box.left < 0 || box.top < 0 || box.right > w || box.bottom > h) continue;
        if (!crowdsAny(box, obstacles)) {
            to = { x, y };
            break;
        }
    }
    counts.candidates += tried;
    if (tried > counts.worst) counts.worst = tried;
    return { crowded: true, to };
}

/**
 * Asked by `HeroMotion` as `heroId` reaches `enemy`, standing on `side`: whether they must wait
 * before the fight starts, because it is stepping to open space. The first ask decides, once; the
 * hero then waits until the enemy has got there and they stand beside it again.
 */
export function holdsArrival(heroId, enemy, side) {
    if (!enemy || BoardState.isInstantArrival() || !isEnemy(enemy)) return false;
    const plans = steps();
    if (!plans) return false;
    const plan = plans.get(enemy.id);
    if (plan) {
        if (plan.heroId === heroId) {
            if (!plan.done) return true;
            plans.delete(enemy.id);
            if (plan.leftoverMs > 0) perBoard(leftoversByBoard).set(enemy.id, plan.leftoverMs);
            return false;
        }
        // Left over from a hero who has let go of it.
        plans.delete(enemy.id);
    }
    const { to } = planFor(heroId, enemy, side);
    if (!to) return false;
    plans.set(enemy.id, { heroId, x: to.x, y: to.y, side, done: false, leftoverMs: 0 });
    const far = Math.sqrt((to.x - enemy.x) ** 2 + (to.y - enemy.y) ** 2);
    counts.stepped++;
    counts.walked += far;
    if (far > counts.farthest) counts.farthest = far;
    return true;
}

/** The step enemy `enemyId` is taking, `{ heroId, x, y, side, done, leftoverMs }`, or null. */
export function stepOf(enemyId) {
    return steps()?.get(enemyId) || null;
}

/** The enemies stepping aside now. */
export function steppingIds() {
    const plans = steps();
    return plans?.size ? [...plans.keys()] : [];
}

/**
 * Enemy `enemyId` has reached its spot, with `leftoverMs` of the tick to spare: its hero may now
 * arrive. Told again each tick the hero is still on their way, it keeps no leftover: a fight that
 * waits for its hero starts when they arrive, as any fight does.
 */
export function finishStep(enemyId, leftoverMs = 0) {
    const plan = steps()?.get(enemyId);
    if (!plan) return;
    plan.leftoverMs = plan.done ? 0 : Math.max(0, Math.round(leftoverMs));
    plan.done = true;
}

/**
 * What the first tick of enemy `enemyId`'s fight is owed by its step, in game ms, once. `BoardCombat`
 * asks every tick it ticks the enemy, so a leftover whose fight did not begin that tick is dropped,
 * as a cycle's leftover is when its station does not start again.
 */
export function takeLeftover(enemyId) {
    const left = leftoversByBoard.get(GameState.state?.board);
    if (!left?.size) return 0;
    const ms = left.get(enemyId);
    if (ms === undefined) return 0;
    left.delete(enemyId);
    return ms;
}

/**
 * Forget every step that no longer stands: its enemy gone or in the player's hand, or its hero
 * no longer after it (let go, sent elsewhere) or already fighting it; and a leftover whose enemy is
 * gone. Run by `EnemyMotion` before it walks anyone.
 */
export function pruneSteps() {
    const left = leftoversByBoard.get(GameState.state?.board);
    if (left?.size) {
        for (const enemyId of left.keys()) if (!BoardState.getTokenById(enemyId)) left.delete(enemyId);
    }
    const plans = steps();
    if (!plans?.size) return;
    for (const [enemyId, plan] of plans) {
        if (!BoardState.getTokenById(enemyId) || Hand.isInHand(enemyId)
            || BoardState.claimOfHero(plan.heroId)?.instanceId !== enemyId
            || BoardState.heroBodyOf(plan.heroId)?.atWork === enemyId) {
            plans.delete(enemyId);
        }
    }
}
