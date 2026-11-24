import { getTokenType, getAllTokenTypes, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getRecipe } from '../../../config/registries/recipePoolRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { respawnOf } from '../../../config/registries/tokenConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as PassiveProduction from '../../../systems/board/PassiveProduction.js';
import * as Respawn from '../../../systems/board/Respawn.js';
import * as TimedChanges from '../../../systems/board/TimedChanges.js';
import * as Fields from '../../../systems/board/Fields.js';
import * as Demolition from '../../../systems/board/Demolition.js';
import * as EventTokens from '../../../systems/board/EventTokens.js';
import { t } from '../../../i18n/index.js';
import { countdownText, lengthText } from '../../../utils/Formatters.js';

/**
 * A Token's timer sentences, written once, for the Token card's Events lines. Each line is
 * `{ kind, icon, label?, text, tip, tone?, alert? }`: `text` the short figure (`4m 57s`, `full`),
 * `tip` the sentence. `alert` marks a stuck reason the Token's problem mark also carries (a
 * spawner short of items or room, a growth or refill waiting).
 * Every engine read comes in through `src`, so tests need no mat.
 */

/** What each line is about. */
export const TIMER_KIND = Object.freeze({
    DEMOLITION: 'demolition',
    LEAVE: 'leave',
    SPAWN: 'spawn',
    GROW: 'grow',
    RIPEN: 'ripen',
    FIELD: 'field',
    RESPAWN: 'respawn',
    PRODUCE: 'produce'
});

/** A time inside a sentence: non-breaking, so a tooltip never wraps between its parts. */
const timeIn = (ms) => countdownText(ms).replace(/ /g, ' ');
const lengthIn = (ms) => lengthText(ms).replace(/ /g, ' ');

/** The live readers the timer lines take. */
export function liveTimerSources() {
    return {
        typeOf: getTokenType,
        allTypes: getAllTokenTypes,
        tokenName,
        itemName: (id) => getItem(id)?.name || id,
        recipeName: (id) => getRecipe(id)?.name || id,
        workerOf: BoardState.workerOf,
        demolishMs: Demolition.DEMOLISH_MS,
        eventLeave: (instance) => {
            const inMs = EventTokens.leavesInMs(instance);
            return inMs == null ? null : { inMs, buff: EventTokens.isEventBuff(instance) };
        },
        spawnerStatus: SpawnerSystem.spawnerStatus,
        nextGrowth: TimedChanges.nextGrowth,
        field: Fields.fieldState,
        respawn: Respawn.respawnState,
        passive: (instance) => ({ lines: PassiveProduction.linesOf(instance), nextInMs: PassiveProduction.nextInMs(instance), lapMs: PassiveProduction.lapMs() })
    };
}

/** "1 Oak Seedling", "1 Oak Seedling and 2 Resin". */
function itemsSpoken(lines, src) {
    return lines.map(l => `${l.quantity} ${src.itemName(l.itemId)}`).join(' and ');
}

/** "an Oak Forest", "an Oak Forest or a Wild Oak Forest": any one of them will do. */
function anyOf(typeIds, src) {
    const names = (typeIds || []).map(id => {
        const name = src.tokenName(id);
        return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
    });
    return names.length < 2 ? names[0] || '' : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

const regrowCache = new WeakMap();

/**
 * Whether a Token type is what a used-up Token leaves behind (a felled Oak Tree's Stump): its
 * growth is then that Token coming back, a respawn, not a new growth.
 */
export function leftByRegrow(typeId, allTypes) {
    if (!typeId || !allTypes || typeof allTypes !== 'object') return false;
    let left = regrowCache.get(allTypes);
    if (!left) {
        left = new Set();
        for (const def of Object.values(allTypes)) {
            const respawn = respawnOf(def);
            if (respawn?.mode === 'regrow' && respawn.into) left.add(respawn.into);
        }
        regrowCache.set(allTypes, left);
    }
    return left.has(typeId);
}

/** A marked Token's line: its countdown once a hero is on it, else what it waits for. */
export function demolitionLine(instance, src) {
    const worked = !!src.workerOf?.(instance.id);
    const left = (Number(src.demolishMs) || 0) - (Number(instance.cycleElapsedMs) || 0);
    return worked
        ? { kind: TIMER_KIND.DEMOLITION, icon: 'clock', label: 'Demolition', text: countdownText(left), tip: `Marked for demolition: gone in ${timeIn(left)}`, tone: 'warning' }
        : { kind: TIMER_KIND.DEMOLITION, icon: 'clock', label: 'Demolition', text: '–', tip: 'Marked for demolition: waiting for a hero with Construction', tone: 'warning' };
}

/** An event Token's time until it expires (a buff's time, a node's hour). */
export function leaveLine(leave) {
    return {
        kind: TIMER_KIND.LEAVE, icon: 'clock', label: t('events.card.expiresIn'), text: countdownText(leave.inMs),
        tip: t(leave.buff ? 'events.card.buffTip' : 'events.card.nodeTip', { time: timeIn(leave.inMs) })
    };
}

/**
 * A spawner's state: its next spawn, or why it waits. `state` is `SpawnerSystem`'s; the family's
 * count is the card's own business.
 */
export function spawnLine(def, status, src) {
    const spawns = (def.spawner?.spawns || []).filter(e => e?.typeId).map(e => src.tokenName(e.typeId)).join(' or ');
    const head = `Spawns ${spawns || 'Tokens'}.`;
    const line = (text, tip, extra = {}) => ({ kind: TIMER_KIND.SPAWN, icon: 'spawn', state: status.state, text, tip: `${head} ${tip}`, ...extra });
    switch (status.state) {
        case 'at_cap':
            return line('full', 'Its family is full: it waits for room.', { tone: 'warning' });
        case 'needs_item':
            return line('needs items', `Waiting for ${(status.needs || []).map(src.itemName).join(', ')}.`, { tone: 'danger', alert: true });
        case 'no_room':
            return line('no room', 'No room to spawn nearby.', { tone: 'warning', alert: true });
        case 'mat_full':
            return line('mat full', 'The mat is full.', { tone: 'warning', alert: true });
        case 'sleeping':
            return line('asleep', 'Asleep while enemies hold this place.', { tone: 'warning' });
        default:
            return line(countdownText(status.nextInMs), `Next in ${timeIn(status.nextInMs)}.`);
    }
}

/**
 * A growing Token's line: its countdown, or why it waits (no Token it needs in reach, or short of
 * its cost; either way no time). What a used-up Token left behind respawns rather than grows.
 */
export function growthLine(instance, growth, src) {
    const into = src.tokenName(growth.into);
    const respawns = leftByRegrow(instance?.typeId, src.allTypes?.());
    const verb = respawns ? `Respawns as ${into}` : `Grows into ${into}`;
    const base = { kind: TIMER_KIND.GROW, icon: 'grow', ...(respawns ? { label: 'Respawns' } : {}) };
    if (growth.paused) {
        return { ...base, text: '–', tip: `${verb} only with ${anyOf(growth.needsNearby, src)} nearby`, tone: 'warning', alert: true };
    }
    if (growth.stopped) {
        const short = (growth.cost || []).filter(c => (growth.short || []).includes(c.itemId));
        const goal = respawns ? `respawn as ${into}` : `grow into ${into}`;
        return { ...base, text: '–', tip: `Stopped: needs ${itemsSpoken(short, src)} to ${goal}`, tone: 'warning', alert: true };
    }
    const cost = growth.cost?.length ? itemsSpoken(growth.cost, src) : null;
    return { ...base, text: countdownText(growth.inMs), tip: `${verb} in ${timeIn(growth.inMs)}${cost ? `, for ${cost} from the Bank` : ''}` };
}

/** A Field's crop on its way (ripening), or the Field stopped for want of a seed; else null. */
export function fieldTimerLine(field, src) {
    const name = (id) => (id ? src.recipeName(id) : 'its crop');
    if (field.stage === 'growing') {
        return { kind: TIMER_KIND.RIPEN, icon: 'grow', text: countdownText(field.inMs), tip: `${name(field.cropId)} growing: ripe in ${timeIn(field.inMs)}` };
    }
    if (field.stage !== 'ripe' && field.stopped) {
        const seeds = (field.short || []).map(id => src.itemName(id)).join(' and ');
        return { kind: TIMER_KIND.FIELD, icon: 'grow', text: '–', tip: `Stopped: needs ${seeds} to sow ${name(field.pickId)}`, tone: 'warning', alert: true };
    }
    return null;
}

/**
 * A Token that respawns: while it is exhausted, when it comes back (or what it waits for); before
 * that, how it will. `live` is false for the lines that only describe it (no clock is running).
 */
export function respawnLine(instance, r, src) {
    const base = { kind: TIMER_KIND.RESPAWN, icon: 'regrow' };
    if (r.mode === 'refill') {
        if (r.resting && r.paused) {
            return { ...base, label: 'Exhausted', text: '–', tip: `Exhausted · respawns only with ${anyOf(r.needsNearby, src)} nearby`, tone: 'warning', alert: true };
        }
        if (r.resting) return { ...base, label: 'Exhausted', text: countdownText(r.inMs), tip: `Exhausted · respawns in ${timeIn(r.inMs)}` };
        return { ...base, label: 'Respawns', text: lengthText(r.afterMs), tip: `Respawns ${lengthIn(r.afterMs)} after it's used up`, live: false };
    }
    const into = src.tokenName(r.into);
    return r.resting
        ? { ...base, label: 'Exhausted', text: into, tip: `Exhausted · leaves ${into}, which respawns`, live: false }
        : { ...base, label: 'Respawns', text: into, tip: `Leaves ${into} when it's used up, which respawns`, live: false };
}

/** Passive Production's next payout (the Guild Hall's, a Token's own), or null when it pays nothing. */
export function produceLine(passive, src) {
    const pays = (passive?.lines || []).filter(l => l?.itemId && Number(l.quantity) > 0);
    if (!pays.length) return null;
    return {
        kind: TIMER_KIND.PRODUCE, icon: 'clock', label: 'Produces', text: countdownText(passive.nextInMs),
        tip: `Passive Production, once a lap: ${pays.map(l => `${Math.floor(Number(l.quantity))} ${src.itemName(l.itemId)}`).join(', ')}, next in ${timeIn(passive.nextInMs)}`
    };
}

/**
 * Every running timer and stuck reason a Token has, in the card's order. A marked Token is demolition and nothing else (its own clocks stand still).
 * @returns {object[]} lines as above; descriptive ones (`live: false`) are left out
 */
export function timerLines(instance, src = liveTimerSources()) {
    const def = instance ? src.typeOf(instance.typeId) : null;
    if (!instance || !def) return [];
    if (instance.demolish === true) return [demolitionLine(instance, src)];
    const out = [];
    const leave = src.eventLeave?.(instance);
    if (leave) out.push(leaveLine(leave));
    const status = def.spawner ? src.spawnerStatus?.(instance.id) : null;
    if (status) out.push(spawnLine(def, status, src));
    const growth = src.nextGrowth?.(instance);
    if (growth) out.push(growthLine(instance, growth, src));
    const field = src.field?.(instance);
    const fieldLine = field ? fieldTimerLine(field, src) : null;
    if (fieldLine) out.push(fieldLine);
    const r = src.respawn?.(instance);
    const rest = r ? respawnLine(instance, r, src) : null;
    if (rest && rest.live !== false) out.push(rest);
    const produce = produceLine(src.passive?.(instance), src);
    if (produce) out.push(produce);
    return out;
}
