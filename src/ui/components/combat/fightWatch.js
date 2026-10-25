import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardCombat from '../../../systems/board/BoardCombat.js';
import * as HeroManager from '../../../systems/hero/HeroManager.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { EFFECTS } from '../../../config/registries/effectRegistry.js';

/**
 * What the combat screen knows about each fight, read from the engine's events: who swung, what
 * landed, what was eaten or drunk, which statuses landed and ticked, how it ended. One record per
 * fight, kept per hero: the fight they are in now and the one before it ("This fight" / "Last
 * fight" in the panel's log), in memory only and never saved. The same reading feeds the mat's
 * floating numbers as "moments" (`subscribeMoments`).
 * ⚠️ Every listener is a UI listener: a catch-up (a quiet bus) records and draws nothing. A fight
 * that was already running when the watch started, or that a catch-up started, is picked up at
 * its next event (`joinedLate`).
 */

/** The most lines one fight's log keeps; older ones give way. */
export const LOG_MAX = 400;

/** How long after a fight ends a status tick still belongs to it (the tick that ended it). */
const LATE_TICK_MS = 1500;

/** What a log line's number says and its colour: a hit on the enemy, on the hero, a heal, nothing. */
export const TONE = Object.freeze({ HIT: 'hit', HURT: 'hurt', HEAL: 'heal', MISS: 'miss', NOTE: 'note' });

/** A moment's kind, for the mat's floating numbers. */
export const MOMENT = Object.freeze({ HIT: 'hit', CRIT: 'crit', MISS: 'miss', HEAL: 'heal', TICK: 'tick' });

/** How a fight ended. */
export const OUTCOME = Object.freeze({ WON: 'won', LOST: 'lost', LEFT: 'left' });

/** `heroId` → `{ current, last }`, each a record or null. */
const byHero = new Map();
/** `heroId` → the snapshot handed to React, a new object on every change. */
const snapshots = new Map();
/** `heroId` → listeners. */
const heroListeners = new Map();
const momentListeners = new Set();
/** Lines said just before a fight starts (an elixir drunk as it engages), waiting for its record. */
const pending = new Map();

let seq = 0;
let starts = 0;
let offs = [];

const EMPTY = Object.freeze({ current: null, last: null });

/** The hero's fights: `{ current, last }`. The same object until something about them changes. */
export function fightsOf(heroId) {
    return snapshots.get(heroId) || EMPTY;
}

/** Call `fn` whenever the hero's fights change. */
export function subscribeFights(heroId, fn) {
    if (!heroId || typeof fn !== 'function') return () => {};
    if (!heroListeners.has(heroId)) heroListeners.set(heroId, new Set());
    heroListeners.get(heroId).add(fn);
    return () => heroListeners.get(heroId)?.delete(fn);
}

/** Call `fn(moment)` for every hit, crit, miss, heal and status tick, as it happens. */
export function subscribeMoments(fn) {
    if (typeof fn !== 'function') return () => {};
    momentListeners.add(fn);
    return () => momentListeners.delete(fn);
}

function changed(heroId) {
    const slot = byHero.get(heroId);
    snapshots.set(heroId, slot ? { current: slot.current, last: slot.last } : EMPTY);
    for (const fn of [...(heroListeners.get(heroId) || [])]) fn();
}

function moment(m) {
    for (const fn of [...momentListeners]) {
        try { fn(m); } catch (err) { console.error('fightWatch: a moment listener threw', err); }
    }
}

const slotOf = (heroId) => {
    if (!byHero.has(heroId)) byHero.set(heroId, { current: null, last: null });
    return byHero.get(heroId);
};

const heroName = (heroId) => HeroManager.getHero(heroId)?.name || heroId;

/** A fresh record for the fight `heroId` is in against Token `instanceId`, read from the engine. */
function makeRecord(heroId, instanceId, typeId = null, joinedLate = false) {
    const fight = BoardCombat.getFight(instanceId);
    const hero = HeroManager.getHero(heroId);
    const type = typeId || fight?.enemy?.id || null;
    const hp = fight?.combat?.enemyHp;
    const enemyMax = hp?.max ?? fight?.enemy?.hp ?? 0;
    return {
        id: ++seq,
        heroId,
        heroName: hero?.name || heroId,
        instanceId,
        typeId: type,
        enemyName: fight?.enemy?.name || tokenName(type),
        startedAt: Date.now(),
        endedAt: null,
        outcome: null,
        joinedLate,
        hp: {
            hero: { cur: hero?.hp?.current ?? 0, max: hero?.hp?.max ?? 0 },
            enemy: { cur: hp?.current ?? enemyMax, max: enemyMax }
        },
        log: [],
        trimmed: 0
    };
}

/** Add a line to a record's log: `key` and `vars` for `t('fight.log.<key>')`, `amount` its number. */
function say(record, line) {
    record.log.push({ n: record.log.length + record.trimmed + 1, ...line });
    if (record.log.length > LOG_MAX) {
        const drop = record.log.length - LOG_MAX;
        record.log.splice(0, drop);
        record.trimmed += drop;
    }
}

/** End `heroId`'s current fight: it becomes their last. */
function endCurrent(heroId, outcome) {
    const slot = byHero.get(heroId);
    const record = slot?.current;
    if (!record) return null;
    record.endedAt = Date.now();
    record.outcome = outcome;
    const hero = HeroManager.getHero(heroId);
    if (hero?.hp) record.hp.hero = { cur: Math.max(0, hero.hp.current), max: hero.hp.max };
    if (outcome === OUTCOME.WON) record.hp.enemy = { ...record.hp.enemy, cur: 0 };
    slot.last = record;
    slot.current = null;
    return record;
}

/**
 * The record of the fight `heroId` is in against `instanceId`: the current one, or a new one when
 * the watch had not seen this fight start (it began before the watch, or in a catch-up).
 */
function ensure(heroId, instanceId) {
    if (!heroId || instanceId == null) return null;
    const slot = slotOf(heroId);
    if (slot.current && slot.current.instanceId === instanceId) return slot.current;
    if (slot.current) endCurrent(heroId, OUTCOME.LEFT);
    if (BoardCombat.fightOfHero(heroId)?.instanceId !== instanceId) return null;
    slot.current = makeRecord(heroId, instanceId, null, true);
    return slot.current;
}

/** The current record whose enemy is Token `instanceId`, if any. */
function recordOfEnemy(instanceId) {
    for (const slot of byHero.values()) if (slot.current?.instanceId === instanceId) return slot.current;
    return null;
}

const statusName = (statusId) => EFFECTS[statusId]?.name || statusId;
const itemName = (itemId) => getItem(itemId)?.name || itemId;

/** Which side a status event is about, and its record (the last fight's for a tick that ended it). */
function statusTarget(p, { late = false } = {}) {
    if (p?.targetType === 'hero') {
        const slot = byHero.get(p.targetId);
        let record = slot?.current || null;
        if (!record) {
            const fight = BoardCombat.fightOfHero(p.targetId);
            record = fight ? ensure(p.targetId, fight.instanceId) : null;
        }
        if (!record && late && slot?.last && Date.now() - slot.last.endedAt <= LATE_TICK_MS) record = slot.last;
        return record ? { record, on: 'hero', who: record.heroName } : null;
    }
    if (p?.targetType === 'enemy' && p.targetId != null) {
        let record = recordOfEnemy(p.targetId);
        if (!record) {
            const heroId = BoardCombat.getFight(p.targetId)?.assignedHeroId;
            record = heroId ? ensure(heroId, p.targetId) : null;
        }
        return record ? { record, on: 'enemy', who: record.enemyName } : null;
    }
    return null;
}

// ---------------------------------------------------------------------------------------------
// The engine's events
// ---------------------------------------------------------------------------------------------

function onEngaged(p) {
    const { heroId, instanceId, typeId } = p || {};
    if (!heroId || instanceId == null) return;
    const slot = slotOf(heroId);
    if (slot.current) endCurrent(heroId, OUTCOME.LEFT);
    const record = makeRecord(heroId, instanceId, typeId, false);
    const early = pending.get(heroId) || [];
    pending.delete(heroId);
    for (const line of early) if (Date.now() - line.at <= LATE_TICK_MS) say(record, line.line);
    slot.current = record;
    changed(heroId);
}

function onHeroSwing(p) {
    const record = ensure(p?.heroId, p?.instanceId);
    if (!record) return;
    const vars = { hero: record.heroName, enemy: record.enemyName };
    const damage = Math.round(Number(p.damage) || 0);
    if (!p.hit) {
        say(record, { icon: 'miss', tone: TONE.MISS, key: 'heroMisses', vars });
    } else {
        say(record, { icon: p.crit ? 'star' : 'hit', tone: TONE.HIT, key: p.crit ? 'heroCrits' : 'heroHits', vars, amount: `${damage}` });
    }
    if (Number.isFinite(p.enemyHpRemaining)) record.hp.enemy.cur = Math.max(0, p.enemyHpRemaining);
    moment({ heroId: record.heroId, instanceId: record.instanceId, by: 'hero', on: 'enemy', kind: !p.hit ? MOMENT.MISS : p.crit ? MOMENT.CRIT : MOMENT.HIT, amount: damage });
    changed(record.heroId);
}

function onEnemySwing(p) {
    const instanceId = p?.instanceId ?? BoardCombat.fightOfHero(p?.heroId)?.instanceId;
    const record = ensure(p?.heroId, instanceId);
    if (!record) return;
    const vars = { hero: record.heroName, enemy: record.enemyName };
    const damage = Math.round(Number(p.damage) || 0);
    if (!p.hit) {
        say(record, { icon: 'miss', tone: TONE.MISS, key: 'enemyMisses', vars });
    } else {
        say(record, { icon: p.crit ? 'star' : 'hit', tone: TONE.HURT, key: p.crit ? 'enemyCrits' : 'enemyHits', vars, amount: `−${damage}` });
    }
    if (Number.isFinite(p.heroHpRemaining)) record.hp.hero.cur = Math.max(0, p.heroHpRemaining);
    moment({ heroId: record.heroId, instanceId: record.instanceId, by: 'enemy', on: 'hero', kind: !p.hit ? MOMENT.MISS : p.crit ? MOMENT.CRIT : MOMENT.HIT, amount: damage });
    changed(record.heroId);
}

function onAte(p) {
    const fight = BoardCombat.fightOfHero(p?.heroId);
    const record = fight ? ensure(p.heroId, fight.instanceId) : null;
    if (!record) return;
    const healed = Math.round(Number(p.healed) || 0);
    say(record, { icon: 'heart', tone: TONE.HEAL, key: 'eats', vars: { hero: record.heroName, item: itemName(p.itemId) }, amount: healed > 0 ? `+${healed}` : null, itemId: p.itemId });
    const hero = HeroManager.getHero(p.heroId);
    if (hero?.hp) record.hp.hero = { cur: hero.hp.current, max: hero.hp.max };
    if (healed > 0) moment({ heroId: record.heroId, instanceId: record.instanceId, by: 'hero', on: 'hero', kind: MOMENT.HEAL, amount: healed });
    changed(record.heroId);
}

function onConsumed(p) {
    if (!p?.elixir || !p.heroId) return;
    const line = { icon: 'potion', tone: TONE.NOTE, key: 'drinks', vars: { hero: heroName(p.heroId), item: itemName(p.itemId) }, itemId: p.itemId };
    // Drunk as the fight engages, before its record exists: kept for it.
    if (!pending.has(p.heroId)) pending.set(p.heroId, []);
    pending.get(p.heroId).push({ at: Date.now(), line });
}

function onStatusApplied(p) {
    const target = statusTarget(p);
    if (!target) return;
    const { record, who } = target;
    say(record, { icon: statusIcon(p.statusId), tone: TONE.NOTE, key: 'statusLands', vars: { status: statusName(p.statusId), who }, amount: p.stacks > 1 ? `×${p.stacks}` : null });
    changed(record.heroId);
}

function onStatusBlocked(p) {
    const target = statusTarget(p);
    if (!target) return;
    const { record, who } = target;
    say(record, { icon: 'miss', tone: TONE.MISS, key: 'statusBlocked', vars: { status: statusName(p.statusId), who } });
    changed(record.heroId);
}

function onStatusTick(p) {
    const target = statusTarget(p, { late: true });
    if (!target) return;
    const { record, on, who } = target;
    const change = Number(p.hpChange);
    const lost = Number.isFinite(change) && change < 0 ? -change : 0;
    const healed = Number.isFinite(change) && change > 0 ? change : 0;
    say(record, {
        icon: statusIcon(p.statusId), tone: healed ? TONE.HEAL : TONE.HURT, key: healed ? 'statusHeals' : 'statusHurts',
        vars: { status: statusName(p.statusId), who }, amount: lost ? `−${lost}` : healed ? `+${healed}` : null
    });
    if (on === 'hero' && Number.isFinite(change)) record.hp.hero.cur = Math.max(0, record.hp.hero.cur + change);
    if (on === 'enemy' && Number.isFinite(change)) record.hp.enemy.cur = Math.max(0, record.hp.enemy.cur + change);
    if (lost || healed) {
        moment({
            heroId: record.heroId, instanceId: record.instanceId, by: 'status', on,
            kind: healed ? MOMENT.HEAL : MOMENT.TICK, amount: lost || healed, statusId: p.statusId
        });
    }
    changed(record.heroId);
}

/** Whether a callout's title names a status (its landing has a line of its own: "Poison on Aela"). */
function namesStatus(title) {
    return Object.values(EFFECTS).some(e => e?.status && e.name && (title === e.name || title.startsWith(`${e.name} `)));
}

function onEffectFired(p) {
    const record = p?.instanceId != null ? recordOfEnemy(p.instanceId) : null;
    if (!record || !p.title || namesStatus(p.title)) return;
    say(record, { icon: 'star', tone: TONE.NOTE, key: 'move', vars: { move: p.title } });
    changed(record.heroId);
}

function onLoot(p) {
    const record = byHero.get(p?.heroId)?.current;
    const drops = (p?.drops || []).filter(d => d?.itemId && (Number(d.quantity) || 0) > 0);
    if (!record || !drops.length) return;
    const items = drops.map(d => (d.quantity > 1 ? `${d.quantity} ${itemName(d.itemId)}` : itemName(d.itemId))).join(', ');
    say(record, { icon: 'bag', tone: TONE.NOTE, key: 'drops', vars: { items } });
    changed(record.heroId);
}

function onResolved(p) {
    const heroId = p?.heroId;
    const record = byHero.get(heroId)?.current;
    if (!record || (p.instanceId != null && record.instanceId !== p.instanceId)) return;
    const won = p.outcome === 'victory';
    say(record, {
        icon: won ? 'fight' : 'down', tone: won ? TONE.HIT : TONE.HURT, key: won ? 'won' : 'lost',
        vars: { hero: record.heroName, enemy: record.enemyName }
    });
    endCurrent(heroId, won ? OUTCOME.WON : OUTCOME.LOST);
    changed(heroId);
}

/**
 * Each tick of a fight: its HP as the engine has it. A rise nothing announced is a heal (a boss's
 * "heals 10 health on itself", a hero's item); a fall nothing announced (a rule's damage) is only
 * caught up.
 */
function onProgress(p) {
    if (!p?.combat) return;
    const record = recordOfEnemy(p.instanceId);
    if (!record) return;
    let any = false;
    const enemyHp = Number(p.enemyHp);
    if (Number.isFinite(enemyHp) && enemyHp !== record.hp.enemy.cur) {
        const rise = enemyHp - record.hp.enemy.cur;
        record.hp.enemy = { cur: enemyHp, max: Number(p.enemyMaxHp) || record.hp.enemy.max };
        if (rise > 0) {
            say(record, { icon: 'heart', tone: TONE.HEAL, key: 'heals', vars: { who: record.enemyName }, amount: `+${rise}` });
            moment({ heroId: record.heroId, instanceId: record.instanceId, by: 'enemy', on: 'enemy', kind: MOMENT.HEAL, amount: rise });
        }
        any = true;
    }
    const hero = HeroManager.getHero(record.heroId);
    const heroHp = hero?.hp?.current;
    if (Number.isFinite(heroHp) && heroHp !== record.hp.hero.cur) {
        const rise = heroHp - record.hp.hero.cur;
        record.hp.hero = { cur: heroHp, max: hero.hp.max };
        if (rise > 0) {
            say(record, { icon: 'heart', tone: TONE.HEAL, key: 'heals', vars: { who: record.heroName }, amount: `+${rise}` });
            moment({ heroId: record.heroId, instanceId: record.instanceId, by: 'hero', on: 'hero', kind: MOMENT.HEAL, amount: rise });
        }
        any = true;
    }
    if (any) changed(record.heroId);
}

/**
 * A hero who let go of their enemy without a kill or a knockout (recalled, their flag moved, a
 * re-plant) ends their fight with no event: their record is closed when they are next heard of.
 */
export function reconcile(heroId) {
    const record = byHero.get(heroId)?.current;
    if (!record) return false;
    const fight = BoardCombat.fightOfHero(heroId);
    if (fight && fight.instanceId === record.instanceId) return false;
    say(record, { icon: 'miss', tone: TONE.MISS, key: 'left', vars: { hero: record.heroName } });
    endCurrent(heroId, OUTCOME.LEFT);
    changed(heroId);
    return true;
}

/**
 * Start a record for a fight the watch has not heard from yet (one a catch-up or a load left
 * running, before its next swing), so a panel opened on it has something to show at once.
 * @returns {boolean} whether a record was made
 */
export function adopt(heroId) {
    if (!heroId || byHero.get(heroId)?.current) return false;
    const fight = BoardCombat.fightOfHero(heroId);
    // Resting after a kill, the next enemy has not stepped up: that fight starts at its engagement.
    if (!fight || (fight.combat?.state?.intermissionTimer ?? 0) > 0) return false;
    if (!ensure(heroId, fight.instanceId)) return false;
    changed(heroId);
    return true;
}

function clearAll() {
    const heroes = [...byHero.keys()];
    byHero.clear();
    pending.clear();
    for (const heroId of heroes) changed(heroId);
}

/** The glyph a status's lines and ticks wear: a flame for a burn, a drop for the rest. */
export function statusIcon(statusId) {
    const name = `${statusId || ''} ${EFFECTS[statusId]?.name || ''}`;
    return /burn|fire|flame|scorch/i.test(name) ? 'flame' : 'drop';
}

/**
 * Start listening (counted: each caller stops its own start; the last stop unsubscribes).
 * @returns {() => void} stop
 */
export function startFightWatch() {
    starts += 1;
    if (starts === 1) {
        offs = [
            EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, onEngaged, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, onHeroSwing, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, onEnemySwing, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATE, onAte, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, onConsumed, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, onStatusApplied, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.STATUS_BLOCKED, onStatusBlocked, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.STATUS_DOT_TICK, onStatusTick, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, onEffectFired, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.LOOT_GENERATED, onLoot, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, onResolved, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.PROGRESS, onProgress, UI_LISTENER),
            // After the publish that moved them has finished: a knockout moves the hero (their flag
            // furls) before it says how the fight ended.
            EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, (p) => {
                if (p?.heroId) queueMicrotask(() => reconcile(p.heroId));
            }, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, clearAll, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, clearAll, UI_LISTENER)
        ];
    }
    let stopped = false;
    return () => {
        if (stopped) return;
        stopped = true;
        starts -= 1;
        if (starts === 0) {
            offs.forEach(off => off());
            offs = [];
        }
    };
}

/** Forget every fight and listener (tests). */
export function resetFightWatch() {
    offs.forEach(off => off());
    offs = [];
    starts = 0;
    byHero.clear();
    snapshots.clear();
    heroListeners.clear();
    momentListeners.clear();
    pending.clear();
    seq = 0;
}
