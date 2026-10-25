import * as BoardState from '../../../systems/board/BoardState.js';
import * as BoardCombat from '../../../systems/board/BoardCombat.js';
import * as HeroManager from '../../../systems/hero/HeroManager.js';
import { getHeroCombatStyle, getHeroCombatSkillEntry } from '../../../utils/CombatFormulas.js';
import { getEnemyProfile } from '../../../config/registries/enemyProfile.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt } from '../base/TokenSprite.jsx';
import { CELL, plateUnit } from './workPlate.js';
import { HP_BAR } from './healthBar.js';
import { activeElixirsOf, styleName, levelText } from '../combat/fightView.js';
import { t } from '../../../i18n/index.js';

/**
 * A fight on the mat, beside its two health bars: the **fight plate** in the work plate's place
 * on the seam under their feet (both styles with a divider, then the hero's elixirs with the
 * fights each has left) and the **fight chip** at the enemy's outer top corner, beside its bar,
 * which opens the fight panel (owner, 2026-10-25, option B as settled). Rules only, no React.
 */

/**
 * What a fight's plate shows, as a flat projection, or null when there is no fight between them.
 * @returns {{typeId: string, side: number, enemyStyle: string, heroStyle: string|null,
 *   elixirs: {itemId: string, left: number}[]}|null}
 */
export function fightPlateOf(heroId, instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    const hero = HeroManager.getHero(heroId);
    if (!instance || !hero) return null;
    const fight = BoardCombat.getFight(instanceId);
    const enemy = fight?.enemy || getEnemyProfile(instance.typeId);
    return {
        typeId: instance.typeId,
        side: BoardState.heroBodyOf(heroId)?.side === -1 ? -1 : 1,
        enemyStyle: enemy?.combatType || 'melee',
        heroStyle: getHeroCombatStyle(hero),
        elixirs: activeElixirsOf(hero).map(e => ({ itemId: e.itemId, left: e.left }))
    };
}

/**
 * The plate's cells, each under its own fighter: the enemy's style, a divider, the hero's style
 * and their elixirs, mirrored when the hero stands on the enemy's left. A Recruit has no style.
 */
export function fightPlateCells(plate) {
    if (!plate) return [];
    const enemy = [{ kind: CELL.SKILL, id: plate.enemyStyle, who: 'enemy' }];
    const hero = [
        ...(plate.heroStyle ? [{ kind: CELL.SKILL, id: plate.heroStyle, who: 'hero' }] : []),
        ...plate.elixirs.map(e => ({ kind: CELL.ELIXIR, itemId: e.itemId, count: e.left }))
    ];
    const cells = hero.length ? [...enemy, { kind: CELL.DIVIDER }, ...hero] : enemy;
    return plate.side === -1 ? cells.reverse() : cells;
}

/** What a fight plate cell's hover says, read when the pointer arrives. */
export function fightPlateTip(cell, heroId, instanceId) {
    if (cell.kind === CELL.ELIXIR) {
        const name = getItem(cell.itemId)?.name || cell.itemId;
        return t('fight.tip.elixir', { item: name, count: cell.count });
    }
    if (cell.kind === CELL.SKILL) {
        if (cell.who === 'hero') {
            const hero = HeroManager.getHero(heroId);
            const { level } = getHeroCombatSkillEntry(hero);
            return t('fight.tip.level', { name: hero?.name || '', style: styleName(cell.id), level: levelText(level) });
        }
        const instance = BoardState.getTokenById(instanceId);
        const enemy = instance ? getEnemyProfile(instance.typeId) : null;
        return t('fight.tip.enemyStyle', { name: enemy?.name || '', style: styleName(cell.id) });
    }
    return '';
}

/** The chip's measures in plate pixels: the 8 × 8 fight glyph at 2× in the chamfer frame. */
export const CHIP = Object.freeze({ GLYPH: 16, PAD: 2, BAND: 6, GAP: 8 });
export const CHIP_PX = CHIP.GLYPH + 2 * (CHIP.PAD + CHIP.BAND);

/**
 * Where the fight chip stands, in mat units: beside the enemy's health bar on the side away from
 * the hero (the flag's cloth flies the other way, over the hero), its foot level with the bar's,
 * and past the bar's number however wide it grows (`labelW`, the widest it can be, in mat units).
 * @returns {{left: number, top: number, unit: number}}
 */
export function fightChipPlace({ x, y, typeId, side = 1, fit = 1, labelW = 0 }) {
    const u = plateUnit(fit);
    const art = tokenSizeFor(TOKEN_SURFACE.BOARD, typeId, boardScaleAt(fit));
    const top = y - art / 2 - HP_BAR.GAP * u - CHIP_PX * u;
    const half = (HP_BAR.W / 2) * u;
    const clear = Math.max(HP_BAR.W * u, Number(labelW) || 0);
    const gap = CHIP.GAP * u;
    // The bar's inner edge (towards the hero), then out past the bar or its number.
    const left = side === -1 ? x - half + clear + gap : x + half - clear - gap - CHIP_PX * u;
    const snap = (v) => Math.round(v * fit) / fit;
    return { left: snap(left), top: snap(top), unit: u };
}

/** The longest an enemy's health number can be: its full health and 100 %. */
export function fullHealthText(maxHp) {
    return `${Math.max(0, Math.round(Number(maxHp) || 0)).toLocaleString()} · 100%`;
}

let measurer = null;
const widths = new Map();

/**
 * How wide `text` is in the health bars' own font, in mat units: read from a bar's number on the
 * page (its font, sized in mat units) and measured once per text and font. Null with no bar drawn.
 */
export function healthTextWidth(text) {
    if (typeof document === 'undefined') return null;
    const label = document.querySelector('[data-health-label]');
    if (!label || typeof getComputedStyle !== 'function') return null;
    const cs = getComputedStyle(label);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const key = `${font}|${text}`;
    if (widths.has(key)) return widths.get(key);
    measurer = measurer || document.createElement('canvas').getContext?.('2d');
    if (!measurer) return null;
    measurer.font = font;
    const w = measurer.measureText(text)?.width;
    const out = Number.isFinite(w) && w > 0 ? w : null;
    widths.set(key, out);
    return out;
}
