import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import './fixtures/fixtureItems.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { xpForEveryoneOf } from '../systems/progression/hallModifiers.js';
import { hallRuleSentence, starAmount, starSentence } from '../systems/progression/hallStarText.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { HeroManager } from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, XP_FOR_EVERYONE_SOURCE } from '../systems/core/engineEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE, authoredStars, getUpgradeDef } from '../config/guildUpgrades.js';
import { HERO_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { levelFromXp, xpForLevel } from '../utils/XPCurve.js';
import { resetMatTuning } from '../config/matTuning.js';

/**
 * XP for Everyone (brief 620 E2): a Guild Hall star whose every rank bought gives every hero on the
 * roster XP in every skill, once, at the purchase; a hero who joins later arrives with the whole of
 * what the held ranks give. Like every star rank, rank r lists the star's whole gift so far, so a
 * purchase gives the difference and a recruit the held rank's figure; nothing is given on a load, a
 * re-read of the ranks or a travel. Its level-ups are said as ordinary level-ups (`HERO_LEVELED`),
 * hero by hero, with one level-up sound for the purchase.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const ORE = 'fixture_copper_ore';
const OAK = 'item_oak_wood';

let seq = 0;
const rule = (type, value, extra = {}) => ({
    id: `stm_xfe_${++seq}`, keyword: KEYWORD.PROVIDES,
    payload: { type, bucket: 'flat', value, ...extra },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'nearby', target: null, when: null, upkeep: null
});
const gift = (value) => rule(EFFECT_TYPES.XP_FOR_EVERYONE, value);
const rank = (rules, quantity = 5) => ({ tier: 1, price: [{ itemId: ORE, quantity }], rules, lines: [] });

/** Each rank lists the star's whole gift so far: 100, then 100 + 150, then 100 + 150 + 200. */
const PER_RANK = [100, 150, 200];
const TOTALS = [100, 250, 450];

function sky({ ranks = TOTALS.map(v => rank([gift(v)])) } = {}) {
    return {
        constellations: { hearth_x: { id: 'hearth_x', name: 'Hearth X', label: { x: 0, y: -1 } } },
        stars: {
            xp_all: { id: 'xp_all', constellation: 'hearth_x', name: 'Fresh Recruits', node: { x: 0, y: -0.7 }, links: [HALL_NODE], ranks },
            quick: { id: 'quick', constellation: 'hearth_x', name: 'Quick Hands', node: { x: 0.3, y: -0.7 }, links: [HALL_NODE], ranks: [
                rank([{ ...rule(EFFECT_TYPES.WORK_TIME, -0.1), payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.1 } }])
            ] }
        }
    };
}

/** A guild with `n` fresh heroes (every skill at level 1, no XP) and room for exactly them. */
function fresh(n = 3, theSky = sky()) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 200;
    registerHallSky(theSky);
    GameState.state.progress.guildUpgrades.roster_size = n;
    GuildUpgradeManager.recompute();
    for (let i = 0; i < n; i++) expect(HeroManager.addHero(generateHero({ name: `Hero ${i + 1}` }))).toBeTruthy();
    InventoryManager.addItem(ORE, 1000);
    InventoryManager.addItem(OAK, 1000);
}

/** Every hero's XP and level in every skill. */
const sheet = () => Object.fromEntries(GameState.heroes.map(h => [
    h.id, Object.fromEntries(Object.entries(h.skills).map(([id, s]) => [id, { xp: s.xp, level: s.level }]))
]));

/** Heard while `fn` runs: every level-up, and the level-up sounds asked for. */
function heard(fn) {
    const leveled = [];
    const sounds = [];
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, (d) => leveled.push(d)),
        EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, ({ clip } = {}) => { if (clip === 'levelup') sounds.push(clip); })
    ];
    try { fn(); } finally { offs.forEach(off => off()); }
    return { leveled, sounds };
}

/** A gift's level events as `[roster index, skill, old level, new level]`, sorted. */
const levelSteps = (leveled) => leveled
    .map(d => [GameState.heroes.findIndex(h => h.id === d.heroId), d.skillId, d.oldLevel, d.newLevel])
    .sort((a, b) => String(a).localeCompare(String(b)));

beforeAll(() => GuildUpgradeManager.init());
beforeEach(() => fresh());
afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
    getGlobalAggregator().removeModifiersBySource('test:region');
});
afterAll(() => HallRules.teardown());

describe('a rank bought gives every hero on the roster XP in every skill, once', () => {
    it('gives each rank\'s own amount, in every skill the hero holds', () => {
        const before = sheet();
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        for (const hero of GameState.heroes) {
            expect(Object.keys(hero.skills).sort()).toEqual([...HERO_SKILL_IDS].sort());
            for (const [skillId, skill] of Object.entries(hero.skills)) {
                expect(skill.xp).toBe(before[hero.id][skillId].xp + PER_RANK[0]);
                expect(skill.level).toBe(levelFromXp(skill.xp));
            }
        }
        const afterOne = sheet();
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        for (const hero of GameState.heroes) {
            for (const [skillId, skill] of Object.entries(hero.skills)) expect(skill.xp).toBe(afterOne[hero.id][skillId].xp + PER_RANK[1]);
        }
    });

    it('gives nothing more on a re-read of the ranks, a load event, a travel or a new sky', () => {
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        const after = sheet();
        const { leveled, sounds } = heard(() => {
            GuildUpgradeManager.recompute();
            HallRules.apply();
            GuildUpgradeManager.getRank('xp_all');
            EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: 0 });
            EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'travel' });
            registerHallSky(sky());
            GuildUpgradeManager.recompute();
        });
        expect(sheet()).toEqual(after);
        expect(leveled).toEqual([]);
        expect(sounds).toEqual([]);
    });

    it('does not count the gift towards a hero\'s XP an hour (it was not earned working)', async () => {
        const { XpRateTracker } = await import('../systems/hero/XpRateTracker.js');
        const hero = GameState.heroes[0];
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        expect(XpRateTracker.getRate(hero.id, 'mining')).toBe(0);
    });

    it('raises a hero\'s max HP with their best combat skill, as headroom, not a heal', () => {
        const hero = GameState.heroes[0];
        hero.hp.current = 5;
        expect(GuildUpgradeManager.purchaseRanks('xp_all', 3).success).toBe(true);
        expect(hero.hp.max).toBe(10 + levelFromXp(TOTALS[2]));
        expect(hero.hp.current).toBe(5);
    });

    it('leaves a villager alone', () => {
        const villager = GameState.heroes[2];
        villager.isVillager = true;
        const before = sheet()[villager.id];
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        expect(sheet()[villager.id]).toEqual(before);
    });
});

describe('several ranks at once give what as many single buys give', () => {
    for (const [from, n] of [[0, 3], [1, 2], [0, 2]]) {
        it(`ranks ${from + 1} to ${from + n}`, () => {
            fresh();
            for (let i = 0; i < from; i++) expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
            const singles = heard(() => {
                for (let i = 0; i < n; i++) expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
            });
            const bySingles = sheet();
            const ids = GameState.heroes.map(h => h.id);
            const singleSteps = levelSteps(singles.leveled);

            fresh();
            for (let i = 0; i < from; i++) expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
            const multi = heard(() => expect(GuildUpgradeManager.purchaseRanks('xp_all', n).success).toBe(true));
            // The heroes are new objects with new ids: compare sheets in roster order.
            expect(Object.values(sheet())).toEqual(ids.map(id => bySingles[id]));
            // The same levels, said one level event a level either way; one sound a purchase.
            expect(levelSteps(multi.leveled)).toEqual(singleSteps);
            expect(multi.sounds).toHaveLength(multi.leveled.length ? 1 : 0);
        });
    }
});

describe('a save and a load give nothing again', () => {
    it('keeps what was given, gives nothing on the load, and the next rank gives only its own', () => {
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        const saved = sheet();
        const data = JSON.parse(GameState.serializeJson());

        GameState.initNew();
        const { leveled, sounds } = heard(() => {
            loadSavedState(migrateState(data.state, data.version));
            EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
            EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' });
        });
        expect(sheet()).toEqual(saved);
        expect(leveled).toEqual([]);
        expect(sounds).toEqual([]);

        InventoryManager.addItem(ORE, 100);
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        for (const hero of GameState.heroes) {
            for (const [skillId, skill] of Object.entries(hero.skills)) expect(skill.xp).toBe(saved[hero.id][skillId].xp + PER_RANK[1]);
        }
    });
});

describe('a hero who joins later arrives with every rank bought', () => {
    it('a Bunk Beds recruit holds the held rank\'s whole gift in every skill, at full health', () => {
        expect(GuildUpgradeManager.purchaseRanks('xp_all', 2).success).toBe(true);
        const veteranGain = GameState.heroes[0].skills.mining.xp;
        const { leveled, sounds } = heard(() => expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true));
        const recruit = GameState.heroes[GameState.heroes.length - 1];
        expect(GameState.heroes).toHaveLength(4);
        for (const skillId of HERO_SKILL_IDS) {
            expect(recruit.skills[skillId].xp).toBe(TOTALS[1]);
            expect(recruit.skills[skillId].level).toBe(levelFromXp(TOTALS[1]));
        }
        // What a hero there from the start was given, rank by rank.
        expect(recruit.skills.mining.xp).toBe(veteranGain);
        expect(recruit.hp.max).toBe(10 + levelFromXp(TOTALS[1]));
        expect(recruit.hp.current).toBe(recruit.hp.max);
        expect(recruit.level).toBe(levelFromXp(TOTALS[1]));
        // Arriving is not levelling up: the recruit's own banner says they came.
        expect(leveled).toEqual([]);
        expect(sounds).toEqual([]);
    });

    it('any hero added to the roster arrives with it, and a recruit before any rank with nothing', () => {
        fresh(1);
        GameState.state.progress.guildUpgrades.roster_size = 3;
        GuildUpgradeManager.recompute();
        const early = HeroManager.addHero(generateHero({ name: 'Early' }));
        expect(early.skills.mining.xp).toBe(xpForLevel(1));
        expect(GuildUpgradeManager.purchaseRanks('xp_all', 3).success).toBe(true);
        const late = HeroManager.addHero(generateHero({ name: 'Late' }));
        expect(late.skills.mining.xp).toBe(TOTALS[2]);
        expect(early.skills.mining.xp).toBe(TOTALS[2]);
    });

    it('reads the held ranks, never the guild-wide aggregator (a Region rule there gives nobody anything)', () => {
        getGlobalAggregator().addModifier({ type: EFFECT_TYPES.XP_FOR_EVERYONE, value: 999, source: 'test:region' });
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        expect(GameState.heroes[0].skills.mining.xp).toBe(TOTALS[0]);
        expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true);
        expect(GameState.heroes[3].skills.mining.xp).toBe(TOTALS[0]);
    });

    it('works the total from the stars and the ranks alone', () => {
        const stars = authoredStars();
        expect(xpForEveryoneOf(stars, {})).toBe(0);
        expect(xpForEveryoneOf(stars, { xp_all: 1 })).toBe(100);
        expect(xpForEveryoneOf(stars, { xp_all: 3, quick: 1 })).toBe(450);
        // A rank past the top gives nothing, as a rank past the top holds nothing.
        expect(xpForEveryoneOf(stars, { xp_all: 9 })).toBe(0);
    });
});

describe('its level-ups are said as ordinary level-ups, hero by hero', () => {
    it('one HERO_LEVELED a level of every skill that rose, marked as the gift\'s, and one sound', () => {
        const before = sheet();
        const { leveled, sounds } = heard(() => expect(GuildUpgradeManager.purchaseRanks('xp_all', 2).success).toBe(true));
        const to = levelFromXp(TOTALS[1]);
        expect(to).toBeGreaterThan(2);
        expect(sounds).toEqual(['levelup']);
        expect(leveled.every(d => d.source === XP_FOR_EVERYONE_SOURCE)).toBe(true);
        const expected = [];
        for (const hero of GameState.heroes) {
            for (const skillId of Object.keys(hero.skills)) {
                const from = before[hero.id][skillId].level;
                for (let l = from + 1; l <= to; l++) expected.push([hero.id, skillId, l - 1, l, from]);
            }
        }
        // Each skill's rise said a level at a time, from the level it began at, as `addXP` says one.
        expect(leveled.map(d => [d.heroId, d.skillId, d.oldLevel, d.newLevel, d.startLevel])).toEqual(expected);
        for (const d of leveled) {
            expect(d.heroName).toBe(GameState.heroes.find(h => h.id === d.heroId).name);
            expect(typeof d.skillName).toBe('string');
        }
        expect(new Set(leveled.map(d => d.skillId))).toEqual(new Set(HERO_SKILL_IDS));
    });

    it('says a hero\'s level-ups before the next hero is given anything (the recipe banner reads the rest)', () => {
        const [first, second] = GameState.heroes;
        const secondXpWhileFirstRose = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, (d) => {
            if (d.heroId === first.id) secondXpWhileFirstRose.push(second.skills.mining.xp);
        });
        try { expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true); } finally { off(); }
        expect(secondXpWhileFirstRose.length).toBeGreaterThan(0);
        expect(new Set(secondXpWhileFirstRose)).toEqual(new Set([0]));
        expect(second.skills.mining.xp).toBe(TOTALS[0]);
    });

    it('says nothing, and makes no sound, when the gift moved no level', () => {
        fresh(2, sky({ ranks: [rank([gift(10)])] }));
        const { leveled, sounds } = heard(() => expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true));
        expect(leveled).toEqual([]);
        expect(sounds).toEqual([]);
        expect(GameState.heroes[0].skills.mining.xp).toBe(10);
    });

    it('says nothing when the roster is empty, and the next recruit still arrives with it', () => {
        fresh(0);
        const { leveled, sounds } = heard(() => expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true));
        expect(leveled).toEqual([]);
        expect(sounds).toEqual([]);
        GameState.state.progress.guildUpgrades.roster_size = 0;
        expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true);
        expect(GameState.heroes[0].skills.mining.xp).toBe(TOTALS[0]);
    });
});

describe('a star with no such rule changes nothing', () => {
    it('a Speed star gives no XP and says nothing', () => {
        const before = sheet();
        const { leveled, sounds } = heard(() => expect(GuildUpgradeManager.purchase('quick').success).toBe(true));
        expect(sheet()).toEqual(before);
        expect(leveled).toEqual([]);
        expect(sounds).toEqual([]);
        expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true);
        expect(GameState.heroes[3].skills.mining.xp).toBe(xpForLevel(1));
    });

    it('a rank listing no more than the rank before gives nothing at its purchase, and the audit names it', () => {
        const flat = sky({ ranks: [rank([gift(100)]), rank([gift(100)]), rank([gift(-20)])] });
        fresh(2, flat);
        expect(GuildUpgradeManager.purchase('xp_all').success).toBe(true);
        const after = sheet();
        const { leveled, sounds } = heard(() => expect(GuildUpgradeManager.purchaseRanks('xp_all', 2).success).toBe(true));
        expect(sheet()).toEqual(after);
        expect(leveled).toEqual([]);
        expect(sounds).toEqual([]);
        const findings = hallStarFindings({ sky: flat, items: { [ORE]: {} } })
            .filter(f => f.entityId === 'xp_all').map(f => f.message);
        expect(findings).toEqual([
            'rank 2 gives no XP for Everyone at its purchase: it lists 100 XP, no more than rank 1 does. A rank lists the star\'s whole gift so far (rank 3 of 100 a rank lists 300).',
            'rank 3 gives no XP for Everyone at its purchase: it lists 0 XP, no more than rank 2 does. A rank lists the star\'s whole gift so far (rank 3 of 100 a rank lists 300).'
        ]);
        expect(hallStarFindings({ sky: sky(), items: { [ORE]: {} } }).filter(f => f.entityId === 'xp_all')).toEqual([]);
    });
});

describe('in words', () => {
    it('the palette row: XP for Everyone, a flat amount, the Guild Hall\'s only', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.XP_FOR_EVERYONE);
        expect(entry.label).toBe('XP for Everyone');
        expect(entry.buckets).toEqual(['flat']);
        expect(entry.guildOnly).toBe(true);
        expect(entry.hint).toMatch(/every hero/i);
        // A Token or an item cannot carry it: the editors never offer it.
        expect(paletteForKeyword(KEYWORD.PROVIDES).some(e => e.type === EFFECT_TYPES.XP_FOR_EVERYONE)).toBe(false);
    });

    it('a rank\'s rule, the star\'s amounts and its sentence', () => {
        const def = getUpgradeDef('xp_all');
        expect(hallRuleSentence(gift(250))).toBe('Gives every hero 250 XP in every skill in all, recruits too.');
        expect(starAmount(def, 1)).toBe('100 XP in every skill');
        expect(starAmount(def, 2)).toBe('250 XP in every skill');
        expect(def.statLabel(2)).toBe('Gives every hero 250 XP in every skill in all, recruits too.');
        expect(starSentence(def)).toBe('Every hero gets XP in every skill, once a rank; recruits arrive with it.');
    });
});
