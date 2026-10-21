import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/fixtureItems.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroTools from '../systems/equipment/HeroTools.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { getPrimaryWeapon } from '../config/registries/equipmentConstants.js';
import { setStarterCampForTests, resetStarterCampForTests } from '../config/registries/starterCampRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import {
    TOOL_KINDS, HANDS, toolOf, neededToolOf, toolMeets, handsOf, toolNeedPhrase, toolItemFor, starterToolIds
} from '../config/registries/toolKinds.js';
import { toolFindings } from '../systems/core/toolRule.js';
import { problemText, PROBLEM_SEVERITY, SEVERITY } from '../ui/components/board/problemMark.js';
import { blockedText, pinRefusedLineFor } from '../ui/components/board/heroBubbles.js';
import { SKIP_HINT, skipHint } from '../ui/components/board/boardConstants.js';
import { skipLine, tokenSkipLines } from '../ui/components/board/flagText.js';
import { calloutText, dueAgain, TOOL_CALLOUT_GAP_MS } from '../ui/components/board/callouts.js';
import { toolItems, TOKEN_NEEDS } from '../ui/dev/toolsPackContent.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Gathering tools are hero gear: carried in one hand, needed by kind, the tool's tier gating the
 * Token's, a "Needs Pickaxe" callout over a Token a hero passes over for want of one, the starter
 * set in a new game's Bank, and the old tool Tokens retired.
 */

const hand = (id, name, extra = {}) => ({ id, name, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', ...extra });
const ITEMS = {
    fx_pick: hand('fx_pick', 'Fixture Pickaxe', { tool: { kind: 'pickaxe', tier: 1, starter: true } }),
    fx_iron_pick: hand('fx_iron_pick', 'Fixture Iron Pickaxe', { tool: { kind: 'pickaxe', tier: 2 } }),
    fx_axe: hand('fx_axe', 'Fixture Woodaxe', { tool: { kind: 'woodaxe', tier: 1, starter: true } }),
    fx_rod: hand('fx_rod', 'Fixture Rod', { tool: { kind: 'fishing_rod', tier: 1, starter: true } }),
    fx_sword: hand('fx_sword', 'Fixture Sword', { type: 'weapon', skillRequired: 'melee' }),
    fx_greatsword: hand('fx_greatsword', 'Fixture Greatsword', { type: 'weapon', skillRequired: 'melee', hands: 2 }),
    fx_dagger: hand('fx_dagger', 'Fixture Dagger', { type: 'weapon', skillRequired: 'stealth' }),
    fx_charm_pick: { id: 'fx_charm_pick', name: 'Fixture Charm Pickaxe', type: 'armor', equipSlot: 'trinket', stackable: true, tool: { kind: 'pickaxe', tier: 9 } }
};
registerItems(ITEMS);

const worked = (id, name, skill, needsTool, extra = {}) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 500, size: 1, sprite: 's_nature',
    ...(needsTool ? { needsTool } : {}),
    config: { skill, skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] },
    ...extra
});
registerTokenTypes({
    fx_vein: worked('fx_vein', 'Fixture Vein', 'mining', { kind: 'pickaxe', minTier: 1 }),
    fx_deep_vein: worked('fx_deep_vein', 'Fixture Deep Vein', 'mining', { kind: 'pickaxe', minTier: 2 }),
    fx_tree: worked('fx_tree', 'Fixture Tree', 'forestry', { kind: 'woodaxe', minTier: 1 }),
    fx_plain: worked('fx_plain', 'Fixture Plain Node', 'forestry', null),
    // The retired shape: a pickaxe Token that serves the Tokens beside it, and wears doing so.
    fx_pick_token: {
        id: 'fx_pick_token', name: 'Fixture Pickaxe Token', tokenType: 'context', rarity: 'common', theme: 'fixture',
        uses: 10, size: 1, sprite: 'i_pick_copper', provides: [{ tag: 'pickaxe', tier: 5 }]
    }
});

const VEIN = { x: 400, y: 400 };
const TREE = { x: 560, y: 400 };
const FLAG = { x: 480, y: 400 };

function addHero() {
    const hero = generateHero();
    GameState.state.heroes.push(hero);
    return hero;
}
const give = (itemId, n = 1) => InventoryManager.addItem(itemId, n);
const equip = (heroId, itemId) => {
    if (!InventoryManager.hasItem(itemId, 1)) give(itemId);
    const res = EquipmentManager.equipItem(heroId, itemId);
    expect(res.success, res.error).toBe(true);
};
const put = (typeId, at) => {
    const instance = BoardState.createTokenInstance(typeId, getTokenType(typeId)?.uses ?? null);
    expect(Placement.placeTokenAt(instance, at).success).toBe(true);
    return BoardState.getTokenById(instance.id);
};
const held = (hero) => hero.equipment.filter(Boolean);
const tick = (n = 1, ms = 100) => { for (let i = 0; i < n; i++) BoardRunner.tick(ms); };

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 220);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
});

describe('the vocabulary: kinds, a tool, a need, hands', () => {
    it('four kinds, and a hero has two hands', () => {
        expect(TOOL_KINDS.map(k => k.id)).toEqual(['pickaxe', 'woodaxe', 'fishing_rod', 'sickle']);
        expect(HANDS).toBe(2);
    });

    it('an item is a tool only with a kind the game has; a tier reads as a whole number from 1', () => {
        expect(toolOf({ tool: { kind: 'pickaxe', tier: 3 } })).toEqual({ kind: 'pickaxe', tier: 3, starter: false });
        expect(toolOf({ tool: { kind: 'pickaxe', tier: 'x' } }).tier).toBe(1);
        expect(toolOf({ tool: { kind: 'shovel', tier: 1 } })).toBeNull();
        expect(toolOf({})).toBeNull();
        expect(neededToolOf({ needsTool: { kind: 'sickle' } })).toEqual({ kind: 'sickle', minTier: 1 });
        expect(neededToolOf({ needsTool: { kind: '' } })).toBeNull();
    });

    it('the tool\'s tier gates the Token\'s: the same kind, at the tier or above', () => {
        const need = { kind: 'pickaxe', minTier: 2 };
        expect(toolMeets({ kind: 'pickaxe', tier: 2 }, need)).toBe(true);
        expect(toolMeets({ kind: 'pickaxe', tier: 3 }, need)).toBe(true);
        expect(toolMeets({ kind: 'pickaxe', tier: 1 }, need)).toBe(false);
        expect(toolMeets({ kind: 'woodaxe', tier: 9 }, need)).toBe(false);
        expect(toolMeets(null, null)).toBe(true);
    });

    it('a tool takes one hand whatever it says; a two-handed weapon both; anything not held, none', () => {
        expect(handsOf(ITEMS.fx_pick)).toBe(1);
        expect(handsOf({ ...ITEMS.fx_pick, hands: 2 })).toBe(1);
        expect(handsOf(ITEMS.fx_sword)).toBe(1);
        expect(handsOf(ITEMS.fx_greatsword)).toBe(2);
        expect(handsOf(ITEMS.fx_charm_pick)).toBe(0);
    });

    it('a need is named by its kind, and above the bottom rung by the first tool that reaches it', () => {
        const items = getAllItems();
        expect(toolNeedPhrase({ kind: 'pickaxe', minTier: 1 }, items)).toBe('Pickaxe');
        expect(toolNeedPhrase({ kind: 'pickaxe', minTier: 2 }, items)).toBe('Fixture Iron Pickaxe or better');
        expect(toolNeedPhrase({ kind: 'pickaxe', minTier: 99 }, items)).toBe('stronger Pickaxe');
        expect(toolNeedPhrase({ kind: 'fishing_rod', minTier: 1 }, items)).toBe('Fishing Rod');
        expect(toolItemFor({ kind: 'pickaxe', minTier: 2 }, items)).toBe('fx_iron_pick');
    });

    it('the starter tools are the items whose Tool is marked Starter, in kind order', () => {
        expect(starterToolIds(ITEMS)).toEqual(['fx_pick', 'fx_axe', 'fx_rod']);
    });
});

describe('hands: a tool takes one hand', () => {
    it('a tool and a one-handed weapon fit together', () => {
        const hero = addHero();
        equip(hero.id, 'fx_pick');
        equip(hero.id, 'fx_sword');
        expect(held(hero).sort()).toEqual(['fx_pick', 'fx_sword']);
    });

    it('two tools (no weapon) fit, so a hero can do both jobs', () => {
        const hero = addHero();
        equip(hero.id, 'fx_pick');
        equip(hero.id, 'fx_axe');
        expect(held(hero).sort()).toEqual(['fx_axe', 'fx_pick']);
        expect(HeroTools.holdsToolFor(hero.id, { kind: 'pickaxe', minTier: 1 })).toBe(true);
        expect(HeroTools.holdsToolFor(hero.id, { kind: 'woodaxe', minTier: 1 })).toBe(true);
    });

    it('a two-handed weapon leaves no hand for a tool: taking it up puts the tools down', () => {
        const hero = addHero();
        equip(hero.id, 'fx_pick');
        equip(hero.id, 'fx_axe');
        equip(hero.id, 'fx_greatsword');
        expect(held(hero)).toEqual(['fx_greatsword']);
    });

    it('taking up a tool beside a two-handed weapon puts the weapon down', () => {
        const hero = addHero();
        equip(hero.id, 'fx_greatsword');
        equip(hero.id, 'fx_pick');
        expect(held(hero)).toEqual(['fx_pick']);
    });

    it('a third one-hand item still takes the place of the first, as before', () => {
        const hero = addHero();
        equip(hero.id, 'fx_pick');
        equip(hero.id, 'fx_axe');
        equip(hero.id, 'fx_sword');
        expect(held(hero).sort()).toEqual(['fx_axe', 'fx_sword']);
    });

    it('food and the rest of the grid are untouched by the hands', () => {
        const hero = addHero();
        equip(hero.id, 'fx_greatsword');
        give('item_steak');
        expect(EquipmentManager.equipItem(hero.id, 'item_steak').success).toBe(true);
        equip(hero.id, 'fx_pick');
        expect(held(hero).sort()).toEqual(['fx_pick', 'item_steak']);
    });

    it('a pickaxe in hand is not a weapon: combat names the weapon beside it, or none', () => {
        const hero = addHero();
        equip(hero.id, 'fx_pick');
        expect(getPrimaryWeapon(hero)).toBeNull();
        equip(hero.id, 'fx_dagger');
        expect(getPrimaryWeapon(hero)).toBe('fx_dagger');
    });

    it('new heroes arrive empty-handed', () => {
        expect(addHero().equipment.every(slot => slot === null)).toBe(true);
    });
});

describe('the gate: only a hero holding the tool may work the Token', () => {
    it('no tool, no work; the tool of the kind at the tier, work', () => {
        const hero = addHero();
        const vein = put('fx_vein', VEIN);
        const config = vein && getTokenType('fx_vein').config;
        expect(WorkCheck.heroReason(hero.id, config, vein)).toBe(ALERT.NO_TOOL);
        equip(hero.id, 'fx_axe');
        expect(WorkCheck.heroReason(hero.id, config, vein)).toBe(ALERT.NO_TOOL);
        equip(hero.id, 'fx_pick');
        expect(WorkCheck.heroReason(hero.id, config, vein)).toBeNull();
    });

    it('a copper-tier pickaxe does not mine a vein that needs the next tier; an iron one does', () => {
        const hero = addHero();
        const deep = put('fx_deep_vein', VEIN);
        const config = getTokenType('fx_deep_vein').config;
        equip(hero.id, 'fx_pick');
        expect(WorkCheck.heroReason(hero.id, config, deep)).toBe(ALERT.NO_TOOL);
        equip(hero.id, 'fx_iron_pick');
        expect(WorkCheck.heroReason(hero.id, config, deep)).toBeNull();
    });

    it('a tool counts only while the Bank still holds one, and only in the hands', () => {
        const hero = addHero();
        const vein = put('fx_vein', VEIN);
        const config = getTokenType('fx_vein').config;
        equip(hero.id, 'fx_pick');
        InventoryManager.removeItem('fx_pick', InventoryManager.getItemCount('fx_pick'));
        expect(WorkCheck.heroReason(hero.id, config, vein)).toBe(ALERT.NO_TOOL);

        const other = addHero();
        equip(other.id, 'fx_charm_pick');
        expect(WorkCheck.heroReason(other.id, config, vein)).toBe(ALERT.NO_TOOL);
    });

    it('a Token that needs no tool needs none, and demolishing needs none either', () => {
        const hero = addHero();
        const plain = put('fx_plain', VEIN);
        expect(WorkCheck.heroReason(hero.id, getTokenType('fx_plain').config, plain)).toBeNull();
        const vein = put('fx_vein', TREE);
        vein.demolish = true;
        expect(Demolition.isMarked(vein)).toBe(true);
        expect(WorkCheck.heroReason(hero.id, Demolition.DEMOLITION_CONFIG, vein)).toBeNull();
    });

    it('the runner and the chooser agree: a hero on the vein without a pickaxe raises the no-tool mark', () => {
        const hero = addHero();
        const vein = put('fx_vein', VEIN);
        Flags.plant(hero.id, VEIN);
        BoardState.setClaim(hero.id, { instanceId: vein.id, typeId: vein.typeId, x: vein.x, y: vein.y });
        expect(WorkCheck.whyCannotRun(vein.id, vein, hero.id, getTokenType('fx_vein').config)).toBe(ALERT.NO_TOOL);
        BoardRunner.tick(100);
        expect(vein.alert).toBe(ALERT.NO_TOOL);
    });
});

describe('choosing work: the hero does other allowed work, and the Token says what it needs', () => {
    let heard;
    let off;
    beforeEach(() => {
        heard = [];
        off = EventBus.subscribe(BOARD_EVENTS.TOOL_NEEDED, (p) => heard.push(p));
    });
    afterEach(() => off?.());

    it('holding only a woodaxe, the hero works the tree and passes the vein over with no tool', () => {
        const hero = addHero();
        equip(hero.id, 'fx_axe');
        const vein = put('fx_vein', VEIN);
        const tree = put('fx_tree', TREE);
        Flags.setRule(hero.id, 'mining', { priority: 1 });
        Flags.plant(hero.id, FLAG);

        expect(BoardState.claimOfHero(hero.id)?.instanceId).toBe(tree.id);
        expect(Flags.skipsOf(vein.id)).toEqual([{ heroId: hero.id, reason: ALERT.NO_TOOL }]);
        expect(heard).toContainEqual({ instanceId: vein.id, heroId: hero.id, kind: 'pickaxe', minTier: 1 });
        // The flag's hover and the vein's own hover name the tool.
        expect(skipLine({ instanceId: vein.id, reason: ALERT.NO_TOOL, typeId: 'fx_vein' }, hero.id)).toBe('Fixture Vein — needs a Pickaxe in hand');
        expect(tokenSkipLines(vein.id)).toEqual([`${hero.name}’s flag skipped this: needs a Pickaxe in hand`]);
        // The pass-over is not a badge on the vein: the problem is the hero's.
        tick(5);
        expect(vein.alert ?? null).toBeNull();
    });

    it('only the Token the hero would have worked says it: one bubble per look, however many veins', () => {
        const hero = addHero();
        const near = put('fx_vein', VEIN);
        const far = put('fx_vein', TREE);
        Flags.plant(hero.id, { x: 420, y: 400 });
        expect(Flags.skipsOf(near.id)).toEqual([{ heroId: hero.id, reason: ALERT.NO_TOOL }]);
        expect(Flags.skipsOf(far.id)).toEqual([{ heroId: hero.id, reason: ALERT.NO_TOOL }]);
        expect(heard).toHaveLength(1);
        expect([near.id, far.id]).toContain(heard[0].instanceId);
    });

    it('an idle hero takes the vein as soon as a pickaxe is in hand', () => {
        const hero = addHero();
        // In the Bank already: taking it up is the only change, and it alone wakes the flag.
        give('fx_pick');
        const vein = put('fx_vein', VEIN);
        Flags.plant(hero.id, VEIN);
        tick(3);
        expect(BoardState.claimOfHero(hero.id)).toBeNull();
        expect(heard.length).toBeGreaterThan(0);

        equip(hero.id, 'fx_pick');
        tick(1);
        expect(BoardState.claimOfHero(hero.id)?.instanceId).toBe(vein.id);
    });

    it('putting the pickaxe down mid-work lets go of the vein at once', () => {
        const hero = addHero();
        equip(hero.id, 'fx_pick');
        const vein = put('fx_vein', VEIN);
        Flags.plant(hero.id, VEIN);
        tick(3);
        expect(BoardState.claimOfHero(hero.id)?.instanceId).toBe(vein.id);

        const slot = hero.equipment.indexOf('fx_pick');
        EquipmentManager.unequipItem(hero.id, slot);
        tick(3);
        expect(BoardState.claimOfHero(hero.id)).toBeNull();
        expect(vein.alert ?? null).toBeNull();
    });

    it('a flag dropped on the vein without a pickaxe is not pinned, and the hero says what they need', () => {
        const hero = addHero();
        const vein = put('fx_vein', VEIN);
        const said = [];
        const offPin = EventBus.subscribe(BOARD_EVENTS.PIN_REFUSED, (p) => said.push(p));
        try {
            const res = Flags.plant(hero.id, VEIN, { pin: true });
            expect(res.pinnedTo).toBeNull();
            expect(res.pinRefused).toBe(ALERT.NO_TOOL);
        } finally { offPin(); }
        expect(said).toEqual([{ heroId: hero.id, instanceId: vein.id, reason: ALERT.NO_TOOL }]);
        expect(pinRefusedLineFor(vein.id, ALERT.NO_TOOL)).toBe('I need a Pickaxe to work Fixture Vein.');
    });
});

describe('the old tool Tokens are retired', () => {
    it('a pickaxe Token beside the vein does not stand in for the tool in hand', () => {
        const hero = addHero();
        const vein = put('fx_vein', VEIN);
        put('fx_pick_token', TREE);
        expect(WorkCheck.heroReason(hero.id, getTokenType('fx_vein').config, vein)).toBe(ALERT.NO_TOOL);
    });

    it('and a hero working the vein with a pickaxe in hand spends none of its charges', () => {
        const hero = addHero();
        equip(hero.id, 'fx_pick');
        const vein = put('fx_vein', VEIN);
        const old = put('fx_pick_token', TREE);
        Flags.plant(hero.id, VEIN, { pin: true });
        let cycles = 0;
        const offCycle = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === vein.id) cycles++; });
        try { tick(60); } finally { offCycle(); }
        expect(cycles).toBeGreaterThan(2);
        expect(old.usesRemaining).toBe(10);
    });
});

describe('the words: the bubble, the mark, the flag\'s hover', () => {
    it('the callout says the kind the Token needs, now and then', () => {
        expect(calloutText.needsTool('Pickaxe')).toBe('Needs Pickaxe');
        expect(dueAgain(null, 0)).toBe(true);
        expect(dueAgain(1000, 1000 + TOOL_CALLOUT_GAP_MS - 1)).toBe(false);
        expect(dueAgain(1000, 1000 + TOOL_CALLOUT_GAP_MS)).toBe(true);
    });

    it('the problem mark is a can\'t, and its hover names the tool', () => {
        expect(PROBLEM_SEVERITY[ALERT.NO_TOOL]).toBe(SEVERITY.CANT);
        const vein = put('fx_vein', VEIN);
        const deep = put('fx_deep_vein', TREE);
        expect(problemText({ kind: ALERT.NO_TOOL }, vein.id)).toBe('Needs Pickaxe');
        expect(problemText({ kind: ALERT.NO_TOOL }, deep.id)).toBe('Needs Fixture Iron Pickaxe or better');
    });

    it('the hero\'s line and the flag\'s hover', () => {
        expect(blockedText(ALERT.NO_TOOL, { token: 'Oak Tree', tool: 'Woodaxe' })).toBe('I need a Woodaxe to work Oak Tree.');
        expect(blockedText(ALERT.NO_TOOL, { token: 'Gold Ore Vein', tool: 'Iron Pickaxe or better' }))
            .toBe('I need an Iron Pickaxe or better to work Gold Ore Vein.');
        expect(SKIP_HINT[ALERT.NO_TOOL]).toBe('needs {tool} in hand');
        expect(skipHint(ALERT.NO_TOOL, { tool: 'a Pickaxe' })).toBe('needs a Pickaxe in hand');
        expect(skipHint(ALERT.NO_TOOL)).toBe('needs a tool in hand');
        expect(WorkCheck.HERO_GATES.has(ALERT.NO_TOOL)).toBe(true);
        expect(WorkCheck.FIXABLE.has(ALERT.NO_TOOL)).toBe(false);
    });
});

describe('a new game: the starter tools wait in the Bank', () => {
    afterEach(() => resetStarterCampForTests());

    function newGame(bank) {
        setStarterCampForTests({ version: 1, mat: { w: 1760, h: 1126 }, hall: { x: 880, y: 563 }, tokens: [], bank });
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        EngineBootstrap.createDefaultGameData();
    }

    it('one of each starter tool, beside the camp\'s own Bank', () => {
        newGame({ item_oak_wood: 4 });
        for (const id of starterToolIds(getAllItems())) expect(InventoryManager.getItemCount(id), id).toBe(1);
        expect(InventoryManager.getItemCount('fx_pick')).toBe(1);
        expect(InventoryManager.getItemCount('fx_iron_pick')).toBe(0);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(4);
        expect(GameState.state.heroes).toEqual([]);
    });

    it('a starter tool the camp\'s Bank already holds is not doubled', () => {
        newGame({ fx_pick: 2 });
        expect(InventoryManager.getItemCount('fx_pick')).toBe(2);
        expect(InventoryManager.getItemCount('fx_axe')).toBe(1);
    });
});

describe('the tutorial has a hero equip a tool', () => {
    afterEach(() => QuestManager.cleanup());

    it('the step comes right after recruiting, and only a tool counts', () => {
        const ids = TUTORIAL_QUESTS.map(t => t.id);
        expect(ids.indexOf('cart_tool')).toBe(ids.indexOf('cart_recruit') + 1);
        expect(TUTORIAL_QUESTS.find(t => t.id === 'cart_tool')).toMatchObject({ targetType: 'hero_equipped', match: { tool: true } });

        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), 880, 600);
        QuestManager.init();
        GameState.state.quests.completedTutorials.push('cart_recruit');
        for (const t of BoardState.tokens().filter(t => t.quest?.tutorial)) BoardState.removeToken(t.id);
        QuestManager.ensureQuests();
        const step = () => QuestManager.getActiveQuests().find(q => q.id === 'cart_tool');
        expect(step()).toBeTruthy();

        const hero = addHero();
        equip(hero.id, 'fx_sword');
        expect(step().currentCount || 0).toBe(0);
        equip(hero.id, 'fx_axe');
        expect(step().currentCount).toBe(1);
    });
});

describe('content: the rules the audit checks', () => {
    it('names a tool no hero can hold, a need no tool answers, and content still written as tool Tokens', () => {
        const items = {
            ok: { id: 'ok', name: 'Good Pick', equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 2 } },
            worn: { id: 'worn', name: 'Pick Charm', equipSlot: 'trinket', tool: { kind: 'pickaxe', tier: 1 } },
            big: { id: 'big', name: 'Big Axe', equipSlot: 'hand', hands: 2, tool: { kind: 'woodaxe', tier: 1 } },
            odd: { id: 'odd', name: 'Shovel', equipSlot: 'hand', tool: { kind: 'shovel', tier: 1 } }
        };
        const tokens = {
            fine: { id: 'fine', name: 'Fine Vein', needsTool: { kind: 'pickaxe', minTier: 2 } },
            deep: { id: 'deep', name: 'Deep Vein', needsTool: { kind: 'pickaxe', minTier: 3 } },
            reed: { id: 'reed', name: 'Reed Bed', needsTool: { kind: 'sickle', minTier: 1 } },
            what: { id: 'what', name: 'Odd Node', needsTool: { kind: 'shovel', minTier: 1 } },
            oldTool: { id: 'oldTool', name: 'Old Pickaxe Token', provides: [{ tag: 'pickaxe', tier: 1 }] },
            oldVein: { id: 'oldVein', name: 'Old Vein', acceptedTokens: [{ tag: 'pickaxe', minTier: 1 }] },
            anvil: { id: 'anvil', name: 'Anvil', provides: [{ tag: 'anvil', tier: 1 }] }
        };
        const recipes = [
            { id: 'r_old', name: 'Old Recipe', requiresContext: [{ tag: 'axe', minTier: 1, chargeCost: 1 }] },
            { id: 'r_anvil', name: 'Nails', requiresContext: [{ tag: 'anvil', minTier: 1, chargeCost: 1 }] }
        ];
        const found = toolFindings({ items, tokens, recipes });
        const ids = found.map(f => f.entityId).sort();
        expect(ids).toEqual(['big', 'deep', 'odd', 'oldTool', 'oldVein', 'r_old', 'reed', 'what', 'worn'].sort());
        expect(found.find(f => f.entityId === 'deep').message).toMatch(/tier 3 .*best Pickaxe is tier 2/);
        expect(found.find(f => f.entityId === 'reed').message).toMatch(/no item is a Sickle/);
    });

    it('the pack\'s content answers every need it sets, and the starter tools cover every kind', () => {
        const TOOL_ITEMS = toolItems();
        const shipped = Object.fromEntries(Object.entries(getAllItems()).filter(([id]) => !id.startsWith('fx_')));
        const items = { ...shipped, ...TOOL_ITEMS };
        for (const [tokenId, [kind, minTier]] of Object.entries(TOKEN_NEEDS)) {
            expect(toolItemFor({ kind, minTier }, TOOL_ITEMS), tokenId).toBeTruthy();
            expect(getTokenType(tokenId), tokenId).toBeTruthy();
        }
        const starters = starterToolIds(TOOL_ITEMS).map(id => TOOL_ITEMS[id].tool.kind);
        expect(starters).toEqual(TOOL_KINDS.map(k => k.id));
        const tokens = Object.fromEntries(Object.keys(TOKEN_NEEDS).map(id => [id, { id, needsTool: { kind: TOKEN_NEEDS[id][0], minTier: TOKEN_NEEDS[id][1] } }]));
        expect(toolFindings({ items, tokens, recipes: [] })).toEqual([]);
    });
});

describe('an old save with a tool Token on the mat', () => {
    it('a Token whose type the Sync removed stands inert: ticks and flags carry on', () => {
        const hero = addHero();
        equip(hero.id, 'fx_pick');
        const ghost = BoardState.createTokenInstance('token_removed_by_sync', 40);
        BoardState.addToken(ghost, TREE.x, TREE.y);
        const vein = put('fx_vein', VEIN);
        Flags.plant(hero.id, FLAG);
        expect(() => tick(30)).not.toThrow();
        expect(BoardState.claimOfHero(hero.id)?.instanceId).toBe(vein.id);
        expect(BoardState.getTokenById(ghost.id)).toBeTruthy();
    });
});
