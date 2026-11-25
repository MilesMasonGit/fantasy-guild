import {
    getTokenType, getAllTokenTypes, getProvidedTagsWithTiers, outputRange, productionRoutes, neverWearsOutType
} from '../../../config/registries/tokenRegistry.js';
import { contextRequirementsOf, getRecipe } from '../../../config/registries/recipePoolRegistry.js';
import { getAllItems } from '../../../config/registries/itemRegistry.js';
import { neededToolOf, toolNeedPhrase, toolItemFor, toolKindLabel } from '../../../config/registries/toolKinds.js';
import { hasCatchPools, catchPoolsOf } from '../../../config/registries/catchPools.js';
import { rareTableOf, rareEntryChances } from '../../../config/registries/rareTables.js';
import { enemyProfileOf } from '../../../config/registries/enemyProfile.js';
import { movesView, enemyHitTypes, kindView, enemyRestNumbers, hasFought } from '../combat/fightView.js';
import { PLAIN_ENEMY_HIT_TYPE } from '../../../config/registries/damageTypes.js';
import { fieldOf, cropTermsOf, campOf, isWarCamp, endTermsOf } from '../../../config/registries/tokenConstants.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as BoardCombat from '../../../systems/board/BoardCombat.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import * as Fields from '../../../systems/board/Fields.js';
import * as Charges from '../../../systems/board/Charges.js';
import * as Fishing from '../../../systems/board/Fishing.js';
import * as Demolition from '../../../systems/board/Demolition.js';
import * as RareTables from '../../../systems/board/RareTables.js';
import { effectBreakdown } from '../../../systems/board/EffectBreakdown.js';
import { exactInputQuantity } from '../../../systems/board/InputCost.js';
import { mostByChance } from '../../../utils/RNG.js';
import { workTimeOf, resolveAxis, heroItemGrants } from '../../../systems/board/TileModifiers.js';
import { canPayLoadoutCost } from '../../../systems/hero/HeroEffects.js';
import { EFFECT_TYPES } from '../../../systems/effects/constants.js';
import { GameState } from '../../../state/GameState.js';
import { effectiveIO } from '../../../systems/board/RecipeResolver.js';
import { availableOf } from '../../../systems/board/InputAllocator.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { chanceFigure, oneInText } from '../../../utils/Formatters.js';
import { landmarkLines } from '../drawer/landmarkLines.js';
import * as SupportLinks from '../../../systems/board/supportLinks.js';
import { reachRadius } from '../../../systems/board/nearby.js';
import { effectTagOf, effectTagText } from './effectBadgeText.js';
import { spotFishRows, luresIn } from './spotFish.js';
import { isHideout } from '../../../systems/board/Hideouts.js';
import { theftBlockOf } from './hideoutCard.js';
import {
    liveTimerSources, demolitionLine, leaveLine, spawnLine, growthLine, fieldTimerLine, respawnLine, produceLine, litLine
} from './tokenTimers.js';

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
    FIGHT: 'fight',
    WORK: 'work',
    CYCLE: 'cycle',
    RECIPE: 'recipe',
    THEFT: 'theft',
    LIFECYCLE: 'lifecycle',
    SUPPORT: 'support',
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

/** Its work runs at its own time whatever is near it (`BoardRunner.tick`). */
const GUILD_HALL = 'token_guild_hall';

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

/**
 * ⚠️ The card's one read of an enemy's moves: what each is called and hits with or does, and the
 * types its attacks hit with. A change to how moves are authored changes this reader alone.
 * @returns {{ moves: Array<object>|null, hitTypes: string[] }}
 */
export function enemyMovesOnCard(profile) {
    return { moves: movesView(profile?.moves), hitTypes: enemyHitTypes(profile?.moves) };
}

/**
 * ⚠️ The card's one read of an enemy's kinds, each with its name and what it does; null until the
 * guild has fought one of this enemy (the card then says to fight one). A change to how kinds are
 * authored changes this reader alone.
 */
export function enemyKindsOnCard(profile, fought) {
    if (!fought) return null;
    return (profile?.kinds || []).map(kindView).filter(Boolean);
}

/** The live readers the card takes. */
export function liveCardSources() {
    return {
        ...liveTimerSources(),
        instanceOf: BoardState.getTokenById,
        heroName: (id) => (GameState.state?.heroes || []).find(h => h?.id === id)?.name || null,
        fishingOf: Fishing.fishingOf,
        poolsHere: Fishing.poolsHere,
        catchLevel: Fishing.catchLevelOf,
        bestLevel: (skillId) => Math.max(0, ...(GameState.state?.heroes || []).map(h => Number(h?.skills?.[skillId]?.level) || 0)),
        catchWeight: (instanceId, itemId, weight) => resolveAxis(instanceId, EFFECT_TYPES.CATCH_WEIGHT, weight, itemId),
        rareChance: RareTables.rareChanceAt,
        effects: effectBreakdown,
        // The most a cycle can take of an input, as the check before it starts asks (`InputCost.costedInputs`).
        inputMost: (instance, quantity) => mostByChance(exactInputQuantity(
            instance.id, quantity, StationRecipe.workConfigOf(getTokenType(instance.typeId), instance)?.skill
        )),
        effectiveIO,
        workTime: workTimeOf,
        available: availableOf,
        selectedRecipe: StationRecipe.selectedRecipe,
        poolFor: StationRecipe.poolFor,
        fieldCrop: Fields.cropOf,
        endChance: Charges.endChanceOf,
        recipeOf: getRecipe,
        fightOf: BoardCombat.getFight,
        fought: hasFought,
        supports: (instanceId) => ({ boosts: SupportLinks.boosts(instanceId) }),
        // The engine's own list (`OutputRules.dropBonusGrants`), less a grant whose item has run out:
        // that one would not land.
        bonusGrants: (instanceId) => heroItemGrants(instanceId, EFFECT_TYPES.BONUS_DROP).filter(canPayLoadoutCost),
        demolitionConfig: Demolition.DEMOLITION_CONFIG,
        allItems: getAllItems,
        art: (def) => cardArtOf(def),
        theft: (instance, def) => theftBlockOf(instance, def)
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

/**
 * The Token types whose work a tool or support Token `def` serves: any with a recipe that needs a
 * tag it provides. Empty for one nothing uses any more (an old save's retired anvil).
 */
export function drivenBy(def, allTypes = getAllTokenTypes(), routesOf = productionRoutes) {
    const tags = new Set(Object.keys(getProvidedTagsWithTiers(def) || {}));
    if (!tags.size) return [];
    return Object.entries(allTypes || {})
        .filter(([id]) => routesOf(id).some(r => (r.requiresContext || []).some(t => tags.has(t))))
        .map(([id]) => id);
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
            return { itemId: o.itemId, min, max, chance: chance < 100 ? chanceFigure(chance) : null };
        });
}

/**
 * The bonus drops the working hero brings (their gear, a potion carried for the cycle), one row per
 * grant, each with its source: the gear piece's name, or the carried effect's (the item that applied
 * it is not kept with it). The card groups them by source under the Loot. Empty with nobody at work.
 */
function bonusOf(instance, src) {
    const heroId = instance && src.bonusGrants ? src.workerOf?.(instance.id) : null;
    if (!heroId) {
        if (instance) carriedHeld.delete(instance);
        return [];
    }
    const heroName = src.heroName(heroId) || heroId;
    const rows = src.bonusGrants(instance.id).map(grant => {
        const items = (grant.sourceItemIds || []).map(id => src.itemName(id));
        const quantity = Math.max(1, Number(grant.quantity) || 1);
        const chance = grant.chance == null ? 100 : Number(grant.chance);
        return {
            itemId: grant.itemId, heroId, heroName, carried: !items.length,
            source: items.length ? items.join(', ') : (grant.effectTitle || ''),
            min: quantity, max: quantity, chance: chance < 100 ? chanceFigure(chance) : null,
            text: effectTagText(grant, src.itemName)
        };
    });
    return withCarriedHeld(instance, heroId, rows);
}

/**
 * The carried bonus rows each Token's card last showed, by the Token's instance:
 * `{ heroId, rows: Map<key, row> }`. Weak, so a Token gone from the mat (or a game left) drops it.
 */
const carriedHeld = new WeakMap();

/**
 * ⚠️ A potion's effect comes off its hero as a cycle completes and goes back on as the next
 * starts (`LoadoutMoments`), so between the two the grant is gone and its row would blink. A
 * carried row once shown is held while the same hero works the Token and no cycle is under way
 * (`cycleElapsedMs` is zero only between cycles). A cycle that starts without it (the potion ran
 * out) or another hero ends the hold. Display only: the engine's grants are read as they are.
 * Gear rows never blink and are not held, so gear running out goes at once.
 */
function withCarriedHeld(instance, heroId, rows) {
    const keyOf = (r) => `${r.itemId}|${r.text}|${r.source}`;
    const prev = carriedHeld.get(instance);
    const between = !(Number(instance.cycleElapsedMs) > 0);
    const out = rows.slice();
    if (prev && prev.heroId === heroId && between) {
        const live = new Set(rows.map(keyOf));
        for (const [key, row] of prev.rows) if (!live.has(key)) out.push(row);
    }
    const carried = out.filter(r => r.carried);
    if (carried.length) carriedHeld.set(instance, { heroId, rows: new Map(carried.map(r => [keyOf(r), r])) });
    else carriedHeld.delete(instance);
    return out;
}

/** Every drop with its chance, 100 % included: a drop table reads as odds. */
function dropsOf(outputs) {
    return (Array.isArray(outputs) ? outputs : [])
        .filter(o => o?.itemId && !o.currency)
        .map(o => {
            const { min, max } = outputRange(o);
            return { itemId: o.itemId, min, max, chance: o.chance == null ? 100 : chanceFigure(o.chance) };
        });
}

/**
 * The Rare finds group: the rare drop table's chance (Lucky counted, on a Token on the mat) and its
 * entries, each at the table's chance times its share. Null for a Token with no table.
 * @returns {{ chance: number, rows: Array<{itemId: string, min: number, max: number, chance: number}> }|null}
 */
function rareBlockOf(def, instance, src, skill) {
    const table = rareTableOf(def);
    if (!table) return null;
    const chance = instance && src.rareChance ? src.rareChance(instance.id, def, skill) : table.chance;
    const rows = rareEntryChances(table, chance).map(({ entry, chance: c }) => ({
        itemId: entry.itemId, min: entry.minQty, max: entry.maxQty, chance: chanceFigure(Math.max(0, c))
    }));
    return { chance: chanceFigure(Math.max(0, chance)), rows };
}

/**
 * The Needs rows: on the mat, what a cycle can take of each input once Efficiency counts (its cost
 * rounded up, as the check before a cycle asks), coloured against that; off it, the recipe's own.
 */
function needsOf(inputs, src, instance) {
    return (Array.isArray(inputs) ? inputs : [])
        .filter(i => i?.itemId && Number(i.quantity) > 0)
        .map(i => {
            const authored = Number(i.quantity);
            const need = instance && src.inputMost ? src.inputMost(instance, authored) : authored;
            return { itemId: i.itemId, need, have: Math.floor(src.available(i.itemId) || 0) };
        });
}

/** Weights as a pool's odds in percent, written by the chance rule, in pool order. */
function catchRows(catches, weightOf = (c) => c.weight) {
    const weights = catches.map(c => Math.max(0, Number(weightOf(c)) || 0));
    const total = weights.reduce((sum, w) => sum + w, 0);
    return catches
        .map((c, i) => ({ itemId: c.itemId, chance: total > 0 ? chanceFigure((weights[i] / total) * 100) : 0 }))
        .filter(row => row.chance > 0);
}

/**
 * What a water's card says it catches. With a hero on it: `setup`, what that hero's tool and bait
 * land now, at the odds the engine rolls (`Fishing.catchOf`), and `groups`, the water's other
 * pools by tool at their authored odds. With none, every pool is in `groups`. `unable` names a
 * hero on it whose hands give them no pool here. A spot lists only the pools that hold where it
 * stands (`Fishing.poolsHere`).
 */
function catchBlockOf(def, instance, src) {
    const heroId = instance ? src.workerOf?.(instance.id) : null;
    const plan = heroId ? src.fishingOf?.(def, heroId, instance) : null;
    const setup = plan && {
        toolId: plan.tool.itemId,
        toolName: src.itemName(plan.tool.itemId),
        baitId: plan.bait,
        baitName: plan.bait ? src.itemName(plan.bait) : null,
        catches: catchRows(plan.catches, (c) => src.catchWeight(instance.id, c.itemId, c.weight))
    };
    const groups = [];
    for (const pool of (src.poolsHere ? src.poolsHere(def, instance) : catchPoolsOf(def))) {
        if (plan && pool === plan.pool) continue;
        let group = groups.find(g => g.tool === pool.tool);
        if (!group) {
            group = { tool: pool.tool, label: toolKindLabel(pool.tool), pools: [] };
            groups.push(group);
        }
        group.pools.push({ bait: pool.bait, baitName: pool.bait ? src.itemName(pool.bait) : null, catches: catchRows(pool.catches) });
    }
    return { heroName: heroId ? (src.heroName?.(heroId) || 'This hero') : null, setup: setup || null, unable: !!heroId && !plan, groups };
}

/**
 * A water's fish list: every fish it can give where it stands, each with the tool kinds that catch
 * it, its Fishing level (out of reach while no hero has it) and the lures that pick it.
 */
function fishBlockOf(def, instance, src) {
    const pools = src.poolsHere ? src.poolsHere(def, instance) : catchPoolsOf(def);
    const skillId = def.config?.skill || 'fishing';
    const best = src.bestLevel ? src.bestLevel(skillId) : 0;
    const rows = spotFishRows(pools, {
        levelOf: (itemId) => (src.catchLevel ? src.catchLevel(def, itemId) : 1),
        best,
        lures: luresIn(src.allItems?.() || {})
    }).map(row => ({
        ...row,
        toolNames: row.tools.map(toolKindLabel),
        lureNames: row.lures.map(id => src.itemName(id))
    }));
    return rows.length ? { skillId, best, rows } : null;
}

/** "1 Oak Seedling", "1 Oak Seedling and 2 Resin". */
function itemsSpoken(lines, src) {
    return lines.map(l => `${l.quantity} ${src.itemName(l.itemId)}`).join(' and ');
}

/**
 * A Field's card lines: its crop ripening or stopped for a seed (the timer writer's), ripe (its
 * chance to finish each harvest), or about to be sown; and, after a change of pick, what it sows
 * next.
 */
function fieldCardLines(field, src) {
    const name = (id) => (id ? src.recipeName(id) : 'its crop');
    const out = [];
    const timer = fieldTimerLine(field, src);
    if (timer) {
        out.push(timer);
    } else if (field.stage === 'ripe') {
        const odds = oneInText(field.endChance);
        out.push({ icon: 'grow', text: odds, tip: `${name(field.cropId)} ripe: each harvest has a ${odds} chance to be the last; the last sows it again` });
    } else if (field.pickId) {
        out.push({ icon: 'grow', text: '–', tip: `Sowing ${name(field.pickId)}` });
    }
    if (field.pickId && field.cropId && field.pickId !== field.cropId) {
        out.push({ icon: 'grow', text: name(field.pickId), tip: `Sows ${name(field.pickId)} next` });
    }
    const pick = field.pickId ? src.recipeOf?.(field.pickId) : null;
    const seeds = pick ? cropTermsOf(pick).seeds : [];
    if (seeds.length) out.push({ icon: 'grow', text: `${itemsSpoken(seeds, src)} per sowing`, tip: `Each sowing costs ${itemsSpoken(seeds, src)} from the Bank` });
    return out;
}

/**
 * The lifecycle lines as icon + short text, each with the sentence its hover gives. Every timer
 * and stuck reason is the timer writer's (`tokenTimers.js`), worded as the idle hover words it.
 * @returns {{ icon: string, text: string, tip: string, tone?: 'warning'|'danger' }[]}
 */
export function cardLifecycle(instance, def, src) {
    if (!instance || !def) return [];
    const out = [];
    if (instance.demolish === true) return [demolitionLine(instance, src)];

    const leave = src.eventLeave?.(instance);
    if (leave) out.push(leaveLine(leave));

    if (def.spawner) {
        const status = src.spawnerStatus?.(instance.id);
        if (status) out.push(spawnCardLine(def, status, src));
    }
    const growth = src.nextGrowth?.(instance);
    if (growth) out.push(growthLine(instance, growth, src));

    // A camp: what its heroes work and how far it reaches (the one standard reach). A War Camp's
    // style is only its mark: its heroes fight in their own.
    const camp = campOf(def);
    if (camp && isWarCamp(def)) {
        const reach = Math.round(reachRadius());
        out.push({
            icon: 'reach', label: 'War Camp', text: `Enemies · ${reach} u`,
            tip: `A War Camp: heroes sent here fight every enemy within ${reach} u, one at a time, each in their own style`
        });
    } else if (camp) {
        const skill = getSkill(camp.skill)?.name || camp.skill;
        const reach = Math.round(reachRadius());
        out.push({
            icon: 'reach', label: 'Camp', text: `${skill} · ${reach} u`,
            tip: `A camp: heroes sent here work the ${skill} Tokens within ${reach} u, one hero each`
        });
    }

    const field = src.field?.(instance);
    if (field) out.push(...fieldCardLines(field, src));

    const r = src.respawn?.(instance);
    if (r) out.push(respawnLine(instance, r, src));

    const produce = produceLine(src.passive?.(instance), src);
    if (produce) out.push(produce);

    // A shrine: how long it stays lit, or that it is out (its bar on the mat shows the same time).
    const shrine = src.shrine?.(instance);
    if (shrine) out.push(litLine(shrine));
    return out;
}

/** A spawner's card line: the timer writer's, with its family's count in front. */
function spawnCardLine(def, status, src) {
    const line = spawnLine(def, status, src);
    const family = `${status.count}/${status.cap}`;
    return { ...line, text: `${family} · ${status.state === 'spawning' ? `next ${line.text}` : line.text}` };
}

/**
 * The card for one Token, as `{ enemy, name, art, blocks, effects }`. `blocks` is in display order
 * and holds only the blocks that apply; `effects` is the badges' breakdown, on the mat only.
 *
 * A Token's card: name; work (skill, level, XP); cycle (time, charges or the chance it runs out); the current recipe
 * (needs, tools, makes, rare finds or a water's fish and catches, and a station's Change recipe), or a
 * Hideout's theft (its camp, what it steals, the odds of a catch, Change camp); lifecycle lines;
 * what it boosts.
 * An enemy's card: name; HP; combat (style, level, XP a kill); its fight (hit, moves, resistances,
 * how often it attacks, its kinds once fought); drops and rare finds.
 * The card draws `hp`, `combat`, `work` and `cycle` together as its stat block.
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
        // Out of a fight, a hurt enemy's kept health (`fightHp`), healing back.
        const kept = Number(instance?.fightHp?.current);
        const cur = hp ? hp.current : (kept > 0 && kept < enemy.hp ? kept : enemy.hp);
        blocks.push({ id: CARD_BLOCK.HP, cur, max: hp ? hp.max : enemy.hp });
        blocks.push({ id: CARD_BLOCK.COMBAT, skillId: enemy.combatType, level: enemy.level, xp: enemy.xpAwarded });
        const { moves, hitTypes } = enemyMovesOnCard(enemy);
        // Its own numbers with its kinds', as a fight starts from them.
        const rest = enemyRestNumbers(enemy);
        blocks.push({
            id: CARD_BLOCK.FIGHT,
            typeId,
            hit: rest.hit,
            hitType: hitTypes[0] ?? PLAIN_ENEMY_HIT_TYPE,
            hitTypes,
            moves,
            resists: rest.resists,
            attackEveryMs: rest.attackEveryMs,
            kinds: enemyKindsOnCard(enemy, !!src.fought?.(typeId))
        });
        const drops = dropsOf(def.config?.outputs);
        const rare = rareBlockOf(def, instance, src, def.config?.skill || '');
        if (drops.length || rare) blocks.push({ id: CARD_BLOCK.DROPS, drops, rare });
        return { enemy: true, name, art, blocks, effects: effectsOf(instance, src) };
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
    // A station with nothing chosen has no work yet: its type's own config is only the engine's
    // fallback, and no recipe runs at that time, level or XP.
    const unchosen = isStation && !recipe;
    if (skillId) {
        const level = unchosen ? null : Math.max(1, Number(work?.skillRequired) || 0, marked ? 0 : StationRecipe.recipeLevel(recipe));
        // Demolishing pays nothing, whatever the Token's own work would.
        const xp = unchosen ? 0 : Number(marked ? work?.xp : (io?.xp ?? recipe?.xp ?? work?.xp)) || 0;
        blocks.push({ id: CARD_BLOCK.WORK, skillId, level, xp });
    }

    const baseMs = unchosen ? 0 : Number(marked ? src.demolishMs : (io?.cycleTimeMs ?? recipe?.durationMs ?? def.config?.cycleTimeMs)) || 0;
    // The time the work really takes on the mat, sped up by what is in reach and the hero on it.
    const cycleMs = baseMs > 0 && instance && !marked && typeId !== GUILD_HALL && src.workTime
        ? Number(src.workTime(instance.id, baseMs, skillId)) || baseMs
        : baseMs;
    // A Token that runs out by chance shows its chance, never a count.
    const endChance = instance ? (src.endChance?.(instance) ?? null) : typeEndChance(def);
    const uses = endChance != null ? null : instance ? (instance.usesRemaining ?? null) : (def.uses ?? null);
    // A station with nothing chosen keeps its Charges cell: only the time goes.
    if (cycleMs > 0 || uses != null || endChance != null || unchosen) blocks.push({ id: CARD_BLOCK.CYCLE, cycleMs, baseMs, uses, endChance });

    if (!marked) {
        // A crop's inputs are its seed, paid once per sowing (its lifecycle line says so), not per harvest.
        const inputs = isField ? [] : isStation ? (recipe?.inputs || []) : (def.config?.inputs || []);
        // Water makes no Outputs: what bites depends on the tool and bait (`catches`).
        const water = hasCatchPools(def);
        const outputs = isStation ? (recipe?.outputs || []) : water ? [] : (def.config?.outputs || []);
        const needs = needsOf(inputs, src, instance);
        const tools = toolsOf(def, recipe, src);
        // A build drops nothing, so a Foundation's rare table (if one were authored) never rolls.
        const makes = makesOf(outputs);
        // The Hall pays no output rules, so no bonus drop either (`BoardRunner`).
        const bonus = typeId === GUILD_HALL ? [] : bonusOf(instance, src);
        // A Hideout rolls the camp's steal table's rare finds, never its own (its theft block shows them).
        const rare = def.foundation || isHideout(def) ? null : rareBlockOf(def, instance, src, def.config?.skill);
        const change = isStation && instance
            ? {
                label: def.foundation ? (recipe ? 'Change building' : 'Choose what to build') : isField ? 'Change crop' : 'Change recipe',
                chosen: !!recipe,
                empty: def.foundation ? 'Nothing chosen to build' : isField ? 'No crop chosen' : 'No recipe chosen'
            }
            : null;
        const catches = water ? catchBlockOf(def, instance, src) : null;
        const fish = water ? fishBlockOf(def, instance, src) : null;
        if (needs.length || tools.length || makes.length || bonus.length || rare || change || catches || fish) {
            blocks.push({ id: CARD_BLOCK.RECIPE, recipeName: recipe?.name || null, recipeId: recipe?.id || null, needs, tools, makes, bonus, rare, change, catches, fish });
        }
        // A Hideout: the camp it robs, what a theft takes, the odds of a catch (`hideoutCard.js`).
        if (isHideout(def) && src.theft) blocks.push({ id: CARD_BLOCK.THEFT, ...src.theft(instance, def) });
    }

    const lifecycle = cardLifecycle(instance, def, src);
    if (lifecycle.length) blocks.push({ id: CARD_BLOCK.LIFECYCLE, lines: lifecycle });

    const support = instance ? supportBlock(src.supports?.(instance.id), src) : null;
    if (support) blocks.push(support);

    const more = {
        landmark: !!landmarkLines(def, { skillName: (id) => id, itemName: src.itemName }),
        buff: !!def.buff,
        drives: drivenBy(def, src.allTypes()).length > 0
    };
    if (more.landmark || more.buff || more.drives) blocks.push({ id: CARD_BLOCK.MORE, ...more });
    return { enemy: false, name, art, blocks, effects: effectsOf(instance, src) };
}

/** The chance a Token type runs out each cycle, off the mat (a shop, the Encyclopedia), or null. */
function typeEndChance(def) {
    if (!def?.id || neverWearsOutType(def.id)) return null;
    return endTermsOf(def)?.chance ?? null;
}

/** The effect badges' numbers for a Token on the mat (`effectBreakdown`), else null. */
function effectsOf(instance, src) {
    return instance && src.effects ? (src.effects(instance.id) || null) : null;
}

/**
 * What this Token boosts, one row per Token in reach with its effects as tags. Null when it boosts
 * nothing. What boosts it is the badge row's hovers (`effectBreakdown`).
 */
function supportBlock(links, src) {
    if (!links) return null;
    const boosts = (links.boosts || []).map(r => ({
        id: r.id, typeId: r.typeId, name: src.tokenName(r.typeId), tags: r.payloads.map(p => effectTagOf(p, src.itemName))
    }));
    if (!boosts.length) return null;
    return { id: CARD_BLOCK.SUPPORT, boosts };
}

