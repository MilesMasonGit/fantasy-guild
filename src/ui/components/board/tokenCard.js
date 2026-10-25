import {
    getTokenType, getAllTokenTypes, tokenName, getProvidedTagsWithTiers, outputRange
} from '../../../config/registries/tokenRegistry.js';
import { contextRequirementsOf, getRecipe } from '../../../config/registries/recipePoolRegistry.js';
import { getItem, getAllItems } from '../../../config/registries/itemRegistry.js';
import { neededToolOf, toolNeedPhrase, toolItemFor } from '../../../config/registries/toolKinds.js';
import { hasCatchPools, catchItemIds } from '../../../config/registries/catchPools.js';
import { enemyProfileOf } from '../../../config/registries/enemyProfile.js';
import { turnTiming, fieldOf, cropTermsOf } from '../../../config/registries/tokenConstants.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as BoardCombat from '../../../systems/board/BoardCombat.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as PassiveProduction from '../../../systems/board/PassiveProduction.js';
import * as Respawn from '../../../systems/board/Respawn.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import * as TimedChanges from '../../../systems/board/TimedChanges.js';
import * as Fields from '../../../systems/board/Fields.js';
import * as Demolition from '../../../systems/board/Demolition.js';
import { effectiveIO } from '../../../systems/board/RecipeResolver.js';
import { availableOf } from '../../../systems/board/InputAllocator.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { formatClock } from '../drawer/lifecycleLines.js';
import { landmarkLines } from '../drawer/landmarkLines.js';

/**
 * The Token card's content as plain data: which blocks it shows, top to bottom, and what each
 * says. The card component only draws this. Every engine read comes through `src`, so a test can
 * pin the order without a mat.
 */

/** The card's blocks, in the order a Token's card shows them. */
export const CARD_BLOCK = Object.freeze({
    NAME: 'name',
    HP: 'hp',
    COMBAT: 'combat',
    WORK: 'work',
    CYCLE: 'cycle',
    RECIPE: 'recipe',
    LIFECYCLE: 'lifecycle',
    DROPS: 'drops',
    MORE: 'more'
});

/**
 * Activity scenes that do not follow the `b_<skill id>` name. A skill with neither gets a plain
 * card until its scene is drawn.
 */
export const ACTIVITY_ART = Object.freeze({
    mining: 'b_mine',
    smithing: 'b_smithy',
    cooking: 'b_kitchen'
});

/** How far a spawner's activity is looked for through what it spawns and what that grows into. */
const ACTIVITY_DEPTH = 3;

/**
 * The skill or trade a Token is for: its work skill, a station's or Foundation's skill, or for a
 * spawner the activity of what it spawns (a Copper Mine spawns veins, so mining). An enemy has
 * none: its fights have no scene.
 */
export function activityOf(def, typeOf = getTokenType, depth = 0) {
    if (!def || def.enemy?.level != null) return null;
    const own = def.config?.skill || def.foundation?.skill || stationSkillOf(def);
    if (own) return own;
    if (depth >= ACTIVITY_DEPTH) return null;
    const next = [
        ...(Array.isArray(def.spawner?.spawns) ? def.spawner.spawns.map(s => s?.typeId) : []),
        def.grows?.into
    ].filter(Boolean);
    for (const id of next) {
        const found = activityOf(typeOf(id), typeOf, depth + 1);
        if (found) return found;
    }
    return null;
}

/**
 * The card's backdrop: the Token's own picture when the CMS names one (`cardArt`) and it
 * resolves, else its activity's scene, else null (a plain card).
 * @returns {{ path: string, source: 'override'|'activity' }|null}
 */
export function cardArtOf(def, { typeOf = getTokenType, resolve = resolveSpritePath } = {}) {
    if (!def) return null;
    const own = typeof def.cardArt === 'string' && def.cardArt.trim() ? resolve(def.cardArt.trim()) : null;
    if (own) return { path: own, source: 'override' };
    const activity = activityOf(def, typeOf);
    if (!activity) return null;
    const scene = resolve(`b_${activity}`) || (ACTIVITY_ART[activity] ? resolve(ACTIVITY_ART[activity]) : null);
    return scene ? { path: scene, source: 'activity' } : null;
}

/** The live readers the card takes. */
export function liveCardSources() {
    return {
        typeOf: getTokenType,
        tokenName,
        itemName: (id) => getItem(id)?.name || id,
        instanceOf: BoardState.getTokenById,
        workerOf: BoardState.workerOf,
        effectiveIO,
        available: availableOf,
        selectedRecipe: StationRecipe.selectedRecipe,
        poolFor: StationRecipe.poolFor,
        spawnerStatus: SpawnerSystem.spawnerStatus,
        respawn: Respawn.respawnState,
        nextGrowth: TimedChanges.nextGrowth,
        field: Fields.fieldState,
        fieldCrop: Fields.cropOf,
        recipeName: (id) => getRecipe(id)?.name || id,
        recipeOf: getRecipe,
        nextTurn: TimedChanges.nextTurnRoll,
        passive: (instance) => ({ lines: PassiveProduction.linesOf(instance), nextInMs: PassiveProduction.nextInMs(instance) }),
        fightOf: BoardCombat.getFight,
        demolishMs: Demolition.DEMOLISH_MS,
        demolitionConfig: Demolition.DEMOLITION_CONFIG,
        allTypes: getAllTokenTypes,
        allItems: getAllItems,
        art: (def) => cardArtOf(def)
    };
}

/** The cheapest Token type that provides `tag` at `minTier` or better, for naming a tool. */
export function toolTokenFor(tag, minTier = 1, allTypes = getAllTokenTypes()) {
    const ranked = Object.entries(allTypes || {})
        .map(([id, def]) => ({ id, rank: Number(getProvidedTagsWithTiers(def)?.[tag]) || 0 }))
        .filter(c => c.rank && c.rank >= minTier)
        .sort((a, b) => a.rank - b.rank);
    return ranked[0]?.id || null;
}

function toolsOf(def, recipe, src) {
    const out = [];
    const seen = new Set();
    const add = (entry) => {
        const key = entry.typeId || entry.itemId || entry.name;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(entry);
    };
    // The tool a hero must hold to work it, named by the first tool item that will do.
    const need = neededToolOf(def);
    if (need) {
        const items = src.allItems?.() || {};
        add({ itemId: toolItemFor(need, items), name: toolNeedPhrase(need, items), tag: need.kind, inHand: true });
    }
    for (const req of Array.isArray(def.acceptedTokens) ? def.acceptedTokens : []) {
        if (req?.tag) {
            const typeId = toolTokenFor(req.tag, req.minTier || 1, src.allTypes());
            add({ typeId, name: typeId ? src.tokenName(typeId) : req.tag, tag: req.tag });
        } else if (Array.isArray(req?.tokenIds) && req.tokenIds.length) {
            add({ typeId: req.tokenIds[0], name: req.tokenIds.map(src.tokenName).join(' or '), tag: null });
        }
    }
    for (const req of contextRequirementsOf(recipe)) {
        const typeId = toolTokenFor(req.tag, req.minTier, src.allTypes());
        add({ typeId, name: typeId ? src.tokenName(typeId) : req.tag, tag: req.tag });
    }
    return out;
}

/** "Makes" rows: item outputs only (a currency output pays nothing), the chance under 100 %. */
function makesOf(outputs) {
    return (Array.isArray(outputs) ? outputs : [])
        .filter(o => o?.itemId && !o.currency)
        .map(o => {
            const { min, max } = outputRange(o);
            const chance = o.chance == null ? 100 : Number(o.chance);
            return { itemId: o.itemId, min, max, chance: chance < 100 ? chance : null };
        });
}

/** Every drop with its chance, 100 % included: a drop table reads as odds. */
function dropsOf(outputs) {
    return (Array.isArray(outputs) ? outputs : [])
        .filter(o => o?.itemId && !o.currency)
        .map(o => {
            const { min, max } = outputRange(o);
            return { itemId: o.itemId, min, max, chance: o.chance == null ? 100 : Number(o.chance) };
        });
}

function needsOf(inputs, src) {
    return (Array.isArray(inputs) ? inputs : [])
        .filter(i => i?.itemId && Number(i.quantity) > 0)
        .map(i => ({ itemId: i.itemId, need: Number(i.quantity), have: Math.floor(src.available(i.itemId) || 0) }));
}

const seconds = (ms) => Math.max(0, Math.ceil((Number(ms) || 0) / 1000));

/** "1 Oak Seedling", "1 Oak Seedling and 2 Resin". */
function itemsSpoken(lines, src) {
    return lines.map(l => `${l.quantity} ${src.itemName(l.itemId)}`).join(' and ');
}

/**
 * A growing Token's card line: its countdown, or why it waits. A Stump with no Forest in reach
 * waits for one; one short of its seedling is stopped; either way the clock shows no time.
 */
function growthLine(growth, src) {
    const into = src.tokenName(growth.into);
    const needs = (growth.needsNearby || []).map(src.tokenName).join(' or ');
    const cost = growth.cost?.length ? itemsSpoken(growth.cost, src) : null;
    if (growth.paused) {
        return { icon: 'grow', text: '–', tip: `Grows into ${into} only with ${needs} nearby`, tone: 'warning' };
    }
    if (growth.stopped) {
        const short = growth.cost.filter(c => (growth.short || []).includes(c.itemId));
        return { icon: 'grow', text: '–', tip: `Stopped: needs ${itemsSpoken(short, src)} to grow into ${into}`, tone: 'warning' };
    }
    return {
        icon: 'grow', text: formatClock(growth.inMs),
        tip: `Grows into ${into} in ${spoken(growth.inMs)}${cost ? `, for ${cost} from the Bank` : ''}`
    };
}

/**
 * A Field's card lines: its crop growing (a countdown), ripe (harvests left), stopped for a seed,
 * or about to be sown; and, after a change of pick, what it sows next.
 */
function fieldCardLines(field, src) {
    const name = (id) => (id ? src.recipeName(id) : 'its crop');
    const out = [];
    if (field.stage === 'growing') {
        out.push({ icon: 'grow', text: formatClock(field.inMs), tip: `${name(field.cropId)} growing: ripe in ${spoken(field.inMs)}` });
    } else if (field.stage === 'ripe') {
        out.push({ icon: 'grow', text: `${field.load}/${field.full}`, tip: `${name(field.cropId)} ripe: ${field.load} of ${field.full} harvests left; the last sows it again` });
    } else if (field.stopped) {
        const seeds = field.short.map(id => src.itemName(id)).join(' and ');
        out.push({ icon: 'grow', text: '–', tip: `Stopped: needs ${seeds} to sow ${name(field.pickId)}`, tone: 'warning' });
    } else if (field.pickId) {
        out.push({ icon: 'grow', text: '–', tip: `Sowing ${name(field.pickId)}` });
    }
    if (field.pickId && field.cropId && field.pickId !== field.cropId) {
        out.push({ icon: 'grow', text: name(field.pickId), tip: `Sows ${name(field.pickId)} next` });
    }
    const pick = field.pickId ? src.recipeOf?.(field.pickId) : null;
    const seeds = pick ? cropTermsOf(pick).seeds : [];
    if (seeds.length) out.push({ icon: 'clock', text: itemsSpoken(seeds, src), tip: `Each sowing costs ${itemsSpoken(seeds, src)} from the Bank` });
    return out;
}

/** A spoken duration for a tooltip: "12 s", "2 min", "1 min 5 s". */
function spoken(ms) {
    const total = seconds(ms);
    if (total < 60) return `${total} s`;
    const min = Math.floor(total / 60);
    const s = total % 60;
    return s ? `${min} min ${s} s` : `${min} min`;
}

const percent = (chance) => `${Math.round(Number(chance) * 10) / 10}%`;

/**
 * The lifecycle lines as icon + short text, each with the sentence its hover gives.
 * @returns {{ icon: string, text: string, tip: string, tone?: 'warning'|'danger' }[]}
 */
export function cardLifecycle(instance, def, src) {
    if (!instance || !def) return [];
    const out = [];
    if (instance.demolish === true) {
        const worked = !!src.workerOf?.(instance.id);
        const left = (Number(src.demolishMs) || 0) - (Number(instance.cycleElapsedMs) || 0);
        out.push(worked
            ? { icon: 'clock', text: formatClock(left), tip: `Marked for demolition: gone in ${spoken(left)}`, tone: 'warning' }
            : { icon: 'clock', text: '–', tip: 'Marked for demolition: waiting for a hero with Construction', tone: 'warning' });
        return out;
    }

    const turn = src.nextTurn?.(instance);
    if (instance.turnedFrom) {
        if (turn) {
            out.push({
                icon: 'turn', text: formatClock(turn.inMs),
                tip: `A ${percent(turn.chance)} chance to turn back into ${src.tokenName(instance.turnedFrom)} in ${spoken(turn.inMs)}`
            });
        }
    } else {
        if (def.spawner) {
            const status = src.spawnerStatus?.(instance.id);
            if (status) out.push(spawnLine(def, status, src));
        }
        const growth = src.nextGrowth?.(instance);
        if (growth) out.push(growthLine(growth, src));
        if (turn) {
            const into = turn.into.map(src.tokenName).join(' or ');
            const { everyMs } = turnTiming(def.turns);
            out.push({
                icon: 'turn', text: formatClock(turn.inMs),
                tip: `A ${percent(turn.chance)} chance every ${spoken(everyMs)} to turn into ${into}, and the same to turn back. Next roll in ${spoken(turn.inMs)}`
            });
        }
    }

    const field = src.field?.(instance);
    if (field) out.push(...fieldCardLines(field, src));

    const r = src.respawn?.(instance);
    if (r) {
        if (r.mode === 'refill') {
            // Drawn as the shared empty rock, a resting vein's line names its ore.
            const restTip = r.restingSprite
                ? `${src.tokenName(instance.typeId)}: resting, refills in ${formatClock(r.inMs)}`
                : `Resting: refills in ${spoken(r.inMs)}`;
            out.push(r.resting
                ? { icon: 'regrow', text: formatClock(r.inMs), tip: restTip }
                : { icon: 'regrow', text: formatClock(r.afterMs), tip: `Respawns ${spoken(r.afterMs)} after it's used up` });
        } else {
            const into = src.tokenName(r.into);
            out.push({ icon: 'regrow', text: into, tip: r.resting ? `Becomes ${into}, which grows back` : `Becomes ${into} when it's used up, which grows back` });
        }
    }

    const passive = src.passive?.(instance);
    const pays = (passive?.lines || []).filter(l => l?.itemId && Number(l.quantity) > 0);
    if (pays.length) {
        out.push({
            icon: 'clock', text: formatClock(passive.nextInMs),
            tip: `Passive Production: ${pays.map(l => `${Math.floor(Number(l.quantity))} ${src.itemName(l.itemId)}`).join(', ')}, next in ${spoken(passive.nextInMs)}`
        });
    }
    return out;
}

function spawnLine(def, status, src) {
    const spawns = (def.spawner.spawns || []).filter(e => e?.typeId).map(e => src.tokenName(e.typeId)).join(' or ');
    const family = `${status.count}/${status.cap}`;
    const head = `Spawns ${spawns || 'Tokens'}. Its family: ${status.count} of ${status.cap}.`;
    switch (status.state) {
        case 'at_cap':
            return { icon: 'spawn', text: `${family} · full`, tip: `${head} Waits for room in the family.`, tone: 'warning' };
        case 'needs_item':
            return {
                icon: 'spawn', text: `${family} · needs items`,
                tip: `${head} Waiting for ${(status.needs || []).map(src.itemName).join(', ')}.`, tone: 'danger'
            };
        case 'no_room':
            return { icon: 'spawn', text: `${family} · no room`, tip: `${head} No room to spawn nearby.`, tone: 'warning' };
        case 'mat_full':
            return { icon: 'spawn', text: `${family} · mat full`, tip: `${head} The mat is full.`, tone: 'warning' };
        default:
            return { icon: 'spawn', text: `${family} · next ${formatClock(status.nextInMs)}`, tip: `${head} Next in ${spoken(status.nextInMs)}.` };
    }
}

/**
 * The card for one Token, as `{ enemy, name, art, blocks }`. `blocks` is in display order and
 * holds only the blocks that apply.
 *
 * A Token's card: name; work (skill, level, XP); cycle (time, charges); the current recipe
 * (needs, tools, makes, and a station's Change recipe); lifecycle lines; drops.
 * An enemy's card: name; HP; combat (style, level, XP a kill); drops.
 * After them, `more`: what the card's layout has no block for yet (a landmark's challenge, a
 * buff, the stations a tool Token drives).
 */
export function tokenCardModel(typeId, instanceId = null, src = liveCardSources()) {
    const def = src.typeOf(typeId);
    if (!def) return null;
    const instance = instanceId != null ? src.instanceOf(instanceId) : null;
    const name = src.tokenName(typeId);
    const art = src.art(def);
    const blocks = [{ id: CARD_BLOCK.NAME, name }];

    const enemy = enemyProfileOf(def);
    if (enemy) {
        const fight = instance ? src.fightOf?.(instance.id) : null;
        const hp = fight?.combat?.enemyHp;
        blocks.push({ id: CARD_BLOCK.HP, cur: hp ? hp.current : enemy.hp, max: hp ? hp.max : enemy.hp });
        blocks.push({ id: CARD_BLOCK.COMBAT, skillId: enemy.combatType, level: enemy.level, xp: enemy.xpAwarded });
        const drops = dropsOf(def.config?.outputs);
        if (drops.length) blocks.push({ id: CARD_BLOCK.DROPS, drops });
        return { enemy: true, name, art, blocks };
    }

    const marked = instance?.demolish === true;
    const io = instance ? src.effectiveIO(instance.id, instance) : null;
    const stationSkill = def.foundation?.skill || stationSkillOf(def);
    const isStation = !!stationSkill && !marked && src.poolFor(def).length > 0;
    // A Field shows its crop: the one in the ground, else the one it sows next.
    const isField = !!fieldOf(def);
    const recipe = instance && isStation
        ? (isField ? (src.fieldCrop?.(instance, def) ?? null) : src.selectedRecipe(instance, def))
        : null;

    const work = marked ? src.demolitionConfig : def.config;
    const skillId = marked ? work?.skill : (def.config?.skill || def.foundation?.skill || null);
    if (skillId) {
        const level = Math.max(1, Number(work?.skillRequired) || 0, marked ? 0 : StationRecipe.recipeLevel(recipe));
        const xp = Number(io?.xp ?? recipe?.xp ?? work?.xp) || 0;
        blocks.push({ id: CARD_BLOCK.WORK, skillId, level, xp });
    }

    const cycleMs = Number(marked ? src.demolishMs : (io?.cycleTimeMs ?? recipe?.durationMs ?? def.config?.cycleTimeMs)) || 0;
    const uses = instance ? (instance.usesRemaining ?? null) : (def.uses ?? null);
    if (cycleMs > 0 || uses != null) blocks.push({ id: CARD_BLOCK.CYCLE, cycleMs, uses });

    if (!marked) {
        // A crop's inputs are its seed, paid once per sowing (its lifecycle line says so), not per harvest.
        const inputs = isField ? [] : isStation ? (recipe?.inputs || []) : (def.config?.inputs || []);
        // Water lists every fish its pools can land: what bites depends on the tool and bait.
        const outputs = isStation ? (recipe?.outputs || [])
            : hasCatchPools(def) ? catchItemIds(def).map(itemId => ({ itemId, minQty: 1, maxQty: 1 }))
            : (def.config?.outputs || []);
        const needs = needsOf(inputs, src);
        const tools = toolsOf(def, recipe, src);
        const makes = makesOf(outputs);
        const change = isStation && instance
            ? { label: def.foundation ? 'Choose what to build' : isField ? 'Change crop' : 'Change recipe', chosen: !!recipe }
            : null;
        if (needs.length || tools.length || makes.length || change) {
            blocks.push({ id: CARD_BLOCK.RECIPE, recipeName: recipe?.name || null, needs, tools, makes, change });
        }
    }

    const lifecycle = cardLifecycle(instance, def, src);
    if (lifecycle.length) blocks.push({ id: CARD_BLOCK.LIFECYCLE, lines: lifecycle });

    const more = {
        landmark: !!landmarkLines(def, { skillName: (id) => id, itemName: src.itemName }),
        buff: !!def.buff,
        drives: Object.keys(getProvidedTagsWithTiers(def)).length > 0
    };
    if (more.landmark || more.buff || more.drives) blocks.push({ id: CARD_BLOCK.MORE, ...more });
    return { enemy: false, name, art, blocks };
}

/** Seconds as the cycle line writes them: `4s`, `2.5s`. */
export function cycleText(ms) {
    const s = (Number(ms) || 0) / 1000;
    return `${Number.isInteger(s) ? s : Math.round(s * 10) / 10}s`;
}
