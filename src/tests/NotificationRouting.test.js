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
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { ROUTES, wireNotifications, unwireNotifications, pins, MAX_FIND_STUBS, BANNER_SOUND, deliverCatchUpNews } from '../systems/notifications/routing.js';
import { startNewsCollector } from '../systems/notifications/catchUpNews.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { recipesUnlockedBy } from '../systems/notifications/recipeUnlocks.js';
import { announce } from '../ui/components/board/dropOnMat.js';
import { equipBubbleOf, clearEquipBubbles } from '../ui/components/dock/equipBubbles.js';
import { equipOrAnnounce } from '../ui/components/dock/dockEquip.js';
import { DEFAULT_MAX_STACK } from '../config/registries/itemRegistry.js';
import { setHallSky } from '../config/guildUpgrades.js';
import { withRequiredThree } from './fixtures/hallSky.js';

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
    // Nothing here loads the star registry, so the file puts in the Bank Tabs and Bunk Beds it announces.
    setHallSky(withRequiredThree());
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
            [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED]: 'banner:upgrade',
            [ENGINE_EVENTS.MASTERY_RANK_UP]: 'banner:mastery',
            [BOARD_EVENTS.HERO_DEFEATED]: 'banner:knockout',
            [ENGINE_EVENTS.BANK_FULL]: 'banner:bankFull',
            [ENGINE_EVENTS.ATLAS_CHANGED]: 'banner:settled',
            [BOARD_EVENTS.NO_ROOM_WAIT]: 'banner:noRoom',
            [BOARD_EVENTS.EVENT_LANDED]: 'banner:event',
            [BOARD_EVENTS.EVENT_ENDED]: 'banner:event',
            [ENGINE_EVENTS.BOARD_SWAPPED]: 'banner:event',
            [ENGINE_EVENTS.CATCH_UP_FINISHED]: 'catchUp:news',
            [ENGINE_EVENTS.CATCH_UP_OFFERED_AGAIN]: 'catchUp:news',
            [UI_EVENTS.CATCH_UP_SUMMARY_CLOSED]: 'catchUp:news'
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
    // Rewritten with classless heroes: promotion is retired, so its banner is gone.
    it('a new hero and a guild upgrade are gold', () => {
        GameState.heroes.push(heroWith('h1', 'Aela', 1));
        EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, { heroId: 'h1', name: 'Aela' });
        EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: 'bank_tabs', rank: 1 });
        const all = Banners.getAll();
        expect(all.map(b => [b.kind, b.tone])).toEqual([
            ['upgrade', 'milestone'], ['hero', 'milestone']
        ]);
        expect(all[1].sprite).toEqual({ kind: 'src', src: '/assets/heroes/hn_bard_por.png' });
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

    it('a hero who fled under Valiant gets a Fled banner, saying nothing was lost', () => {
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h1', heroName: 'Aela', lost: [], fled: true });
        const all = Banners.getAll();
        expect(all.map(b => [b.kind, b.tone])).toEqual([['fled', 'problem']]);
        expect(all[0].title).toBe('Fled!');
        expect(all[0].line).toBe('Aela fled the fight and went home to heal. Nothing was lost.');
    });

    it('time away: a hero who only fled is told as Fled, one also Defeated as Defeated', () => {
        const collector = startNewsCollector();
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h1', heroName: 'Aela', lost: [], fled: true });
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h1', heroName: 'Aela', lost: [], fled: true });
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h2', heroName: 'Bram', lost: [], fled: true });
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h2', heroName: 'Bram', lost: ['Iron Sword'] });
        const news = collector.stop();
        expect(news.knockouts).toEqual([
            { heroId: 'h1', heroName: 'Aela', times: 2, fled: 2, lost: [] },
            { heroId: 'h2', heroName: 'Bram', times: 2, fled: 1, lost: ['Iron Sword'] }
        ]);
        Banners.reset();
        deliverCatchUpNews(news);
        const kinds = Banners.getAll().map(b => [b.kind, b.line]);
        expect(kinds).toContainEqual(['fled', 'Aela fled the fight and went home to heal. Nothing was lost.']);
        expect(kinds).toContainEqual(['knockout', 'Bram was carried home, injured. Lost: Iron Sword.']);
    });

    it('time away with no summary: a mastery rank reached is told by its banner, the highest rank of a kind once', () => {
        const collector = startNewsCollector();
        EventBus.publish(ENGINE_EVENTS.MASTERY_RANK_UP, { kind: 'k_vein', kindName: 'Copper Vein', rank: 1, ranks: 3, effectId: null, scale: 1 });
        EventBus.publish(ENGINE_EVENTS.MASTERY_RANK_UP, { kind: 'k_vein', kindName: 'Copper Vein', rank: 2, ranks: 3, effectId: null, scale: 1 });
        const news = collector.stop();
        expect(news.mastery).toEqual([{ kind: 'k_vein', kindName: 'Copper Vein', rank: 2, ranks: 3, effectId: null, scale: 1 }]);
        Banners.reset();
        deliverCatchUpNews(news);
        const all = Banners.getAll().map(b => [b.kind, b.line]);
        expect(all).toEqual([['mastery', 'Copper Vein mastery II']]);
    });

    it('a banner coming on screen plays a chime, or a warning tone for a problem', () => {
        const clips = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (p) => clips.push(p.clip));
        EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, { heroId: 'h9', name: 'Cara' });
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h9', heroName: 'Cara', lost: [] });
        off();
        expect(clips).toEqual(['quest_claim', 'invasion']);
    });

    it('a banner sound takes no number from the game\'s random draws, and the chimes still vary', () => {
        // A catch-up raises no banner: a sound that drew a number would leave live play and a
        // catch-up of the same hour with different random numbers.
        vi.stubGlobal('Audio', class { play() { return Promise.resolve(); } pause() {} });
        const files = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (d) => {
            AudioSystem.playSfx(d.clip, d.options);                 // as AudioSystem.init hears it
            files.push(AudioSystem._getSfxPath(d.clip, d.options?.variant));
        });
        const random = vi.spyOn(Math, 'random');
        try {
            for (const [heroId, name] of [['h1', 'Aela'], ['h2', 'Bram'], ['h3', 'Cara']]) {
                EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, { heroId, name });
            }
            EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h1', heroName: 'Aela', lost: [] });
            expect(Banners.getAll()).toHaveLength(4);
            expect(random).not.toHaveBeenCalled();
            expect(new Set(files.slice(0, 3)).size).toBe(3);
        } finally {
            random.mockRestore();
            off();
            vi.unstubAllGlobals();
        }
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

    it('a refused equip is said over the hero on the hero bar, not as a callout', () => {
        const said = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => said.push(p.text));
        const engine = { EquipmentManager: { equipItem: () => ({ success: false, error: 'No free slot in the loadout' }) } };
        expect(equipOrAnnounce(engine.EquipmentManager, 'h1', 'item_sword')).toBe(false);
        off();
        expect(said).toEqual([]);
        expect(equipBubbleOf('h1').text).toMatch(/No free slot in the loadout\.$/);
        clearEquipBubbles();
        expect(toasts).toEqual([]);
    });
});

describe('after time away: the catch-up\'s news, handed over', () => {
    /** A catch-up's news as `CatchUp.run` hands it over (`summary.news`). */
    const news = (extra = {}) => ({
        recipes: [{ heroId: 'h1', heroName: 'Aela', skillId: 'cooking', recipes: [
            { id: 'r_cider', name: 'Cider', itemId: 'item_cider' },
            { id: 'r_pie', name: 'Apple Pie', itemId: 'item_pie' },
            { id: 'r_stew', name: 'Stew', itemId: 'item_stew' }
        ] }],
        finds: [{ itemId: 'item_copper', count: 4 }],
        bankFull: ['item_oak'],
        knockouts: [{ heroId: 'h2', heroName: 'Bram', times: 1, lost: ['Copper Sword'] }],
        ...extra
    });
    const finished = (n, show) => EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, {
        show, awayMs: show ? 3_600_000 : 60_000, summary: { news: n }
    });
    const closed = () => EventBus.publish(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED);
    const kinds = () => Banners.getAll().map(b => b.kind);
    /** No slot for a kind the Bank does not hold yet. */
    const bankFull = () => { GameState.inventory.maxSlots = 0; };
    const onMat = (...itemIds) => {
        GameState.state.board.sprites = itemIds.map((refId, i) => ({ id: `sp${i}`, kind: 'item', refId, quantity: 3, x: 10, y: 10 }));
    };

    it('⭐ told once: closing the summary raises no recipe or knock-out again, only a problem still standing', () => {
        bankFull();
        // item_oak still waits on the mat; item_stone, refused while away, no longer lies there.
        onMat('item_oak');
        finished(news({ bankFull: ['item_oak', 'item_stone'] }), true);
        expect(Banners.getAll()).toEqual([]);
        expect(ItemStubs.getStub('item_copper')).toBeNull();

        closed();
        expect(kinds()).toEqual(['bankFull']);
        const [full] = Banners.getAll();
        expect(full.line).toBe('item_oak waits on the mat until the Bank has room');
        // A first find's stub marks the item, it is not a banner.
        const stub = ItemStubs.getStub('item_copper');
        expect(stub.isNew).toBe(true);
        expect(ItemStubs.netOf(stub)).toBe(4);
        expect(toasts).toEqual([]);

        // Said once: closing again raises nothing more.
        closed();
        expect(Banners.getAll()).toHaveLength(1);
    });

    it('judged on the game at close, not on the summary: a Bank with room by then raises nothing', () => {
        onMat('item_oak');
        finished(news(), true);
        closed();
        expect(Banners.getAll()).toEqual([]);
    });

    it('a pile the Bank refuses at close is said even when the summary had no row for it; a full stack too', () => {
        bankFull();
        GameState.inventory.items.item_flint = { quantity: DEFAULT_MAX_STACK };
        onMat('item_oak', 'item_flint', 'item_oak');
        finished(news({ bankFull: [], recipes: [], knockouts: [], finds: [] }), true);
        closed();
        expect(Banners.getAll().map(b => [b.kind, b.parts.itemIds])).toEqual([
            ['stackFull', ['item_flint']], ['bankFull', ['item_oak']]
        ]);
    });

    it('a short catch-up with no summary raises them at once', () => {
        bankFull();
        finished(news(), false);
        expect(kinds().sort()).toEqual(['bankFull', 'knockout', 'recipe']);
        expect(ItemStubs.getStub('item_copper').isNew).toBe(true);
    });

    it('each comes on screen with its sound, as a live banner does', () => {
        bankFull();
        const sounds = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (p) => sounds.push(p.clip));
        try {
            finished(news(), false);
        } finally {
            off();
        }
        expect(sounds).toEqual([BANNER_SOUND.milestone, BANNER_SOUND.problem, BANNER_SOUND.problem]);
    });

    it('⭐ two heroes knocked out in a short absence share one banner that says what each lost', () => {
        finished(news({
            recipes: [],
            knockouts: [
                { heroId: 'h0', heroName: 'Aela', times: 1, lost: ['Iron Sword'] },
                { heroId: 'h1', heroName: 'Bram', times: 1, lost: ['3 Shrimp'] }
            ],
            bankFull: [],
            finds: []
        }), false);
        const knockouts = Banners.getAll().filter(b => b.kind === 'knockout');
        expect(knockouts).toHaveLength(1);
        expect(knockouts[0].line).toBe('Aela and Bram were defeated and carried home. Aela lost: Iron Sword. Bram lost: 3 Shrimp.');
    });

    it('a long absence with no summary stays merged: one banner per kind, and no wall of stubs', () => {
        bankFull();
        const heroes = ['Aela', 'Bram', 'Cara', 'Dov', 'Eli'];
        const finds = Array.from({ length: 15 }, (_, i) => ({ itemId: `item_find_${i}`, count: i + 1 }));
        finished(news({
            recipes: heroes.map((name, i) => ({ heroId: `h${i}`, heroName: name, skillId: 'cooking', recipes: [{ id: `r${i}`, name: `Dish ${i}`, itemId: 'item_pie' }] })),
            knockouts: heroes.map((name, i) => ({ heroId: `h${i}`, heroName: name, times: 3, lost: [] })),
            bankFull: ['item_oak', 'item_stone', 'item_copper_ore'],
            finds
        }), false);
        expect(kinds().sort()).toEqual(['bankFull', 'knockout', 'recipe']);
        expect(Banners.getAll().find(b => b.kind === 'recipe').line).toBe('Aela, Bram and 3 more unlocked 5 recipes: Dish 0, Dish 1, ...');
        expect(Banners.getAll().find(b => b.kind === 'knockout').line).toBe('Aela, Bram and 3 more were defeated and carried home. Nothing was lost.');
        ItemStubs.flush();
        expect(ItemStubs.getStubs()).toHaveLength(MAX_FIND_STUBS);
        expect(ItemStubs.getStubs().every(s => s.isNew)).toBe(true);
    });

    it('two catch-ups before the summary closes: both finds handed over, no recipe replayed', () => {
        finished(news({ bankFull: [], knockouts: [] }), true);
        finished(news({
            recipes: [{ heroId: 'h2', heroName: 'Bram', skillId: 'smithing', recipes: [{ id: 'r_bar', name: 'Copper Bar', itemId: 'item_copper_bar' }] }],
            bankFull: [], knockouts: [], finds: [{ itemId: 'item_tin', count: 2 }]
        }), true);
        closed();
        expect(kinds()).toEqual([]);
        expect(ItemStubs.getStub('item_copper').isNew).toBe(true);
        expect(ItemStubs.getStub('item_tin').isNew).toBe(true);
    });

    it('a load before the summary closes forgets it (a new game too)', () => {
        finished(news(), true);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
        closed();
        expect(Banners.getAll()).toEqual([]);
        expect(ItemStubs.getStub('item_copper')).toBeNull();

        finished(news(), true);
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'new_game' });
        closed();
        expect(Banners.getAll()).toEqual([]);
    });

    it('a pinned stub counts the time away: the catch-up\'s gained and spent, kept in the save at once', () => {
        GameState.state.ui.pinnedStubs = [{ itemId: 'item_oak', added: 40, removed: 0 }];
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_stone', added: 3 });
        const items = { gained: { item_oak: 300, item_stone: 50 }, spent: { item_oak: 120 }, net: {}, floor: {} };
        // With a summary on screen too: the count is not held back until it closes.
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: true, summary: { items, news: null } });
        expect(GameState.state.ui.pinnedStubs).toEqual([{ itemId: 'item_oak', added: 340, removed: 120 }]);
        expect(ItemStubs.netOf(ItemStubs.getStub('item_oak'))).toBe(220);
        // Unpinned stubs stay quiet after time away: the summary speaks for them.
        expect(ItemStubs.netOf(ItemStubs.getStub('item_stone'))).toBe(3);
        // Closing the summary counts nothing again.
        closed();
        expect(GameState.state.ui.pinnedStubs).toEqual([{ itemId: 'item_oak', added: 340, removed: 120 }]);

        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: false, summary: { items: { gained: { item_oak: 2 }, spent: {} }, news: null } });
        expect(GameState.state.ui.pinnedStubs).toEqual([{ itemId: 'item_oak', added: 342, removed: 120 }]);
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: false, summary: null });
        expect(GameState.state.ui.pinnedStubs).toEqual([{ itemId: 'item_oak', added: 342, removed: 120 }]);
    });

    it('a catch-up with nothing to say raises nothing', () => {
        finished({ recipes: [], finds: [], bankFull: [], knockouts: [] }, false);
        finished(null, false);
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: false, summary: null });
        closed();
        expect(Banners.getAll()).toEqual([]);
        expect(ItemStubs.getStubs()).toEqual([]);
    });
});

describe('a place settled is a gold banner', () => {
    it('settling a new place raises it with the place\'s name; the first camp of a new game says nothing', () => {
        Atlas.createStarterRegion();
        expect(Banners.getAll()).toEqual([]);

        const { region } = Atlas.createRegion({ seed: 7, ground: { main: 'forest' } });
        const [banner] = Banners.getAll();
        expect(banner.kind).toBe('settled');
        expect(banner.tone).toBe('milestone');
        expect(banner.title).toBe('New place settled!');
        expect(banner.line).toBe(`The guild settled ${region.flavourName}`);
        expect(banner.sprite).toEqual({ kind: 'area', id: expect.any(String) });
        expect(Banners.getAll()).toHaveLength(1);
    });

    it('travel, renames and the rest of the Atlas\'s news say nothing', () => {
        Atlas.createStarterRegion();
        for (const reason of ['travelled', 'renamed']) {
            EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason, regionId: Atlas.activeRegion()?.id });
        }
        expect(Banners.getAll()).toEqual([]);
    });
});

describe('⭐ no room is said in one banner, the waits named in it', () => {
    it('names the waiting station, then folds a second wait and the arrival into the same banner', () => {
        EventBus.publish(BOARD_EVENTS.NO_ROOM_WAIT, { key: 'tok_s', source: 'station', instanceId: 'tok_s', typeId: 'token_smithy', name: 'Smithy' });
        let all = Banners.getAll();
        expect(all).toHaveLength(1);
        expect(all[0]).toMatchObject({ kind: 'noRoom', tone: 'problem', title: 'No Room!', line: 'No room beside the Smithy.' });
        expect(all[0].subjects).toEqual([{ type: 'token', id: 'tok_s' }]);

        EventBus.publish(BOARD_EVENTS.NO_ROOM_WAIT, { key: 'tok_q', source: 'spawner', instanceId: 'tok_q', typeId: 'token_quarry', name: 'Quarry' });
        EventBus.publish(BOARD_EVENTS.NO_ROOM_WAIT, { key: 'arrival', source: 'arrival', instanceId: null, typeId: null, name: null });
        all = Banners.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].line).toBe('No room beside the Smithy and the Quarry. No room for the enemies arriving here: they wait to land.');
        expect(toasts).toEqual([]);
    });

    it('says an event that found no room without naming a Token', () => {
        EventBus.publish(BOARD_EVENTS.NO_ROOM_WAIT, { key: 'event', source: 'event', instanceId: null, typeId: null, name: null });
        const [banner] = Banners.getAll();
        expect(banner.line).toBe('No room for an event to land: it tries again later.');
        expect(banner.subjects).toEqual([]);
    });
});

describe('⭐ a problem banner goes by itself once fixed; a milestone stays until clicked', () => {
    const refused = (itemId, reason) => EventBus.publish(ENGINE_EVENTS.BANK_FULL, { itemId, reason });

    it('Bank full goes once the Bank has a free slot', () => {
        GameState.inventory.maxSlots = 0;
        refused('item_oak', 'slots');
        refused('item_stone', 'slots');
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: 'h1', heroName: 'Aela', lost: [] });
        // A Bank change that frees nothing leaves it.
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
        expect(kinds()).toEqual(['knockout', 'bankFull']);

        GameState.inventory.maxSlots = 64;
        EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId: 'bank_tabs', rank: 1 });
        expect(kinds()).not.toContain('bankFull');
        // The knock-out stays until clicked.
        expect(kinds()).toContain('knockout');
    });

    it('stack full names only the items still at the ceiling, and goes when none is', () => {
        GameState.inventory.items.item_flint = { quantity: DEFAULT_MAX_STACK };
        GameState.inventory.items.item_tin = { quantity: DEFAULT_MAX_STACK };
        refused('item_flint', 'stack');
        refused('item_tin', 'stack');
        expect(Banners.getAll()).toHaveLength(1);

        GameState.inventory.items.item_flint.quantity = DEFAULT_MAX_STACK - 5;
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_flint', removed: 5 });
        const [banner] = Banners.getAll();
        expect(banner.parts.itemIds).toEqual(['item_tin']);
        expect(banner.line).toBe('item_tin waits on the mat: the Bank holds no more of it');

        GameState.inventory.items.item_tin.quantity = 1;
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId: 'item_tin', removed: 5 });
        expect(Banners.getAll()).toEqual([]);
    });

    it('a cleared banner among others goes alone', () => {
        GameState.inventory.maxSlots = 0;
        refused('item_oak', 'slots');
        for (const [id, name] of [['h1', 'Aela'], ['h2', 'Bram'], ['h3', 'Cara']]) {
            GameState.heroes.push(heroWith(id, name, 1));
            EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, { heroId: id, name });
        }
        expect(Banners.getView().shown).toHaveLength(4);
        GameState.inventory.maxSlots = 64;
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
        expect(Banners.getView().shown).toHaveLength(3);
        expect(kinds()).not.toContain('bankFull');
    });

    it('a kept Bank-full banner a load brings back goes at once when the Bank has room now', () => {
        GameState.state.ui.banners = [
            { kind: 'bankFull', parts: { items: ['item_oak'], itemIds: ['item_oak'] }, sprite: null, subjects: [] },
            { kind: 'knockout', parts: { heroes: ['Aela'], lost: [] }, sprite: null, subjects: [] }
        ];
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
        expect(kinds()).toEqual(['knockout']);
    });

    it('clicking it still sends it away before it is fixed', () => {
        GameState.inventory.maxSlots = 0;
        refused('item_oak', 'slots');
        Banners.dismiss(Banners.getAll()[0].id);
        expect(Banners.getAll()).toEqual([]);
    });

    const kinds = () => Banners.getAll().map(b => b.kind);
});
