import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as Flags from '../systems/board/Flags.js';
import * as Shop from '../systems/board/Shop.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle slice 9.5 — the tutorial chain, walked through the REAL
 * systems on the SHIPPED content.
 *
 * Every step is completed by doing the thing it asks — recruiting through the
 * Guild Hall board, planting a flag, a hero working a Token until the engine
 * publishes the cycle, collecting loot, buying at the Shop, building on a
 * Foundation — never by publishing an event by hand. The one exception is the
 * Item Bank step, whose only publisher is a React hook (`useUIModals`), so the
 * test publishes exactly what that hook publishes.
 *
 * Items the chain needs are put in the Bank directly: this pins that each
 * step's EVENT fires; whether a new game can afford the chain is slice 10.1.
 */

/** Spots on the mat, far enough apart that one flag reaches one Token. */
const SPOT = {
    tree: { x: 300, y: 300 },
    build: { x: 1400, y: 300 },
    farm: { x: 300, y: 900 },
    map: { x: 1400, y: 900 }
};

const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const quest = (id) => QuestManager.getActiveQuests().find(q => q.id === id);
const give = (itemId, n) => InventoryManager.addItem(itemId, n);

/** Run the engine in 100 ms ticks until `done()` or `maxMs` of game time. */
function runUntil(done, maxMs) {
    for (let t = 0; t < maxMs; t += 100) {
        if (done()) return true;
        BoardRunner.tick(100);
        SpriteLayer.tick(100);
    }
    return done();
}

const complete = (id) => (quest(id)?.currentCount || 0) >= (quest(id)?.requiredCount || Infinity);

/** The step is offered, finishes, and pays out. */
function claim(id) {
    expect(quest(id), `${id} is offered`).toBeTruthy();
    expect(complete(id), `${id} is complete`).toBe(true);
    expect(QuestManager.claimQuest(id).success, id).toBe(true);
}

/** Buy at the Shop, then move the new Token to its own spot. */
function buyAt(typeId, point) {
    const res = Shop.buy(typeId);
    expect(res.success, `${typeId}: ${res.reason}`).toBe(true);
    expect(Placement.moveTokenTo(res.instance.id, point)?.success ?? true).toBe(true);
    return BoardState.getTokenById(res.instance.id);
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 220);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    QuestManager.init();
});

afterEach(() => QuestManager.cleanup());

describe('⭐ the tutorial chain, step by step, through the real systems (9.5)', () => {
    it('every step completes from the event it listens to', () => {
        // 1. Recruit a Hero: the Guild Hall board's first Bunk Beds rank is free.
        expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true);
        const heroId = GameState.heroes[0].id;
        claim('tut_recruit');

        // 2. Plant a Flag beside an Oak Tree.
        Placement.placeTokenAt(
            BoardState.createTokenInstance('token_oak_tree', tokenStartingUses('token_oak_tree')), SPOT.tree);
        expect(Flags.plant(heroId, SPOT.tree).success).toBe(true);
        claim('tut_flag');

        // 3. Log an Oak Tree three times.
        expect(runUntil(() => complete('tut_log'), 5 * 60_000)).toBe(true);
        claim('tut_log');

        // 4. Collect 10 items by hovering (the hover calls `collectSprite`).
        expect(runUntil(() => {
            for (const s of SpriteLayer.getSprites().filter(s => s.kind === 'item')) SpriteLayer.collectSprite(s.id);
            if (!onMat('token_oak_tree').length) {
                Placement.placeTokenAt(BoardState.createTokenInstance('token_oak_tree', 10), SPOT.tree);
            }
            return complete('tut_collect');
        }, 10 * 60_000)).toBe(true);
        claim('tut_collect');
        Flags.furl(heroId);

        // 5. Open the Item Bank — what `useUIModals` publishes on the orb click.
        EventBus.publish('ui_modal:opened', { modalId: 'bank' });
        claim('tut_bank');

        // 6. Buy anything at the Shop.
        give('item_oak_wood', 15);
        const quarry = Shop.buy('token_quarry');
        expect(quarry.success, quarry.reason).toBe(true);
        Placement.removePlacedToken(quarry.instance.id);
        claim('tut_shop');

        // 7. Buy a Wood Foundation (buying a Quarry did not count for it).
        give('item_oak_wood', 15);
        const foundation = buyAt('token_wood_foundation', SPOT.build);
        claim('tut_foundation');

        // 8. Build a Workbench on it.
        StationRecipe.setSelectedRecipe(foundation, 'recipe_muily2pb');
        give('item_oak_wood', 5);
        Flags.plant(heroId, SPOT.build);
        expect(runUntil(() => complete('tut_workbench'), 2 * 60_000)).toBe(true);
        expect(onMat('token_workbench')).toHaveLength(1);
        claim('tut_workbench');

        // 9. Craft Charcoal (a new Workbench starts on Charcoal).
        give('item_oak_wood', 10);
        expect(runUntil(() => complete('tut_charcoal'), 2 * 60_000)).toBe(true);
        claim('tut_charcoal');

        // 10. Plant Farmland as a Wheat Field.
        give('item_oak_wood', 10);
        const farmland = buyAt('token_farmland', SPOT.farm);
        StationRecipe.setSelectedRecipe(farmland, 'recipe_muil1w5z');
        give('item_wheat_seed', 5);
        Flags.plant(heroId, SPOT.farm);
        expect(runUntil(() => complete('tut_farmland'), 2 * 60_000)).toBe(true);
        expect(onMat('token_wheat_field')).toHaveLength(1);
        claim('tut_farmland');

        // 11. Harvest Ripe Wheat: the Field spawns sprouts, which ripen.
        expect(runUntil(() => complete('tut_wheat'), 5 * 60_000)).toBe(true);
        claim('tut_wheat');

        // 12. Explore the Oak Forest Map with a Shrimp and a Torch.
        give('item_oak_wood', 5);
        give('item_torch', 2);
        give('item_shrimp', 1);
        buyAt('token_oak_forest_map', SPOT.map);
        Flags.plant(heroId, SPOT.map);
        expect(runUntil(() => complete('tut_explore'), 2 * 60_000)).toBe(true);
        claim('tut_explore');

        // Every step was walked, in order.
        expect(GameState.state.quests.completedTutorials).toEqual(TUTORIAL_QUESTS.map(t => t.id));
    }, 120_000);
});

describe('no quest listens for an event nobody publishes', () => {
    const SRC = path.resolve(__dirname, '..');
    const questSource = fs.readFileSync(path.join(SRC, 'systems/quests/QuestManager.js'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    it('none of the retired events is subscribed to', () => {
        for (const name of [
            'map_burst', 'map_opened', 'map_purchased',
            'vault_withdrawn', 'vault_deposited', 'loot_token_placed',
            'board_recall', 'return_to_tray'
        ]) {
            expect(questSource, name).not.toMatch(new RegExp(`subscribe\\(\\s*['"]${name}['"]`));
        }
        expect(questSource).not.toMatch(/modalId === 'vault'/);
    });

    it('every tutorial target is one QuestManager reports', () => {
        for (const t of TUTORIAL_QUESTS) {
            expect(questSource, t.id).toContain(`reportProgress('${t.targetType}'`);
        }
    });
});
