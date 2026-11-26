import * as HeroManager from '../../../systems/hero/HeroManager.js';
import * as BoardCombat from '../../../systems/board/BoardCombat.js';
import * as LiveEffects from '../../../systems/effects/LiveEffects.js';
import { isFightElixir } from '../../../systems/hero/ConsumptionSystem.js';
import { MAX_SKILL_LEVEL } from '../../../utils/XPCurve.js';
import * as CombatFormulas from '../../../systems/combat/CombatFormulas.js';
import { levelDamageBonus, UNARMED_DAMAGE, NO_AMMO_DAMAGE_FACTOR } from '../../../config/FormulaRegistry.js';
import { DAMAGE_TYPES, PLAIN_ENEMY_HIT_TYPE, arrowOf } from '../../../config/registries/damageTypes.js';
import { nextArrowOf, shootsArrows, carriedArrowIds, nextAmmoOf, AMMO } from '../../../systems/combat/Ammo.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { getEquippedEntries, isConsumableCategory } from '../../../config/registries/equipmentConstants.js';
import { getEnemyProfile } from '../../../config/registries/enemyProfile.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { tokenName, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { EFFECTS } from '../../../config/registries/effectRegistry.js';
import { statusBlockOf } from '../../../systems/effects/effectLibrary.js';
import { enemyAtRest, enemyFightNumbers } from '../../../systems/effects/enemyKindEffects.js';
import { lengthText } from '../../../utils/Formatters.js';
import { rulesLinesOf } from '../../../systems/effects/statementText.js';
import { carriedRuleNames } from '../dock/heroPerks.js';
import { explainLinesOf, effectTypesOfStatements } from '../base/effectExplain.js';
import { statementsOf } from '../../../systems/effects/statements.js';
import { GameState } from '../../../state/GameState.js';
import { resolveAnimationPath, resolveSpritePath, resolveEnemyAnimationPath } from '../../../utils/AssetManager.js';
import { statusIcon } from './fightWatch.js';
import { t } from '../../../i18n/index.js';

/**
 * What the combat screen shows, as plain values read from the engine: both fighters' numbers for
 * the fight panel's versus card, the enemy card, the hero's elixirs for the bubble row. No React:
 * the views here are handed to components (`FightPanel.jsx`, `EnemyCard.jsx`, `FightLayer.jsx`),
 * which a test can also feed a fixture.
 * The numbers are the ones the fight uses (`CombatFormulas`), before the other side's resistances
 * and the matchup: the player does the sums (no forecast).
 */

/** A hit's size as the screen shows it: `2`, `2.5`, `1.88` (a fraction rolls when it lands). */
export function damageText(n) {
    const v = Math.max(0, Number(n) || 0);
    return String(Math.round(v * 100) / 100);
}

/** A damage type's name in the player's words. */
export const damageTypeName = (id) => t(`fight.types.${id}`);

/** Resistance lines in type order: `[{ id, value }]`, a weakness negative. */
function orderedLines(valueOf) {
    const out = [];
    for (const { id } of DAMAGE_TYPES) {
        const value = valueOf(id);
        if (value) out.push({ id, value });
    }
    return out;
}

/** An enemy's resistances as written. */
export function enemyResistLines(resistances) {
    return orderedLines(id => Number(resistances?.[id]) || 0);
}

/**
 * An enemy's resistances in a fight, as they stand: its own, what effects on it lend and after any
 * Sunder (`CombatFormulas.enemyTypeResistance`).
 */
export function liveEnemyResistLines(enemy) {
    return orderedLines(id => CombatFormulas.enemyTypeResistance(enemy, id));
}

/** A hero's resistances from what they carry and the guild gives, each type's lines added. */
export function heroResistLines(hero) {
    return orderedLines(id => Math.round(CombatFormulas.heroTypeResistance(hero, id) * 100) / 100);
}

/**
 * A Ranged hero's arrows: the one their next shot spends and how many the Bank holds, or none left.
 * Null for any other style.
 * @returns {{itemId: string|null, name: string|null, count: number, arrow: object|null}|null}
 */
export function arrowsView(hero) {
    if (!hero || !shootsArrows(hero)) return null;
    const itemId = nextArrowOf(hero);
    if (!itemId) {
        const carried = carriedArrowIds(hero);
        return { itemId: carried[0] || null, name: carried[0] ? getItem(carried[0])?.name || carried[0] : null, count: 0, arrow: null };
    }
    return { itemId, name: getItem(itemId)?.name || itemId, count: InventoryManager.getItemCount(itemId), arrow: arrowOf(getItem(itemId)) };
}

/**
 * A Mote or Kunai hero's ammo: the item their attack spends, how many the Bank holds, and whether
 * none is left (`short`: they attack at half). Null for a weapon that spends neither.
 * @returns {{kind: string, itemId: string, name: string, count: number, short: boolean}|null}
 */
export function spentAmmoView(hero) {
    const next = hero ? nextAmmoOf(hero) : null;
    if (!next || next.rule.kind === AMMO.ARROW || !next.rule.needs) return null;
    const itemId = next.rule.needs;
    return {
        kind: next.rule.kind, itemId, name: getItem(itemId)?.name || itemId,
        count: next.itemId ? InventoryManager.getItemCount(itemId) : 0, short: !next.itemId
    };
}

/** `20/99`. */
export const levelText = (level) => `${Math.max(0, Math.round(Number(level) || 0))}/${MAX_SKILL_LEVEL}`;

/** A combat style's name (`Melee`), or null. */
export const styleName = (style) => (style ? getSkill(style)?.name || style : null);

/** Whether the guild has fought this enemy (its kinds are then shown). */
export function hasFought(typeId) {
    return !!(typeId && GameState.state?.collection?.discoveredEnemies?.[typeId]);
}

/** Whether a hero is in a fight with an enemy that has stepped up (not resting between kills). */
function engaged(hero) {
    return BoardCombat.tradingBlows(hero?.id);
}

/**
 * The fight elixirs a hero has working: equipped elixirs whose effect is on them for this fight,
 * or that have fights left. `left` is how many more fights each lasts after the one under way;
 * `count` is what the screen shows, the fight under way counted too (owner, 2026-10-25): a fresh
 * dose shows 10, its last fight 1, and between fights the fights still to come.
 * @returns {{itemId: string, name: string, left: number, count: number}[]}
 */
export function activeElixirsOf(hero) {
    if (!hero) return [];
    const out = [];
    const seen = new Set();
    const inFight = engaged(hero);
    const sources = new Set((hero.effects || []).filter(e => e?.forFight && e.sourceId).map(e => e.sourceId));
    for (const { itemId, category } of getEquippedEntries(hero)) {
        if (seen.has(itemId) || !isConsumableCategory(category) || !isFightElixir(itemId)) continue;
        seen.add(itemId);
        const left = Math.max(0, Number(hero.elixirFights?.[itemId]) || 0);
        const item = getItem(itemId);
        const working = (item?.effects || []).some(ref => sources.has(ref?.effectId));
        if (working || left > 0) out.push({ itemId, name: item?.name || itemId, left, count: inFight ? left + 1 : left });
    }
    return out;
}

/**
 * A fighter's statuses as the panel lists them: name, stacks, its cap, ticks left, its glyph. The
 * cap is the one the engine stacks to: the status's own, within the engine's range, moved by what
 * the fighter carries (a Status Stack Limit rule).
 */
export function statusesView(target) {
    return LiveEffects.statusesOf(target).map(s => ({
        id: s.effectId,
        name: EFFECTS[s.effectId]?.name || s.effectId,
        stacks: s.stacks,
        maxStacks: stackCapOf(target, s.effectId),
        ticksLeft: s.ticksLeft,
        icon: statusIcon(s.effectId)
    }));
}

/** The stack cap `LiveEffects` holds a status at on this fighter, or null for no status block. */
function stackCapOf(target, effectId) {
    const block = statusBlockOf(EFFECTS[effectId]);
    return block ? CombatFormulas.heroStatusStackCap(target, effectId, block.stacks) : null;
}

// ⚠️ `swing` is the lifetime id stored in content; the player reads it as "for this attack".
const LASTS_KEY = Object.freeze({ attack: 'Attack', swing: 'ThisAttack', fight: 'Fight' });

/**
 * What a move's effect does, in the player's words: "Flutter on itself, for one attack", "Venom on
 * the hero" (a status keeps its own lifetime). Null for a move with no effect.
 */
export function moveEffectText(move) {
    if (!move?.effectId) return null;
    const entry = EFFECTS[move.effectId];
    const effect = entry?.name || move.effectId;
    const on = move.target === 'self' ? 'self' : 'hero';
    const lasts = statusBlockOf(entry) ? 'Status' : (LASTS_KEY[move.lasts] || LASTS_KEY.fight);
    return t(`fight.moves.${on}${lasts}`, { effect });
}

/**
 * An enemy's moves as the screen lists them (`enemyMoves.js`), or null for an enemy without: each
 * one's name, the type it hits with (null when it does not hit), what its effect does and its share
 * of the attacks in whole percent.
 * @returns {Array<{name: string, hits: boolean, type: string|null, effect: string|null, share: number}>|null}
 */
export function movesView(moves) {
    if (!Array.isArray(moves) || moves.length === 0) return null;
    const total = moves.reduce((sum, m) => sum + (m.weight || 0), 0) || moves.length;
    return moves.map(m => ({
        name: m.name || t('fight.moves.unnamed'),
        hits: !!m.hits,
        type: m.hits ? m.type : null,
        effect: moveEffectText(m),
        share: Math.round(((m.weight || 0) / total) * 100)
    }));
}

/** The types an enemy's attacks hit with: its moves' that hit, each once, or the plain Crush Strike's. */
export function enemyHitTypes(moves) {
    if (!Array.isArray(moves) || moves.length === 0) return [PLAIN_ENEMY_HIT_TYPE];
    return [...new Set(moves.filter(m => m.hits).map(m => m.type))];
}

/**
 * A lingering effect as its row shows it: its name, and its rules as its bearer's own (`Attack
 * Speed +50% in combat.`), so an enemy's Enrage reads with its plain sign, never as a loss; and
 * what each effect its rules name means (`explains`).
 */
function buffOf(effectId) {
    const entry = EFFECTS[effectId];
    const names = { ...carriedRuleNames(), effect: (id) => EFFECTS[id]?.name || id };
    return {
        name: entry?.name || effectId,
        lines: entry ? rulesLinesOf(entry, names) : [],
        explains: entry ? explainLinesOf(effectTypesOfStatements(statementsOf(entry), names)) : []
    };
}

/** What lingers on an enemy for the fight besides statuses (a boss's Stone Skin, its Enrage). */
function enemyBuffs(fight) {
    return (fight?.effects || [])
        .filter(e => e?.stacks == null && !e.forSwing)
        .map(e => buffOf(e.effectId));
}

/** What lingers on a hero for the fight besides statuses (an elixir's Valor). */
function heroBuffs(hero) {
    return (hero?.effects || [])
        .filter(e => e?.forFight && e.stacks == null && !e.forSwing)
        .map(e => buffOf(e.effectId));
}

/** The hero's side of the versus card, read live. */
export function heroSide(hero) {
    if (!hero) return null;
    const { id: style, level } = CombatFormulas.getHeroCombatSkillEntry(hero);
    const weapon = CombatFormulas.getHeroWeapon(hero);
    // The cut worn gear makes to this style (a mage in an iron chestplate) is in the hit shown.
    const cut = CombatFormulas.styleDamageCut(hero, style);
    const ammo = spentAmmoView(hero);
    // A cast with no Mote, or a throw of the last Kunai, lands at half.
    const buffs = CombatFormulas.heroDamageMultiplier(hero, style) * CombatFormulas.styleCutFactor(hero, style)
        * (ammo?.short ? NO_AMMO_DAMAGE_FACTOR : 1);
    const arrows = arrowsView(hero);
    const hitParts = CombatFormulas.heroHitParts(hero, arrows?.arrow || null)
        .map(p => ({ type: p.type, hit: Math.max(0, p.base * buffs), arrow: !!p.arrow }));
    const hit = hitParts.reduce((sum, p) => sum + p.hit, 0);
    const weaponDamage = weapon && Number(weapon.damage) > 0 ? Number(weapon.damage) : UNARMED_DAMAGE;
    const levelStep = levelDamageBonus(CombatFormulas.getHeroCombatLevel(hero));
    const more = Math.round((CombatFormulas.heroBaseDamage(hero) * CombatFormulas.heroDamageMultiplier(hero, style) - weaponDamage - levelStep) * 100) / 100;
    const boosts = [...new Set(hitParts.map(p => p.type))]
        .map(type => ({ type, n: CombatFormulas.heroTypeDamageBoost(hero, type) }))
        .filter(b => b.n);
    const attackEveryMs = CombatFormulas.heroAttackSpeedMs(hero);
    return {
        id: hero.id,
        name: hero.name,
        style,
        level: style ? level : null,
        sprite: hero.spriteId || null,
        hp: { cur: Math.max(0, hero.hp?.current ?? 0), max: hero.hp?.max ?? 0 },
        hit,
        hitParts,
        arrows,
        ammo,
        armed: !!weapon,
        hitLines: [
            weapon ? t('fight.tip.weapon', { item: weapon.name, n: `${weaponDamage} ${damageTypeName(hitParts[0].type)}` }) : t('fight.tip.fist'),
            levelStep ? t('fight.tip.levelStep', { n: levelStep }) : null,
            more ? t('fight.tip.moreDamage', { n: `${more > 0 ? '+' : '−'}${damageText(Math.abs(more))}` }) : null,
            cut ? t('fight.tip.styleCut', { style: styleName(style), n: `−${damageText(cut)}%` }) : null,
            arrows?.arrow ? t('fight.tip.arrow', { item: arrows.name, n: damageText(arrows.arrow.damage), type: damageTypeName(arrows.arrow.damageType) }) : null,
            arrows ? t('fight.tip.arrowsLeft', { count: arrows.count }) : null,
            ammo ? (ammo.short ? t('fight.tip.ammoShort', { item: ammo.name }) : t(`fight.tip.${ammo.kind}Left`, { item: ammo.name, count: ammo.count })) : null,
            ...boosts.map(b => t('fight.tip.typeBoost', { type: damageTypeName(b.type), n: `${b.n > 0 ? '+' : ''}${b.n}%` })),
            hitParts.some(p => Math.abs(p.hit - Math.round(p.hit)) > 1e-9) ? t('fight.tip.fraction') : null
        ].filter(Boolean),
        resists: heroResistLines(hero),
        attackEveryMs,
        elixirs: activeElixirsOf(hero),
        statuses: statusesView(hero),
        buffs: heroBuffs(hero)
    };
}

/**
 * An enemy's hit, resistances and how often it attacks, as the engine reads them off `subject` (a
 * fight's enemy, or one at rest, `enemyAtRest`): the hit the engine swings for (`enemyBlow`) before
 * the matchup and the hero's resistances, with the flat Damage and the Damage percentage its effects
 * and kinds lend it.
 */
function enemyNumbers(subject) {
    return {
        hit: Math.max(0, CombatFormulas.enemyBaseHit(subject) * CombatFormulas.damageMultiplierOf(subject)),
        resists: liveEnemyResistLines(subject),
        attackEveryMs: CombatFormulas.enemyAttackSpeedMs(subject)
    };
}

/** An enemy Token type's hit, resistances and attack time before any fight: its own numbers and its kinds'. */
export function enemyRestNumbers(profile) {
    return profile ? enemyNumbers(enemyAtRest(profile)) : null;
}

/** An enemy's side of the versus card: live from its fight, or its type's numbers with its kinds. */
export function enemySide(typeId, fight = null) {
    const profile = fight?.enemy || getEnemyProfile(typeId);
    if (!profile) return null;
    const live = !!fight;
    const subject = live ? profile : enemyAtRest(profile);
    const { hit, resists, attackEveryMs } = enemyNumbers(subject);
    const known = hasFought(typeId);
    const hitTypes = enemyHitTypes(profile.moves);
    const boosts = hitTypes.map(type => ({ type, n: CombatFormulas.typeDamageBoost(subject, type) })).filter(b => b.n);
    return {
        typeId,
        name: profile.name || tokenName(typeId),
        style: profile.combatType || 'melee',
        level: profile.level ?? null,
        hp: live
            ? { cur: Math.max(0, fight.combat?.enemyHp?.current ?? 0), max: fight.combat?.enemyHp?.max ?? profile.hp }
            : { cur: profile.hp, max: profile.hp },
        hit,
        /** The Type Damage rules lend it, one line per type it hits with, as the hero's side lists them. */
        hitLines: boosts.map(b => t('fight.tip.typeBoost', { type: damageTypeName(b.type), n: `${b.n > 0 ? '+' : ''}${b.n}%` })),
        hitType: hitTypes[0] ?? PLAIN_ENEMY_HIT_TYPE,
        hitTypes,
        moves: movesView(profile.moves),
        resists,
        attackEveryMs,
        kinds: known ? (profile.kinds || []).map(kindView).filter(Boolean) : null,
        statuses: live ? statusesView(fight) : [],
        buffs: live ? enemyBuffs(fight) : []
    };
}

/**
 * A kind as the player reads it: its effect's name, and what it does: the effect's own description
 * where it has one, else what it does to an enemy with nothing else of its own ({@link kindNumbersText}).
 * Null for an id the library does not hold.
 */
export function kindView(id) {
    const entry = EFFECTS[id];
    if (!entry) return null;
    const own = typeof entry.description === 'string' ? entry.description.trim() : '';
    return { id, name: entry.name || id, tip: own || kindNumbersText(id) };
}

const signed = (n) => (n > 0 ? `+${n}` : `−${-n}`);

/**
 * What a kind adds to a level 1 enemy with no numbers of its own, in the enemy card's words, by the
 * numbers the fight uses (`enemyFightNumbers`): "Resists Slash 50%, Crush 50%, Stab 50%; attacks
 * every 4s", "Dodge +15", "Hits +33%; attacks every 4s". Empty for a kind with none of these.
 */
function kindNumbersText(id) {
    const bare = enemyFightNumbers({ id: '', enemy: { level: 1 } });
    const kinded = enemyFightNumbers({ id: '', enemy: { level: 1, kinds: [id] } });
    if (!bare || !kinded) return '';
    const step = (line) => t('fight.card.step', { type: damageTypeName(line.id), n: Math.abs(line.value) });
    const lines = enemyResistLines(kinded.resistances);
    const parts = [];
    const resists = lines.filter(l => l.value > 0);
    const weak = lines.filter(l => l.value < 0);
    if (resists.length) parts.push(t('fight.kinds.resists', { lines: resists.map(step).join(', ') }));
    if (weak.length) parts.push(t('fight.kinds.weak', { lines: weak.map(step).join(', ') }));
    const dodge = Math.round(kinded.dodge - bare.dodge);
    if (dodge) parts.push(t('fight.kinds.dodge', { n: signed(dodge) }));
    const hits = bare.hit > 0 ? Math.round((kinded.hit / bare.hit - 1) * 100) : 0;
    if (hits) parts.push(t('fight.kinds.hits', { n: `${signed(hits)}%` }));
    if (kinded.attackSpeed !== bare.attackSpeed) parts.push(t('fight.kinds.every', { time: lengthText(kinded.attackSpeed) }));
    return parts.join('; ');
}

/** The enemy card's rows for an enemy Token type, or null. */
export function enemyCardView(typeId) {
    const side = enemySide(typeId, null);
    if (!side) return null;
    return {
        typeId,
        name: side.name,
        level: side.level,
        style: side.style,
        hp: side.hp.max,
        hit: side.hit,
        hitType: side.hitType,
        hitTypes: side.hitTypes,
        moves: side.moves,
        resists: side.resists,
        attackEveryMs: side.attackEveryMs,
        kinds: side.kinds
    };
}

/** The pictures a fighter is drawn with on the panel's strip. */
export function heroArt(sprite) {
    return { sheet: sprite ? resolveAnimationPath(sprite) : null, still: sprite ? resolveSpritePath(sprite) : null };
}

/** An enemy's animation sheet, or null for one that stands still (every enemy but the Cow today). */
export function enemySheet(typeId) {
    const def = getTokenType(typeId);
    return def?.sprite ? resolveEnemyAnimationPath(def.sprite) : null;
}

/**
 * The whole panel for `heroId`'s fights (`fightWatch.fightsOf`): the current fight live, else the
 * last one as it ended. Null when the hero has neither.
 * @param {string} heroId
 * @param {{current: object|null, last: object|null}} fights
 */
export function fightPanelView(heroId, fights) {
    const record = fights?.current || fights?.last || null;
    if (!record) return null;
    const live = !!fights.current;
    const hero = HeroManager.getHero(heroId);
    const fight = live ? BoardCombat.getFight(record.instanceId) : null;
    const liveFight = fight && fight.assignedHeroId === heroId ? fight : null;
    const heroView = heroSide(hero) || {
        id: heroId, name: record.heroName, style: null, level: null, sprite: null, hp: record.hp.hero,
        hit: 0, hitParts: [], arrows: null, ammo: null, hitLines: [], resists: [], attackEveryMs: 0, elixirs: [], statuses: [], buffs: []
    };
    const enemyView = enemySide(record.typeId, liveFight) || {
        typeId: record.typeId, name: record.enemyName, style: 'melee', level: null, hp: record.hp.enemy,
        hit: 0, hitType: PLAIN_ENEMY_HIT_TYPE, hitTypes: [PLAIN_ENEMY_HIT_TYPE], moves: null, resists: [], attackEveryMs: 0, kinds: null, statuses: [], buffs: []
    };
    if (!live) {
        heroView.hp = { ...record.hp.hero };
        heroView.statuses = [];
        heroView.buffs = [];
        enemyView.hp = { ...record.hp.enemy };
        enemyView.statuses = [];
        enemyView.buffs = [];
    }
    return {
        heroId,
        live,
        ended: live ? null : { outcome: record.outcome },
        hero: { ...heroView, art: heroArt(heroView.sprite) },
        enemy: { ...enemyView, sheet: enemySheet(record.typeId), lastMove: record.lastMove ?? null },
        instanceId: record.instanceId
    };
}
