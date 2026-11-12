// The QA panel's actions: give items, change the heroes, put Tokens and enemies on the mat.
// ⚠️ QA BUILDS ONLY: reached from `TestDashboard`, which a ship build drops (`QA_TOOLS`).

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { giveItem, listGivableItemIds } from '../../systems/core/DevTools.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as SkillSystem from '../../systems/hero/SkillSystem.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { WoundedSystem } from '../../systems/combat/WoundedSystem.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as BoardCombat from '../../systems/board/BoardCombat.js';
import * as Placement from '../../systems/board/Placement.js';
import { takesCopy } from '../../systems/equipment/heldCopies.js';
import { getAllItems, getItem } from '../../config/registries/itemRegistry.js';
import { getAllTokenTypes, getTokenType, tokenName, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/** Rows a picker shows at once; the rest are reached by typing. */
export const PICKER_ROWS = 40;

/** Every item a player can hold, by name: `{id, name}`. */
export function itemChoices() {
    return listGivableItemIds()
        .map(id => ({ id, name: getItem(id)?.name || id }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every Token type, enemies among them, by name: `{id, name, enemy}`. */
export function tokenChoices(allTypes = getAllTokenTypes()) {
    return Object.keys(allTypes || {})
        .map(id => ({ id, name: tokenName(id), enemy: isEnemyDef(allTypes[id]) }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** The choices whose name holds every word typed, in any case; all of them for nothing typed. */
export function filterByName(choices, query) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return choices;
    return choices.filter(c => {
        const name = c.name.toLowerCase();
        return words.every(w => name.includes(w));
    });
}

/** `giveItem` in words: the Bank first, whatever does not fit onto the mat. */
export function giveAndSay(itemId, amount) {
    const r = giveItem(itemId, amount);
    if (!r.ok) return r.error;
    const name = getItem(itemId)?.name || itemId;
    return r.overflow > 0
        ? `Gave ${r.added} ${name} to the Bank; ${r.overflow} went onto the mat`
        : `Gave ${r.added} ${name} to the Bank`;
}

/**
 * One of every item kind the content has, into the Bank, as far as its slots go.
 * @returns {{added: number, left: number}} kinds added, and kinds that found no slot
 */
export function devBankEveryKind() {
    let added = 0;
    let left = 0;
    InventoryManager.batch(() => {
        for (const item of Object.values(getAllItems())) {
            if (!item?.id || InventoryManager.getItemCount(item.id) > 0) continue;
            if (InventoryManager.lacksSlotFor(item.id)) { left++; continue; }
            if (InventoryManager.addItem(item.id, 1) > 0) added++;
        }
    });
    return { added, left };
}

/**
 * One of each item not yet in the Bank, until every slot is taken. Never gear, weapons or tools:
 * one of those in the Bank would be the slot a hero's copy goes back to.
 * @returns {{filled: number, free: number}} the slots filled, and those still free when the content
 *          has too few kinds of item to fill them
 */
export function devFillBank() {
    let filled = 0;
    for (const item of Object.values(getAllItems())) {
        if (!item?.id || takesCopy(item.id)) continue;
        if (InventoryManager.getItemCount(item.id) > 0) continue;
        if (InventoryManager.lacksSlotFor(item.id)) break;
        if (InventoryManager.addItem(item.id, 1) > 0) filled++;
    }
    return { filled, free: InventoryManager.freeSlots() };
}

/**
 * Raises the roster cap just enough for `count` more heroes: written as a rank, not paid for.
 */
function ensureRosterRoom(count) {
    const ranks = GuildUpgradeManager.getRanks();
    const neededRank = GameState.state.heroes.length + count;
    if ((ranks.roster_size || 0) < neededRank) {
        ranks.roster_size = neededRank;
        GuildUpgradeManager.recompute();
    }
}

/** Raise every skill `hero` holds by exactly `n` levels, wherever it sits inside its level. */
function raiseSkills(hero, n, { to = null } = {}) {
    for (const skillId of Object.keys(hero.skills || {})) {
        const skill = hero.skills[skillId];
        if (!skill) continue;
        const target = to ?? Math.min(99, skill.level + n);
        const xpNeeded = xpForLevel(target) - skill.xp;
        if (xpNeeded > 0) SkillSystem.addXP(hero.id, skillId, xpNeeded);
    }
}

/** One new hero, the roster cap raised for them if it is full. */
export function hireHero() {
    ensureRosterRoom(1);
    const hero = generateHero();
    return HeroManager.addHero(hero) ? hero : null;
}

/** The art of the four heroes in a spawned party. */
export const PARTY_SPRITES = Object.freeze(['fighter', 'wizard', 'ranger', 'rogue']);

/** Four heroes at level 50 in every skill and at full health. @returns {number} heroes added */
export function spawnParty() {
    ensureRosterRoom(PARTY_SPRITES.length);
    let added = 0;
    for (const spriteId of PARTY_SPRITES) {
        const hero = generateHero({ spriteId });
        if (!HeroManager.addHero(hero)) continue;
        added++;
        raiseSkills(hero, 0, { to: 50 });
        // Max HP follows the combat skills, so a hero levelled here would read as wounded.
        if (hero.hp) hero.hp.current = hero.hp.max;
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_spawn_party' });
    return added;
}

/** Every hero's skills up by `n` levels. @returns {number} heroes raised */
export function levelAllHeroes(n) {
    const heroes = HeroManager.getAllHeroes().filter(h => !h.isVillager);
    for (const hero of heroes) raiseSkills(hero, n);
    return heroes.length;
}

/** The wounded recover and every hero is back at full health. @returns {number} heroes healed */
export function healEveryone() {
    const heroes = GameState.state?.heroes || [];
    for (const h of heroes.filter(h => h.status === 'wounded')) WoundedSystem.recoverHero(h.id);
    for (const h of heroes) if (h.hp) h.hp.current = h.hp.max;
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_heal' });
    return heroes.length;
}

/**
 * Knock a hero out as a lost fight does (`BoardCombat.resolveStatusDefeat`): their order cleared,
 * they limp home and heal. A working hero first, then any hero who is not wounded already.
 * @returns {{ok: boolean, name?: string, error?: string}}
 */
export function knockOutAHero() {
    const heroes = GameState.state?.heroes || [];
    const hero = heroes.find(h => BoardState.flagOf(h.id) && h.status !== 'wounded')
        || heroes.find(h => h.status !== 'wounded');
    if (!hero) return { ok: false, error: 'No hero to knock out' };
    HeroManager.getHero(hero.id).hp.current = 0;
    BoardCombat.resolveStatusDefeat(hero.id);
    return { ok: true, name: hero.name };
}

/**
 * Put a Token or enemy of any type on the mat at the first free spot from the middle out
 * (`Placement.placeArrivalNear`), fresh and placed. It ignores the Token cap.
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function devPlaceToken(typeId) {
    const id = String(typeId || '').trim();
    if (!getTokenType(id)) return { success: false, reason: `No Token type "${id}"` };
    const instance = BoardState.createTokenInstance(id, tokenStartingUses(id));
    const res = Placement.placeArrivalNear(instance, Placement.centreOfBoard());
    return res?.success ? { ...res, instance } : res;
}

/** Every Token and loose item off the mat, the Guild Hall too. */
export function clearBoard() {
    const state = GameState.state;
    state.board.tokens = {};
    state.board.sprites = [];
    EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'dev_clear' });
}
