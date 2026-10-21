import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../config/registries/recipePoolRegistry.js', () => ({
    listRecipes: () => [
        { id: 'r_juice', name: 'Apple Juice', skill: 'cooking', levelRequirement: 1, outputs: [{ itemId: 'item_apple_juice' }] },
        { id: 'r_cider', name: 'Cider', skill: 'cooking', levelRequirement: 5, outputs: [{ itemId: 'item_cider' }] },
        { id: 'r_pie', name: 'Apple Pie', skill: 'cooking', levelRequirement: 6, outputs: [{ itemId: 'item_pie' }] },
        { id: 'r_stew', name: 'Stew', skill: 'cooking', levelRequirement: 6, outputs: [{ itemId: 'item_stew' }] },
        { id: 'r_bar', name: 'Copper Bar', skill: 'smithing', levelRequirement: 5, outputs: [{ itemId: 'item_copper_bar' }] }
    ]
}));

import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { GameState } from '../state/GameState.js';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import * as Banners from '../systems/notifications/banners.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { ROUTES, wireNotifications, unwireNotifications, pins } from '../systems/notifications/routing.js';
import { recipesUnlockedBy } from '../systems/notifications/recipeUnlocks.js';
import { announce } from '../ui/components/board/dropOnMat.js';
import { equipOrAnnounce } from '../ui/components/dock/dockEquip.js';

/**
 * Where every event goes (the owner's audit, concept_notifications.md): items to one stub each,
 * what must not be missed to a banner, level-ups to the hero only, refusals to the mat's callouts,
 * and nothing else to a notification at all.
 */

const heroWith = (id, name, cooking) => ({ id, name, spriteId: 'hn_bard_por', skills: { cooking: { level: cooking, xp: 0 } } });

function leveled(heroId, heroName, from, to) {
    for (let level = from + 1; level <= to; level++) {
        EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, {
            heroId, heroName, skillId: 'cooking', oldLevel: level - 1, newLevel: level, startLevel: from, skillName: 'Cooking'
        });
    }
}

let toasts;
let offToasts;

beforeEach(() => {
    GameState.initNew();
    ItemStubs.reset();
    Banners.reset();
    NotificationSystem.dismissAll();
    wireNotifications();
    toasts = [];
    offToasts = EventBus.subscribe(ENGINE_EVENTS.NOTIFICATION_ADDED, (n) => toasts.push(n));
});

afterEach(() => {
    offToasts();
    unwireNotifications();
    ItemStubs.reset();
    Banners.reset();
});

describe('the routing table', () => {
    it('says where each event goes', () => {
        const table = Object.fromEntries(ROUTES.filter(r => r.to !== 'reset').map(r => [r.event, r.to]));
        expect(table).toEqual({
            [ENGINE_EVENTS.INVENTORY_UPDATED]: 'stub',
            [ENGINE_EVENTS.ITEM_DISCOVERED]: 'stub:new',
            [ENGINE_EVENTS.HERO_LEVELED]: 'banner:recipe',
            [ENGINE_EVENTS.HERO_RECRUITED]: 'banner:hero',
            [ENGINE_EVENTS.HERO_PROMOTED]: 'banner:promotion',
            [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED]: 'banner:upgrade',
            [BOARD_EVENTS.HERO_DEFEATED]: 'banner:knockout',
            [ENGINE_EVENTS.BANK_FULL]: 'banner:bankFull'
        });
    });
});

describe('items go to the stubs', () => {
    it('gains and spending of one item make one stub with the net', () => {
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_oak', added: 5 });
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_oak', removed: 2 });
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, {});
        expect(ItemStubs.getStubs()).toHaveLength(1);
        expect(ItemStubs.netOf(ItemStubs.getStub('item_oak'))).toBe(3);
        expect(toasts).toEqual([]);
        expect(Banners.getAll()).toEqual([]);
    });

    it('a first find makes its stub new', () => {
        EventBus.publish(ENGINE_EVENTS.ITEM_DISCOVERED, { itemId: 'item_copper', itemName: 'Copper' });
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_copper', added: 1 });
        expect(ItemStubs.getStub('item_copper').isNew).toBe(true);
    });

    it('pins are kept in the save as they change', () => {
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_oak', added: 5 });
        pins.pin('item_oak');
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_oak', added: 4 });
        expect(GameState.state.ui.pinnedStubs).toEqual([{ itemId: 'item_oak', added: 9, removed: 0 }]);
        pins.reset('item_oak');
        expect(GameState.state.ui.pinnedStubs).toEqual([{ itemId: 'item_oak', added: 0, removed: 0 }]);
        pins.unpin('item_oak');
        expect(GameState.state.ui.pinnedStubs).toEqual([]);
    });

    it('left-click toggles the pin; right-click resets a pinned stub and clears an unpinned one, each kept in the save', () => {
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_oak', added: 5 });
        pins.toggle('item_oak');
        expect(GameState.state.ui.pinnedStubs).toEqual([{ itemId: 'item_oak', added: 5, removed: 0 }]);
        pins.clear('item_oak');
        expect(GameState.state.ui.pinnedStubs).toEqual([{ itemId: 'item_oak', added: 0, removed: 0 }]);
        expect(ItemStubs.getStub('item_oak').pinned).toBe(true);
        pins.toggle('item_oak');
        expect(GameState.state.ui.pinnedStubs).toEqual([]);
        pins.clear('item_oak');
        expect(ItemStubs.getStub('item_oak').leaving).toBe(true);
    });

    it('a load brings back that save\'s pins and nothing else', () => {
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_stone', added: 5 });
        Banners.push({ kind: 'hero', parts: { heroes: ['Old'] } });
        GameState.state.ui.pinnedStubs = [{ itemId: 'item_oak', added: 40, removed: 1 }];
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
        expect(ItemStubs.serializePins()).toEqual([{ itemId: 'item_oak', added: 40, removed: 1 }]);
        expect(ItemStubs.getStub('item_stone')).toBeNull();
        expect(Banners.getAll()).toEqual([]);
    });
});

describe('level-ups stay on the hero; a recipe unlock is a banner', () => {
    it('a level-up that unlocks nothing raises nothing', () => {
        GameState.heroes.push(heroWith('h1', 'Aela', 3));
        leveled('h1', 'Aela', 2, 3);
        expect(Banners.getAll()).toEqual([]);
        expect(toasts).toEqual([]);
    });

    it('one level-up that unlocks several gives one banner', () => {
        GameState.heroes.push(heroWith('h1', 'Aela', 6));
        leveled('h1', 'Aela', 4, 6);
        const all = Banners.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].line).toBe('Aela unlocked 3 recipes: Cider, Apple Pie, ...');
        expect(all[0].sprite).toEqual({ kind: 'item', id: 'item_cider' });
        expect(all[0].subjects).toEqual([{ type: 'hero', id: 'h1' }]);
    });

    it('only the first time anyone in the guild can run it', () => {
        GameState.heroes.push(heroWith('h1', 'Aela', 5), heroWith('h2', 'Bram', 6));
        leveled('h1', 'Aela', 4, 5);
        expect(Banners.getAll()).toEqual([]);
    });

    it('two level-ups are two banners', () => {
        GameState.heroes.push(heroWith('h1', 'Aela', 6));
        leveled('h1', 'Aela', 4, 5);
        leveled('h1', 'Aela', 5, 6);
        expect(Banners.getAll()).toHaveLength(2);
    });

    it('recipesUnlockedBy counts every recipe of the skill above the guild\'s best', () => {
        const recipes = [
            { name: 'a', skill: 's', levelRequirement: 2 },
            { name: 'b', skill: 's', levelRequirement: 4 },
            { name: 'c', skill: 's' },
            { name: 'd', skill: 't', levelRequirement: 3 }
        ];
        expect(recipesUnlockedBy(recipes, { skillId: 's', oldLevel: 1, newLevel: 4 }).map(r => r.name)).toEqual(['a', 'b']);
        expect(recipesUnlockedBy(recipes, { skillId: 's', oldLevel: 1, newLevel: 4, othersBest: 3 }).map(r => r.name)).toEqual(['b']);
        expect(recipesUnlockedBy(recipes, { skillId: 's', oldLevel: 4, newLevel: 4 })).toEqual([]);
    });
});

describe('milestones and problems are banners', () => {
    it('a new hero, a promotion and a guild upgrade are gold', () => {
        GameState.heroes.push(heroWith('h1', 'Aela', 1));
        EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, { heroId: 'h1', name: 'Aela' });
        EventBus.publish(ENGINE_EVENTS.HERO_PROMOTED, { heroId: 'h1', heroName: 'Aela', toJobName: 'Knight' });
        EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: 'bank_slots', rank: 1 });
        const all = Banners.getAll();
        expect(all.map(b => [b.kind, b.tone])).toEqual([
            ['upgrade', 'milestone'], ['promotion', 'milestone'], ['hero', 'milestone']
        ]);
        expect(all[1].line).toBe('Aela is now a Knight');
        expect(all[2].sprite).toEqual({ kind: 'src', src: '/assets/heroes/hn_bard_por.png' });
    });

    it('a Roster Size rank says only its new hero', () => {
        EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: 'roster_size', rank: 2 });
        expect(Banners.getAll()).toEqual([]);
    });

    it('a knock-out and a full Bank are red', () => {
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h1', heroName: 'Aela', lost: ['Iron Sword'] });
        EventBus.publish(ENGINE_EVENTS.BANK_FULL, { itemId: 'item_oak' });
        const all = Banners.getAll();
        expect(all.map(b => [b.kind, b.tone])).toEqual([['bankFull', 'problem'], ['knockout', 'problem']]);
        expect(all[1].line).toBe('Aela was carried home, injured. Lost: Iron Sword.');
    });

    it('a banner coming on screen plays a chime, or a warning tone for a problem', () => {
        const clips = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (p) => clips.push(p.clip));
        EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, { heroId: 'h9', name: 'Cara' });
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h9', heroName: 'Cara', lost: [] });
        off();
        expect(clips).toEqual(['quest_claim', 'invasion']);
    });
});

describe('refusals are callouts, never notifications', () => {
    it('a refused drop is said at the point it was aimed at', () => {
        const said = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_TOKEN_ALERT, (p) => said.push(p));
        announce({ success: false, reason: "Can't place that there" }, { x: 10, y: 20 });
        announce({ success: false, reason: 'No Token there' }, { instanceId: 't1', x: 1, y: 2 });
        announce({ success: false, reason: 'Already said', alerted: true }, { x: 10, y: 20 });
        announce({ success: false, reason: 'Already there' }, { x: 10, y: 20 });
        off();
        expect(said.map(p => [p.title, p.instanceId, p.x])).toEqual([
            ["Can't place that there", null, 10], ['No Token there', 't1', 1]
        ]);
        expect(toasts).toEqual([]);
    });

    it('a refused equip is said where the item was let go', () => {
        const said = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => said.push(p.text));
        const engine = { EquipmentManager: { equipItem: () => ({ success: false, error: 'No free slot in the loadout' }) } };
        expect(equipOrAnnounce(engine.EquipmentManager, 'h1', 'item_sword')).toBe(false);
        off();
        expect(said).toEqual(['No free slot in the loadout']);
        expect(toasts).toEqual([]);
    });
});
