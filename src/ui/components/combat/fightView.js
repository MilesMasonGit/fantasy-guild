import * as HeroManager from '../../../systems/hero/HeroManager.js';
import * as BoardCombat from '../../../systems/board/BoardCombat.js';
import * as LiveEffects from '../../../systems/effects/LiveEffects.js';
import { isFightElixir } from '../../../systems/hero/ConsumptionSystem.js';
import { MASTERY_LEVEL } from '../../../systems/hero/PromotionSystem.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import { roundHalfUp, levelDamageBonus, UNARMED_DAMAGE } from '../../../config/FormulaRegistry.js';
import { getEquippedEntries, isConsumableCategory } from '../../../config/registries/equipmentConstants.js';
import { getEnemyProfile } from '../../../config/registries/enemyProfile.js';
import { getEnemyKind } from '../../../config/registries/enemyKinds.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { tokenName, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { EFFECTS } from '../../../config/registries/effectRegistry.js';
import { GameState } from '../../../state/GameState.js';
import { resolveAnimationPath, resolveSpritePath, resolveEnemyAnimationPath } from '../../../utils/AssetManager.js';
import { healthText } from '../board/healthBar.js';
import { statusIcon } from './fightWatch.js';
import { t } from '../../../i18n/index.js';

/**
 * What the combat screen shows, as plain values read from the engine: both fighters' numbers for
 * the fight panel's versus card, the enemy card, the hero's elixirs for the bubble row. No React:
 * the views here are handed to components (`FightPanel.jsx`, `EnemyCard.jsx`, `FightLayer.jsx`),
 * which a test or the style sheet page can also feed a fixture.
 * The numbers are the ones the fight uses (`CombatFormulas`), before the other side's armour and
 * the matchup: the player does the sums (no forecast).
 */

/** `3 s`, `1.5 s`: a swing time. */
export function secondsText(ms) {
    const s = Math.round((Number(ms) || 0) / 100) / 10;
    return t('fight.seconds', { n: s.toLocaleString() });
}

/** `0:12`, `4:05`: whole seconds. */
export function clockText(ms) {
    const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** `20/99`. */
export const levelText = (level) => `${Math.max(0, Math.round(Number(level) || 0))}/${MASTERY_LEVEL}`;

/** A combat style's name (`Melee`), or null. */
export const styleName = (style) => (style ? getSkill(style)?.name || style : null);

/** Whether the guild has fought this enemy (its kinds are then shown). */
export function hasFought(typeId) {
    return !!(typeId && GameState.state?.collection?.discoveredEnemies?.[typeId]);
}

/** Whether a hero is in a fight with an enemy that has stepped up (not resting between kills). */
function engaged(hero) {
    const fight = BoardCombat.fightOfHero(hero?.id);
    return !!fight && !((fight.combat?.state?.intermissionTimer ?? 0) > 0);
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

/** A fighter's statuses as the panel lists them: name, stacks, its cap, ticks left, its glyph. */
export function statusesView(target) {
    return LiveEffects.statusesOf(target).map(s => ({
        id: s.effectId,
        name: EFFECTS[s.effectId]?.name || s.effectId,
        stacks: s.stacks,
        maxStacks: EFFECTS[s.effectId]?.status?.stacks ?? null,
        ticksLeft: s.ticksLeft,
        icon: statusIcon(s.effectId)
    }));
}

/** What lingers on an enemy for the fight besides statuses (a boss's Stone Skin, its Enrage). */
function enemyBuffs(fight) {
    return (fight?.effects || [])
        .filter(e => e?.stacks == null && !e.forSwing)
        .map(e => EFFECTS[e.effectId]?.name || e.effectId);
}

/** The hero's side of the versus card, read live. */
export function heroSide(hero, enemy = null) {
    if (!hero) return null;
    const { id: style, level } = CombatFormulas.getHeroCombatSkillEntry(hero);
    const weapon = CombatFormulas.getHeroWeapon(hero);
    const base = CombatFormulas.heroBaseDamage(hero);
    const hit = Math.max(1, roundHalfUp(base * CombatFormulas.damageMultiplierOf(hero)));
    const weaponDamage = weapon && Number(weapon.damage) > 0 ? Number(weapon.damage) : UNARMED_DAMAGE;
    const levelStep = levelDamageBonus(CombatFormulas.getHeroCombatLevel(hero));
    const more = hit - weaponDamage - levelStep;
    const armour = CombatFormulas.heroFlatArmor(hero);
    const swingMs = CombatFormulas.heroAttackSpeedMs(hero);
    return {
        id: hero.id,
        name: hero.name,
        style,
        level: style ? level : null,
        sprite: hero.spriteId || hero.classId || null,
        hp: { cur: Math.max(0, hero.hp?.current ?? 0), max: hero.hp?.max ?? 0 },
        hit,
        armed: !!weapon,
        hitLines: [
            weapon ? t('fight.tip.weapon', { item: weapon.name, n: weaponDamage }) : t('fight.tip.fist'),
            levelStep ? t('fight.tip.levelStep', { n: levelStep }) : null,
            more ? t('fight.tip.moreDamage', { n: `${more > 0 ? '+' : ''}${more}` }) : null
        ].filter(Boolean),
        armour,
        swingMs,
        elixirs: activeElixirsOf(hero),
        statuses: statusesView(hero),
        enemyArmour: enemy ? CombatFormulas.enemyFlatArmor(enemy) : null
    };
}

/** An enemy's side of the versus card: live from its fight, or its type's numbers. */
export function enemySide(typeId, fight = null) {
    const profile = fight?.enemy || getEnemyProfile(typeId);
    if (!profile) return null;
    const live = !!fight;
    const flat = live ? CombatFormulas.damageMultiplierOf(profile) : 1;
    const hit = Math.max(1, roundHalfUp((profile.hit ?? 1) * flat));
    const known = hasFought(typeId);
    return {
        typeId,
        name: profile.name || tokenName(typeId),
        style: profile.combatType || 'melee',
        level: profile.level ?? null,
        hp: live
            ? { cur: Math.max(0, fight.combat?.enemyHp?.current ?? 0), max: fight.combat?.enemyHp?.max ?? profile.hp }
            : { cur: profile.hp, max: profile.hp },
        hit,
        armour: live ? CombatFormulas.enemyFlatArmor(profile) : (profile.armor || 0),
        swingMs: live ? CombatFormulas.enemyAttackSpeedMs(profile) : (profile.attackSpeed || 3000),
        kinds: known ? (profile.kinds || []).map(kindView).filter(Boolean) : null,
        statuses: live ? statusesView(fight) : [],
        buffs: live ? enemyBuffs(fight) : []
    };
}

/** A kind as the player reads it: its name and what it does. */
export function kindView(id) {
    if (!getEnemyKind(id)) return null;
    return { id, name: t(`fight.kinds.${id}.name`), tip: t(`fight.kinds.${id}.tip`) };
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
        armour: side.armour,
        swingMs: side.swingMs,
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
export function fightPanelView(heroId, fights, now = Date.now()) {
    const record = fights?.current || fights?.last || null;
    if (!record) return null;
    const live = !!fights.current;
    const hero = HeroManager.getHero(heroId);
    const fight = live ? BoardCombat.getFight(record.instanceId) : null;
    const liveFight = fight && fight.assignedHeroId === heroId ? fight : null;
    const heroView = heroSide(hero, liveFight?.enemy || null) || {
        id: heroId, name: record.heroName, style: null, level: null, sprite: null, hp: record.hp.hero,
        hit: 0, hitLines: [], armour: 0, swingMs: 0, elixirs: [], statuses: [], enemyArmour: null
    };
    const enemyView = enemySide(record.typeId, liveFight) || {
        typeId: record.typeId, name: record.enemyName, style: 'melee', level: null, hp: record.hp.enemy,
        hit: 0, armour: 0, swingMs: 0, kinds: null, statuses: [], buffs: []
    };
    if (!live) {
        heroView.hp = { ...record.hp.hero };
        heroView.statuses = [];
        enemyView.hp = { ...record.hp.enemy };
        enemyView.statuses = [];
        enemyView.buffs = [];
    }
    return {
        heroId,
        live,
        title: t('fight.panel.title', { hero: heroView.name, enemy: enemyView.name }),
        clock: clockText((record.endedAt ?? now) - record.startedAt),
        ended: live ? null : { outcome: record.outcome },
        hero: { ...heroView, hpText: healthText(heroView.hp.cur, heroView.hp.max), art: heroArt(heroView.sprite) },
        enemy: { ...enemyView, hpText: healthText(enemyView.hp.cur, enemyView.hp.max), sheet: enemySheet(record.typeId) },
        instanceId: record.instanceId
    };
}
