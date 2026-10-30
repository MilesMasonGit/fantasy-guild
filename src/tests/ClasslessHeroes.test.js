import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as CombatFormulas from '../utils/CombatFormulas.js';
import { handleVictory } from '../systems/combat/CombatResolutionProcessor.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero, settleSkillSheet } from '../systems/hero/logic/HeroRehydration.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { canHeroEquip } from '../systems/equipment/EquipmentValidator.js';
import { equipItem } from '../systems/equipment/EquipmentManager.js';
import { loadoutRefs } from '../systems/hero/HeroEffects.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { getEnemyProfile } from '../config/registries/enemyProfile.js';
import {
    SKILLS, SKILL_LAYERS, STARTING_SKILL_IDS, COMBAT_SKILL_IDS, SPECIALIST_SKILL_IDS, HERO_SKILL_IDS,
    RETIRED_SKILL_IDS, getSkillIdsByLayer, isSkillId
} from '../config/registries/skillRegistry.js';
import { weaponStyleOf, authoredWeaponStyles, gearLevelRequirement, unmetGearRequirement } from '../config/registries/weaponStyles.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import { KEYWORD, KEYWORDS, getKeyword, statementsOf, statementsWith } from '../systems/effects/statements.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderStatement } from '../systems/effects/statementText.js';
import { xpForLevel } from '../utils/XPCurve.js';

/**
 * Classless heroes: every hero holds every skill from level 1, the weapon in their hands decides
 * the style they fight in (and the skill their kills train), barehanded is a Melee punch, gear asks
 * a level in its style, and max HP grows with the best combat skill. Older saves keep their
 * levels: banked skills come back, the job and cut skills are dropped.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

registerItems({
    k1_sword: { id: 'k1_sword', name: 'K1 Sword', type: 'weapon', equipSlot: 'hand', styles: ['melee'], damage: 2 },
    k1_bow: { id: 'k1_bow', name: 'K1 Bow', type: 'weapon', equipSlot: 'hand', styles: ['ranged'], damage: 2 },
    k1_dagger: { id: 'k1_dagger', name: 'K1 Dagger', type: 'weapon', equipSlot: 'hand', styles: ['stealth', 'melee'], damage: 1, speed: 'fast' },
    k1_club: { id: 'k1_club', name: 'K1 Club', type: 'weapon', equipSlot: 'hand', damage: 2 },
    k1_old_staff: { id: 'k1_old_staff', name: 'K1 Old Staff', type: 'weapon', equipSlot: 'hand', skillRequired: 'magic', damage: 2 },
    k1_iron_sword: { id: 'k1_iron_sword', name: 'K1 Iron Sword', type: 'weapon', equipSlot: 'hand', styles: ['melee'], damage: 3, levelRequired: 15 },
    k1_iron_helm: { id: 'k1_iron_helm', name: 'K1 Iron Helm', type: 'armor', equipSlot: 'hat', skillRequired: 'melee', levelRequired: 15 },
    k1_merchant_ring: { id: 'k1_merchant_ring', name: 'K1 Ring', type: 'armor', equipSlot: 'trinket', requirements: [{ skill: 'commerce', level: 5 }] }
});

const enemy = () => getEnemyProfile('fixture_enemy');

/** A new hero on the roster, `skills` set at their levels. */
function hero(skills = {}, equipment = []) {
    const h = generateHero({ name: 'Ana' });
    h.id = `hero_${Object.keys(GameState.state.heroes).length}`;
    for (const [id, level] of Object.entries(skills)) h.skills[id] = { level, xp: xpForLevel(level) };
    h.equipment = [...equipment, ...Array(9 - equipment.length).fill(null)];
    GameState.state.heroes.push(h);
    rehydrateHero(h);
    return h;
}

function win(h) {
    const fight = { id: 'f', combat: { state: {} }, drops: [] };
    handleVictory(fight, h, enemy(), h.id, [h.id]);
}

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.rosterLimit = 8;
});

describe('the skills: 9 Starting, 4 combat, 7 specialist', () => {
    it('has twenty skills in three layers', () => {
        expect(Object.values(SKILL_LAYERS)).toEqual(['starting', 'combat', 'specialist']);
        expect(STARTING_SKILL_IDS).toHaveLength(9);
        expect(COMBAT_SKILL_IDS).toEqual(['melee', 'ranged', 'magic', 'stealth']);
        expect(SPECIALIST_SKILL_IDS).toEqual(['fletching', 'faith', 'summoning', 'enchanting', 'crime', 'taming', 'science']);
        expect(HERO_SKILL_IDS).toHaveLength(20);
        expect(Object.keys(SKILLS)).toHaveLength(20);
        expect(getSkillIdsByLayer(SKILL_LAYERS.SPECIALIST)).toEqual(SPECIALIST_SKILL_IDS);
    });

    it('the five cut skills are gone', () => {
        expect(RETIRED_SKILL_IDS).toEqual(['leadership', 'commerce', 'trapping', 'armory', 'shadowcraft']);
        for (const id of RETIRED_SKILL_IDS) expect(isSkillId(id), id).toBe(false);
    });
});

describe('a new hero holds every skill from level 1', () => {
    it('all twenty at level 1, no job, and 11 HP', () => {
        const h = generateHero({ name: 'Ana' });
        expect(Object.keys(h.skills).sort()).toEqual([...HERO_SKILL_IDS].sort());
        for (const id of HERO_SKILL_IDS) expect(h.skills[id], id).toEqual({ level: 1, xp: 0 });
        expect(h).not.toHaveProperty('jobId');
        expect(h.hp).toEqual({ current: 11, max: 11 });
    });

    it('carries no Recruit title once on the roster', () => {
        const h = hero();
        expect(h).not.toHaveProperty('className');
    });
});

describe('the weapon decides the style', () => {
    it('reads one style per weapon: a list of two reads its first, none reads Melee', () => {
        expect(weaponStyleOf({ equipSlot: 'hand', styles: ['ranged'] })).toBe('ranged');
        expect(weaponStyleOf({ equipSlot: 'hand', styles: ['stealth', 'melee'] })).toBe('stealth');
        expect(weaponStyleOf({ equipSlot: 'hand', styles: ['melee', 'stealth'] })).toBe('melee');
        expect(weaponStyleOf({ equipSlot: 'hand' })).toBe('melee');
        expect(weaponStyleOf({ equipSlot: 'hand', skillRequired: 'magic' })).toBe('magic');
        expect(authoredWeaponStyles({ equipSlot: 'hand', styles: ['melee', 'nope', 'stealth'] })).toEqual(['melee', 'stealth']);
        expect(weaponStyleOf({ equipSlot: 'hat', styles: ['melee'] })).toBeNull();
        expect(weaponStyleOf({ equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 1 } })).toBeNull();
    });

    it('a sword fights Melee at the Melee level; a bow Ranged at the Ranged level', () => {
        const h = hero({ melee: 20, ranged: 5 }, ['k1_sword']);
        expect(CombatFormulas.getHeroCombatSkillEntry(h)).toEqual({ id: 'melee', level: 20 });
        h.equipment[0] = 'k1_bow';
        expect(CombatFormulas.getHeroCombatSkillEntry(h)).toEqual({ id: 'ranged', level: 5 });
        expect(CombatFormulas.getHeroCombatLevel(h)).toBe(5);
    });

    it('barehanded is a Melee punch: 1 + the Melee level step, every 3 s', () => {
        const h = hero({ melee: 40, magic: 80 });
        expect(CombatFormulas.getHeroCombatStyle(h)).toBe('melee');
        expect(CombatFormulas.getHeroCombatLevel(h)).toBe(40);
        expect(CombatFormulas.heroBaseDamage(h)).toBe(1 + 2);
        expect(CombatFormulas.heroAttackSpeedMs(h)).toBe(3000);
    });

    it('older content: a weapon naming no style is Melee, an old skillRequired style is read', () => {
        expect(CombatFormulas.getHeroCombatStyle(hero({}, ['k1_club']))).toBe('melee');
        expect(CombatFormulas.getHeroCombatStyle(hero({}, ['k1_old_staff']))).toBe('magic');
        expect(CombatFormulas.getHeroCombatStyle(hero({}, ['k1_dagger']))).toBe('stealth');
    });

    it('the matchup follows the weapon: a bow is weak against the melee enemy, a sword even', () => {
        const h = hero({ melee: 1, ranged: 1 }, ['k1_bow']);
        // 2 × 0.75 = 1.5, rounded halves up: 2. The enemy's 1 against ranged: 1 × 1.25 = 1.25 → 1.
        expect(CombatFormulas.heroHitDamage(h, { ...enemy(), combatType: 'magic' })).toBe(3);
        expect(CombatFormulas.heroHitDamage(h, { ...enemy(), combatType: 'melee', armor: 0 })).toBe(2);
        h.equipment[0] = 'k1_sword';
        expect(CombatFormulas.heroHitDamage(h, { ...enemy(), combatType: 'magic', armor: 0 })).toBe(2);
    });
});

describe('kills train the style fought in', () => {
    it('a sword kill is Melee XP, a bow kill Ranged XP, a punch Melee XP', () => {
        const h = hero({}, ['k1_sword']);
        const award = CombatFormulas.getCombatXpAward(enemy());
        win(h);
        expect(h.skills.melee.xp).toBe(award);
        expect(h.skills.ranged.xp).toBe(0);
        h.equipment[0] = 'k1_bow';
        win(h);
        expect(h.skills.ranged.xp).toBe(award);
        expect(h.skills.melee.xp).toBe(award);
        h.equipment[0] = null;
        win(h);
        expect(h.skills.melee.xp).toBe(2 * award);
        for (const id of [...STARTING_SKILL_IDS, ...SPECIALIST_SKILL_IDS, 'magic', 'stealth']) expect(h.skills[id].xp, id).toBe(0);
    });
});

describe('max HP = 10 + the best combat skill', () => {
    it('reads the highest of the four, whatever is in the hands', () => {
        const h = hero({ melee: 5, ranged: 30, mining: 80 }, ['k1_sword']);
        expect(h.hp.max).toBe(40);
        h.equipment[0] = 'k1_bow';
        HeroManager.updateHeroFromSkills(h);
        expect(h.hp.max).toBe(40);
        expect(CombatFormulas.heroMaxHpFromSkills({ magic: { level: 99 } })).toBe(109);
        expect(CombatFormulas.heroMaxHpFromSkills({})).toBe(10);
    });
});

describe('gear asks a level in its style', () => {
    it('a weapon names its own style; armour the style it says', () => {
        expect(gearLevelRequirement({ equipSlot: 'hand', styles: ['ranged'], levelRequired: 15 })).toEqual({ skill: 'ranged', level: 15 });
        expect(gearLevelRequirement({ equipSlot: 'chest', skillRequired: 'magic', levelRequired: 30 })).toEqual({ skill: 'magic', level: 30 });
        expect(gearLevelRequirement({ equipSlot: 'chest', levelRequired: 30 })).toBeNull();
        expect(gearLevelRequirement({ equipSlot: 'hand', styles: ['melee'] })).toBeNull();
    });

    it('refuses an Iron Sword below Melee 15 with "Needs Melee 15", and takes it at 15', () => {
        const low = hero({ melee: 14 });
        expect(canHeroEquip(low.id, 'k1_iron_sword')).toEqual({ canEquip: false, reason: 'Needs Melee 15' });
        const able = hero({ melee: 15 });
        expect(canHeroEquip(able.id, 'k1_iron_sword')).toEqual({ canEquip: true });
    });

    it('the refusal reaches the equip and nothing moves', () => {
        const h = hero();
        InventoryManager.addItem('k1_iron_sword', 1);
        const result = equipItem(h.id, 'k1_iron_sword');
        expect(result).toMatchObject({ success: false, error: 'Needs Melee 15' });
        expect(h.equipment.filter(Boolean)).toEqual([]);
        expect(InventoryManager.getItemCount('k1_iron_sword')).toBe(1);
    });

    it('armour names its style: an Iron Helm needs Melee 15', () => {
        expect(canHeroEquip(hero({ melee: 3, magic: 60 }).id, 'k1_iron_helm')).toEqual({ canEquip: false, reason: 'Needs Melee 15' });
    });

    it('a requirement in a cut skill can never be met, and keeps its raw id', () => {
        expect(canHeroEquip(hero().id, 'k1_merchant_ring')).toEqual({ canEquip: false, reason: 'Needs commerce 5' });
        expect(unmetGearRequirement({ requirements: [{ skill: 'commerce', level: 5 }] }, { skills: {} })).toEqual({ skill: 'commerce', level: 5, have: 0 });
    });

    it('a weapon held below its requirement (an older save) is not swung, and lends nothing', () => {
        const h = hero({ melee: 5 }, ['k1_iron_sword']);
        expect(CombatFormulas.getHeroWeapon(h)).toBeNull();
        expect(CombatFormulas.heroBaseDamage(h)).toBe(1);
        expect(loadoutRefs(h).size).toBe(0);
        h.skills.melee = { level: 15, xp: xpForLevel(15) };
        expect(CombatFormulas.getHeroWeapon(h)?.id).toBe('k1_iron_sword');
    });
});

describe('an older save keeps every level', () => {
    /** A Knight as the class rework saved one: a job, class skills, banked skills, a cut skill. */
    const knight = () => ({
        id: 'hero_old_knight', name: 'Sir Old', jobId: 'knight', className: 'Recruit',
        hp: { current: 35, max: 35 }, status: 'idle', equipment: [],
        skills: {
            ...Object.fromEntries(STARTING_SKILL_IDS.map(id => [id, { level: 12, xp: xpForLevel(12) }])),
            melee: { level: 25, xp: xpForLevel(25) },
            fletching: { level: 18, xp: xpForLevel(18) + 7 },
            leadership: { level: 30, xp: xpForLevel(30) },
            armory: { level: 9, xp: xpForLevel(9) }
        },
        bankedSkills: {
            magic: { level: 33, xp: xpForLevel(33) },
            enchanting: { level: 7, xp: xpForLevel(7) },
            commerce: { level: 40, xp: xpForLevel(40) },
            melee: { level: 3, xp: xpForLevel(3) }
        }
    });

    it('keeps held levels, brings banked ones back, drops the job and the cut skills', () => {
        const h = knight();
        const result = settleSkillSheet(h);
        expect(Object.keys(h.skills).sort()).toEqual([...HERO_SKILL_IDS].sort());
        expect(h.skills.melee).toEqual({ level: 25, xp: xpForLevel(25) });
        expect(h.skills.fletching).toEqual({ level: 18, xp: xpForLevel(18) + 7 });
        expect(h.skills.magic.level).toBe(33);
        expect(h.skills.enchanting.level).toBe(7);
        expect(h.skills.mining.level).toBe(12);
        expect(h.skills.ranged).toEqual({ level: 1, xp: 0 });
        expect(h).not.toHaveProperty('jobId');
        expect(h).not.toHaveProperty('bankedSkills');
        expect(result.restored.sort()).toEqual(['enchanting', 'magic']);
        expect(result.dropped.sort()).toEqual(['armory', 'leadership']);
    });

    it('on load: no title, and HP from the best combat skill (a banked Magic 33 counts)', () => {
        const h = knight();
        GameState.state.heroes.push(h);
        rehydrateHero(h);
        expect(h).not.toHaveProperty('className');
        expect(h.hp).toEqual({ current: 35, max: 43 });
    });

    it('settles a hero twice to the same sheet', () => {
        const h = knight();
        settleSkillSheet(h);
        const once = JSON.stringify(h.skills);
        expect(settleSkillSheet(h)).toEqual({ restored: [], dropped: [], added: [] });
        expect(JSON.stringify(h.skills)).toBe(once);
    });

    it('drops only the cut skills: a skill it does not know (a test fixture’s) stays', () => {
        const h = { id: 'h', skills: { fixture_skill: { level: 4, xp: 0 }, trapping: { level: 2, xp: 0 } } };
        settleSkillSheet(h);
        expect(h.skills.fixture_skill).toEqual({ level: 4, xp: 0 });
        expect(h.skills).not.toHaveProperty('trapping');
    });

    it('leaves a villager alone', () => {
        const v = { id: 'v', isVillager: true, skills: { leadership: { level: 3 } }, jobId: 'recruit' };
        settleSkillSheet(v);
        expect(v.skills).toEqual({ leadership: { level: 3 } });
        expect(v.jobId).toBe('recruit');
    });
});

describe('the audits name what K1 retired', () => {
    const tokens = {
        academy: {
            id: 'academy', name: 'Old Academy',
            statements: [{ id: 's1', keyword: KEYWORD.PROMOTES, payload: { jobId: 'fighter' } }]
        },
        market: { id: 'market', name: 'Old Market', config: { skill: 'commerce' } }
    };
    const items = {
        dagger: { id: 'dagger', name: 'Old Dagger', equipSlot: 'hand', styles: ['melee', 'stealth'] },
        sword: { id: 'sword', name: 'Sword', equipSlot: 'hand', styles: ['melee'] }
    };
    const found = findUnknownRefs({ tokens, items, recipes: {} });
    const on = (id) => found.filter(f => f.entityId === id).map(f => f.message);

    it('a Promotes rule does nothing now', () => {
        expect(on('academy')).toEqual([expect.stringMatching(/jobs are retired/)]);
    });

    it('a Token worked with a cut skill can be worked by nobody', () => {
        expect(on('market')).toEqual([expect.stringMatching(/"commerce", which does not exist/)]);
    });

    it('a weapon naming two styles fights in its first', () => {
        expect(on('dagger')).toEqual([expect.stringMatching(/names 2 styles; a weapon has one, so it fights as Melee/)]);
        expect(on('sword')).toEqual([]);
    });
});

describe('the Promotes rule is retired', () => {
    it('stays readable as it was (so a Sync rewrites no description), and is marked retired', () => {
        expect(getKeyword(KEYWORD.PROMOTES)).toMatchObject({ retired: true });
        expect(KEYWORDS.filter(k => k.retired).map(k => k.id)).toEqual([KEYWORD.PROMOTES]);
        expect(renderStatement({ keyword: KEYWORD.PROMOTES, payload: { jobId: 'fighter' } })).toBe('Promotes the hero to Fighter.');
        expect(renderStatement({ keyword: KEYWORD.PROMOTES, payload: { jobId: 'not_a_job' } })).toBe('Promotes the hero to not_a_job.');
    });
});

describe('the shipped data', () => {
    const data = (file) => JSON.parse(readFileSync(join(process.cwd(), 'data', file), 'utf8'));
    const jobOf = (def) => statementsWith(def, KEYWORD.PROMOTES)[0]?.payload?.jobId ?? null;

    // The Academies are the owner's to delete in the CMS, so this reads whichever shipped Tokens
    // still carry the rule rather than naming them.
    it('each shipped Token with a Promotes rule loads as a retired promotion Token', () => {
        const tokens = data('tokens.json');
        const effects = data('effects.json');
        const promoting = Object.keys(tokens).filter((id) => jobOf(expandBearer(tokens[id], effects)));
        for (const id of promoting) {
            const def = getTokenType(id);
            const job = jobOf(def);
            expect(job, id).toBeTruthy();
            expect(deriveTokenType(def).type, id).toBe('promotion');
            expect(statementsOf(def).map((st) => renderStatement(st)), id).toEqual([`Promotes the hero to ${job[0].toUpperCase()}${job.slice(1)}.`]);
        }
    });
});
