import { ALERT } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { effectiveIO } from '../../../systems/board/RecipeResolver.js';
import { checkInputs } from '../../../systems/board/InputAllocator.js';
import { workConfigOf } from '../../../systems/board/StationRecipe.js';
import * as Demolition from '../../../systems/board/Demolition.js';
import { STAND_GAP } from '../../../systems/board/HeroMotion.js';
import { MASTERY_LEVEL } from '../../../systems/hero/PromotionSystem.js';
import * as HeroManager from '../../../systems/hero/HeroManager.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt, boardArtSteps } from '../base/TokenSprite.jsx';
import { GLYPHS } from '../base/PixelGlyph.jsx';
import { t } from '../../../i18n/index.js';
import { problemOf, problemText } from './problemMark.js';
import { ringCount } from './ringRow.js';
import { inputSummary } from './recipeText.js';

/**
 * The work plate: while a hero works a Token, one framed plate on the seam between them, just
 * below their feet, saying what is being made (its cycle along the plate's foot), the charges left,
 * or exactly what the Token waits for. Resting the pointer on the hero, the Token or the plate
 * opens the full line: the skill, the output, the charges and the time to the next one, each part
 * explaining itself on hover. It replaces the worked Token's work bar, its "!" and its charges
 * ring; a Token nobody works keeps those.
 * This file is the plate's rules, with no React: what it shows (`workPlateOf`, `plateCells`), its
 * tooltips (`plateTip`) and where it stands (`platePlace`).
 */

/**
 * The plate's measures in plate pixels. One plate pixel is one screen pixel on a mat drawing its
 * art at 2× (`plateUnit`): item sprites at 1×, skill icons and marks at 2×, all 32 across.
 */
export const PLATE = Object.freeze({
    /** An icon cell. */
    ICON: 32,
    /** The plate's height: an icon and its padding. */
    H: 40,
    /** Padding at each end, and between cells. */
    SIDE: 6,
    GAP: 4,
    /** The chamfer frame's band (its 3-pixel corners at 2×) and its hard shadow's offset. */
    BAND: 6,
    SHADOW: 4,
    /** The cycle's fill, under the first cell: 16 steps of 2 plate pixels, 4 tall. */
    FILL_W: 32,
    FILL_H: 4,
    FILL_STEPS: 16,
    FILL_BOTTOM: 2,
    /** How far the plate tucks up under the art boxes' foot (their last rows are their shadow). */
    TUCK: 2,
    /** A slot as wide as the opened line, centred on the seam. */
    SLOT: 280,
    /** How many missing inputs it names at once; the tooltip names the rest. */
    MISSING_MAX: 2
});

/**
 * The cells a plate can show, in the order they stand. A fight's plate (`fightPlate.js`) uses the
 * skill cell for each fighter's style, a divider between them and an elixir with its fights left.
 */
export const CELL = Object.freeze({
    SKILL: 'skill', OUTPUT: 'output', MISSING: 'missing', PROBLEM: 'problem', CHARGES: 'charges', TIMER: 'timer',
    DIVIDER: 'divider', ELIXIR: 'elixir'
});

/**
 * Mat units for one plate pixel at a mat fit: whole screen pixels, half the art's steps, never
 * below one (a 1× mat keeps the plate at its 2× size rather than halving item sprites).
 */
export function plateUnit(fit = 1) {
    const f = Number.isFinite(fit) && fit > 0 ? fit : 1;
    return Math.max(1, Math.floor(boardArtSteps(f) / 2)) / f;
}

/** The main thing a recipe makes: its anchored output, else its first. */
function mainOutput(outputs) {
    const list = outputs || [];
    return list.find(o => o?.anchor) || list[0] || null;
}

/**
 * What Token `id`'s plate shows, as a flat projection (`useTokenState`'s contract), or null while
 * no hero has reached it.
 * @returns {{typeId: string, heroId: string, side: number, output: string|null, skill: string|null,
 *   charges: number|null, problem: string|null, severity: string|null,
 *   missing: {itemId: string, have: number, need: number}[]}|null}
 */
export function workPlateOf(id) {
    const instance = BoardState.getTokenById(id);
    const heroId = instance ? BoardState.workerOf(id) : null;
    if (!heroId) return null;
    const def = getTokenType(instance.typeId);
    // Being taken down, it makes nothing and spends no charges: the work is the demolition.
    const marked = Demolition.isMarked(instance);
    const io = effectiveIO(id, instance);
    const out = marked ? null : mainOutput(io.outputs);
    const alert = instance.alert || null;
    const problem = problemOf({ alert });
    const missing = alert === ALERT.INPUTS && io.inputs?.length
        ? checkInputs(io.inputs).missing.map(m => ({ itemId: m.itemId, have: Math.max(0, Math.floor(m.available)), need: m.needed }))
        : [];
    return {
        typeId: instance.typeId,
        heroId,
        side: BoardState.heroBodyOf(heroId)?.side === -1 ? -1 : 1,
        output: out ? (out.itemId || out.tokenId || null) : null,
        skill: workConfigOf(def, instance)?.skill || null,
        charges: def?.isGuildHall || marked ? null : (instance.usesRemaining ?? null),
        problem: problem?.kind ?? null,
        severity: problem?.severity ?? null,
        missing
    };
}

/**
 * The plate's cells. At rest: what it makes (or, making no item, the skill), then exactly what it
 * waits for, else its charges. Open: the skill, what it makes, what it waits for, the charges and
 * the time to the next one (not while it waits: nothing is coming).
 * @param {ReturnType<typeof workPlateOf>} plate
 * @returns {{kind: string, id?: string, itemId?: string, have?: number, need?: number, count?: number, severity?: string}[]}
 */
export function plateCells(plate, { open = false } = {}) {
    if (!plate) return [];
    const cells = [];
    if (plate.output) {
        if (open && plate.skill) cells.push({ kind: CELL.SKILL, id: plate.skill });
        cells.push({ kind: CELL.OUTPUT, id: plate.output });
    } else if (plate.skill) {
        cells.push({ kind: CELL.SKILL, id: plate.skill });
    }
    if (plate.problem) {
        if (plate.missing?.length) {
            for (const m of plate.missing.slice(0, PLATE.MISSING_MAX)) cells.push({ kind: CELL.MISSING, ...m });
        } else {
            cells.push({ kind: CELL.PROBLEM, severity: plate.severity });
        }
    }
    if (plate.charges != null && (open || !plate.problem)) cells.push({ kind: CELL.CHARGES, count: plate.charges });
    if (open && !plate.problem) cells.push({ kind: CELL.TIMER });
    return cells;
}

/** `0:34`, `4:05`: whole seconds, rounded up. */
export function clockText(ms) {
    const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The time to the next cycle's end from where the bar stands (`cycleShare.readCycle`). */
export function timeLeftText(cycle) {
    if (!cycle?.cycleMs) return null;
    return clockText(cycle.cycleMs - (cycle.elapsedMs || 0));
}

/** The plate's charges, as short as a ring's: `7`, `248`, `1.2k`. */
export const chargesText = (n) => ringCount(n);

const itemName = (id) => getItem(id)?.name || tokenName(id) || id;

/** `1`, `1–2`: how many one cycle makes. */
function qtyText(output) {
    const min = output?.minQty ?? output?.quantity ?? 1;
    const max = output?.maxQty ?? min;
    return min === max ? `${min}` : `${min}–${max}`;
}

/**
 * What a cell's hover says, read from the engine when the pointer arrives (never per render).
 * @param {{kind: string}} cell from {@link plateCells}
 * @param {string} instanceId
 * @param {{elapsedMs: number, cycleMs: number}|null} cycle where the bar stands now
 */
export function plateTip(cell, instanceId, cycle = null) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance) return '';
    switch (cell.kind) {
        case CELL.SKILL: {
            const heroId = BoardState.workerOf(instanceId);
            const hero = heroId ? HeroManager.getHero(heroId) : null;
            const level = hero?.skills?.[cell.id]?.level ?? 1;
            const xp = effectiveIO(instanceId, instance).xp;
            const vars = { hero: hero?.name || '', skill: getSkill(cell.id)?.name || cell.id, level: `${level}/${MASTERY_LEVEL}`, xp };
            return xp ? t('workPlate.skillXp', vars) : t('workPlate.skill', vars);
        }
        case CELL.OUTPUT: {
            const io = effectiveIO(instanceId, instance);
            const out = mainOutput(io.outputs);
            const vars = { qty: qtyText(out), item: itemName(cell.id), time: clockText(io.cycleTimeMs) };
            const inputs = inputSummary({ inputs: io.inputs });
            return inputs ? t('workPlate.makesFrom', { ...vars, inputs }) : t('workPlate.makes', vars);
        }
        case CELL.MISSING:
            return t('workPlate.needs', { need: cell.need, item: itemName(cell.itemId), have: cell.have });
        case CELL.PROBLEM: {
            const problem = problemOf({ alert: instance.alert || null });
            return problem ? problemText(problem, instanceId) : '';
        }
        case CELL.CHARGES:
            return t('workPlate.charges', { count: cell.count, amount: Number(cell.count).toLocaleString() });
        case CELL.TIMER: {
            const left = timeLeftText(cycle);
            const out = Demolition.isMarked(instance) ? null : mainOutput(effectiveIO(instanceId, instance).outputs);
            const id = out ? (out.itemId || out.tokenId) : null;
            if (!left) return '';
            return id ? t('workPlate.next', { item: itemName(id), time: left }) : t('workPlate.nextCycle', { time: left });
        }
        default:
            return '';
    }
}

/**
 * Where Token `typeId`'s plate stands, in mat units: a slot centred on the seam between the Token
 * and its hero (`side`), its top tucked under their feet. Too near the mat's foot to fit, it goes
 * over their heads instead.
 * @returns {{left: number, top: number, width: number, unit: number}}
 */
export function platePlace({ x, y, typeId, side = 1, fit = 1, matH = Infinity }) {
    const unit = plateUnit(fit);
    const artUnit = boardScaleAt(fit);
    const art = Math.max(tokenSizeFor(TOKEN_SURFACE.BOARD, typeId, artUnit), tokenSizeFor(TOKEN_SURFACE.BOARD, 1, artUnit));
    const seam = x + (side === -1 ? -1 : 1) * (artRadiusOf(typeId) + STAND_GAP) / 2;
    const height = (PLATE.H + PLATE.SHADOW) * unit;
    let top = y + art / 2 - PLATE.TUCK * unit;
    if (top + height > matH) top = y - art / 2 - height;
    const width = PLATE.SLOT * unit;
    // On whole screen pixels, so the sprites and the pixel font inside stay sharp.
    const snap = (v) => Math.round(v * fit) / fit;
    return { left: snap(seam - width / 2), top: snap(top), width, unit };
}

/**
 * How much further down a name below the Token or its hero goes while their plate shows, in mat
 * units: past the plate and its shadow.
 */
export function plateNameDrop(fit = 1) {
    return (PLATE.H + PLATE.SHADOW - PLATE.TUCK) * plateUnit(fit);
}

const glyphCache = new Map();

/** A code-drawn 8 × 8 glyph (`PixelGlyph`'s) as one picture, so a plate draws it as one element. */
export function glyphUri(name, colour = '#ffffff') {
    const key = `${name}|${colour}`;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const rows = GLYPHS[name] || [];
    let d = '';
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '#') d += `M${x} ${y}h1v1h-1z`;
    });
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' shape-rendering='crispEdges'><path fill='${colour}' d='${d}'/></svg>`;
    const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    glyphCache.set(key, uri);
    return uri;
}
