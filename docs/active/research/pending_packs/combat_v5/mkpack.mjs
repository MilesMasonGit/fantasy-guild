// Brief 280 V5: build the combat content pack from the current records (data/, or --from <workspace.json>).
// Usage: node mkpack.mjs [--from ws.json] [--chief-hit N] > out ; writes v5/<id>.json
import fs from 'fs';
import path from 'path';

const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/c2';
const { workspaceFromDataFiles, currentValue } = await import('file:///' + WT + '/cms/src/engine/changePacks.js');
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i === -1 ? d : args[i + 1]; };
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const data = path.join(WT, 'data');
const opt = (n, fb) => (fs.existsSync(path.join(data, n)) ? rd(path.join(data, n)) : fb);
const ws = argOf('--from') ? rd(argOf('--from')) : workspaceFromDataFiles({
    items: rd(path.join(data, 'items.json')), tokens: rd(path.join(data, 'tokens.json')), effects: opt('effects.json', {}),
    tokenRecipes: opt('tokenRecipes.json', []), starterCamp: opt('starterCamp.json', null), skillPerks: opt('skillPerks.json', null), plan: null
});
const CHIEF_HIT = argOf('--chief-hit', null);
const CHIEF_LEVEL = Number(argOf('--chief-level', 12));

const clone = (v) => JSON.parse(JSON.stringify(v));
const entries = [];
const edit = (kind, id, patch, note) => {
    const cur = currentValue(ws, kind, id);
    if (!cur) throw new Error('missing ' + kind + ' ' + id);
    const value = clone(cur);
    patch(value);
    entries.push({ op: 'edit', kind, id, value, note });
};
const create = (kind, id, value, note, placeholderArt) => {
    if (currentValue(ws, kind, id)) throw new Error('exists ' + kind + ' ' + id);
    entries.push({ op: 'create', kind, id, value: { ...value, id }, note, ...(placeholderArt ? { placeholderArt: true } : {}) });
};
const del = (kind, id, note) => {
    if (!currentValue(ws, kind, id)) throw new Error('missing ' + kind + ' ' + id);
    entries.push({ op: 'delete', kind, id, note });
};
const provides = (id, type, value, category) => ({
    id, keyword: 'provides', payload: { type, bucket: 'flat', value, ...(category ? { category } : {}) },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'nearby', target: null, when: null, upkeep: null
});

// ---- Effects ----------------------------------------------------------------------------------
create('effect', 'effect_sunder', {
    name: 'Sunder', autoSyncId: true, status: { stacks: 3, ticks: 0 },
    statements: [{ ...provides('stm_v5_sunder', 'SUNDER', 10), to: null }]
}, 'Sunder (brief 280): a status, up to 3 stacks, lasts the fight; each stack takes 10 off every resistance its bearer has, never below 0. Landed by the Iron Bodkin Arrow.');
create('effect', 'effect_sundering', {
    name: 'Sundering', autoSyncId: true,
    statements: [{
        id: 'stm_v5_sundering', keyword: 'applies',
        payload: { effectId: 'effect_sunder', scale: 1, durationMs: 0, chance: 100 },
        chargeDelta: 0, to: null, reach: null, target: { role: 'opponent' },
        when: { scope: 'self', event: 'FIGHT_HIT', every: 1 }, upkeep: null
    }]
}, 'Sundering: On Hit, applies Sunder to the enemy. On an arrow it counts only on the shot that spends that arrow.');
create('effect', 'effect_flutter', {
    name: 'Flutter', autoSyncId: true,
    statements: [{ ...provides('stm_v5_flutter', 'TYPE_RESIST', 50, 'physical'), to: null }]
}, 'Flutter (the owner\'s chicken): +50 % Physical resistance. The Bee and the Queen Bee land it on themselves for one attack.');
edit('effect', 'effect_ironskin', (v) => {
    v.statements = [provides('stm_v5_ironskin_physical', 'TYPE_RESIST', 20, 'physical')];
}, 'Ironskin (the Elixir of Ironskin, for the fight): Physical resistance 20 % in place of the retired Armor 1.');
for (const id of ['effect_leather_armour', 'effect_copper_armour', 'effect_iron_armour']) {
    del('effect', id, 'Its only rule was the retired Armor 1; the armour pieces carry Defence lines now, and nothing else names it.');
}

// ---- Weapons ----------------------------------------------------------------------------------
const WEAPONS = {
    item_copper_sword: ['slash', 'Swords are Slash at every metal (starter table).'],
    item_iron_sword: ['slash', 'Swords are Slash at every metal (starter table).'],
    item_copper_cleaver: ['slash', 'Cleavers are Slash (starter table).'],
    item_iron_cleaver: ['slash', 'Cleavers are Slash (starter table).'],
    item_copper_greatsword: ['crush', 'Greatswords are Crush while there is no Mace (starter table).'],
    item_iron_greatsword: ['crush', 'Greatswords are Crush while there is no Mace (starter table).'],
    item_copper_dagger: ['stab', 'Daggers are Stab (starter table); one style, Stealth, in place of Melee and Stealth (a weapon has one style; it fought as Melee, the first).'],
    item_iron_dagger: ['stab', 'Daggers are Stab (starter table); one style, Stealth, in place of Melee and Stealth (a weapon has one style; it fought as Melee, the first).'],
    item_copper_bow: ['electric', 'The bow\'s part of a shot is Electric (bows carry an Elemental or Special type, arrows a Physical one); the same type at every metal. Electric had no weapon.'],
    item_iron_bow: ['electric', 'The bow\'s part of a shot is Electric, as the Copper Bow (type from the family, never the tier).'],
    item_copper_wand: ['fire', 'Copper Wand Fire (starter table).'],
    item_iron_wand: ['ice', 'Iron Wand Ice (starter table): answers the Fire Elementals (weak to Ice).']
};
for (const [id, [type, note]] of Object.entries(WEAPONS)) {
    edit('item', id, (v) => {
        v.damageType = type;
        if (/dagger/.test(id)) v.styles = ['stealth'];
    }, note);
}

// ---- Armour: Defence blocks in place of the Armor rows ---------------------------------------
const ARMOUR = {
    item_leather_hat: [{ physical: 5, elemental: 10 }, { magic: 5 }, 'Leather leans Elemental: Physical 5 %, Elemental 10 %; Magic damage −5 %.'],
    item_leather_chest: [{ physical: 10, elemental: 10 }, { magic: 10 }, 'Leather leans Elemental: Physical 10 %, Elemental 10 %; Magic damage −10 %.'],
    item_copper_helmet: [{ physical: 10 }, { magic: 15, stealth: 5 }, 'Metal resists Physical: 10 %; Magic damage −15 %, Stealth −5 %.'],
    item_copper_chestplate: [{ physical: 15 }, { magic: 20, stealth: 10 }, 'Metal resists Physical: 15 %; Magic damage −20 %, Stealth −10 %.'],
    item_iron_helmet: [{ physical: 15 }, { magic: 20, stealth: 10 }, 'Iron resists Physical: 15 %; Magic damage −20 %, Stealth −10 %.'],
    item_iron_chestplate: [{ physical: 20 }, { magic: 30, stealth: 15 }, 'The concept\'s own example: Physical 20 %; Magic damage −30 %, Stealth −15 %.']
};
for (const [id, [resistances, damageCut, note]] of Object.entries(ARMOUR)) {
    edit('item', id, (v) => {
        v.resistances = resistances;
        v.damageCut = damageCut;
        delete v.effects;
    }, note + ' Replaces the retired Armor 1 rule.');
}

// ---- New items: arrows and a shield ----------------------------------------------------------
create('item', 'item_copper_arrow', {
    name: 'Copper Arrow', description: '', type: 'material', sprite: 'i_arrow', stackable: true, restoreAmount: 0,
    equipSlot: 'consumable', value: null, valueSource: null, autoSyncId: true,
    arrow: { damage: 1, damageType: 'stab' }, tags: ['Arrow', 'Ammo'],
    plan: { status: 'draft', note: 'No recipe yet: arrows wait for Fletching (concept_combat_v2).' }
}, 'The first arrow: carried in a consumable cell by a bow hero, one spent a shot, adding 1 Stab to the bow\'s Electric. No recipe: the concept names Fletching as the maker, and no Fletching station or recipe exists yet.');
create('item', 'item_iron_bodkin_arrow', {
    name: 'Iron Bodkin Arrow', description: '', type: 'material', sprite: 'i_arrow', stackable: true, restoreAmount: 0,
    equipSlot: 'consumable', value: null, valueSource: null, autoSyncId: true,
    arrow: { damage: 1, damageType: 'stab' }, effects: [{ effectId: 'effect_sundering', scale: 1 }], tags: ['Arrow', 'Ammo'],
    plan: { status: 'draft', note: 'No recipe yet: arrows wait for Fletching (concept_combat_v2).' }
}, 'A sundering arrow (the concept: some arrows carry Sunder): 1 Stab, and every hit it lands applies Sunder to the enemy. No recipe yet (Fletching).', true);
create('item', 'item_copper_shield', {
    name: 'Copper Shield', description: '', type: 'armor', sprite: 'i_armor_plate_copper', stackable: true, restoreAmount: 0,
    equipSlot: 'hand', offHand: true, value: null, valueSource: null, autoSyncId: true,
    resistances: { physical: 10 }, damageCut: { magic: 10, stealth: 10 }, tags: ['Armour', 'Shield']
}, 'The first shield, Held as an off-hand item: acts like a piece of body armour beside a one-handed weapon. Physical 10 %; Magic and Stealth damage −10 %.', true);
create('recipe', 'recipe_copper_shield', {
    name: 'Copper Shield', skill: 'smithing', levelRequirement: 6, requiresContext: [], stationChargeCost: 1,
    inputs: [{ itemId: 'item_copper_ingot', quantity: 2 }, { itemId: 'item_oak_wood', quantity: 2 }],
    outputs: [{ itemId: 'item_copper_shield', chance: 100, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: false }],
    durationMs: 17000, xp: 2, stationKinds: ['smithy'], sim: { tempo: 'medium', purpose: 'iph' }
}, 'The Copper Shield at the copper smithy, beside the helmet (Smithing 6: 2 Copper Ingot, 2 Oak Wood).');

// ---- Enemies -----------------------------------------------------------------------------------
const M = (name, damageType, extra = {}) => ({ name, damageType, ...extra });
const FLUTTER = { name: 'Flutter', hits: false, effectId: 'effect_flutter', target: 'self', lasts: 'attack' };
const ENEMIES = {
    token_thorn_elemental: [{ fire: -50 }, [M('Lash', 'slash'), M('Prick', 'stab')], 'A plant: weak to Fire 50 %. Lash (Slash), Prick (Stab).'],
    token_cow: [null, [M('Headbutt', 'crush'), M('Kick', 'crush')], 'No resistances (starter table). Headbutt and Kick (Crush).'],
    token_goblin: [null, [M('Shiv', 'stab'), M('Club', 'crush')], 'No resistances (starter table). Shiv (Stab), Club (Crush).'],
    token_goblin_chief: [null, [M('Cleave', 'slash'), M('Bash', 'crush')], `Level 20 → ${CHIEF_LEVEL} (the ledger's L8: the sure Volcano map came above plane 2's own enemies)${CHIEF_HIT ? `, its hit 4 → ${CHIEF_HIT}` : ''}. Duel checks with 20 Shrimp: a Melee 8–10 hero in a copper sword, helmet and chestplate wins about 3 in 4, the same hero without armour about 1 in 7, a new hero in the copper set 1 in 10 (at level 20 all of them lost). No resistances. Cleave (Slash), Bash (Crush); Heavy Strike every 6th swing stays.`],
    token_wolf: [null, [M('Bite', 'stab'), M('Claw', 'slash')], 'No resistances. Bite (Stab), Claw (Slash).'],
    token_crab: [{ crush: -50, electric: -25 }, [M('Pinch', 'crush'), M('Snip', 'slash')], 'A shell: Armoured gives Physical 50 %; weak to Crush 50 % (starter table) and Electric 25 % (water). Pinch (Crush), Snip (Slash).'],
    token_bee: [{ fire: -25 }, [M('Sting', 'stab', { weight: 2 }), FLUTTER], 'Weak to Fire 25 % (smoke). Sting (Stab, twice as likely), Flutter (no hit: +50 % Physical resistance on itself for one attack).'],
    token_wolf_alpha: [null, [M('Bite', 'stab'), M('Maul', 'slash')], 'No resistances. Bite (Stab), Maul (Slash); Enrage below half stays.'],
    token_water_elemental: [{ fire: 50, electric: -50 }, [M('Crashing Wave', 'crush'), M('Frost Spray', 'ice')], 'Water: resists Fire 50 %, weak to Electric 50 %; Armoured gives Physical 50 %. Crashing Wave (Crush), Frost Spray (Ice).'],
    token_greater_slime: [{ poison: 50, fire: -25 }, [M('Engulf', 'crush'), M('Acid Spit', 'poison')], 'Resists Poison 50 %, weak to Fire 25 %; Armoured gives Physical 50 %. Engulf (Crush), Acid Spit (Poison); its Venom every 3rd hit stays.'],
    token_wind_elemental: [{ physical: 25 }, [M('Gust', 'crush'), M('Cutting Wind', 'slash')], 'Resists Physical 25 % (the starter table said 50: at 50 a level-12 hero of any style with copper gear and 20 Shrimp won at most 12 % of duels; at 25 a sword hero wins about 2 in 3). Gust (Crush), Cutting Wind (Slash).'],
    token_queen_bee: [{ fire: -25 }, [M('Sting', 'stab', { weight: 2 }), FLUTTER], 'Weak to Fire 25 %, as the Bee. Sting (Stab, twice as likely), Flutter; Venomous and Enrage stay.'],
    token_fire_elemental: [{ fire: 100, ice: -50 }, [M('Scorch', 'fire', { weight: 2 }), M('Slam', 'crush')], 'Immune to Fire, weak to Ice 50 % (starter table). Scorch (Fire, twice as likely), Slam (Crush): Physical armour alone does not answer it.'],
    token_sulphur_lizard: [{ fire: 50, ice: -25 }, [M('Bite', 'stab'), M('Sulphur Spit', 'fire')], 'Lives in the volcano: resists Fire 50 %, weak to Ice 25 %; Armoured gives Physical 50 %. Bite (Stab), Sulphur Spit (Fire).'],
    token_frog: [{ poison: 50, electric: -25 }, [M('Tongue Lash', 'crush'), M('Spit', 'poison')], 'Resists Poison 50 % (starter table), weak to Electric 25 % (water). Tongue Lash (Crush), Spit (Poison).'],
    token_fire_elemental_chief: [{ fire: 100, ice: -50 }, [M('Inferno', 'fire', { weight: 2 }), M('Slam', 'crush')], 'As the Fire Elemental: immune to Fire, weak to Ice 50 %. Inferno (Fire, twice as likely), Slam (Crush); Burn every 3rd hit stays.'],
    token_big_lizard: [{ fire: 50, ice: -25 }, [M('Bite', 'stab', { weight: 2 }), M('Tail Smash', 'crush', { effectId: 'effect_heavy_strike', target: 'self', lasts: 'swing' })], 'As the Sulphur Lizard: resists Fire 50 %, weak to Ice 25 %; Armoured gives Physical 50 %. Bite (Stab, twice as likely), Tail Smash (Crush, with Heavy Strike for that swing).'],
    token_toxic_frog: [{ poison: 100, electric: -25 }, [M('Tongue Lash', 'crush'), M('Toxic Spit', 'poison')], 'Immune to Poison, weak to Electric 25 %. Tongue Lash (Crush), Toxic Spit (Poison); Venomous stays.']
};
for (const [id, [res, moves, note]] of Object.entries(ENEMIES)) {
    edit('token', id, (v) => {
        if (res) v.enemy.resistances = res;
        v.enemy.moves = moves;
        if (id === 'token_goblin_chief') {
            v.enemy.level = CHIEF_LEVEL;
            if (CHIEF_HIT) v.enemy.hit = Number(CHIEF_HIT);
        }
    }, note);
}

const pack = {
    format: 'fantasy-guild-change-pack', version: 1,
    id: '2026-10-30-combat-v5-content',
    createdAt: new Date().toISOString(),
    asked: 'Combat v2 content (brief 280 V5): damage types on the weapons, resistances, weaknesses and moves on the enemies, a first arrow line, armour as resistances and trade-offs, a shield, Flutter and Sunder; the Goblin Chief to about level 12 (the ledger). Owner interview 2026-10-28.',
    entries
};
const out = argOf('--out') || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), pack.id + '.json');
fs.writeFileSync(out, JSON.stringify(pack, null, 2) + '\n');
const counts = {};
for (const e of entries) counts[`${e.op} ${e.kind}`] = (counts[`${e.op} ${e.kind}`] || 0) + 1;
console.log(out, entries.length, counts);
