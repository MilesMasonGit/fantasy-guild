/**
 * The boosts pack writer (`npm run cms -- pack boosts`): every effect statement that changes work
 * time, XP, yield or doubles, rare finds or regrowth, sized by the rule for its source (BALANCE_RULES
 * section 5, the owner's budget of 2026-11-26) and written as a change pack. Only the number moves:
 * each statement keeps its name, its axis, what it reaches and how.
 *
 * The sources, read from what carries the statement:
 * - **a placed building** (a `buff` Token, or a station's rule on its neighbours): one building's
 *   size of its kind ({@link BOOST_RULE}`.building`);
 * - **a station's own upgrade** (a station's rule on itself): 5 % off work time a step, a step one
 *   scale of the reference that carries it (Foundry holds Faster Station at II: two steps);
 * - **skill perks**: a skill's speed perks bring it, perk by perk, to a quarter of the speed total
 *   of the tier each perk's level falls in, 15 % by darkmetal;
 * - **Guild Hall stars**: a star's ranks reach 10 % of its kind at its top rank, in even steps (a
 *   rank holds its whole value, as `hallModifiers` reads it);
 * - **the one consumable** (a drink or a work potion: what it applies at a work moment): a speed
 *   drink a quarter of its tier's speed total, an XP drink its tier's XP total, a yield potion by its
 *   tier (+10 % at copper to +50 % at darkmetal), a rare-finds potion +100 %, +200 % from adamantine.
 * Tier totals are the ledger's boost budget, the Maxed cell of the row the tier falls in
 * (`settings.boostBudget`, from the workspace's plan settings). An item's tier is its plan's tier,
 * else the tier the ledger first reaches it at (`options.tierOf`), as the ledger's budget check reads it.
 *
 * Growth time is crop growth on a Field (speed, BALANCE_RULES section 5) and a node's rest
 * elsewhere (regrowth): told apart by the Tokens the statement reaches.
 *
 * Anything that fits none of the sources, or mixes kinds (one building, consumable, perk or star
 * moving two), is listed as unclear and left alone; an effect shared by bearers the rule sizes
 * differently is unclear too. A statement whose bearers are all Parked, an enemy's, or one nothing
 * carries is skipped. Other axes (combat, coins outside a building, Passive Production) are not counted.
 *
 * Pure: it reads the workspace it is given and returns the pack, never a changed workspace.
 */

import { fingerprint, currentValue, PACK_FORMAT, PACK_VERSION } from './changePacks.js';
import { settingsOf } from './ledger/settings.js';
import { PLAN_STATUS, DEFAULT_PLAN_STATUS, tierOrNull, tierLabel } from '../../../src/systems/progression/ledger/plan.js';
import { reachOf, REACH } from '../../../src/config/registries/reachRegistry.js';
import { respawnOf, fieldOf, campOf } from '../../../src/config/registries/tokenConstants.js';
import { targetModeMatches } from '../../../src/config/registries/filterRegistry.js';
import { isWorkMoment } from '../../../src/systems/core/consumableRule.js';

/** The rule's numbers, in percent (BALANCE_RULES section 5). */
export const BOOST_RULE = Object.freeze({
    building: Object.freeze({ speed: 5, xp: 2.5, yield: 50, rare: 12.5, regrow: 10, coin: 10 }),
    stationStep: 5,
    perkShare: 0.25,
    // A yield perk is a speed perk's slice at five times the size (the owner, 2026-11-26).
    perkYieldPerSpeed: 5,
    hallStar: 10,
    // Yield and rare finds by plan tier (the balancer, 2026-11-26): copper (tiers 0 and 1) to darkmetal; rare +200 % from adamantine (owner, 2026-11-07).
    consumable: Object.freeze({
        speedShare: 0.25, xpShare: 1,
        yieldByTier: Object.freeze([10, 10, 15, 20, 25, 30, 40, 50]),
        rare: 100, rareLate: 200, rareLateTier: 6,
    }),
});

/** A yield drink or potion's size at a plan tier, the last tier's past the table. */
const consumableYieldAt = (tier) => {
    const table = BOOST_RULE.consumable.yieldByTier;
    return table[Math.min(Math.max(0, tier), table.length - 1)];
};

/** What the budget leaves unsized and out of its check (the balancer, 2026-11-26): skipped, not unclear. */
const UNSIZED = Object.freeze({
    event: 'a world event\'s Token: left unsized, and out of the boost budget check',
    bonus: 'a bonus drop of named items: left unsized, and out of the boost budget check',
    mastery: 'a mastery track\'s rank: left unsized (the ledger rates no mastery)',
});

/** What has no share of the work budget and needs an effect of its own (the owner, 2026-11-26): for the content session. */
const NEEDS = Object.freeze({
    tool: 'a tool has no share of the work budget: it keeps its gating, and this work boost needs another effect',
    gear: 'worn gear has no share of the work budget: this work boost becomes an effect of its own',
    xpPerk: 'an XP perk is not sized: it needs another effect',
});

/** The axes the pack sizes: the kind each moves, the bucket the rule's number is written in, and its sign. */
const AXIS = Object.freeze({
    WORK_TIME: { kind: 'speed', bucket: 'percentage', sign: -1, label: 'work time' },
    GROW_TIME: { kind: 'growth', bucket: 'percentage', sign: -1, label: 'growth time' },
    XP_BONUS: { kind: 'xp', bucket: 'percentage', sign: 1, label: 'XP' },
    YIELD: { kind: 'yield', bucket: 'percentage', sign: 1, label: 'yield' },
    LOOT_MULT: { kind: 'yield', bucket: 'flat', sign: 1, label: 'double loot chance' },
    DOUBLE_DROP: { kind: 'yield', bucket: 'flat', sign: 1, label: 'double item chance' },
    LUCKY: { kind: 'rare', bucket: 'percentage', sign: 1, label: 'rare finds' },
    COIN_FIND: { kind: 'coin', bucket: 'percentage', sign: 1, label: 'coin find' },
    BONUS_DROP: { kind: 'finds', bucket: null, sign: 1, label: 'bonus drop' },
});

export const KIND_TEXT = Object.freeze({ speed: 'speed', regrow: 'regrowth', xp: 'XP', yield: 'yield', rare: 'rare finds', coin: 'coins', finds: 'bonus drops' });
export const SOURCE_TEXT = Object.freeze({ building: 'a placed building', camp: 'a camp variant', station: 'a station\'s own upgrade', perk: 'a skill perk', hall: 'a Guild Hall star', consumable: 'the one consumable' });

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const statusOf = (record) => record?.plan?.status ?? DEFAULT_PLAN_STATUS;
const wholeScale = (n) => (Number.isFinite(Number(n)) && Number(n) >= 1 ? Math.floor(Number(n)) : 1);
const round = (n, places) => {
    const f = 10 ** places;
    const r = Math.round(n * f) / f;
    return Object.is(r, -0) ? 0 : r;
};

/** A statement's axis row when it is one the pack counts, else null. */
function axisOf(statement) {
    if (statement?.keyword !== 'provides' && statement?.keyword !== 'grants') return null;
    return AXIS[statement?.payload?.type] || null;
}

/** The statement's value for `pct` percent on its axis, as the CMS stores it: a share for a percentage, points for a flat chance. */
function storedValue(axis, pct) {
    return axis.bucket === 'percentage' ? round(axis.sign * pct / 100, 4) : round(axis.sign * pct, 2);
}

/** A stored value in words, `-5 %` or `+50 % chance`. */
function shown(axis, value) {
    if (!Number.isFinite(value)) return String(value);
    const pct = axis.bucket === 'percentage' ? value * 100 : value;
    const n = round(pct, 2);
    return `${n > 0 ? '+' : ''}${n} %`;
}

/** The skill a Token's growth is narrowed by: its own work skill, else what it regrows into's. */
function growSkillOf(def, tokens) {
    const own = def?.config?.skill || def?.camp?.skill;
    if (own) return own;
    const back = respawnOf(def);
    return back?.mode === 'regrow' ? tokens?.[back.into]?.config?.skill || null : null;
}

/**
 * What a growth-time statement moves: `'speed'` when every Token it reaches that grows is a Field
 * (a crop's growth), `'regrow'` when every one is a resting or regrowing Token, else `{ unclear }`.
 */
function growthKindOf(statement, bearer, workspace) {
    const tokens = workspace?.tokens || {};
    const category = statement?.payload?.category || null;
    const reached = reachOf(statement) === REACH.SELF
        ? [bearer]
        : Object.values(tokens).filter((def) => isObject(def) && !isObject(def.enemy) && def !== bearer
            && targetModeMatches(statement?.to, def) && (!category || growSkillOf(def, tokens) === category));
    const kinds = new Set();
    for (const def of reached) {
        if (fieldOf(def)) kinds.add('speed');
        else if (respawnOf(def) || isObject(def?.grows)) kinds.add('regrow');
    }
    if (kinds.size === 1) return [...kinds][0];
    if (!kinds.size) return { unclear: 'growth time reaching no Field and no resting Token: neither crop growth (speed) nor regrowth' };
    return { unclear: 'growth time reaching both Fields (crop growth, speed) and resting Tokens (regrowth): two kinds' };
}

/** The kind a statement moves (growth told apart), or `{ unclear }` for a bucket or shape the rule's number cannot be written in. */
function kindOf(statement, axis, bearer, workspace) {
    if (axis.kind === 'finds') return { skip: UNSIZED.bonus };
    if (statement?.when?.event) return { unclear: `a ${axis.label} rule that waits on a moment (${statement.when.event}): the rule sizes always-on boosts` };
    if ((statement?.payload?.bucket || 'flat') !== axis.bucket) return { unclear: `${axis.label} as a ${statement?.payload?.bucket || 'flat'} amount: the rule's number is a ${axis.bucket}` };
    if (axis.kind === 'growth') return growthKindOf(statement, bearer, workspace);
    return axis.kind;
}

/**
 * The tier totals: the boost budget's row for a tier (the last at or before it) and the tier a
 * level falls in.
 */
function budgetOf(settings) {
    const rows = [...settings.boostBudget].sort((a, b) => a.tier - b.tier);
    const rowAt = (tier) => {
        let out = rows[0];
        for (const row of rows) if (row.tier <= tier) out = row;
        return out;
    };
    const tierAtLevel = (level) => {
        let out = 0;
        for (const p of settings.tierLevels) if (p.level <= level && p.tier > out) out = p.tier;
        return out;
    };
    const top = rows[rows.length - 1];
    return { rowAt, tierAtLevel, top };
}

/**
 * @param {object} workspace the CMS workspace (items, tokens, effects, skillPerks, hallStars, planSettings, events)
 * @param {{ id: string, createdAt?: string, asked?: string, tierOf?: (kind: 'item'|'token', id: string) => number|null }} options
 *   `tierOf` the tier the ledger first reaches an entry at, for an item whose plan names none
 * @returns {{ pack: object|null, filled: object[], unclear: object[], skipped: object[], notes: string[], tierSource: string }}
 */
export function writeBoostPack(workspace, { id, createdAt = new Date().toISOString(), asked, tierOf = null } = {}) {
    const settings = settingsOf(workspace?.planSettings);
    const { rowAt, tierAtLevel, top } = budgetOf(settings);
    const effects = workspace?.effects || {};
    const tokens = workspace?.tokens || {};
    const items = workspace?.items || {};
    const eventTokens = new Set(Object.values(workspace?.events || {}).map((e) => e?.typeId).filter(Boolean));
    const notes = [];

    /** Every statement the pack counts, with what each bearer makes of it. */
    const claims = new Map();
    const claimOf = (key, make) => {
        if (!claims.has(key)) claims.set(key, { key, outcomes: [], ...make() });
        return claims.get(key);
    };
    const effectClaim = (effectId, index) => claimOf(`effect:${effectId}#${index}`, () => ({
        kind: 'effect', id: effectId, index, name: effects[effectId]?.name || effectId,
        statement: effects[effectId].statements[index], where: `effect ${effectId} #${index + 1}`,
    }));
    /** The counted statements of an effect, with their index: `[{ statement, index, axis }]`. */
    const countedOf = (effectId) => list(effects[effectId]?.statements).map((statement, index) => ({ statement, index, axis: axisOf(statement) })).filter((s) => s.axis);

    const bearerName = (kind, def, idOf) => `${def?.name || idOf} (${kind} ${idOf})`;

    /**
     * Outcomes for one bearer's statements under one source, with the "one kind" rule: a building,
     * consumable, perk or star that moves more than one kind is unclear in all of them.
     * `extra` is kept on every sized outcome (a consumable's tier).
     * `rows` are `{ claim, kind | unclear, scale, size(kind) -> pct | { unclear } }`.
     */
    function settle(rows, bearer, source, sizeOf, extra = {}) {
        const kinds = new Set(rows.filter((r) => typeof r.kind === 'string').map((r) => r.kind));
        // A station's own steps are speed alone: its other rules on itself are unclear by themselves, and leave its steps be.
        const mixed = kinds.size > 1 && source !== 'station' ? `${bearer} moves more than one kind (${[...kinds].map((k) => KIND_TEXT[k]).join(' and ')}): ${SOURCE_TEXT[source]} boosts one` : null;
        for (const r of rows) {
            if (r.skip) { r.claim.outcomes.push({ bearer, skip: r.skip }); continue; }
            if (r.unclear) { r.claim.outcomes.push({ bearer, source, unclear: r.unclear }); continue; }
            if (mixed) { r.claim.outcomes.push({ bearer, source, unclear: mixed }); continue; }
            const pct = sizeOf(r.kind, r);
            if (isObject(pct)) { r.claim.outcomes.push({ bearer, source, unclear: pct.unclear }); continue; }
            const axis = axisOf(r.claim.statement);
            const value = storedValue(axis, pct);
            const scale = r.scale || 1;
            r.claim.outcomes.push({ bearer, source, kind: r.kind, pct, value, base: storedValue(axis, pct / scale), scale, ...extra });
        }
    }

    // ── Tokens: placed buildings and stations' own upgrades ─────────────────────────────────────
    for (const [tokenId, def] of Object.entries(tokens)) {
        if (!isObject(def)) continue;
        const bearer = bearerName('token', def, tokenId);
        const parked = statusOf(def) === PLAN_STATUS.PARKED;
        const refs = list(def.effects).filter((r) => effects[r.effectId]);
        const rows = { building: [], station: [], camp: [] };
        for (const ref of refs) {
            for (const { statement, index, axis } of countedOf(ref.effectId)) {
                const claim = effectClaim(ref.effectId, index);
                if (parked) { claim.outcomes.push({ bearer, skip: 'its bearer is Parked' }); continue; }
                if (isObject(def.enemy)) { claim.outcomes.push({ bearer, skip: 'an enemy\'s rule (combat numbers are not this pack\'s)' }); continue; }
                if (eventTokens.has(tokenId) || list(def.tags).includes('Event')) { claim.outcomes.push({ bearer, skip: UNSIZED.event }); continue; }
                const reach = reachOf(statement);
                const kind = kindOf(statement, axis, def, workspace);
                const row = isObject(kind) ? { claim, ...kind } : { claim, kind, scale: wholeScale(ref.scale) };
                if (row.skip) { claim.outcomes.push({ bearer, skip: row.skip }); continue; }
                if (reach === REACH.SELF) {
                    if (def.tokenType !== 'station') { claim.outcomes.push({ bearer, unclear: `a ${def.tokenType || 'Token'}'s rule on itself: not a station's own upgrade` }); continue; }
                    rows.station.push(row);
                } else if (reach === REACH.SELF_AND_NEARBY) {
                    claim.outcomes.push({ bearer, unclear: 'reaches itself and its neighbours: a station step and a building at once' });
                } else if (reach === REACH.BOARD) {
                    claim.outcomes.push({ bearer, unclear: 'a Token\'s rule on the whole board: not a placed building\'s reach' });
                } else if (campOf(def)) {
                    rows.camp.push(row);
                } else if (isObject(def.spawner)) {
                    claim.outcomes.push({ bearer, unclear: 'a spawner\'s own rule on its family: not a placed building' });
                } else if (def.tokenType === 'buff' || def.tokenType === 'station') {
                    rows.building.push(row);
                } else {
                    claim.outcomes.push({ bearer, unclear: `a ${def.tokenType || 'Token'}'s rule on its neighbours: not a placed building` });
                }
            }
        }
        settle(rows.building, bearer, 'building', (kind) => BOOST_RULE.building[kind]);
        // A camp variant stands in the camp's place: one building's worth of its kind.
        settle(rows.camp, bearer, 'camp', (kind) => (kind === 'coin' ? { unclear: 'a camp\'s coin find: coins come from the coin building' } : BOOST_RULE.building[kind]));
        // A station's own step: 5 % of work time, or one building's worth of XP or yield, a step a scale.
        settle(rows.station, bearer, 'station', (kind, r) => (kind === 'speed' ? BOOST_RULE.stationStep * r.scale
            : kind === 'xp' || kind === 'yield' ? BOOST_RULE.building[kind] * r.scale
                : { unclear: `a station's own ${KIND_TEXT[kind]}: a station's own step is sized in work time, XP or yield` }));
        for (const r of list(def.mastery?.ranks)) {
            if (!effects[r?.effectId]) continue;
            for (const { index } of countedOf(r.effectId)) {
                effectClaim(r.effectId, index).outcomes.push({ bearer, skip: parked ? 'its bearer is Parked' : UNSIZED.mastery });
            }
        }
        for (const move of list(def.enemy?.moves)) {
            if (!effects[move?.effectId]) continue;
            for (const { index } of countedOf(move.effectId)) effectClaim(move.effectId, index).outcomes.push({ bearer, skip: 'an enemy\'s move (combat numbers are not this pack\'s)' });
        }
    }

    // ── Items: the one consumable, and tools and gear ───────────────────────────────────────────
    let tiersFromLedger = 0;
    for (const [itemId, def] of Object.entries(items)) {
        if (!isObject(def)) continue;
        const bearer = bearerName('item', def, itemId);
        const parked = statusOf(def) === PLAN_STATUS.PARKED;
        const consumable = def.equipSlot === 'drink' || def.equipSlot === 'consumable';
        const rows = [];
        for (const ref of list(def.effects).filter((r) => effects[r.effectId])) {
            for (const { index, axis } of countedOf(ref.effectId)) {
                const claim = effectClaim(ref.effectId, index);
                if (parked) { claim.outcomes.push({ bearer, skip: 'its bearer is Parked' }); continue; }
                if (axis.kind === 'finds') { claim.outcomes.push({ bearer, skip: UNSIZED.bonus }); continue; }
                if (consumable) { claim.outcomes.push({ bearer, unclear: 'a drink or potion\'s own always-on rule (not what it applies when drunk)' }); continue; }
                if (def.equipSlot === 'food') { claim.outcomes.push({ bearer, unclear: 'food\'s own boost: food is not one of the sources the rule sizes' }); continue; }
                claim.outcomes.push({ bearer, needs: def.type === 'tool' ? NEEDS.tool : NEEDS.gear });
            }
            if (!consumable) continue;
            for (const s of list(effects[ref.effectId]?.statements)) {
                if (s?.keyword !== 'applies' || !isWorkMoment(s?.when?.event)) continue;
                const appliedId = s.payload?.effectId;
                if (!effects[appliedId]) continue;
                const scale = wholeScale(ref.scale) * wholeScale(s.payload?.scale);
                for (const { statement, index, axis } of countedOf(appliedId)) {
                    const claim = effectClaim(appliedId, index);
                    if (parked) { claim.outcomes.push({ bearer, skip: 'its bearer is Parked' }); continue; }
                    const kind = kindOf(statement, axis, null, workspace);
                    rows.push(isObject(kind) ? { claim, ...kind } : { claim, kind, scale });
                }
            }
        }
        if (!rows.length) continue;
        let tier = tierOrNull(def.plan?.tier);
        if (tier === null && tierOf) {
            tier = tierOrNull(tierOf('item', itemId));
            if (tier !== null) tiersFromLedger++;
        }
        if (tier === null) {
            for (const r of rows) r.claim.outcomes.push({ bearer, unclear: 'a consumable with no tier: its plan names none and the ledger reaches it at none' });
            continue;
        }
        const row = rowAt(tier);
        settle(rows, bearer, 'consumable', (kind) => {
            if (kind === 'speed') return BOOST_RULE.consumable.speedShare * row.speed.maxed;
            if (kind === 'xp') return BOOST_RULE.consumable.xpShare * row.xp.maxed;
            if (kind === 'yield') return consumableYieldAt(tier);
            if (kind === 'rare') return tier >= BOOST_RULE.consumable.rareLateTier ? BOOST_RULE.consumable.rareLate : BOOST_RULE.consumable.rare;
            return { unclear: `a consumable's ${KIND_TEXT[kind]}: the one consumable is sized for speed, XP, yield or rare finds` };
        }, { tier });
    }

    // ── Skill perks ─────────────────────────────────────────────────────────────────────────────
    // Speed: a quarter of the tier's speed total; yield the same slice five times over (+25 % where speed is 5 %).
    const PERK_SLICE = Object.freeze({ speed: 1, yield: BOOST_RULE.perkYieldPerSpeed });
    const perkTarget = (kind, level) => PERK_SLICE[kind] * BOOST_RULE.perkShare * rowAt(tierAtLevel(level)).speed.maxed;
    for (const [skill, table] of Object.entries(workspace?.skillPerks || {})) {
        const byKind = { speed: [], yield: [] };
        for (const perk of list(table?.perks)) {
            if (!effects[perk.effectId]) continue;
            const bearer = `${skill} perk at level ${perk.level} (${perk.effectId})`;
            const rows = countedOf(perk.effectId).map(({ statement, index, axis }) => {
                const kind = kindOf(statement, axis, null, workspace);
                const claim = effectClaim(perk.effectId, index);
                return isObject(kind) ? { claim, ...kind } : { claim, kind, scale: wholeScale(perk.scale) };
            });
            const kinds = new Set(rows.filter((r) => typeof r.kind === 'string').map((r) => r.kind));
            const only = kinds.size === 1 ? [...kinds][0] : null;
            if (byKind[only]) byKind[only].push({ perk, bearer, rows });
            else if (only === 'xp') for (const r of rows) r.claim.outcomes.push(r.skip ? { bearer, skip: r.skip } : r.unclear ? { bearer, unclear: r.unclear } : { bearer, needs: NEEDS.xpPerk });
            else settle(rows, bearer, 'perk', (kind) => ({ unclear: `a perk's ${KIND_TEXT[kind]}: skill perks are sized in speed and yield` }));
        }
        // Perk by perk, to the kind's slice of the speed total of the tier each perk's level falls in; perks in one tier share its step.
        for (const [kind, perks] of Object.entries(byKind)) {
            perks.sort((a, b) => a.perk.level - b.perk.level);
            let reached = 0;
            for (let i = 0; i < perks.length;) {
                const tier = tierAtLevel(perks[i].perk.level);
                const row = rowAt(tier);
                const group = perks.filter((p) => rowAt(tierAtLevel(p.perk.level)) === row);
                const target = perkTarget(kind, perks[i].perk.level);
                const each = (target - reached) / group.length;
                for (const p of group) {
                    settle(p.rows, p.bearer, 'perk', () => (each > 0 ? each : { unclear: `no room left: the perks before it already reach ${tierLabel(tier)}'s ${KIND_TEXT[kind]} slice` }));
                }
                reached = Math.max(reached, target);
                i += group.length;
            }
            const full = PERK_SLICE[kind] * BOOST_RULE.perkShare * top.speed.maxed;
            if (perks.length && reached < full - 1e-9) notes.push(`${skill}'s ${KIND_TEXT[kind]} perks reach ${round(reached, 2)} % of the ${round(full, 2)} % by darkmetal: more perk levels would carry the rest (for the content session).`);
        }
    }

    // ── Guild Hall stars ────────────────────────────────────────────────────────────────────────
    for (const [starId, star] of Object.entries(workspace?.hallStars || {})) {
        const ranks = list(star?.ranks);
        const bearer = `${star?.name || starId} (hallStar ${starId})`;
        const rows = [];
        ranks.forEach((rank, r) => {
            list(rank?.rules).forEach((statement, j) => {
                const axis = axisOf(statement);
                if (!axis) return;
                const claim = claimOf(`hallStar:${starId}#${r}#${j}`, () => ({
                    kind: 'hallStar', id: starId, rank: r, rule: j, name: star?.name || starId, statement,
                    where: `hallStar ${starId} rank ${r + 1} rule ${j + 1}`,
                }));
                const kind = kindOf(statement, axis, null, workspace);
                rows.push(isObject(kind) ? { claim, ...kind } : { claim, kind, step: (r + 1) / ranks.length });
            });
        });
        settle(rows, bearer, 'hall', (kind, row) => (kind === 'coin' ? { unclear: 'a star cannot carry coin find' } : BOOST_RULE.hallStar * row.step));
    }

    // ── Settle each statement over its bearers ──────────────────────────────────────────────────
    const filled = [];
    const unclear = [];
    const skipped = [];
    const needsEffect = [];
    const at = (c) => ({ where: c.where, name: c.name, kind: c.kind, id: c.id, axis: c.statement?.payload?.type, current: c.statement?.payload?.value });
    // Effects nothing carries (or only an enemy's kinds list): skipped, so the counts cover every counted statement.
    for (const effectId of Object.keys(effects)) {
        for (const { index } of countedOf(effectId)) {
            const c = effectClaim(effectId, index);
            if (!c.outcomes.length) c.outcomes.push({ bearer: null, skip: 'no bearer carries it' });
        }
    }
    const writes = new Map();
    for (const c of claims.values()) {
        const axis = axisOf(c.statement);
        const sized = c.outcomes.filter((o) => 'value' in o);
        const unsure = c.outcomes.filter((o) => o.unclear);
        const bearers = [...new Set(c.outcomes.map((o) => o.bearer).filter(Boolean))];
        const needs = c.outcomes.filter((o) => o.needs);
        if (needs.length && !sized.length && !unsure.length) {
            needsEffect.push({ ...at(c), bearers, reason: [...new Set(needs.map((o) => o.needs))].join('; ') });
            continue;
        }
        if (needs.length) unsure.push(...needs.map((o) => ({ ...o, unclear: `shared with ${o.bearer}, which needs another effect` })));
        if (!sized.length && !unsure.length) {
            skipped.push({ ...at(c), bearers, reason: [...new Set(c.outcomes.map((o) => o.skip))].join('; ') });
            continue;
        }
        if (unsure.length) {
            const reasons = [...new Set(unsure.map((o) => o.unclear))];
            const shared = sized.length ? `; shared with ${sized.map((o) => `${o.bearer} (${SOURCE_TEXT[o.source]}, ${shown(axis, o.value)})`).join(', ')}` : '';
            unclear.push({ ...at(c), bearers, reason: `${reasons.join('; ')}${shared}` });
            continue;
        }
        const bases = [...new Set(sized.map((o) => o.base))];
        if (bases.length > 1) {
            unclear.push({ ...at(c), bearers, reason: `shared by bearers the rule sizes differently: ${sized.map((o) => `${o.bearer} ${shown(axis, o.value)}${o.tier !== undefined ? ` (${tierLabel(o.tier)})` : ''}`).join(', ')}` });
            continue;
        }
        const to = bases[0];
        const sources = [...new Set(sized.map((o) => SOURCE_TEXT[o.source]))];
        const kinds = [...new Set(sized.map((o) => KIND_TEXT[o.kind]))];
        const scales = [...new Set(sized.map((o) => o.scale))];
        filled.push({ ...at(c), bearers, source: sources.join(', '), boost: kinds.join(', '), from: c.statement.payload.value, to, scales, label: axis.label });
        if (to !== c.statement.payload.value) {
            const key = `${c.kind}:${c.id}`;
            if (!writes.has(key)) writes.set(key, { kind: c.kind, id: c.id, name: c.name, changes: [] });
            writes.get(key).changes.push({ c, to, line: `${axis.label} ${shown(axis, c.statement.payload.value)} → ${shown(axis, to)}${c.kind === 'hallStar' ? ` at rank ${c.rank + 1}` : ''} (${sources.join(', ')}${scales.some((s) => s > 1) ? `, a step at scale ${scales.join('/')}` : ''})` });
        }
    }

    const entries = [];
    for (const w of writes.values()) {
        const current = currentValue(workspace, w.kind, w.id);
        const value = JSON.parse(JSON.stringify(current));
        for (const { c, to } of w.changes) {
            const statement = w.kind === 'effect' ? value.statements[c.index] : value.ranks[c.rank].rules[c.rule];
            statement.payload.value = to;
        }
        if (value.id === undefined) value.id = w.id;
        entries.push({
            op: 'edit', kind: w.kind, id: w.id, value, fingerprint: fingerprint(current),
            note: `${w.name}: ${w.changes.map((x) => x.line).join('; ')}. The boost budget's size for its source (BALANCE_RULES section 5); only the number moves.`,
        });
    }

    const pack = entries.length ? {
        format: PACK_FORMAT,
        version: PACK_VERSION,
        id,
        createdAt,
        asked: asked || 'Every boost sized by its source, by the owner\'s boost budget of 2026-11-26 (T-736).',
        entries,
    } : null;
    const tierSource = `an item's tier is its plan's tier${tierOf ? `, else the tier the ledger first reaches it at (${tiersFromLedger} so)` : ''}; tier totals are the Maxed cells of the boost budget's row for that tier`;
    return { pack, filled, unclear, skipped, needsEffect, notes, tierSource };
}

/** A list of the writer's rows as text lines. */
export function boostLines(rows, { written = false } = {}) {
    if (!rows.length) return ['Nothing.'];
    return rows.map((r) => {
        const who = r.bearers?.length ? ` [${r.bearers.join('; ')}]` : '';
        if (written) return `- ${r.name} (${r.where}): ${r.label} ${r.from} → ${r.to}, ${r.source}${who}`;
        return `- ${r.name} (${r.where}, ${r.axis}${r.current === undefined ? '' : ` ${r.current}`}): ${r.reason}${who}`;
    });
}
